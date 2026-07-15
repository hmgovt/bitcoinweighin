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
	 * true-height column instead of the tiered view. Task 14 wires the
	 * camera to `renderTiered`/`renderLiteral`'s returned dominant extent,
	 * adds the damped dolly loop, and makes clicking/tapping (or Enter/Space
	 * when focused) toggle `viewMode`. A later revision reverses the
	 * earlier "no Shiba on this tab" call (see docs/handoff/14-cash.md) —
	 * the dog now stages beside the stack (or relocates to the camera
	 * foreground at monolith scale) using the SAME tested rig LiveStage
	 * drives its cube from (`M.cameraTransform` + `M.dogStagePosition` in
	 * `./maths.js`), not a bespoke reimplementation.
	 */
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type * as THREE from 'three';
	import type { CubicGrid } from '../billStack.js';

	let {
		noteCount = 0,
		viewMode = $bindable<'tiered' | 'literal'>('tiered'),
		staged = $bindable(false),
	}: {
		noteCount?: number;
		viewMode?: 'tiered' | 'literal';
		/** True when the dog has walked to the foreground (readout honesty line). */
		staged?: boolean;
	} = $props();

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
	let envTexture: THREE.Texture | null = null;
	let dog: THREE.Object3D | null = null;
	let mixer: THREE.AnimationMixer | null = null;
	let idleAction: THREE.AnimationAction | null = null;

	// Maths / bill-stack / bill-materials modules (dynamic-imported once in
	// hydrate) — held so reframe()/refreshStage()/renderTiered() can reach
	// them without re-importing per call.
	let M: typeof import('./maths.js') | null = null;
	let BS: typeof import('../billStack.js') | null = null;
	let BM: typeof import('./billMaterials.js') | null = null;
	let maxAnisotropy = 1;

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

	// Separately: literal mode frames the column's FULL height, and that
	// forces a deliberate, disclosed departure from physical proportion.
	// The column's true width is a fixed real-bill footprint (~15.6 cm),
	// and `framingDistance` dollies back linearly with the framed height —
	// frame even a 15 m column true-width and it subtends ~2 px; at
	// monolith heights it is genuinely sub-pixel and the stage looks empty.
	// So `renderLiteral` widens the whole column (X/Z only — HEIGHT STAYS
	// EXACTLY TRUE) just enough that the framed tower keeps this
	// height:width aspect: a ~14:1 slender tower reads clearly at ~2% of
	// frame width. The widening is disclosed on-stage whenever it kicks in
	// (the `.width-hint` caption, same staging-honesty idiom as the dog's
	// foreground line), and the readout's height/comparison numbers are
	// computed from the true dimensions regardless.
	const LITERAL_TOWER_ASPECT = 14;

	let tierGroup: THREE.Group | null = null;

	// Literal mode's disclosed width exaggeration (see LITERAL_TOWER_ASPECT).
	// 1 in tiered mode and for short columns; the template shows the
	// `.width-hint` disclosure caption whenever it meaningfully exceeds 1.
	let widthScale = $state(1);

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
	 *  materials, per-axis cell size, the render cap (`renderLimit`, e.g.
	 *  `PALLET_RENDER_CAP` for pallet), and `spacingFactor` (>1 opens a
	 *  visible air gap between neighbouring blocks on the horizontal
	 *  `cell * spacingFactor` pitch below — without it, adjacent blocks
	 *  touch face to face and the whole grid reads as one fused monolith
	 *  instead of discrete bundles/pallets). The factor applies to X/Z
	 *  ONLY: blocks stack under gravity, so a vertical gap would leave the
	 *  upper layers hovering — anti-gravity slabs — instead of resting on
	 *  the layer beneath. Per-instance rotation/position jitter (bounded to
	 *  a quarter of the gap, so blocks never interpenetrate) breaks up the
	 *  remaining grid-aligned repetition. */
	function placeGridInstances(
		three: typeof THREE,
		geometry: THREE.BoxGeometry,
		materials: THREE.MeshStandardMaterial[],
		grid: CubicGrid,
		cellWidthM: number,
		cellHeightM: number,
		cellLengthM: number,
		renderLimit: number,
		spacingFactor: number
	): number {
		if (!scene || !tierGroup) return 0;
		const instanced = new three.InstancedMesh(geometry, materials, grid.colsX * grid.colsZ * grid.layersY);
		instanced.castShadow = true;
		const m = new three.Matrix4();
		const color = new three.Color();
		const pitchX = cellWidthM * spacingFactor;
		// Vertically the blocks rest on each other (see the doc comment). The
		// 0.2% epsilon is not a visible gap — it keeps a jittered block's
		// bottom face from being exactly coplanar with slivers of the lower
		// block's exposed top face, which would z-fight/shimmer.
		const pitchY = cellHeightM * 1.002;
		const pitchZ = cellLengthM * spacingFactor;
		const gapX = pitchX - cellWidthM;
		const gapZ = pitchZ - cellLengthM;
		let i = 0;
		for (let x = 0; x < grid.colsX; x++) {
			for (let y = 0; y < grid.layersY; y++) {
				for (let z = 0; z < grid.colsZ; z++) {
					if (i >= renderLimit) break;
					const jitterX = (Math.random() - 0.5) * 0.5 * gapX; // ±25% of the gap
					const jitterZ = (Math.random() - 0.5) * 0.5 * gapZ;
					const jitterRotY = (Math.random() - 0.5) * 0.04; // ±0.02 rad
					m.makeRotationY(jitterRotY);
					m.setPosition(
						(x - (grid.colsX - 1) / 2) * pitchX + jitterX,
						y * pitchY + cellHeightM / 2,
						(z - (grid.colsZ - 1) / 2) * pitchZ + jitterZ
					);
					instanced.setMatrixAt(i, m);
					// Subtle per-instance shade variation (±3% value, grey-white)
					// so identical blocks don't fuse into one flat-lit monolith.
					// instanceColor multiplies the material colour independently
					// of vertexColors — no material flags needed.
					color.setScalar(0.97 + Math.random() * 0.06);
					instanced.setColorAt(i, color);
					i++;
				}
			}
		}
		instanced.count = i;
		instanced.instanceMatrix.needsUpdate = true;
		if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
		tierGroup.add(instanced);
		scene.add(tierGroup);
		return Math.max(grid.colsX * pitchX, grid.layersY * pitchY, grid.colsZ * pitchZ);
	}

	function renderTiered(three: typeof THREE, billStackMod: typeof import('../billStack.js'), count: number): number {
		if (!scene || !bakedBillGeometry || !billMats) return 0;
		clearTierGroup(three);
		tierGroup = new three.Group();
		widthScale = 1; // tiered geometry is always true-proportioned

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
				const jitterX = (Math.random() - 0.5) * widthM * 0.06; // ±3% of footprint
				const jitterZ = (Math.random() - 0.5) * lengthM * 0.06;
				const jitterRotY = (Math.random() - 0.5) * 0.12; // ±0.06 rad
				m.makeRotationY(jitterRotY);
				m.setPosition(jitterX, thicknessM * (i + 0.5), jitterZ);
				instanced.setMatrixAt(i, m);
			}
			instanced.instanceMatrix.needsUpdate = true;
			tierGroup.add(instanced);
			scene.add(tierGroup);
			// Dominant extent, metres — a flat loose/strap stack is only a few
			// mm tall but a full 156 mm long, so the taller of height/footprint
			// keeps the camera from dollying in absurdly close on a wide, short
			// pile (see the matching max() in renderLiteral below).
			return Math.max(count * thicknessM, lengthM);
		}

		if (tier === 'bundle' || tier === 'cube') {
			// Coalesced textured blocks, one per bundle of NOTES_PER_BUNDLE
			// notes, arranged via cubicGridDims. Side faces carry the per-note
			// edge stripes (repeat.y = true note count — physically honest).
			const bundleGeom = new three.BoxGeometry(widthM, BUNDLE_HEIGHT_MM / 1000, lengthM);
			const edgeMat = billMats.edge.clone();
			edgeMat.map = edgeMat.map!.clone();
			edgeMat.map.anisotropy = maxAnisotropy;
			edgeMat.map.repeat.set(1, billStackMod.NOTES_PER_BUNDLE);
			edgeMat.map.needsUpdate = true;
			const blockMats = [edgeMat, edgeMat, billMats.face, billMats.face, edgeMat, edgeMat]; // BoxGeometry face order: +x -x +y -y +z -z
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
				bundleCount,
				1.06
			);
		}

		// pallet: a receding field of pallet-scale blocks (10x10x10 bundles
		// each — a non-cubic ~0.66 x 1.09 x 1.56 m box, since a bundle isn't
		// a cube), capped for renderability — the readout's note count
		// carries the true magnitude past the cap, same principle as
		// Cocaine's `production` tier. Cell sizes are per-axis, exactly like
		// the bundle/cube branch above: a uniform max-extent cell would bake
		// ~0.47 m of vertical air under every layer (floating slabs) and
		// over-wide x-aisles.
		const palletWidthMm = 10 * billStackMod.BILL_WIDTH_MM;
		const palletLengthMm = 10 * billStackMod.BILL_LENGTH_MM;
		const palletHeightMm = 10 * BUNDLE_HEIGHT_MM;
		const palletGeom = new three.BoxGeometry(
			palletWidthMm / 1000,
			palletHeightMm / 1000,
			palletLengthMm / 1000
		);
		// Pallet materials: bundle-scale granularity, not note-scale. Side
		// faces tile the bundle-unit texture 10x10 (a pallet face is 10x10
		// bundle edges — see makeBundleUnitTexture's comment for why this is
		// deliberately impressionistic rather than per-note-honest); the top
		// face tiles the bill FACE art 10x10 (a pallet top is 10x10 bundle
		// tops, each one bill face). Both are fresh, tier-group-owned
		// resources: clearTierGroup disposes any material (and its map) that
		// isn't the shared billMats.face/edge, which covers these.
		const bundleUnitMat = new three.MeshStandardMaterial({
			map: BM!.makeBundleUnitTexture(),
			roughness: 0.9,
			metalness: 0,
		});
		bundleUnitMat.map!.anisotropy = maxAnisotropy;
		bundleUnitMat.map!.repeat.set(10, 10);
		bundleUnitMat.map!.needsUpdate = true;
		const palletTopMat = billMats.face.clone();
		palletTopMat.map = palletTopMat.map!.clone();
		palletTopMat.map.wrapS = palletTopMat.map.wrapT = three.RepeatWrapping;
		palletTopMat.map.anisotropy = maxAnisotropy;
		palletTopMat.map.repeat.set(10, 10);
		palletTopMat.map.needsUpdate = true;
		const palletMats = [
			bundleUnitMat,
			bundleUnitMat,
			palletTopMat,
			palletTopMat,
			bundleUnitMat,
			bundleUnitMat,
		]; // BoxGeometry face order: +x -x +y -y +z -z

		const totalPallets = Math.ceil(count / (billStackMod.NOTES_PER_BUNDLE * PALLET_BUNDLES));
		const renderedPallets = Math.min(totalPallets, PALLET_RENDER_CAP);
		const grid = billStackMod.cubicGridDims(renderedPallets, palletWidthMm, palletLengthMm, palletHeightMm);
		return placeGridInstances(
			three,
			palletGeom,
			palletMats,
			grid,
			palletWidthMm / 1000,
			palletHeightMm / 1000,
			palletLengthMm / 1000,
			renderedPallets,
			1.12
		);
	}

	const LITERAL_INSTANCE_CAP = 2000; // individually-instanced bills at the base of the column

	/** Literal mode: a single column framed at its FULL height, regardless
	 *  of tier — the base is individually-instanced real bill geometry (up
	 *  to `LITERAL_INSTANCE_CAP`, matching the loose/strap approach in
	 *  `renderTiered`), and any remaining height above that cap is a single
	 *  coalesced block sized to make up the rest of `stackHeightMm(count)`
	 *  exactly, so the modelled geometry's HEIGHT is always physically
	 *  honest up to `LITERAL_HEIGHT_RENDER_CAP_M` (a float32-precision
	 *  safety net; framing the 10 km render-capped column full-height is
	 *  visually identical to framing the true one). The column's WIDTH is
	 *  deliberately exaggerated (uniform X/Z group scale) just enough to
	 *  hold `LITERAL_TOWER_ASPECT` at the framed height — see that
	 *  constant's comment; `widthScale` exposes the factor so the template
	 *  can disclose it on-stage. `BillReadout` computes the true, uncapped
	 *  height straight from `stackHeightMm` for the text readout, so the
	 *  displayed numbers never lie. */
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
			edgeMat.map.anisotropy = maxAnisotropy;
			edgeMat.map.repeat.set(1, remaining); // physically-honest stripe density (Task 10)
			edgeMat.map.needsUpdate = true;
			const blockMats = [edgeMat, edgeMat, billMats.face, billMats.face, edgeMat, edgeMat];
			const block = new three.Mesh(blockGeom, blockMats);
			block.castShadow = true;
			block.position.y = instancedCount * thicknessM + remainingHeightM / 2;
			tierGroup.add(block);
		}

		scene.add(tierGroup);

		// Width exaggeration for the full-height tower shot (disclosed via
		// widthScale — see LITERAL_TOWER_ASPECT). X/Z only; Y stays 1 so the
		// column's height remains exactly true. Applied at the group level so
		// the instanced base bills and the coalesced block widen together and
		// the column stays coherent. s = 1 for columns short enough to read
		// at true width.
		const s = Math.max(1, renderHeightM / (LITERAL_TOWER_ASPECT * lengthM));
		tierGroup.scale.set(s, 1, s);
		widthScale = s;

		// Dominant = the framed extent: full height for tall columns, or the
		// (possibly widened) footprint for squat ones — same footprint-floor
		// reasoning as the loose/strap branch in renderTiered above.
		return Math.max(renderHeightM, lengthM * s);
	}

	let wantPos: THREE.Vector3 | null = null;
	let wantAim: THREE.Vector3 | null = null;
	let prefersReduced = false;
	// True once reframe() has run at least once since the last hydrate — the
	// very first reframe snaps straight to target instead of lerping in from
	// the hardcoded bootstrap camPos (mirrors LiveStage's `update(true)` calls
	// at hydrate and after the dog loads).
	let framedOnce = false;

	/** Reframes the camera (and the dog's staging position, key light,
	 *  shadow frustum, and fog) to whatever `renderTiered`/`renderLiteral`
	 *  reports as the dominant extent — using the exact same tested rig
	 *  LiveStage drives its cube from: `M.cameraTransform()` for
	 *  position/aim, and `M.dogStagePosition()` for where the Shiba stands.
	 *  An earlier revision of this function deliberately avoided
	 *  `cameraTransform()` because BillStage had no dog anywhere in its
	 *  scene, so the dog-aware aim/foreground-relocation terms would have
	 *  pointed the look-at target past the edge of the rendered grid. Now
	 *  that the Shiba is staged here too, those terms are exactly what's
	 *  needed, so this rebuilds nothing by hand any more. */
	function reframe(three: typeof THREE, M: typeof import('./maths.js'), dominant: number): void {
		if (!camera || !camPos || !camAim || !wantPos || !wantAim) return;
		const safeDominant = Math.max(dominant, 1e-4);
		const tr = M.cameraTransform(safeDominant);
		wantPos.set(tr.pos.x, tr.pos.y, tr.pos.z);
		wantAim.set(tr.aim.x, tr.aim.y, tr.aim.z);

		if (dog) {
			const aspect = height > 0 ? width / height : 1;
			const sp = M.dogStagePosition(safeDominant, tr.pos, tr.aim, aspect);
			dog.position.x = sp.x;
			dog.position.z = sp.z;
			dog.rotation.y = Math.atan2(-sp.x, -sp.z) + 0.14; // face the stack
			staged = sp.staged;
		} else {
			staged = false;
		}

		// Key light + shadow-camera frustum + fog track the scale, identical
		// to LiveStage's update() (including the `tr.aim.x -` term, which
		// keeps the light aimed at the same point the camera is once the
		// dog's foreground relocation pulls that point sideways).
		if (key) {
			key.position.set(tr.aim.x - tr.dominant * 1.6, tr.dominant * 2.4, tr.dominant * 1.2);
			const sc = key.shadow.camera;
			sc.left = sc.bottom = -tr.dominant * 2.2;
			sc.right = sc.top = tr.dominant * 2.2;
			sc.near = tr.dominant * 0.1;
			sc.far = tr.dominant * 8;
			sc.updateProjectionMatrix();
		}
		if (scene) scene.fog = new three.Fog(BG, tr.dist * 2.2, tr.dist * 9);

		if (prefersReduced || !framedOnce) {
			camPos.copy(wantPos);
			camAim.copy(wantAim);
		}
		framedOnce = true;

		camera.position.copy(camPos);
		camera.lookAt(camAim);
		// Literal-mode height is uncapped (a single true-height column can run
		// into the kilometres at extreme note counts), so the near/far planes
		// must track the camera distance every reframe — same as LiveStage's
		// loop() — or a large dominant dollies the camera straight past the
		// fixed far plane and the object vanishes. Unlike LiveStage, near is
		// ALSO clamped to 2 m: full-height literal framing can dolly the
		// camera tens of km out, and dist/100 there would near-plane-clip the
		// foreground-staged dog (3.5–8.5 m from camera, per dogGroundMark's
		// clamp) into invisibility. LiveStage never hits this because gold at
		// 21M BTC is only a ~10 m cube.
		camera.near = Math.min(Math.max(camPos.length() / 100, 1e-4), 2);
		camera.far = camPos.length() * 60;
		camera.updateProjectionMatrix();
	}

	let running = false;
	const clock = { last: 0 };

	/** Damped dolly loop — matches LiveStage's damping constant so a reframe
	 *  on toggle/slider-move animates with the same feel.
	 *
	 *  NOTE for future verification: this damped dolly needs a live
	 *  requestAnimationFrame loop. Headless/preview environments can freeze
	 *  rAF entirely, leaving the camera stuck at whatever position it last
	 *  had while everything else (DOM, one-shot renders) looks alive —
	 *  screenshots then show a bogus framing. Verify framing changes on the
	 *  prefers-reduced-motion path (which snaps with no rAF) or in a real
	 *  browser. */
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
		// every frame, not just on reframe, since the dolly moves camPos here
		// (including reframe()'s 2 m near clamp for the foreground dog).
		camera.near = Math.min(Math.max(camPos.length() / 100, 1e-4), 2);
		camera.far = camPos.length() * 60;
		camera.updateProjectionMatrix();
		mixer?.update(dt); // dog idle animation
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

		const [three, gltfMod, moMod, billMaterialsMod, billStackMod, materials, maths] = await Promise.all([
			import('three'),
			import('three/addons/loaders/GLTFLoader.js'),
			import('three/addons/libs/meshopt_decoder.module.js'),
			import('./billMaterials.js'),
			import('../billStack.js'),
			import('./materials.js'),
			import('./maths.js'),
		]);
		const { loadNormalizedModel } = await import('./loadNormalizedModel.js');
		if (destroyed || !containerEl) return;
		T = three;
		M = maths;
		BS = billStackMod;
		BM = billMaterialsMod;

		width = containerEl.clientWidth || 1;
		height = containerEl.clientHeight || 1;

		renderer = new three.WebGLRenderer({ antialias: true, alpha: false });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(width, height);
		renderer.toneMapping = three.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 1.3;
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = three.PCFSoftShadowMap;
		renderer.domElement.className = 'stage-canvas';
		renderer.domElement.setAttribute('aria-hidden', 'true');
		containerEl.appendChild(renderer.domElement);
		maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

		scene = new three.Scene();
		scene.background = new three.Color(BG);
		envTexture = materials.makeEnvironmentTexture(renderer);
		scene.environment = envTexture;
		// LiveStage runs this env at 1.3, tuned for metals whose envmap
		// REFLECTIONS need the punch. Matte paper (roughness 0.85–0.9,
		// metalness 0) instead integrates the whole softbox as diffuse
		// irradiance, and at 1.3 (with the shared 1.3 tone-mapping exposure,
		// kept so the Shiba matches its look on the metal tabs) the warm
		// paper tones clip to near-white. 1.0 keeps the face art legible.
		scene.environmentIntensity = 1.0;

		camera = new three.PerspectiveCamera(maths.FOV_DEG, width / height, 1e-4, 5000);

		key = new three.DirectionalLight(0xfff2dd, 2.2);
		key.castShadow = true;
		key.shadow.mapSize.set(2048, 2048);
		scene.add(key);
		scene.add(new three.AmbientLight(0x404048, 0.4));

		// 60 km ground disc (LiveStage's is 4 km): full-height literal framing
		// can dolly the camera — and with it the foreground-staged dog — tens
		// of km from origin, and both must still stand on ground, not void.
		groundGeometry = new three.CircleGeometry(60000, 64).rotateX(-Math.PI / 2);
		groundMaterial = new three.MeshStandardMaterial({ color: 0x202024, roughness: 0.95, metalness: 0 });
		const ground = new three.Mesh(groundGeometry, groundMaterial);
		ground.receiveShadow = true;
		scene.add(ground);

		const face = billMaterialsMod.makeBillFaceTexture();
		const edge = billMaterialsMod.makeBillEdgeTexture();
		face.anisotropy = maxAnisotropy;
		edge.anisotropy = maxAnisotropy;
		billMats = billMaterialsMod.makeBillMaterials(face, edge);

		camPos = new three.Vector3(0.3, 0.15, 0.4);
		camAim = new three.Vector3(0, 0.02, 0);
		wantPos = new three.Vector3();
		wantAim = new three.Vector3();
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

		// Lazy-load the Shiba (meshopt-compressed) after the rest of the scene
		// is up — same load-order as LiveStage.
		loadDog(loadNormalizedModel, three, gltfMod.GLTFLoader, moMod.MeshoptDecoder);
	}

	function loadDog(
		loadNormalizedModel: typeof import('./loadNormalizedModel.js').loadNormalizedModel,
		three: typeof THREE,
		GLTFLoaderCtor: typeof import('three/addons/loaders/GLTFLoader.js').GLTFLoader,
		MeshoptDecoder: typeof import('three/addons/libs/meshopt_decoder.module.js').MeshoptDecoder
	): void {
		loadNormalizedModel(
			three,
			GLTFLoaderCtor,
			MeshoptDecoder,
			'/models/references/shiba_inu/shiba.glb',
			M!.DOG_TOTAL_HEIGHT_M,
			'y',
			(object, animations) => {
				if (destroyed || !scene || !M) return;
				dog = object;
				dog.traverse((o) => {
					if ((o as THREE.Mesh).isMesh) o.castShadow = true;
				});
				scene.add(dog);

				if (animations.length) {
					mixer = new three.AnimationMixer(dog);
					// Clips: play_dead, rollover, shake, sitting, standing. sitting
					// is the resting idle; the others are metal-tab-only easter-egg
					// tricks BillStage doesn't wire up. Select the idle by NAME —
					// animations[0] is play_dead (the dog dies; a shipped prototype
					// bug we must NOT regress).
					const idleClip =
						animations.find((c) => c.name.includes('sitting')) ?? animations[animations.length - 1];
					idleAction = mixer.clipAction(idleClip);
					idleAction.play();
					// Unlike LiveStage (which never hydrates under reduced motion),
					// BillStage does — and startLoop() never runs a rAF loop in that
					// case, so nothing would otherwise call mixer.update() to bake
					// the idle pose onto the skeleton. One manual update(0) here
					// poses the dog statically at hydrate time.
					if (prefersReduced) mixer.update(0);
				}

				// Re-run the current framing so the dog is positioned immediately
				// instead of waiting for the next noteCount/viewMode change.
				refreshStage(noteCount, viewMode);
			},
			() => {
				/* Dog failed to load — the scene continues without it, same
				   graceful degradation as the bill model's own error path. */
			}
		);
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
		refreshStage(noteCount, viewMode); // aspect feeds dog staging
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
		// Same ordering requirement as the shared bill resources above: must
		// run before renderer.dispose() resets WebGLProperties' WeakMap.
		envTexture?.dispose();
		mixer?.stopAllAction();

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
		envTexture = null;
		dog = mixer = idleAction = null;
		staged = false;
		widthScale = 1;
		framedOnce = false;
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

	/** Recomputes the tiered/literal render for `count`/`mode` and reframes
	 *  the camera + dog around whatever dominant extent that produced. Called
	 *  from the reactive effect below on every noteCount/viewMode change,
	 *  and again once the dog finishes loading (see `loadDog`) and on resize
	 *  (aspect feeds `M.dogStagePosition`). No-ops until both the bill GLB
	 *  and the maths/billStack modules are ready. */
	function refreshStage(count: number, mode: 'tiered' | 'literal'): void {
		if (!canvasActive || !T || !M || !BS || !BM || !bakedBillGeometry) return;
		const dominant = mode === 'literal' ? renderLiteral(T, BS, count) : renderTiered(T, BS, count);
		reframe(T, M, dominant);
		render();
	}

	$effect(() => {
		const count = noteCount;
		const mode = viewMode;
		if (!canvasActive) return;
		refreshStage(count, mode);
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
	{#if viewMode === 'literal' && widthScale > 1.05}
		<!--
			Staging honesty: the full-height tower shot deliberately widens the
			column (height stays true) so it doesn't vanish to a sub-pixel
			hairline — see LITERAL_TOWER_ASPECT. Disclosed on-stage, same idiom
			as the dog's foreground perspective line in the readout.
		-->
		<div class="width-hint">
			column widened {widthScale.toLocaleString('en-US', {
				maximumFractionDigits: widthScale >= 10 ? 0 : 1,
			})}× to stay visible — height is true
		</div>
	{/if}
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
	.width-hint {
		position: absolute;
		bottom: 8px;
		left: 12px;
		font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
		font-size: 11px;
		color: #71717a;
		pointer-events: none;
		z-index: 1;
	}
</style>
