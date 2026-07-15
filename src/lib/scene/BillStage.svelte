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

	// Literal mode's height scales LINEARLY with note count (unlike the metal
	// cubes, which scale as cube-root of value and so stay metre-scale even at
	// 21M BTC) — at the site's 21M BTC ceiling the true height reaches
	// ~1.45e8 m. World-space geometry at that magnitude blows past float32 GPU
	// precision and silently fails to rasterize (confirmed: the stage goes
	// blank, no console error). 10 km keeps the ULP well under a millimetre
	// and comfortably covers every realistic position; only the theoretical
	// extreme gets capped. Same "cap the render, let the readout carry the
	// true magnitude" idiom as PALLET_RENDER_CAP above.
	const LITERAL_HEIGHT_RENDER_CAP_M = 10_000;

	// Separately: the column's WIDTH is always a fixed real-bill footprint
	// (~6.6 cm) while `framingDistance` dollies the camera back linearly with
	// the framed height. Frame more than a few metres of column and the
	// fixed-width column thins toward a hairline: at a 15 m framing the
	// camera sits ~52 m out and the column subtends ~2 px; at the uncapped
	// 100 BTC height (~700 m) it is genuinely sub-pixel and the stage looks
	// empty. There's no width/height combination that keeps the full height
	// AND a legible width in frame at once, so the camera stops dollying
	// back at a human-scale framing: 3 m puts it ~10.5 m out, where the
	// column reads ~2% of frame width (clearly a stack of bills, base
	// legible) and the (still fully modelled, up to
	// `LITERAL_HEIGHT_RENDER_CAP_M`) shaft recedes up out of frame — the
	// same thing a photo of a very tall real building does. Stacks shorter
	// than the cap still frame to their true height, and the cap is
	// continuous at the boundary. The readout's height/comparison line is
	// unaffected (computed straight from the true, uncapped height).
	//
	// NOTE for future verification: this pane's damped camera dolly needs a
	// live requestAnimationFrame loop. Headless/preview environments can
	// freeze rAF entirely, leaving the camera stuck at whatever position it
	// last had while everything else (DOM, one-shot renders) looks alive —
	// screenshots then show a bogus framing. Verify framing changes on the
	// prefers-reduced-motion path (which snaps with no rAF) or in a real
	// browser.
	const LITERAL_FRAMING_CAP_M = 3;

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
	 *  exactly, so the modelled geometry's height is always physically honest
	 *  up to `LITERAL_HEIGHT_RENDER_CAP_M` (a float32-precision safety net,
	 *  rarely binding). The value returned for camera framing is a SEPARATE,
	 *  much smaller cap (`LITERAL_FRAMING_CAP_M`) — see that constant's
	 *  comment for why the two need not (and must not) match. `BillReadout`
	 *  computes the true, uncapped height straight from `stackHeightMm` for
	 *  the text readout, so the displayed number never lies even when the
	 *  scene can't show the whole column. */
	function renderLiteral(three: typeof THREE, billStackMod: typeof import('../billStack.js'), count: number): number {
		if (!scene || !bakedBillGeometry || !billMats) return 0;
		clearTierGroup(three);
		tierGroup = new three.Group();

		const widthM = billStackMod.BILL_WIDTH_MM / 1000;
		const lengthM = billStackMod.BILL_LENGTH_MM / 1000;
		const thicknessM = billStackMod.BILL_THICKNESS_MM / 1000;
		const totalHeightM = billStackMod.stackHeightMm(count) / 1000;
		const renderHeightM = Math.min(totalHeightM, LITERAL_HEIGHT_RENDER_CAP_M);

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
		const remainingHeightM = Math.max(renderHeightM - instancedCount * thicknessM, 0);
		if (remaining > 0 && remainingHeightM > 0) {
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
		return Math.min(renderHeightM, LITERAL_FRAMING_CAP_M);
	}

	let wantPos: THREE.Vector3 | null = null;
	let wantAim: THREE.Vector3 | null = null;
	let prefersReduced = false;

	/** Reframes the camera target to whatever `renderTiered`/`renderLiteral`
	 *  reports as the dominant extent. Deliberately does NOT call
	 *  `M.cameraTransform()` — that function's aim point is blended (via
	 *  `aimBlend`/`besidePlacement` in maths.ts) toward a position beside a
	 *  Shiba dog model, because LiveStage's metal-cube scene stages a dog next
	 *  to the cube. BillStage has no dog anywhere in its scene, so that
	 *  sideways aim offset just points the look-at target past the edge of
	 *  the rendered grid (see Task 17b bugfix notes). Instead this rebuilds
	 *  the same position/elevation/height geometry `cameraTransform` derives
	 *  from `framingDominant`/`framingDistance`/`cameraElevationRad`/
	 *  `cameraHeight`/`AZIMUTH_RAD`, but aims strictly at the scene's own
	 *  centre (x = 0) — matching `cameraTransform`'s own `aim.y` formula
	 *  (`dominant * 0.32`) without the dog-driven `aim.x` term. */
	function reframe(three: typeof THREE, M: typeof import('./maths.js'), dominant: number): void {
		if (!camera || !camPos || !camAim) return;
		const safeDominant = Math.max(dominant, 1e-4);
		const framingDominant = M.framingDominant(safeDominant);
		const dist = M.framingDistance(framingDominant);
		const elev = M.cameraElevationRad(safeDominant);
		const azim = M.AZIMUTH_RAD;
		const camY = M.cameraHeight(framingDominant);
		wantPos = new three.Vector3(
			dist * Math.cos(elev) * Math.sin(azim),
			camY,
			dist * Math.cos(elev) * Math.cos(azim)
		);
		wantAim = new three.Vector3(0, framingDominant * 0.32, 0);
		// Key light + shadow-camera frustum track the scale, mirroring
		// LiveStage's update() — without this the light stays at three.js's
		// default (0, 1, 0), shining straight down, and the near-vertical side
		// faces of bundle/cube/pallet BoxGeometry blocks (which dominate the
		// view at BillStage's shallow camera elevation) receive almost no
		// direct light and render black. `0 -` replaces LiveStage's
		// `tr.aim.x -` term: BillStage has no dog-staging offset, so aim.x is
		// always 0 here.
		if (key) {
			key.position.set(0 - framingDominant * 1.6, framingDominant * 2.4, framingDominant * 1.2);
			const sc = key.shadow.camera;
			sc.left = sc.bottom = -framingDominant * 2.2;
			sc.right = sc.top = framingDominant * 2.2;
			sc.near = framingDominant * 0.1;
			sc.far = framingDominant * 8;
			sc.updateProjectionMatrix();
		}
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
