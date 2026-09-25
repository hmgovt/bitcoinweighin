<!-- src/lib/scene/CocaineStage.svelte -->
<script lang="ts">
	/**
	 * CocaineStage — the Cocaine tab's live WebGL stage, sibling to
	 * LiveStage and BillStage. What a mass of cocaine actually looks like, at
	 * true scale beside Sat:
	 *
	 *   < 1 g          lines chopped out on a mirror, a razor blade alongside
	 *   1 g – 1 kg     1 g zip-lock baggies, dropped into a heap
	 *   1 kg – 1 t     taped, stamped 1 kg bricks — a row, then a stack
	 *   ≥ 1 t          shrink-wrapped pallets of 1,000 bricks; past 120,
	 *                  one warehouse block of them at true count
	 *
	 * Sizes and placements are pure and tested (src/lib/cocaine-scene.ts);
	 * the things are built procedurally (scene/cocaineProps.ts). The camera
	 * looks down on flat things (a line is under half a millimetre tall) and
	 * flattens as the load grows; Sat stands just off the load, moving to
	 * the foreground once it dwarfs him — the metal stage's foreground mark
	 * (`M.dogGroundMark`). Without WebGL, the old inline-SVG diagram stands in.
	 */
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type * as THREE from 'three';
	import CocaineBrickStack from '$lib/components/CocaineBrickStack.svelte';
	import {
		countFor,
		layoutLines,
		layoutBags,
		layoutBricks,
		layoutPallets,
		stageCamera,
		dogBeside,
		shotBounds,
		groundMark,
		lineHeightM,
		hash01,
		LINE,
		PALLET,
		PALLET_LOAD_M,
		type Count,
		type Extent,
		type StageTier,
	} from '$lib/cocaine-scene.js';
	import { formatCount } from '$lib/components/CocaineBrickStack.helpers.js';

	let {
		massGrams = 0,
		staged = $bindable(false),
		ready = $bindable(false),
	}: {
		massGrams?: number;
		/** True when Sat has walked to the foreground (readout honesty line). */
		staged?: boolean;
		/** True once a frame has rendered and the dog has resolved (the X-bot's gate). */
		ready?: boolean;
	} = $props();

	const BG = 0x18181b;

	let containerEl: HTMLDivElement | undefined = $state();
	let noWebGL = $state(false);
	let canvasActive = $state(false);

	let T: typeof THREE | null = null;
	let P: typeof import('./cocaineProps.js') | null = null;
	let M: typeof import('./maths.js') | null = null;
	let mats: import('./cocaineProps.js').CocaineMaterials | null = null;
	let renderer: THREE.WebGLRenderer | null = null;
	let scene: THREE.Scene | null = null;
	let camera: THREE.PerspectiveCamera | null = null;
	let key: THREE.DirectionalLight | null = null;
	let envTexture: THREE.Texture | null = null;
	let groundGeometry: THREE.BufferGeometry | null = null;
	let groundMaterial: THREE.Material | null = null;
	let group: THREE.Group | null = null;
	let dog: THREE.Object3D | null = null;
	let mixer: THREE.AnimationMixer | null = null;

	let camPos: THREE.Vector3 | null = null;
	let camAim: THREE.Vector3 | null = null;
	let wantPos: THREE.Vector3 | null = null;
	let wantAim: THREE.Vector3 | null = null;
	let framedOnce = false;
	let extent: Extent = { w: 0.2, d: 0.12, h: 0.004 };
	let tier: StageTier = 'lines';

	let width = 1;
	let height = 1;
	let destroyed = false;
	let prefersReduced = false;
	let rafId = 0;
	let running = false;
	let last = 0;
	let resizeObs: ResizeObserver | null = null;
	let renderedOnce = false;
	let dogResolved = false;

	function hasWebGL(): boolean {
		try {
			const c = document.createElement('canvas');
			return !!(c.getContext('webgl2') || c.getContext('webgl'));
		} catch {
			return false;
		}
	}

	// ── Build a tier ────────────────────────────────────────────
	/** Geometries and per-build materials this group alone owns. */
	let owned: { geoms: THREE.BufferGeometry[]; mats: THREE.Material[]; texs: THREE.Texture[] } = {
		geoms: [],
		mats: [],
		texs: [],
	};

	function clearGroup(): void {
		if (group && scene) scene.remove(group);
		for (const g of owned.geoms) g.dispose();
		for (const m of owned.mats) m.dispose();
		for (const t of owned.texs) t.dispose();
		owned = { geoms: [], mats: [], texs: [] };
		group = null;
	}

	function own<G extends THREE.BufferGeometry>(g: G): G {
		owned.geoms.push(g);
		return g;
	}

	function instanced(geom: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], placed: { x: number; y: number; z: number; rotY: number; tiltX?: number; tiltZ?: number }[]): THREE.InstancedMesh {
		const three = T!;
		const mesh = new three.InstancedMesh(geom, mat, Math.max(1, placed.length));
		const m = new three.Matrix4();
		const q = new three.Quaternion();
		const e = new three.Euler();
		const s = new three.Vector3(1, 1, 1);
		const p = new three.Vector3();
		placed.forEach((pl, i) => {
			e.set(pl.tiltX ?? 0, pl.rotY, pl.tiltZ ?? 0);
			q.setFromEuler(e);
			p.set(pl.x, pl.y, pl.z);
			m.compose(p, q, s);
			mesh.setMatrixAt(i, m);
		});
		mesh.count = placed.length;
		mesh.instanceMatrix.needsUpdate = true;
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		return mesh;
	}

	function buildLines(c: Count): Extent {
		const three = T!;
		const { lines, mirror, blade } = layoutLines(c);
		const mg = P!.makeMirrorGeometries(mirror.w, mirror.d);
		const glass = new three.Mesh(own(mg.glass), mats!.mirror);
		const edge = new three.Mesh(own(mg.edge), mats!.mirrorEdge);
		glass.receiveShadow = true;
		edge.receiveShadow = true;
		group!.add(edge, glass);

		const top = 0.0041;
		const h = lineHeightM();
		const grains: { x: number; y: number; z: number; rotY: number; s: number }[] = [];
		lines.forEach((l, i) => {
			const g = own(P!.makeLineGeometry(LINE.lengthM, LINE.widthM, h, l.fill, i + 1));
			const mesh = new three.Mesh(g, mats!.powder);
			mesh.position.set(l.x, top, l.z);
			mesh.rotation.y = l.rotY;
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			group!.add(mesh);
			const len = LINE.lengthM * Math.max(0.15, l.fill);
			for (let k = 0; k < 120; k++) {
				const u = (hash01(i * 97 + k, 81) - 0.5) * len * 1.1;
				const spread = Math.pow(hash01(i * 97 + k, 82), 2.6) * LINE.widthM * 3 + LINE.widthM * 0.4;
				const v = (hash01(i * 97 + k, 83) > 0.5 ? 1 : -1) * spread;
				const cs = Math.cos(l.rotY);
				const sn = Math.sin(l.rotY);
				const size = 0.00006 + Math.pow(hash01(i * 97 + k, 84), 2) * 0.00028;
				grains.push({ x: l.x + u * cs + v * sn, y: top + size * 0.5, z: l.z - u * sn + v * cs, rotY: hash01(k, i) * 6, s: size });
			}
		});
		if (grains.length) {
			const gg = own(P!.makeGrainGeometry());
			const im = new three.InstancedMesh(gg, mats!.powder, grains.length);
			const m = new three.Matrix4();
			grains.forEach((gr, i) => {
				m.makeRotationY(gr.rotY);
				m.scale(new three.Vector3(gr.s, gr.s * 0.7, gr.s));
				m.setPosition(gr.x, gr.y, gr.z);
				im.setMatrixAt(i, m);
			});
			im.instanceMatrix.needsUpdate = true;
			group!.add(im);
		}

		const bladeMesh = new three.Mesh(own(P!.makeBladeGeometry()), mats!.steel);
		bladeMesh.position.set(blade.x, 0, blade.z);
		bladeMesh.rotation.y = blade.rotY;
		bladeMesh.castShadow = true;
		group!.add(bladeMesh);
		return { w: mirror.w, d: mirror.d, h: 0.006 };
	}

	function buildBags(c: Count): Extent {
		const three = T!;
		const { bags, extent: ex } = layoutBags(c);
		const whole = bags.filter((b) => b.fill >= 1);
		const part = bags.find((b) => b.fill < 1);
		const full = P!.makeBagGeometries(1);
		own(full.plastic);
		own(full.powder);
		own(full.zip);
		if (whole.length) {
			group!.add(instanced(full.powder, mats!.powder, whole));
			group!.add(instanced(full.zip, mats!.zip, whole));
			const pl = instanced(full.plastic, mats!.plastic, whole);
			pl.castShadow = false;
			pl.renderOrder = 2;
			group!.add(pl);
		}
		if (part) {
			const g = P!.makeBagGeometries(part.fill);
			for (const [geom, mat, order] of [
				[own(g.powder), mats!.powder, 0],
				[own(g.zip), mats!.zip, 0],
				[own(g.plastic), mats!.plastic, 2],
			] as const) {
				const mesh = new three.Mesh(geom, mat);
				mesh.position.set(part.x, part.y, part.z);
				mesh.rotation.set(part.tiltX ?? 0, part.rotY, part.tiltZ ?? 0);
				mesh.renderOrder = order;
				mesh.castShadow = order === 0;
				mesh.receiveShadow = true;
				group!.add(mesh);
			}
		}
		return ex;
	}

	function buildBricks(c: Count): Extent {
		const three = T!;
		const { bricks, extent: ex } = layoutBricks(c);
		const whole = bricks.filter((b) => b.fill >= 1);
		const part = bricks.find((b) => b.fill < 1);
		const geom = own(P!.makeBrickGeometry(1));
		// Mostly brown tape; about one in ten wrapped in yellow.
		const main = whole.filter((_, i) => hash01(i, 90) >= 0.1);
		const alt = whole.filter((_, i) => hash01(i, 90) < 0.1);
		if (main.length) group!.add(instanced(geom, mats!.brick, main));
		if (alt.length) group!.add(instanced(geom, mats!.brickAlt, alt));
		if (part) {
			const g = own(P!.makeBrickGeometry(part.fill));
			// The cut end (+x) shows the pressed powder.
			const m = [mats!.brickCut, ...mats!.brick.slice(1)];
			const mesh = new three.Mesh(g, m);
			mesh.position.set(part.x, part.y, part.z);
			mesh.rotation.y = part.rotY;
			mesh.castShadow = mesh.receiveShadow = true;
			group!.add(mesh);
		}
		return ex;
	}

	function buildPallets(c: Count): Extent {
		const three = T!;
		const { pallets, block, extent: ex } = layoutPallets(c);
		const loadW = 5 * 0.21;
		const loadD = 7 * 0.14;
		if (block) {
			const unitH = PALLET.deckM + PALLET_LOAD_M;
			const w = block.colsX * PALLET.lengthM;
			const d = block.colsZ * PALLET.widthM;
			const hgt = block.layers * unitH;
			const face = (rx: number, ry: number) => {
				const t = mats!.palletFace.map!.clone();
				t.repeat.set(rx, ry);
				t.needsUpdate = true;
				owned.texs.push(t);
				const m = new three.MeshStandardMaterial({ map: t, roughness: 0.6 });
				owned.mats.push(m);
				return m;
			};
			const topT = mats!.palletTop.map!.clone();
			topT.repeat.set(block.colsX, block.colsZ);
			topT.needsUpdate = true;
			owned.texs.push(topT);
			const topM = new three.MeshStandardMaterial({ map: topT, roughness: 0.55 });
			owned.mats.push(topM);
			const fx = face(block.colsZ, block.layers);
			const fz = face(block.colsX, block.layers);
			const mesh = new three.Mesh(own(new three.BoxGeometry(w, hgt, d)), [fx, fx, topM, topM, fz, fz]);
			mesh.position.y = hgt / 2;
			mesh.castShadow = mesh.receiveShadow = true;
			group!.add(mesh);
			return ex;
		}
		const whole = pallets.filter((p) => p.fill >= 1);
		const part = pallets.find((p) => p.fill < 1);
		const woodG = own(P!.makePalletGeometry());
		const loadG = own(new three.BoxGeometry(loadW, PALLET_LOAD_M, loadD));
		loadG.translate(0, PALLET.deckM + PALLET_LOAD_M / 2, 0);
		const filmG = own(new three.BoxGeometry(loadW + 0.02, PALLET_LOAD_M + 0.015, loadD + 0.02));
		filmG.translate(0, PALLET.deckM + PALLET_LOAD_M / 2 + 0.004, 0);
		const all = [...whole, ...(part ? [part] : [])];
		group!.add(instanced(woodG, mats!.wood, all));
		if (whole.length) {
			group!.add(instanced(loadG, mats!.load, whole));
			const f = instanced(filmG, mats!.film, whole);
			f.castShadow = false;
			f.renderOrder = 2;
			group!.add(f);
		}
		if (part) {
			// A part-load: fewer courses of bricks on the deck.
			const layers = Math.max(1, Math.round(PALLET.layers * part.fill));
			const h = (layers / PALLET.layers) * PALLET_LOAD_M;
			const lg = own(new three.BoxGeometry(loadW, h, loadD));
			lg.translate(0, PALLET.deckM + h / 2, 0);
			const mesh = new three.Mesh(lg, mats!.load);
			mesh.position.set(part.x, 0, part.z);
			mesh.rotation.y = part.rotY;
			mesh.castShadow = mesh.receiveShadow = true;
			group!.add(mesh);
		}
		return ex;
	}

	function rebuild(grams: number): void {
		if (!T || !P || !mats || !scene) return;
		clearGroup();
		group = new T.Group();
		const c = countFor(grams);
		if (c) {
			tier = c.tier;
			extent =
				c.tier === 'lines'
					? buildLines(c)
					: c.tier === 'bags'
						? buildBags(c)
						: c.tier === 'bricks'
							? buildBricks(c)
							: buildPallets(c);
		}
		scene.add(group);
	}

	// ── Camera, light, Sat ──────────────────────────────────────
	function smoothstep(a: number, b: number, x: number): number {
		const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
		return t * t * (3 - 2 * t);
	}

	function reframe(): void {
		if (!T || !camera || !camPos || !camAim || !wantPos || !wantAim) return;
		const aspect = height > 0 ? width / height : 1;
		const span = Math.max(extent.w, extent.d, extent.h);
		// Small loads: our own look-down shot with Sat beside, in the shot.
		// Wide loads (a pallet field): the same raised shot, Sat walking out
		// to the foreground along the camera's line of sight. A warehouse
		// block — tall as it is wide — blends into the metal stage's rig: low
		// camera, Sat in the foreground, the block treated as a cube.
		const beside = dogBeside(extent, tier);
		const wFg = tier === 'lines' ? 0 : smoothstep(2.5, 6, span);
		const shot = shotBounds(extent, tier === 'lines' || wFg > 0 ? null : beside);
		const near = stageCamera(shot.extent, aspect, shot.center);
		const cubeLike = extent.h > 0.5 * Math.max(extent.w, extent.d);
		const k = M && cubeLike ? wFg : 0;
		let pos = near.pos;
		let aim = near.aim;
		let dogAt = beside;
		let dogStaged = false;
		if (wFg > 0) {
			const mark = groundMark(near.pos, near.aim, aspect, extent);
			if (mark) dogAt = { x: beside.x + (mark.x - beside.x) * wFg, z: beside.z + (mark.z - beside.z) * wFg };
			dogStaged = wFg > 0.5;
		}
		if (k > 0 && M) {
			const tr = M.cameraTransform(span);
			const lerp3 = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => ({
				x: a.x + (b.x - a.x) * k,
				y: a.y + (b.y - a.y) * k,
				z: a.z + (b.z - a.z) * k,
			});
			pos = lerp3(near.pos, tr.pos);
			aim = lerp3(near.aim, tr.aim);
			const sp = M.dogStagePosition(span, tr.pos, tr.aim, aspect);
			dogAt = { x: dogAt.x + (sp.x - dogAt.x) * k, z: dogAt.z + (sp.z - dogAt.z) * k };
			dogStaged = sp.staged && k > 0.5;
		}
		wantPos.set(pos.x, pos.y, pos.z);
		wantAim.set(aim.x, aim.y, aim.z);

		if (dog) {
			dog.position.set(dogAt.x, 0, dogAt.z);
			// Face the load (its middle, at the origin).
			dog.rotation.y = Math.atan2(-dogAt.x, -dogAt.z);
			staged = dogStaged;
		} else {
			staged = false;
		}
		const cam = { dist: Math.hypot(pos.x - aim.x, pos.y - aim.y, pos.z - aim.z) };

		if (key) {
			const s = Math.max(span, 0.6);
			// Flat things get a lower, raking light so their relief reads.
			const rake = tier === 'lines' || tier === 'bags' ? 1.2 : 2.2;
			key.position.set(-s * 1.4, s * rake, s * 1.2);
			key.target.position.set(0, 0, 0);
			const sc = key.shadow.camera;
			sc.left = sc.bottom = -s * 1.3;
			sc.right = sc.top = s * 1.3;
			sc.near = s * 0.05;
			sc.far = s * 6;
			sc.updateProjectionMatrix();
			key.shadow.bias = -0.0002;
			key.shadow.normalBias = span < 0.5 ? 0.0004 : 0.02;
		}
		if (scene) scene.fog = new T.Fog(BG, cam.dist * 2.5, cam.dist * 10);

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
		camera.near = Math.max(d / 200, 0.002);
		camera.far = d * 80;
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
		const k = 1 - Math.exp(-dt * 3.2);
		camPos.lerp(wantPos, k);
		camAim.lerp(wantAim, k);
		applyCamera();
		mixer?.update(dt);
		render();
	}

	function startLoop(): void {
		if (prefersReduced || running || destroyed) return;
		running = true;
		last = performance.now();
		rafId = requestAnimationFrame(loop);
	}

	function updateReady(): void {
		ready = renderedOnce && dogResolved;
	}

	function refresh(grams: number): void {
		if (!canvasActive) return;
		rebuild(grams);
		reframe();
		render();
		renderedOnce = true;
		updateReady();
	}

	// ── Lifecycle ───────────────────────────────────────────────
	async function hydrate(): Promise<void> {
		if (destroyed || !containerEl) return;
		const [three, gltfMod, moMod, props, materials, maths] = await Promise.all([
			import('three'),
			import('three/addons/loaders/GLTFLoader.js'),
			import('three/addons/libs/meshopt_decoder.module.js'),
			import('./cocaineProps.js'),
			import('./materials.js'),
			import('./maths.js'),
		]);
		const { loadNormalizedModel } = await import('./loadNormalizedModel.js');
		if (destroyed || !containerEl) return;
		T = three;
		P = props;
		M = maths;

		width = containerEl.clientWidth || 1;
		height = containerEl.clientHeight || 1;
		renderer = new three.WebGLRenderer({ antialias: true, alpha: false });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(width, height);
		renderer.toneMapping = three.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 1.1;
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = three.PCFSoftShadowMap;
		renderer.domElement.className = 'stage-canvas';
		renderer.domElement.setAttribute('aria-hidden', 'true');
		containerEl.appendChild(renderer.domElement);

		scene = new three.Scene();
		scene.background = new three.Color(BG);
		envTexture = materials.makeEnvironmentTexture(renderer);
		scene.environment = envTexture;
		scene.environmentIntensity = 0.9;

		camera = new three.PerspectiveCamera(maths.FOV_DEG, width / height, 0.001, 5000);
		key = new three.DirectionalLight(0xfff2dd, 2.1);
		key.castShadow = true;
		key.shadow.mapSize.set(2048, 2048);
		scene.add(key, key.target);
		scene.add(new three.AmbientLight(0x404048, 0.45));

		groundGeometry = new three.CircleGeometry(60000, 64).rotateX(-Math.PI / 2);
		groundMaterial = new three.MeshStandardMaterial({ color: 0x202024, roughness: 0.95, metalness: 0 });
		const ground = new three.Mesh(groundGeometry, groundMaterial);
		ground.receiveShadow = true;
		scene.add(ground);

		mats = props.makeMaterials();

		camPos = new three.Vector3(0.3, 0.3, 0.4);
		camAim = new three.Vector3();
		wantPos = new three.Vector3();
		wantAim = new three.Vector3();

		canvasActive = true;
		refresh(massGrams);
		startLoop();

		resizeObs = new ResizeObserver(() => {
			if (!containerEl || !renderer || !camera) return;
			width = containerEl.clientWidth || 1;
			height = containerEl.clientHeight || 1;
			camera.aspect = width / height;
			renderer.setSize(width, height);
			reframe();
			render();
		});
		resizeObs.observe(containerEl);

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
				dog.traverse((o) => {
					if ((o as THREE.Mesh).isMesh) o.castShadow = true;
				});
				scene.add(dog);
				if (animations.length) {
					mixer = new three.AnimationMixer(dog);
					// Select the idle by name — animations[0] is play_dead.
					const idle = animations.find((c) => c.name.includes('sitting')) ?? animations[animations.length - 1];
					mixer.clipAction(idle).play();
					if (prefersReduced) mixer.update(0);
				}
				dogResolved = true;
				reframe();
				render();
				updateReady();
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
		clearGroup();
		mats?.dispose();
		groundGeometry?.dispose();
		groundMaterial?.dispose();
		envTexture?.dispose();
		mixer?.stopAllAction();
		if (renderer) {
			renderer.domElement.remove();
			renderer.dispose();
		}
		renderer = scene = camera = key = null;
		mats = null;
		dog = mixer = null;
		envTexture = null;
		staged = false;
		ready = false;
	}

	onMount(() => {
		if (!browser) return;
		prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (!hasWebGL()) {
			noWebGL = true;
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
		const g = massGrams;
		if (!canvasActive) return;
		refresh(g);
	});

	// ── Captions ────────────────────────────────────────────────
	const count = $derived(countFor(massGrams));
	const countLabel = $derived.by(() => {
		if (!count) return '';
		const n = count.exact;
		const fmt = (x: number) => (x < 10 ? x.toFixed(1) : formatCount(x));
		switch (count.tier) {
			case 'lines':
				return `${fmt(n)} line${n >= 1.05 || n < 0.95 ? 's' : ''}`;
			case 'bags':
				return `${fmt(n)} baggies`;
			case 'bricks':
				return `${fmt(n)} one-kilo bricks`;
			case 'pallets':
				return `${fmt(n)} pallets`;
		}
	});
	const tierLabel = $derived.by(() => {
		if (!count) return '';
		switch (count.tier) {
			case 'lines':
				return '30 mg lines on a mirror · razor blade for scale';
			case 'bags':
				return '1 g zip-lock baggies';
			case 'bricks':
				return 'pressed, taped 1 kg bricks';
			case 'pallets':
				return count.exact > 120 ? 'pallets of 1,000 bricks, stacked warehouse-high' : 'shrink-wrapped pallets of 1,000 bricks';
		}
	});
</script>

<div class="coke-stage" bind:this={containerEl}>
	{#if noWebGL}
		<CocaineBrickStack {massGrams} />
	{:else}
		<div class="chips" aria-live="polite">
			<span class="chip chip--count">{countLabel}</span>
		</div>
		<span class="chip chip--tier">{tierLabel}</span>
	{/if}
</div>

<style>
	.coke-stage {
		position: relative;
		width: 100%;
		height: clamp(340px, 56vh, 520px);
		overflow: hidden;
		border-radius: 8px;
		background: #18181b;
	}
	.coke-stage :global(canvas.stage-canvas) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
	}
	.chips {
		position: absolute;
		top: 12px;
		left: 12px;
		z-index: 2;
	}
	.chip {
		display: inline-block;
		font: 500 11.5px/1 'JetBrains Mono', ui-monospace, monospace;
		color: #d4d4d8;
		background: rgba(9, 9, 11, 0.72);
		border: 1px solid #3f3f46;
		border-radius: 6px;
		padding: 7px 9px;
		pointer-events: none;
	}
	.chip--count {
		font-weight: 600;
		color: #f5f0e6;
	}
	.chip--tier {
		position: absolute;
		left: 12px;
		bottom: 12px;
		z-index: 2;
		color: #a1a1aa;
	}
</style>
