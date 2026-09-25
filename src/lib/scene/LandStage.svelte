<!-- src/lib/scene/LandStage.svelte -->
<script lang="ts">
	/**
	 * LandStage — the Manhattan tab's live stage: every tax lot and building
	 * on the island (NYC Open Data, built by scripts/build-manhattan.ts) at
	 * true scale, with the land a sum of bitcoin buys filled in orange —
	 * whole lots in order from the Battery north (their buildings too), then
	 * the southern slice of the part-owned last lot. A sum smaller than a lot
	 * is a true-size square patch on open ground at the Battery, with Sat
	 * standing on its edge. Valuation in ../manhattan.ts.
	 *
	 * Owned lots and buildings are always a prefix of their index buffers
	 * (manhattanGeometry.ts), so owned and unowned are two draw ranges over
	 * the same GPU buffers: changing the amount moves a split point, nothing
	 * is rebuilt. The meshes are built in a Web Worker.
	 */
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type * as THREE from 'three';
	import earcut from 'earcut';
	import map from '../manhattan-map.json';
	import { cumulativeAreas, lotsFor, PATCH_MAX_M2 } from '../manhattan.js';
	import { southernSlice, fitDistance } from './landPatch.js';
	import type { ManhattanBuffers } from './manhattanGeometry.js';

	let {
		areaM2 = 0,
		frameM2,
		staged = $bindable(false),
		ready = $bindable(false),
	}: {
		/** Land bought, m² (btc × price ÷ $/m², see manhattan.ts). */
		areaM2?: number;
		/** Frame the camera as if this much were bought (the video clips); defaults to areaM2. */
		frameM2?: number;
		staged?: boolean;
		ready?: boolean;
	} = $props();

	const BG = 0x18181b;
	const ORANGE = 0xf7931a;

	let containerEl: HTMLDivElement | undefined = $state();
	let loading = $state(true);
	let failed = $state(false);
	let noWebGL = $state(false);

	let T: typeof THREE | null = null;
	let renderer: THREE.WebGLRenderer | null = null;
	let scene: THREE.Scene | null = null;
	let camera: THREE.PerspectiveCamera | null = null;
	let dog: THREE.Object3D | null = null;
	let mixer: THREE.AnimationMixer | null = null;
	let worker: Worker | null = null;
	const disposables: { dispose(): void }[] = [];

	let buffers: ManhattanBuffers | null = null;
	let lotRings: { polyStart: Uint32Array; ringStart: Uint32Array; coords: Int16Array } | null = null;
	let cum: Float64Array | null = null;
	// Owned / unowned draw ranges.
	let lotsOwned: THREE.Mesh | null = null;
	let lotsRest: THREE.Mesh | null = null;
	let bldOwned: THREE.Mesh | null = null;
	let bldRest: THREE.Mesh | null = null;
	let slice: THREE.Mesh | null = null;
	let patch: THREE.Mesh | null = null;

	let width = 1;
	let height = 1;
	let destroyed = false;
	let rafId = 0;
	let running = false;
	let last = 0;
	let prefersReduced = false;
	let framedOnce = false;
	let dogResolved = false;
	let renderedOnce = false;
	let camPos: THREE.Vector3 | null = null;
	let camAim: THREE.Vector3 | null = null;
	let wantPos: THREE.Vector3 | null = null;
	let wantAim: THREE.Vector3 | null = null;
	let resizeObs: ResizeObserver | null = null;

	const q = map.projection.metresPerUnit;
	const PX = map.patch.x;
	const PY = map.patch.y;

	function hasWebGL(): boolean {
		try {
			const c = document.createElement('canvas');
			return !!(c.getContext('webgl2') || c.getContext('webgl'));
		} catch {
			return false;
		}
	}

	function updateReady(): void {
		ready = renderedOnce && dogResolved;
	}

	/** Two meshes over one set of buffers: [0, split) and [split, end). */
	function splitMeshes(
		three: typeof THREE,
		mesh: { positions: Float32Array; index: Uint32Array; shade?: Uint8Array },
		owned: THREE.Material,
		rest: THREE.Material
	): [THREE.Mesh, THREE.Mesh] {
		const pos = new three.BufferAttribute(mesh.positions, 3);
		const idx = new three.BufferAttribute(mesh.index, 1);
		let col: THREE.BufferAttribute | null = null;
		if (mesh.shade) {
			const rgb = new Uint8Array(mesh.shade.length * 3);
			for (let i = 0; i < mesh.shade.length; i++) rgb[i * 3] = rgb[i * 3 + 1] = rgb[i * 3 + 2] = mesh.shade[i];
			col = new three.BufferAttribute(rgb, 3, true);
		}
		const make = (mat: THREE.Material) => {
			const g = new three.BufferGeometry();
			g.setAttribute('position', pos);
			if (col) g.setAttribute('color', col);
			g.setIndex(idx);
			g.computeBoundingSphere();
			disposables.push(g);
			const m = new three.Mesh(g, mat);
			m.frustumCulled = false;
			return m;
		};
		return [make(owned), make(rest)];
	}

	function flatMesh(three: typeof THREE, mesh: { positions: Float32Array; index: Uint32Array }, mat: THREE.Material): THREE.Mesh {
		const g = new three.BufferGeometry();
		g.setAttribute('position', new three.BufferAttribute(mesh.positions, 3));
		g.setIndex(new three.BufferAttribute(mesh.index, 1));
		disposables.push(g);
		const m = new three.Mesh(g, mat);
		m.frustumCulled = false;
		return m;
	}

	function buildScene(three: typeof THREE, b: ManhattanBuffers): void {
		if (!scene) return;
		const std = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
			// flatShading: normals from screen-space derivatives, so none of
			// these meshes needs a normal attribute (buildings share vertices
			// between walls and roofs; the flat layers are just positions).
			const m = new three.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0, flatShading: true, ...extra });
			disposables.push(m);
			return m;
		};
		// The rivers and harbour (flat, unlit: a lit plane this size catches
		// the sky and reads lighter than the land), then the island.
		const waterMat = new three.MeshBasicMaterial({ color: 0x0a1018 });
		disposables.push(waterMat);
		const water = new three.Mesh(new three.PlaneGeometry(90000, 90000).rotateX(-Math.PI / 2), waterMat);
		water.position.y = -1.5;
		disposables.push(water.geometry);
		scene.add(water);
		scene.add(flatMesh(three, b.land, std(0x414148)));
		scene.add(flatMesh(three, b.parks, std(0x4f7a55)));

		const lotOwnedMat = std(ORANGE, { emissive: new three.Color(ORANGE), emissiveIntensity: 0.18 });
		const lotRestMat = std(0x5a5a62);
		[lotsOwned, lotsRest] = splitMeshes(three, b.lots, lotOwnedMat, lotRestMat);
		scene.add(lotsOwned, lotsRest);

		const bldOwnedMat = std(0xffa640, { vertexColors: true, flatShading: true, roughness: 0.7 });
		const bldRestMat = std(0xc9cad1, { vertexColors: true, flatShading: true, roughness: 0.85 });
		[bldOwned, bldRest] = splitMeshes(three, b.buildings, bldOwnedMat, bldRestMat);
		scene.add(bldOwned, bldRest);

		// The part-owned lot's slice and the small-sum patch draw over
		// everything (a map overlay), so a building on the lot can't hide them.
		const overlay = new three.MeshBasicMaterial({
			color: ORANGE,
			transparent: true,
			opacity: 0.9,
			depthTest: false,
			toneMapped: false,
		});
		disposables.push(overlay);
		slice = new three.Mesh(new three.BufferGeometry(), overlay);
		slice.renderOrder = 5;
		slice.frustumCulled = false;
		patch = new three.Mesh(new three.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), overlay);
		patch.renderOrder = 5;
		disposables.push(slice.geometry, patch.geometry);
		scene.add(slice, patch);
	}

	/** The owned slice of lot `k` (map frame → scene), as a flat mesh. */
	function setSlice(three: typeof THREE, k: number, fraction: number): void {
		if (!slice || !lotRings) return;
		slice.geometry.dispose();
		const g = new three.BufferGeometry();
		slice.geometry = g;
		if (fraction <= 0) return;
		const r0 = lotRings.polyStart[k];
		const r1 = lotRings.polyStart[k + 1];
		const rings: [number, number][][] = [];
		for (let r = r0; r < r1; r++) {
			const ring: [number, number][] = [];
			for (let v = lotRings.ringStart[r]; v < lotRings.ringStart[r + 1]; v++)
				ring.push([lotRings.coords[v * 2] * q, lotRings.coords[v * 2 + 1] * q]);
			rings.push(ring);
		}
		const cut = southernSlice(rings, fraction);
		if (!cut.length) return;
		const flat: number[] = [];
		const holes: number[] = [];
		cut.forEach((r, i) => {
			if (i) holes.push(flat.length / 2);
			for (const [x, y] of r) flat.push(x, y);
		});
		const tris = earcut(flat, holes.length ? holes : undefined);
		const pos = new Float32Array((flat.length / 2) * 3);
		for (let v = 0; v < flat.length / 2; v++) pos.set([flat[v * 2], 0.4, -flat[v * 2 + 1]], v * 3);
		g.setAttribute('position', new three.BufferAttribute(pos, 3));
		g.setIndex(tris);
	}

	/** Apply `area`: move the owned/unowned splits, place slice or patch, reframe. */
	function refresh(area: number, view: number = frameM2 ?? area): void {
		const three = T;
		if (!three || !buffers || !cum || !lotsOwned || !lotsRest || !bldOwned || !bldRest || !patch || !slice) return;
		const n = buffers.lotArea.length;
		const small = area < PATCH_MAX_M2;
		const fill = small ? { whole: 0, fraction: 0, spare: 0 } : lotsFor(area, cum);
		const k = fill.whole;
		const li = buffers.lotIndexStart;
		const bi = buffers.bldIndexByLot;
		lotsOwned.geometry.setDrawRange(0, li[k]);
		lotsRest.geometry.setDrawRange(li[k], li[n] - li[k]);
		bldOwned.geometry.setDrawRange(0, bi[k]);
		bldRest.geometry.setDrawRange(bi[k], buffers.buildings.index.length - bi[k]);
		setSlice(three, Math.min(k, n - 1), k < n ? fill.fraction : 0);

		patch.visible = small && area > 0;
		const side = Math.sqrt(Math.max(area, 1e-4));
		patch.scale.set(side, 1, side);
		patch.position.set(PX, 0.45, -PY);

		// Sat stands at the patch's east edge, facing it.
		if (dog) {
			dog.visible = small || area < 20000;
			dog.position.set(PX + side / 2 + 0.45, 0.15, -PY);
			dog.rotation.y = -Math.PI / 2;
		}
		if (view === area) reframe(area, small, k, fill.fraction);
		else {
			const vSmall = view < PATCH_MAX_M2;
			const v = vSmall ? { whole: 0, fraction: 0 } : lotsFor(view, cum);
			reframe(view, vSmall, v.whole, v.fraction);
		}
		render();
		renderedOnce = true;
		updateReady();
	}

	/** Frame the owned land (or the patch and Sat) with the island around it. */
	function reframe(area: number, small: boolean, k: number, fraction: number): void {
		if (!T || !camera || !camPos || !camAim || !wantPos || !wantAim || !buffers) return;
		const aspect = height > 0 ? width / height : 1;
		const narrow = aspect < 1.1;
		// Plan box (map frame) and height of what's owned.
		let x0: number, y0: number, x1: number, y1: number, h: number;
		if (small) {
			// Enough ground around a doormat to see where it is.
			const s = Math.max(Math.sqrt(area) / 2 + 1, 3.2);
			[x0, y0, x1, y1, h] = [PX - s, PY - s, PX + s + 0.6, PY + s, 0.6];
		} else {
			const j = Math.min(k + (fraction > 0 ? 1 : 0), buffers.lotArea.length) - 1;
			const b = buffers.prefixBounds;
			[x0, y0, x1, y1] = [b[j * 4], b[j * 4 + 1], b[j * 4 + 2], b[j * 4 + 3]];
			h = buffers.prefixMaxHeight[j];
		}
		const span = Math.max(x1 - x0, y1 - y0);
		// Look down more on small plots, flatter across a whole island. Small
		// and middling plots are seen from the harbour (south-west — Lower
		// Manhattan's towers behind the land, not in front of it); as the land
		// runs up the island a wide stage swings round to the east side, so the
		// island lies left to right with the Battery on the left. A narrow
		// stage stays looking up the island from the south.
		const t = Math.min(1, Math.max(0, (Math.log10(Math.max(span, 1)) - 1) / 3.3));
		const elev = ((small ? 34 : 50 - 10 * t) * Math.PI) / 180;
		const side = narrow ? 0 : Math.min(1, Math.max(0, (Math.log10(Math.max(span, 1)) - 2.8) / 0.8));
		const azHarbour = Math.atan2(-0.55, 1); // from the south-west
		const azEast = Math.atan2(1, 0.3);
		const az = azHarbour + (azEast - azHarbour) * side;
		const back: [number, number, number] = [
			Math.sin(az) * Math.cos(elev),
			Math.sin(elev),
			Math.cos(az) * Math.cos(elev),
		];
		const right: [number, number, number] = [Math.cos(az), 0, -Math.sin(az)];
		const up: [number, number, number] = [
			-Math.sin(az) * Math.sin(elev),
			Math.cos(elev),
			-Math.cos(az) * Math.sin(elev),
		];
		const cx = (x0 + x1) / 2;
		const cz = -(y0 + y1) / 2;
		const corners: [number, number, number][] = [];
		for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [0, h]) corners.push([x - cx, z - h * 0.35, -y - cz]);
		const dist = fitDistance(corners, back, right, up, (35 * Math.PI) / 180, aspect, small ? 1.25 : 1.1);
		wantAim.set(cx, h * 0.35, cz);
		wantPos.set(cx + back[0] * dist, h * 0.35 + back[1] * dist, cz + back[2] * dist);
		if (prefersReduced || !framedOnce) {
			camPos.copy(wantPos);
			camAim.copy(wantAim);
		}
		framedOnce = true;
		applyCamera();
	}

	function applyCamera(): void {
		if (!camera || !camPos || !camAim) return;
		camera.position.copy(camPos);
		camera.lookAt(camAim);
		const d = camPos.distanceTo(camAim);
		camera.near = Math.max(d / 400, 0.02);
		camera.far = d * 20 + 40000;
		camera.updateProjectionMatrix();
	}

	function render(): void {
		if (renderer && scene && camera) renderer.render(scene, camera);
	}

	function loop(): void {
		if (!running || destroyed || !camPos || !camAim || !wantPos || !wantAim) return;
		rafId = requestAnimationFrame(loop);
		const now = performance.now();
		const dt = Math.min((now - last) / 1000 || 0, 0.05);
		last = now;
		// Distance eases in log space, so a jump from a doormat to the whole
		// island is a pull-back, not a lurch.
		const k = 1 - Math.exp(-dt * 3.2);
		const d0 = camPos.distanceTo(camAim);
		const d1 = wantPos.distanceTo(wantAim);
		camAim.lerp(wantAim, k);
		const dir = camPos.clone().sub(camAim).normalize().lerp(wantPos.clone().sub(wantAim).normalize(), k).normalize();
		const d = Math.exp(Math.log(Math.max(d0, 1e-3)) + (Math.log(Math.max(d1, 1e-3)) - Math.log(Math.max(d0, 1e-3))) * k);
		camPos.copy(camAim).addScaledVector(dir, d);
		applyCamera();
		mixer?.update(dt);
		render();
	}

	async function hydrate(): Promise<void> {
		if (destroyed || !containerEl) return;
		const [three, gltfMod, moMod, materials, maths] = await Promise.all([
			import('three'),
			import('three/addons/loaders/GLTFLoader.js'),
			import('three/addons/libs/meshopt_decoder.module.js'),
			import('./materials.js'),
			import('./maths.js'),
		]);
		const { loadNormalizedModel } = await import('./loadNormalizedModel.js');
		if (destroyed || !containerEl) return;
		T = three;

		width = containerEl.clientWidth || 1;
		height = containerEl.clientHeight || 1;
		renderer = new three.WebGLRenderer({ antialias: true, alpha: false, logarithmicDepthBuffer: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(width, height);
		renderer.toneMapping = three.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 1.1;
		renderer.domElement.className = 'stage-canvas';
		renderer.domElement.setAttribute('aria-hidden', 'true');
		containerEl.appendChild(renderer.domElement);

		scene = new three.Scene();
		scene.background = new three.Color(BG);
		const env = materials.makeEnvironmentTexture(renderer);
		disposables.push(env);
		scene.environment = env;
		scene.environmentIntensity = 0.55;
		const sun = new three.DirectionalLight(0xfff0dc, 2.4);
		sun.position.set(-0.45, 0.8, 0.4);
		scene.add(sun, new three.HemisphereLight(0xcfdcff, 0x1a1a1d, 0.7));

		camera = new three.PerspectiveCamera(maths.FOV_DEG, width / height, 0.05, 100000);
		camPos = new three.Vector3(PX + 3, 2, -PY + 3);
		camAim = new three.Vector3(PX, 0, -PY);
		wantPos = new three.Vector3();
		wantAim = new three.Vector3();

		resizeObs = new ResizeObserver(() => {
			if (!containerEl || !renderer || !camera) return;
			width = containerEl.clientWidth || 1;
			height = containerEl.clientHeight || 1;
			camera.aspect = width / height;
			renderer.setSize(width, height);
			refresh(areaM2);
		});
		resizeObs.observe(containerEl);

		// The map, built off the main thread.
		worker = new Worker(new URL('./manhattanWorker.ts', import.meta.url), { type: 'module' });
		worker.onmessage = (e) => {
			worker?.terminate();
			worker = null;
			if (destroyed || !scene) return;
			if (!e.data.ok) {
				failed = true;
				loading = false;
				ready = true;
				return;
			}
			buffers = e.data.buffers as ManhattanBuffers;
			lotRings = e.data.lotRings;
			cum = cumulativeAreas(buffers.lotArea);
			buildScene(three, buffers);
			loading = false;
			refresh(areaM2);
			if (!prefersReduced) {
				running = true;
				last = performance.now();
				rafId = requestAnimationFrame(loop);
			}
		};
		worker.postMessage({ url: '/data/manhattan.bin' });

		loadNormalizedModel(
			three,
			gltfMod.GLTFLoader,
			moMod.MeshoptDecoder,
			'/models/references/shiba_inu/shiba.glb',
			maths.DOG_TOTAL_HEIGHT_M,
			'y',
			(object, animations) => {
				if (destroyed || !scene) return;
				dog = object;
				scene.add(dog);
				if (animations.length) {
					mixer = new three.AnimationMixer(dog);
					const idle = animations.find((c) => c.name.includes('sitting')) ?? animations[animations.length - 1];
					mixer.clipAction(idle).play();
					if (prefersReduced) mixer.update(0);
				}
				dogResolved = true;
				refresh(areaM2);
			},
			() => {
				dogResolved = true;
				updateReady();
			}
		);
	}

	function teardown(): void {
		running = false;
		cancelAnimationFrame(rafId);
		resizeObs?.disconnect();
		worker?.terminate();
		worker = null;
		mixer?.stopAllAction();
		for (const d of disposables) d.dispose();
		disposables.length = 0;
		slice?.geometry.dispose();
		if (renderer) {
			renderer.domElement.remove();
			renderer.dispose();
		}
		renderer = scene = camera = null;
		lotsOwned = lotsRest = bldOwned = bldRest = slice = patch = null;
		buffers = null;
		lotRings = null;
		cum = null;
		dog = mixer = null;
		staged = false;
		ready = false;
	}

	onMount(() => {
		if (!browser) return;
		prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (!hasWebGL()) {
			noWebGL = true;
			loading = false;
			ready = true;
			return;
		}
		void hydrate();
		return () => {
			destroyed = true;
			teardown();
		};
	});

	$effect(() => {
		const a = areaM2;
		const v = frameM2;
		if (!buffers) return;
		refresh(a, v ?? a);
	});
</script>

<div class="land-stage" bind:this={containerEl}>
	{#if loading}
		<div class="land-note">Loading Manhattan — 45,000 buildings…</div>
	{:else if failed || noWebGL}
		<div class="land-note">The 3-D map of Manhattan couldn't load here; the figures below still hold.</div>
	{/if}
	<div class="land-credit">Map: NYC Open Data (DOF, DCP, OTI)</div>
</div>

<style>
	.land-stage {
		position: relative;
		width: 100%;
		height: clamp(340px, 56vh, 520px);
		overflow: hidden;
		border-radius: 8px;
		background: #18181b;
	}
	.land-stage :global(canvas.stage-canvas) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
	}
	.land-note {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 16px;
		text-align: center;
		font: 500 13px/1.4 'Inter Tight', system-ui, sans-serif;
		color: #a1a1aa;
		z-index: 1;
	}
	.land-credit {
		position: absolute;
		right: 10px;
		bottom: 8px;
		z-index: 1;
		font: 500 10px/1.2 'JetBrains Mono', ui-monospace, monospace;
		color: rgba(161, 161, 170, 0.75);
		pointer-events: none;
	}
</style>
