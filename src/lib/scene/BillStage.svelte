<!-- src/lib/scene/BillStage.svelte -->
<script lang="ts">
	/**
	 * BillStage — the Cash tab's live WebGL stage. Sibling to LiveStage.svelte
	 * (not an extension of it, same separation as CocaineBrickStack being
	 * wholly separate from CubeRenderer) because the mesh strategy is
	 * fundamentally different: instanced real bill geometry + coalesced
	 * textured blocks, not a single scaled cube.
	 *
	 * Task 11 proved the pipeline: load the bill glb, normalize its scale,
	 * bake its transform into a reusable geometry, and render one bill so
	 * the load->normalize->material chain is verified working. Task 12
	 * (this) adds tiered-mode rendering: `noteCount` now selects one of
	 * three visual branches — individually-instanced bills (loose/strap),
	 * coalesced textured blocks in a roughly-cubic grid (bundle/cube), or a
	 * capped receding field of pallet-scale blocks (pallet) — via
	 * `billStack.ts`'s tier/grid maths. Task 13 adds literal-mode rendering:
	 * a `viewMode` prop that, when `'literal'`, always renders a single
	 * true-height column instead of the tiered view. Task 14 (this) wires
	 * the camera to `renderTiered`/`renderLiteral`'s returned dominant
	 * extent via `cameraTransform` (`./maths.js`), adds the damped dolly
	 * loop, and makes clicking/tapping (or Enter/Space when focused) toggle
	 * `viewMode`.
	 */
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type * as THREE from 'three';
	import type { CubicGrid } from '../billStack.js';

	let {
		noteCount = 0,
		viewMode = $bindable<'tiered' | 'literal'>('tiered'),
	}: { noteCount?: number; viewMode?: 'tiered' | 'literal' } = $props();

	const BG = 0x18181b;
	const BILL_MODEL_URL = '/models/references/one_dollar_bill/bill.glb';

	let containerEl: HTMLDivElement | undefined = $state();
	let canvasActive = $state(false);

	let T: typeof THREE | null = null;
	let renderer: THREE.WebGLRenderer | null = null;
	let scene: THREE.Scene | null = null;
	let camera: THREE.PerspectiveCamera | null = null;
	let key: THREE.DirectionalLight | null = null;
	let camPos: THREE.Vector3 | null = null;
	let camAim: THREE.Vector3 | null = null;

	// $state so the tiered-render $effect (which reads it) re-runs once the
	// async GLTF load (see hydrate()) assigns it — otherwise the effect's
	// first run (triggered by canvasActive) fires while this is still null,
	// bails on the guard below, and nothing re-triggers it for a static
	// noteCount mount.
	let bakedBillGeometry: THREE.BufferGeometry | null = $state(null);
	let billMats: { face: THREE.MeshStandardMaterial; edge: THREE.MeshStandardMaterial } | null =
		null;
	let groundGeometry: THREE.BufferGeometry | null = null;
	let groundMaterial: THREE.MeshStandardMaterial | null = null;

	let width = 0;
	let height = 0;
	let destroyed = false;
	let rafId = 0;
	let resizeObs: ResizeObserver | null = null;

	function hasWebGL(): boolean {
		try {
			const c = document.createElement('canvas');
			return !!(c.getContext('webgl2') || c.getContext('webgl'));
		} catch {
			return false;
		}
	}

	/** Flatten a loaded (already scale-normalized) model's first mesh into a
	 *  standalone geometry in true real-world millimetres — the standard
	 *  three.js technique for turning a loaded scene graph into something an
	 *  InstancedMesh can reuse without carrying a wrapper transform. */
	function extractBakedGeometry(three: typeof THREE, root: THREE.Object3D): THREE.BufferGeometry | null {
		root.updateMatrixWorld(true);
		let found: THREE.BufferGeometry | null = null;
		root.traverse((child) => {
			const mesh = child as THREE.Mesh;
			if (!found && mesh.isMesh && mesh.geometry) {
				const geom = mesh.geometry.clone();
				geom.applyMatrix4(mesh.matrixWorld);
				found = geom;
			}
		});
		return found;
	}

	const BUNDLE_HEIGHT_MM = 1000 * 0.10922; // NOTES_PER_BUNDLE x BILL_THICKNESS_MM, see billStack.ts
	const PALLET_BUNDLES = 1000; // 1,000 bundles/pallet = 1,000,000 notes/pallet (10x10x10 grid)
	const PALLET_RENDER_CAP = 60; // receding field caps here; the readout's note-count carries the rest

	let tierGroup: THREE.Group | null = null;

	/** Removes the current tier's render group from the scene and frees the
	 *  GPU resources it alone owns. `bakedBillGeometry` and `billMats.face`/
	 *  `billMats.edge` are shared across every tier switch — reused directly
	 *  (not cloned) by the loose/strap branch and by the block face material
	 *  — and are owned/disposed by `teardown()` instead; disposing them here
	 *  would free a resource the next render still needs. Only resources
	 *  built fresh inside `renderTiered` on each call (the bundle/pallet box
	 *  geometry, and the cloned edge material + its cloned texture) are
	 *  disposed here. */
	function clearTierGroup(three: typeof THREE): void {
		if (!scene || !tierGroup) return;
		scene.remove(tierGroup);
		tierGroup.traverse((child) => {
			const mesh = child as THREE.Mesh;
			if (!mesh.isMesh) return;
			if (mesh.geometry && mesh.geometry !== bakedBillGeometry) {
				mesh.geometry.dispose();
			}
			const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
			for (const mat of mats) {
				const stdMat = mat as THREE.MeshStandardMaterial | undefined;
				if (!stdMat || stdMat === billMats?.face || stdMat === billMats?.edge) continue;
				stdMat.map?.dispose();
				stdMat.dispose();
			}
		});
		tierGroup = null;
	}

	/** Fills an InstancedMesh with cap-respecting positions arranged per
	 *  `grid` (a `cubicGridDims` result), adds it to `tierGroup`/`scene`, and
	 *  returns the grid's dominant extent in metres — the shared
	 *  grid-placement routine used by both the bundle/cube branch and the
	 *  pallet branch of `renderTiered`, which differ only in geometry,
	 *  materials, per-axis cell size, and the render cap (`renderLimit`,
	 *  e.g. `PALLET_RENDER_CAP` for pallet). */
	function placeGridInstances(
		three: typeof THREE,
		geometry: THREE.BoxGeometry,
		materials: THREE.MeshStandardMaterial[],
		grid: CubicGrid,
		cellWidthM: number,
		cellHeightM: number,
		cellLengthM: number,
		renderLimit: number
	): number {
		if (!scene || !tierGroup) return 0;
		const instanced = new three.InstancedMesh(geometry, materials, grid.colsX * grid.colsZ * grid.layersY);
		instanced.castShadow = true;
		const m = new three.Matrix4();
		let i = 0;
		for (let x = 0; x < grid.colsX; x++) {
			for (let y = 0; y < grid.layersY; y++) {
				for (let z = 0; z < grid.colsZ; z++) {
					if (i >= renderLimit) break;
					m.setPosition(
						(x - (grid.colsX - 1) / 2) * cellWidthM,
						y * cellHeightM + cellHeightM / 2,
						(z - (grid.colsZ - 1) / 2) * cellLengthM
					);
					instanced.setMatrixAt(i, m);
					i++;
				}
			}
		}
		instanced.count = i;
		instanced.instanceMatrix.needsUpdate = true;
		tierGroup.add(instanced);
		scene.add(tierGroup);
		return Math.max(grid.extentXMm, grid.extentYMm, grid.extentZMm) / 1000;
	}

	function renderTiered(three: typeof THREE, billStackMod: typeof import('../billStack.js'), count: number): number {
		if (!scene || !bakedBillGeometry || !billMats) return 0;
		clearTierGroup(three);
		tierGroup = new three.Group();

		const tier = billStackMod.selectBillTier(count);
		if (!tier) {
			scene.add(tierGroup);
			return 0;
		}

		const widthM = billStackMod.BILL_WIDTH_MM / 1000;
		const lengthM = billStackMod.BILL_LENGTH_MM / 1000;
		const thicknessM = billStackMod.BILL_THICKNESS_MM / 1000;

		if (tier === 'loose' || tier === 'strap') {
			// Individually-instanced real bill geometry — cheap up to ~1,000
			// instances of a 24-vertex mesh, and this is exactly the range
			// where the eye can still resolve individual bills.
			const instanced = new three.InstancedMesh(bakedBillGeometry, billMats.face, count);
			instanced.castShadow = true;
			const m = new three.Matrix4();
			for (let i = 0; i < count; i++) {
				const jitterX = (Math.random() - 0.5) * widthM * 0.02;
				const jitterZ = (Math.random() - 0.5) * lengthM * 0.02;
				const jitterRotY = (Math.random() - 0.5) * 0.05;
				m.makeRotationY(jitterRotY);
				m.setPosition(jitterX, thicknessM * (i + 0.5), jitterZ);
				instanced.setMatrixAt(i, m);
			}
			instanced.instanceMatrix.needsUpdate = true;
			tierGroup.add(instanced);
			scene.add(tierGroup);
			return count * thicknessM; // dominant extent, metres
		}

		// bundle / cube / pallet: coalesced textured blocks, one per bundle
		// of NOTES_PER_BUNDLE notes, arranged via cubicGridDims.
		const bundleGeom = new three.BoxGeometry(widthM, BUNDLE_HEIGHT_MM / 1000, lengthM);
		const edgeMat = billMats.edge.clone();
		edgeMat.map = edgeMat.map!.clone();
		edgeMat.map.repeat.set(1, billStackMod.NOTES_PER_BUNDLE);
		edgeMat.map.needsUpdate = true;
		const blockMats = [edgeMat, edgeMat, billMats.face, billMats.face, edgeMat, edgeMat]; // BoxGeometry face order: +x -x +y -y +z -z

		if (tier === 'bundle' || tier === 'cube') {
			const bundleCount = Math.ceil(count / billStackMod.NOTES_PER_BUNDLE);
			const grid = billStackMod.cubicGridDims(
				bundleCount,
				billStackMod.BILL_WIDTH_MM,
				billStackMod.BILL_LENGTH_MM,
				BUNDLE_HEIGHT_MM
			);
			return placeGridInstances(
				three,
				bundleGeom,
				blockMats,
				grid,
				widthM,
				BUNDLE_HEIGHT_MM / 1000,
				lengthM,
				bundleCount
			);
		}

		// pallet: a receding field of pallet-scale blocks (10x10x10 bundles
		// each), capped for renderability — the readout's note count carries
		// the true magnitude past the cap, same principle as Cocaine's
		// `production` tier.
		const palletExtentMm = 10 * Math.max(billStackMod.BILL_WIDTH_MM, billStackMod.BILL_LENGTH_MM, BUNDLE_HEIGHT_MM);
		const palletGeom = new three.BoxGeometry(
			(10 * billStackMod.BILL_WIDTH_MM) / 1000,
			(10 * BUNDLE_HEIGHT_MM) / 1000,
			(10 * billStackMod.BILL_LENGTH_MM) / 1000
		);
		const totalPallets = Math.ceil(count / (billStackMod.NOTES_PER_BUNDLE * PALLET_BUNDLES));
		const renderedPallets = Math.min(totalPallets, PALLET_RENDER_CAP);
		const grid = billStackMod.cubicGridDims(renderedPallets, palletExtentMm, palletExtentMm, palletExtentMm);
		const palletCellM = palletExtentMm / 1000;
		return placeGridInstances(three, palletGeom, blockMats, grid, palletCellM, palletCellM, palletCellM, renderedPallets);
	}

	const LITERAL_INSTANCE_CAP = 2000; // individually-instanced bills at the base of the column

	/** Literal mode: a single true-height column regardless of tier — the
	 *  base is individually-instanced real bill geometry (up to
	 *  `LITERAL_INSTANCE_CAP`, matching the loose/strap approach in
	 *  `renderTiered`), and any remaining height above that cap is a single
	 *  coalesced block sized to make up the rest of `stackHeightMm(count)`
	 *  exactly, so the column's total height is always physically honest. */
	function renderLiteral(three: typeof THREE, billStackMod: typeof import('../billStack.js'), count: number): number {
		if (!scene || !bakedBillGeometry || !billMats) return 0;
		clearTierGroup(three);
		tierGroup = new three.Group();

		const widthM = billStackMod.BILL_WIDTH_MM / 1000;
		const lengthM = billStackMod.BILL_LENGTH_MM / 1000;
		const thicknessM = billStackMod.BILL_THICKNESS_MM / 1000;
		const totalHeightM = billStackMod.stackHeightMm(count) / 1000;

		const instancedCount = Math.min(count, LITERAL_INSTANCE_CAP);
		if (instancedCount > 0) {
			const instanced = new three.InstancedMesh(bakedBillGeometry, billMats.face, instancedCount);
			instanced.castShadow = true;
			const m = new three.Matrix4();
			for (let i = 0; i < instancedCount; i++) {
				m.makeTranslation(0, thicknessM * (i + 0.5), 0);
				instanced.setMatrixAt(i, m);
			}
			instanced.instanceMatrix.needsUpdate = true;
			tierGroup.add(instanced);
		}

		const remaining = count - instancedCount;
		if (remaining > 0) {
			const remainingHeightM = totalHeightM - instancedCount * thicknessM;
			const blockGeom = new three.BoxGeometry(widthM, remainingHeightM, lengthM);
			const edgeMat = billMats.edge.clone();
			edgeMat.map = edgeMat.map!.clone();
			edgeMat.map.repeat.set(1, remaining); // physically-honest stripe density (Task 10)
			edgeMat.map.needsUpdate = true;
			const blockMats = [edgeMat, edgeMat, billMats.face, billMats.face, edgeMat, edgeMat];
			const block = new three.Mesh(blockGeom, blockMats);
			block.castShadow = true;
			block.position.y = instancedCount * thicknessM + remainingHeightM / 2;
			tierGroup.add(block);
		}

		scene.add(tierGroup);
		return totalHeightM;
	}

	let wantPos: THREE.Vector3 | null = null;
	let wantAim: THREE.Vector3 | null = null;
	let prefersReduced = false;

	/** Reframes the camera target to whatever `renderTiered`/`renderLiteral`
	 *  reports as the dominant extent, via the same `cameraTransform` maths
	 *  LiveStage uses for the metal cubes. Under reduced motion the camera
	 *  snaps straight to the new target instead of leaving it for `loop()` to
	 *  damp toward. */
	function reframe(three: typeof THREE, M: typeof import('./maths.js'), dominant: number): void {
		if (!camera || !camPos || !camAim) return;
		const safeDominant = Math.max(dominant, 1e-4);
		const tr = M.cameraTransform(safeDominant);
		wantPos = new three.Vector3(tr.pos.x, tr.pos.y, tr.pos.z);
		wantAim = new three.Vector3(tr.aim.x, tr.aim.y, tr.aim.z);
		if (prefersReduced) {
			camPos.copy(wantPos);
			camAim.copy(wantAim);
		}
		camera.position.copy(camPos);
		camera.lookAt(camAim);
		// Literal-mode height is uncapped (a single true-height column can run
		// into the kilometres at extreme note counts), so the near/far planes
		// must track the camera distance every reframe — same as LiveStage's
		// loop() — or a large dominant dollies the camera straight past the
		// fixed far plane and the object vanishes.
		camera.near = Math.max(camPos.length() / 100, 1e-4);
		camera.far = camPos.length() * 60;
		camera.updateProjectionMatrix();
	}

	let running = false;
	const clock = { last: 0 };

	/** Damped dolly loop — matches LiveStage's damping constant so a reframe
	 *  on toggle/slider-move animates with the same feel. */
	function loop(): void {
		if (!running || destroyed || !T || !camera || !camPos || !camAim || !wantPos || !wantAim) return;
		rafId = requestAnimationFrame(loop);
		const now = performance.now();
		const dt = Math.min((now - clock.last) / 1000 || 0, 0.05);
		clock.last = now;
		const k = 1 - Math.exp(-dt * 3.2); // same damping constant as LiveStage
		camPos.lerp(wantPos, k);
		camAim.lerp(wantAim, k);
		camera.position.copy(camPos);
		camera.lookAt(camAim);
		// See the matching comment in reframe() — near/far must track distance
		// every frame, not just on reframe, since the dolly moves camPos here.
		camera.near = Math.max(camPos.length() / 100, 1e-4);
		camera.far = camPos.length() * 60;
		camera.updateProjectionMatrix();
		render();
	}

	function startLoop(): void {
		// Reduced-motion: no continuous rAF loop. reframe() already snaps
		// camPos/camAim straight to the target (and updates near/far) on the
		// prefersReduced path, and the render $effect calls render() right
		// after — so the scene is fully correct with zero animated frames,
		// and we avoid burning GPU cycles for users who opted out of motion.
		if (prefersReduced || running || destroyed) return;
		running = true;
		clock.last = performance.now();
		rafId = requestAnimationFrame(loop);
	}
	function stopLoop(): void {
		running = false;
		if (rafId) cancelAnimationFrame(rafId);
		rafId = 0;
	}

	async function hydrate(): Promise<void> {
		if (destroyed || canvasActive || !containerEl) return;

		const [three, gltfMod, moMod, billMaterialsMod, billStackMod] = await Promise.all([
			import('three'),
			import('three/addons/loaders/GLTFLoader.js'),
			import('three/addons/libs/meshopt_decoder.module.js'),
			import('./billMaterials.js'),
			import('../billStack.js'),
		]);
		const { loadNormalizedModel } = await import('./loadNormalizedModel.js');
		if (destroyed || !containerEl) return;
		T = three;

		width = containerEl.clientWidth || 1;
		height = containerEl.clientHeight || 1;

		renderer = new three.WebGLRenderer({ antialias: true, alpha: false });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(width, height);
		renderer.toneMapping = three.ACESFilmicToneMapping;
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = three.PCFSoftShadowMap;
		renderer.domElement.className = 'stage-canvas';
		renderer.domElement.setAttribute('aria-hidden', 'true');
		containerEl.appendChild(renderer.domElement);

		scene = new three.Scene();
		scene.background = new three.Color(BG);
		camera = new three.PerspectiveCamera(35, width / height, 1e-4, 5000);

		key = new three.DirectionalLight(0xfff2dd, 2.2);
		key.castShadow = true;
		key.shadow.mapSize.set(2048, 2048);
		scene.add(key);
		scene.add(new three.AmbientLight(0x404048, 0.4));

		groundGeometry = new three.CircleGeometry(4000, 64).rotateX(-Math.PI / 2);
		groundMaterial = new three.MeshStandardMaterial({ color: 0x202024, roughness: 0.95, metalness: 0 });
		const ground = new three.Mesh(groundGeometry, groundMaterial);
		ground.receiveShadow = true;
		scene.add(ground);

		const face = billMaterialsMod.makeBillFaceTexture();
		const edge = billMaterialsMod.makeBillEdgeTexture();
		billMats = billMaterialsMod.makeBillMaterials(face, edge);

		camPos = new three.Vector3(0.3, 0.15, 0.4);
		camAim = new three.Vector3(0, 0.02, 0);
		camera.position.copy(camPos);
		camera.lookAt(camAim);

		loadNormalizedModel(
			three,
			gltfMod.GLTFLoader,
			moMod.MeshoptDecoder,
			BILL_MODEL_URL,
			billStackMod.BILL_LENGTH_MM / 1000, // metres
			'x',
			(object) => {
				if (destroyed || !scene || !billMats) return;
				// Assigning bakedBillGeometry (now $state) triggers the tiered
				// $effect below to run renderTiered() with the current noteCount —
				// no preview mesh here, so a static-noteCount mount goes straight
				// to the correct tiered view instead of a lingering single bill.
				bakedBillGeometry = extractBakedGeometry(three, object);
			},
			() => {
				/* Model failed to load — the poster (BillRenderer, Task 15) covers
				   this state; the WebGL canvas just stays empty. */
			}
		);

		canvasActive = true;
		render();
		startLoop();

		resizeObs = new ResizeObserver(() => onResize());
		resizeObs.observe(containerEl);
	}

	function render(): void {
		if (!renderer || !scene || !camera) return;
		renderer.render(scene, camera);
	}

	function onResize(): void {
		if (!containerEl || !renderer || !camera) return;
		width = containerEl.clientWidth || 1;
		height = containerEl.clientHeight || 1;
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		renderer.setSize(width, height);
		render();
	}

	function teardown(): void {
		stopLoop();
		if (resizeObs) resizeObs.disconnect();

		// Tier-group resources (bundle/pallet box geometry, cloned edge
		// material + its cloned texture) are owned by whichever renderTiered()
		// call created them, not by this function — free them the same way a
		// tier switch would, before the shared resources below and before
		// renderer.dispose() resets WebGLProperties' tracking (see the note
		// below).
		if (T) clearTierGroup(T);

		// bakedBillGeometry + billMats.face/.edge are shared across every
		// tier's InstancedMesh — dispose them once below, not per-mesh, to
		// avoid double-disposing shared resources. This MUST run before
		// renderer.dispose(): WebGLRenderer.dispose()
		// resets WebGLProperties' internal WeakMap, so Texture/Material
		// .dispose() calls made afterward can no longer look up their GPU
		// resources and silently no-op (BufferGeometry.dispose() is unaffected
		// since it uses its own independent WeakMap, but order it consistently
		// anyway).
		bakedBillGeometry?.dispose();
		billMats?.face.map?.dispose();
		billMats?.face.dispose();
		billMats?.edge.map?.dispose();
		billMats?.edge.dispose();
		groundGeometry?.dispose();
		groundMaterial?.dispose();

		if (renderer) {
			renderer.domElement.remove();
			renderer.dispose();
		}

		renderer = scene = camera = key = null;
		bakedBillGeometry = null;
		billMats = null;
		groundGeometry = null;
		groundMaterial = null;
		tierGroup = null;
	}

	onMount(() => {
		if (!browser) return;
		prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (!hasWebGL()) return;
		void hydrate();
		return () => {
			destroyed = true;
			teardown();
		};
	});

	$effect(() => {
		const count = noteCount;
		const mode = viewMode;
		if (!canvasActive || !T || !bakedBillGeometry) return;
		Promise.all([import('../billStack.js'), import('./maths.js')]).then(([billStackMod, M]) => {
			if (destroyed || !T) return;
			const dominant = mode === 'literal' ? renderLiteral(T, billStackMod, count) : renderTiered(T, billStackMod, count);
			reframe(T, M, dominant);
			render();
		});
	});

	function toggleViewMode(): void {
		viewMode = viewMode === 'tiered' ? 'literal' : 'tiered';
	}
</script>

<div
	class="bill-stage"
	bind:this={containerEl}
	role="button"
	tabindex="0"
	aria-label={`Dollar bill stack, ${viewMode === 'tiered' ? 'bundled view — tap for the literal true-height stack' : 'literal true-height stack — tap for the bundled view'}`}
	onclick={toggleViewMode}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggleViewMode();
		}
	}}
>
	<div class="mode-hint">{viewMode === 'tiered' ? 'tap to see it as one column' : 'tap to see it bundled'}</div>
</div>

<style>
	.bill-stage {
		position: relative;
		width: 100%;
		height: clamp(340px, 56vh, 520px);
		overflow: hidden;
		border-radius: 8px;
		background: #18181b;
		cursor: pointer;
	}
	.bill-stage :global(canvas.stage-canvas) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
	}
	.mode-hint {
		position: absolute;
		bottom: 8px;
		right: 12px;
		font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
		font-size: 11px;
		color: #71717a;
		pointer-events: none;
		z-index: 1;
	}
</style>
