<!-- src/lib/scene/BillStage.svelte -->
<script lang="ts">
	/**
	 * BillStage — the Cash tab's live WebGL stage. Sibling to LiveStage.svelte
	 * (not an extension of it, same separation as CocaineBrickStack being
	 * wholly separate from CubeRenderer) because the mesh strategy is
	 * fundamentally different: instanced real bill geometry + coalesced
	 * textured blocks, not a single scaled cube.
	 *
	 * This task (11) only proves the pipeline: load the bill glb, normalize
	 * its scale, bake its transform into a reusable geometry, and render one
	 * bill so the load->normalize->material chain is verified working.
	 * Tiered/literal instancing land in Tasks 12-13; the click/keyboard
	 * toggle lands in Task 14.
	 */
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type * as THREE from 'three';

	let { noteCount = 0 }: { noteCount?: number } = $props();

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

	let bakedBillGeometry: THREE.BufferGeometry | null = null;
	let billMats: { face: THREE.MeshStandardMaterial; edge: THREE.MeshStandardMaterial } | null =
		null;
	let previewMesh: THREE.Mesh | null = null;
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
				bakedBillGeometry = extractBakedGeometry(three, object);
				if (bakedBillGeometry && billMats) {
					previewMesh = new three.Mesh(bakedBillGeometry, billMats.face);
					previewMesh.castShadow = true;
					previewMesh.position.y = billStackMod.BILL_THICKNESS_MM / 1000 / 2;
					scene.add(previewMesh);
					render();
				}
			},
			() => {
				/* Model failed to load — the poster (BillRenderer, Task 15) covers
				   this state; the WebGL canvas just stays empty. */
			}
		);

		canvasActive = true;
		render();

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
		if (resizeObs) resizeObs.disconnect();

		// previewMesh reuses bakedBillGeometry + billMats.face — dispose those
		// once below, not per-mesh, to avoid double-disposing shared resources.
		// This MUST run before renderer.dispose(): WebGLRenderer.dispose()
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
		previewMesh = null;
		groundGeometry = null;
		groundMaterial = null;
	}

	onMount(() => {
		if (!browser) return;
		if (!hasWebGL()) return;
		void hydrate();
		return () => {
			destroyed = true;
			teardown();
		};
	});
</script>

<div class="bill-stage" bind:this={containerEl}></div>

<style>
	.bill-stage {
		position: relative;
		width: 100%;
		height: clamp(340px, 56vh, 520px);
		overflow: hidden;
		border-radius: 8px;
		background: #18181b;
	}
	.bill-stage :global(canvas.stage-canvas) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
	}
</style>
