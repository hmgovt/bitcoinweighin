<script lang="ts">
	/**
	 * LiveStage — the single real-time WebGL hero stage. Ports the signed-off
	 * `prototypes/live-scene.html` 1:1 into the production site.
	 *
	 * Integration contract (handoff stage 12, inviolable):
	 *  · Poster-first: the SSR-rendered cube + Shiba sprite composition
	 *    (`CubeRenderer`) IS both the prerendered poster (anchors LCP, crawler-
	 *    visible) AND the dispatch fallback. The canvas overlays on top only
	 *    after hydration; on no-WebGL / reduced-motion / context-loss it never
	 *    appears and the poster carries the scene.
	 *  · One WebGL context. three + the model lazy-load on first interaction or
	 *    idle — never in the first-paint chunk (dynamic-imported in onMount).
	 *  · Camera / staging / glow maths live in `./maths.ts` (tested); materials
	 *    in `./materials.ts`. This component is the renderer + lifecycle only.
	 *
	 * The stage is a pure consumer of `(commodity, amount)`. `staged` is a
	 * bindable the page reads to add the "Shiba standing nearer the camera"
	 * honesty line to the readout when the dog is in the foreground.
	 */
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type { Commodity } from '$lib/commodities.js';
	import CubeRenderer from '$lib/components/CubeRenderer.svelte';

	// Type-only imports — erased at build, so no `three` in the SSR/first-paint
	// chunk. The runtime modules are dynamic-imported in `hydrate()`.
	import type * as THREE from 'three';
	import type { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
	import type { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
	import type { CubeMaterials } from './materials.js';

	let {
		commodity,
		amount,
		staged = $bindable(false),
	}: {
		commodity: Commodity;
		amount: number | null;
		/** True when the dog has walked to the foreground (readout honesty line). */
		staged?: boolean;
	} = $props();

	const BG = 0x18181b;

	let containerEl: HTMLDivElement | undefined = $state();
	let canvasActive = $state(false); // canvas mounted + rendering (poster covered)

	// ── Scene refs (typed via the erased namespace import) ────────────────────
	let T: typeof THREE | null = null;
	let renderer: THREE.WebGLRenderer | null = null;
	let composer: EffectComposer | null = null;
	let bloomPass: UnrealBloomPass | null = null;
	let scene: THREE.Scene | null = null;
	let camera: THREE.PerspectiveCamera | null = null;
	let cube: THREE.Mesh | null = null;
	let mats: CubeMaterials | null = null;
	let key: THREE.DirectionalLight | null = null;
	let puLight: THREE.PointLight | null = null;
	let dog: THREE.Object3D | null = null;
	let mixer: THREE.AnimationMixer | null = null;
	let idleAction: THREE.AnimationAction | null = null;
	let trickClips: THREE.AnimationClip[] = [];
	let envTexture: THREE.Texture | null = null;

	let camPos: THREE.Vector3 | null = null;
	let camAim: THREE.Vector3 | null = null;
	let wantPos: THREE.Vector3 | null = null;
	let wantAim: THREE.Vector3 | null = null;

	// Maths module (dynamic-imported) — held so `update()` can reach it.
	let M: typeof import('./maths.js') | null = null;

	let width = 0;
	let height = 0;
	let useBloom = false;
	let prefersReduced = false;
	let trickPlaying = false;
	let destroyed = false;
	let running = false;
	let rafId = 0;
	const clock = { last: 0 };

	let resizeObs: ResizeObserver | null = null;
	let viewObs: IntersectionObserver | null = null;
	let hoverTimer: ReturnType<typeof setTimeout> | null = null;
	let raycaster: THREE.Raycaster | null = null;

	const isPu = (c: Commodity) => c.id === 'pu238';

	function hasWebGL(): boolean {
		try {
			const c = document.createElement('canvas');
			return !!(c.getContext('webgl2') || c.getContext('webgl'));
		} catch {
			return false;
		}
	}

	// ── Scene update — drives camera/staging/glow from (commodity, amount) ────
	function update(snap = false): void {
		if (!T || !M || !scene || !cube || !mats || !camPos || !wantPos || !wantAim || !key) return;
		const a = amount ?? 0;
		if (a <= 0) return; // no data for this date — keep last frame, poster covers gaps

		const edge = M.cubeEdgeMetres(a, commodity);
		const safeEdge = Math.max(edge, 1e-5);

		cube.material = mats[commodity.id as keyof CubeMaterials] ?? mats.gold;
		cube.scale.setScalar(safeEdge);
		cube.position.y = safeEdge / 2;

		// Pu-238 thermal glow vs metal bloom (dog must never halo on metals).
		if (isPu(commodity) && puLight) {
			const g = M.puGlowRamp(edge);
			const pu = mats.pu238;
			pu.emissive.setRGB(g.emissive.r, g.emissive.g, g.emissive.b);
			pu.emissiveIntensity = g.emissiveIntensity;
			puLight.color.copy(pu.emissive);
			puLight.intensity = g.lightIntensity;
			puLight.position.set(0, safeEdge / 2, 0);
			scene.environmentIntensity = 0.45; // dark lab; the glow carries
			if (bloomPass) {
				bloomPass.strength = g.bloom.strength;
				bloomPass.threshold = g.bloom.threshold;
			}
		} else {
			if (puLight) puLight.intensity = 0;
			scene.environmentIntensity = 1.3;
			if (bloomPass) {
				bloomPass.strength = M.METAL_BLOOM.strength;
				bloomPass.threshold = M.METAL_BLOOM.threshold;
			}
		}

		// Camera target + dog staging from the tested maths.
		const aspect = height > 0 ? width / height : 1;
		const tr = M.cameraTransform(edge);
		wantPos.set(tr.pos.x, tr.pos.y, tr.pos.z);
		wantAim.set(tr.aim.x, tr.aim.y, tr.aim.z);

		if (dog) {
			const sp = M.dogStagePosition(edge, tr.pos, tr.aim, aspect);
			dog.position.x = sp.x;
			dog.position.z = sp.z;
			dog.rotation.y = Math.atan2(-dog.position.x, -dog.position.z) + 0.14; // face the cube
			staged = sp.staged;
		} else {
			staged = false;
		}

		// Key light + fog track the scale so shadows and depth stay tuned.
		key.position.set(tr.aim.x - tr.dominant * 1.6, tr.dominant * 2.4, tr.dominant * 1.2);
		const sc = key.shadow.camera;
		sc.left = sc.bottom = -tr.dominant * 2.2;
		sc.right = sc.top = tr.dominant * 2.2;
		sc.near = tr.dominant * 0.1;
		sc.far = tr.dominant * 8;
		sc.updateProjectionMatrix();
		scene.fog = new T.Fog(BG, tr.dist * 2.2, tr.dist * 9);

		if (snap && camAim) {
			camPos.copy(wantPos);
			camAim.copy(wantAim);
		}
	}

	// React to slider / preset / tab changes once the scene is live.
	$effect(() => {
		// touch reactive props so the effect re-runs on change
		void commodity;
		void amount;
		if (canvasActive) update();
	});

	// ── Render loop (damped dolly — the easing IS the scale cue) ──────────────
	function loop(): void {
		if (!running || destroyed || !T || !camera || !camPos || !camAim || !wantPos || !wantAim) return;
		rafId = requestAnimationFrame(loop);

		const now = performance.now();
		const dt = Math.min((now - clock.last) / 1000 || 0, 0.05);
		clock.last = now;

		const k = 1 - Math.exp(-dt * 3.2);
		camPos.lerp(wantPos, k);
		camAim.lerp(wantAim, k);
		camera.position.copy(camPos);
		camera.near = Math.max(camPos.length() / 100, 1e-4);
		camera.far = camPos.length() * 60;
		camera.updateProjectionMatrix();
		camera.lookAt(camAim);

		mixer?.update(dt);
		if (useBloom && composer) composer.render();
		else if (renderer && scene) renderer.render(scene, camera);
	}

	function startLoop(): void {
		if (running || destroyed || !canvasActive) return;
		running = true;
		clock.last = performance.now();
		rafId = requestAnimationFrame(loop);
	}
	function stopLoop(): void {
		running = false;
		if (rafId) cancelAnimationFrame(rafId);
		rafId = 0;
	}

	// ── Easter egg — hover dwell / tap / ?easter=doge → random trick ──────────
	function playTrick(): void {
		if (prefersReduced || !mixer || trickPlaying || !trickClips.length) return;
		trickPlaying = true;
		const clip = trickClips[Math.floor(Math.random() * trickClips.length)];
		const action = mixer.clipAction(clip);
		action.reset();
		action.setLoop(2200, 1); // THREE.LoopOnce
		idleAction?.fadeOut(0.25);
		action.fadeIn(0.25).play();
	}

	function pointerOnDog(e: PointerEvent): boolean {
		if (!dog || !raycaster || !camera || !T || !renderer) return false;
		const rect = (renderer.domElement as HTMLCanvasElement).getBoundingClientRect();
		const ndc = new T.Vector2(
			((e.clientX - rect.left) / rect.width) * 2 - 1,
			-((e.clientY - rect.top) / rect.height) * 2 + 1
		);
		raycaster.setFromCamera(ndc, camera);
		return raycaster.intersectObject(dog, true).length > 0;
	}

	// ── Hydrate: build the WebGL scene (dynamic-imports three) ────────────────
	async function hydrate(): Promise<void> {
		if (destroyed || canvasActive || !containerEl) return;

		const [three, gltfMod, rbgMod, ecMod, rpMod, ubpMod, opMod, moMod, materials, maths] =
			await Promise.all([
				import('three'),
				import('three/addons/loaders/GLTFLoader.js'),
				import('three/addons/geometries/RoundedBoxGeometry.js'),
				import('three/addons/postprocessing/EffectComposer.js'),
				import('three/addons/postprocessing/RenderPass.js'),
				import('three/addons/postprocessing/UnrealBloomPass.js'),
				import('three/addons/postprocessing/OutputPass.js'),
				import('three/addons/libs/meshopt_decoder.module.js'),
				import('./materials.js'),
				import('./maths.js'),
			]);
		if (destroyed || !containerEl) return;
		T = three;
		M = maths;

		width = containerEl.clientWidth || 1;
		height = containerEl.clientHeight || 1;

		renderer = new three.WebGLRenderer({ antialias: true, alpha: false });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // DPR cap 2
		renderer.setSize(width, height);
		renderer.toneMapping = three.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 1.3;
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = three.PCFSoftShadowMap;
		renderer.domElement.className = 'stage-canvas';
		renderer.domElement.setAttribute('aria-hidden', 'true');
		containerEl.appendChild(renderer.domElement);

		renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);

		useBloom = renderer.capabilities.isWebGL2; // bloom only on WebGL2

		scene = new three.Scene();
		scene.background = new three.Color(BG);
		envTexture = materials.makeEnvironmentTexture(renderer);
		scene.environment = envTexture;
		scene.environmentIntensity = 1.3;

		camera = new three.PerspectiveCamera(maths.FOV_DEG, width / height, 1e-4, 5000);

		key = new three.DirectionalLight(0xfff2dd, 2.4);
		key.castShadow = true;
		key.shadow.mapSize.set(2048, 2048);
		scene.add(key);
		scene.add(new three.AmbientLight(0x404048, 0.25));

		const ground = new three.Mesh(
			new three.CircleGeometry(4000, 64).rotateX(-Math.PI / 2),
			new three.MeshStandardMaterial({ color: 0x202024, roughness: 0.95, metalness: 0 })
		);
		ground.receiveShadow = true;
		scene.add(ground);

		const roughMap = materials.makeRoughnessMap();
		mats = materials.makeMaterials(roughMap);

		cube = new three.Mesh(new rbgMod.RoundedBoxGeometry(1, 1, 1, 4, 0.018), mats.gold);
		cube.castShadow = true;
		scene.add(cube);

		puLight = new three.PointLight(0xff5a1e, 0, 0, 2);
		scene.add(puLight);

		// Smoothed + target camera vectors.
		camPos = new three.Vector3(2, 1, 3);
		camAim = new three.Vector3(0, 0.3, 0);
		wantPos = new three.Vector3();
		wantAim = new three.Vector3();
		raycaster = new three.Raycaster();

		// Composer (bloom) — WebGL2 only.
		if (useBloom) {
			composer = new ecMod.EffectComposer(renderer);
			composer.addPass(new rpMod.RenderPass(scene, camera));
			bloomPass = new ubpMod.UnrealBloomPass(new three.Vector2(width, height), 0.35, 0.5, 0.85);
			composer.addPass(bloomPass);
			composer.addPass(new opMod.OutputPass());
		}

		// Pointer / easter-egg wiring.
		renderer.domElement.addEventListener('pointermove', onPointerMove);
		renderer.domElement.addEventListener('pointerdown', onPointerDown);

		// Snap the camera to the first frame, reveal the canvas, start the loop.
		update(true);
		canvasActive = true;
		startLoop();

		// Observers: resize + pause when off-screen / tab hidden.
		resizeObs = new ResizeObserver(() => onResize());
		resizeObs.observe(containerEl);
		viewObs = new IntersectionObserver(
			(entries) => {
				const visible = entries[0]?.isIntersecting ?? true;
				if (visible && !document.hidden) startLoop();
				else stopLoop();
			},
			{ threshold: 0 }
		);
		viewObs.observe(containerEl);
		document.addEventListener('visibilitychange', onVisibility);

		// Lazy-load the Shiba (meshopt-compressed) after the scene is up.
		loadDog(three, gltfMod.GLTFLoader, moMod.MeshoptDecoder);
	}

	function loadDog(
		three: typeof THREE,
		GLTFLoader: typeof import('three/addons/loaders/GLTFLoader.js').GLTFLoader,
		MeshoptDecoder: typeof import('three/addons/libs/meshopt_decoder.module.js').MeshoptDecoder
	): void {
		const loader = new GLTFLoader();
		loader.setMeshoptDecoder(MeshoptDecoder);
		loader.load(
			'/models/references/shiba_inu/shiba.glb',
			(gltf) => {
				if (destroyed || !scene || !M) return;
				dog = gltf.scene;
				const box = new three.Box3().setFromObject(dog);
				const size = box.getSize(new three.Vector3());
				dog.scale.setScalar(M.DOG_TOTAL_HEIGHT_M / size.y);
				const box2 = new three.Box3().setFromObject(dog);
				dog.position.y -= box2.min.y; // feet on ground
				dog.traverse((o) => {
					if ((o as THREE.Mesh).isMesh) o.castShadow = true;
				});
				scene.add(dog);

				if (gltf.animations?.length) {
					mixer = new three.AnimationMixer(dog);
					// Clips: play_dead, rollover, shake, sitting, standing. sitting is
					// the resting idle; the first three are easter-egg tricks. Select
					// the idle by NAME — animations[0] is play_dead (the dog dies; a
					// shipped prototype bug we must NOT regress).
					const idleClip =
						gltf.animations.find((c) => c.name.includes('sitting')) ??
						gltf.animations[gltf.animations.length - 1];
					idleAction = mixer.clipAction(idleClip);
					trickClips = gltf.animations.filter((c) => /play_dead|rollover|shake/.test(c.name));
					if (!prefersReduced) idleAction.play();
					mixer.addEventListener('finished', () => {
						trickPlaying = false;
						idleAction?.reset().fadeIn(0.3).play();
					});
					if (new URLSearchParams(location.search).get('easter') === 'doge') {
						setTimeout(playTrick, 800);
					}
				}
				update(true);
			},
			undefined,
			() => {
				/* Model failed — scene continues without the dog; the poster keeps a
				   Shiba anyway, so this degrades gracefully. */
			}
		);
	}

	// ── Event handlers ────────────────────────────────────────────────────────
	function onResize(): void {
		if (!containerEl || !renderer || !camera) return;
		width = containerEl.clientWidth || 1;
		height = containerEl.clientHeight || 1;
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		renderer.setSize(width, height);
		composer?.setSize(width, height);
		update(); // aspect feeds dog staging
	}

	function onVisibility(): void {
		if (document.hidden) stopLoop();
		else startLoop();
	}

	function onPointerMove(e: PointerEvent): void {
		if (!renderer) return;
		const hit = pointerOnDog(e);
		renderer.domElement.style.cursor = hit ? 'pointer' : '';
		if (hit && !hoverTimer && !trickPlaying) {
			hoverTimer = setTimeout(() => {
				hoverTimer = null;
				playTrick();
			}, 200);
		} else if (!hit && hoverTimer) {
			clearTimeout(hoverTimer);
			hoverTimer = null;
		}
	}

	function onPointerDown(e: PointerEvent): void {
		if (pointerOnDog(e)) playTrick();
	}

	function onContextLost(e: Event): void {
		// Swap to the sprite fallback with the current state, keeping the readout.
		e.preventDefault();
		teardown();
		canvasActive = false; // re-reveals the CubeRenderer poster/fallback
		staged = false;
	}

	// ── Teardown ──────────────────────────────────────────────────────────────
	function teardown(): void {
		stopLoop();
		if (hoverTimer) {
			clearTimeout(hoverTimer);
			hoverTimer = null;
		}
		resizeObs?.disconnect();
		viewObs?.disconnect();
		if (browser) document.removeEventListener('visibilitychange', onVisibility);
		if (renderer) {
			renderer.domElement.removeEventListener('pointermove', onPointerMove);
			renderer.domElement.removeEventListener('pointerdown', onPointerDown);
			renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
			renderer.domElement.remove();
			renderer.dispose();
		}
		composer?.dispose?.();
		envTexture?.dispose();
		mixer?.stopAllAction();
		renderer = composer = bloomPass = scene = camera = cube = puLight = key = null;
		dog = mixer = idleAction = null;
		trickClips = [];
	}

	onMount(() => {
		if (!browser) return;
		prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		// Reduced motion or no WebGL → never hydrate; the poster IS the experience.
		if (prefersReduced || !hasWebGL()) return;

		let triggered = false;
		let idleId: number | null = null;
		const cancelIdle = () => {
			if (idleId === null) return;
			if (typeof cancelIdleCallback === 'function') cancelIdleCallback(idleId);
			else clearTimeout(idleId);
			idleId = null;
		};
		const removeTriggers = () => {
			window.removeEventListener('pointerdown', trigger);
			window.removeEventListener('keydown', trigger);
			cancelIdle();
		};
		function trigger(): void {
			if (triggered) return;
			triggered = true;
			removeTriggers();
			void hydrate();
		}
		// First interaction (slider / tabs / presets all bubble to window) OR idle.
		window.addEventListener('pointerdown', trigger, { passive: true });
		window.addEventListener('keydown', trigger);
		if (typeof requestIdleCallback === 'function') {
			idleId = requestIdleCallback(trigger, { timeout: 3000 });
		} else {
			idleId = window.setTimeout(trigger, 1200) as unknown as number;
		}

		return () => {
			destroyed = true;
			removeTriggers();
			teardown();
		};
	});
</script>

<div class="live-stage" bind:this={containerEl}>
	<!--
		Poster + fallback: the SSR cube + Shiba sprite composition. Visible to
		crawlers and JS-off visitors, anchors LCP, and re-surfaces on context
		loss. Hidden (not unmounted) once the canvas is live so it can return.
	-->
	<div class="poster" class:poster--hidden={canvasActive}>
		<CubeRenderer {commodity} amount={amount ?? 0} />
	</div>
	<!-- renderer.domElement (.stage-canvas) is appended here on hydrate. -->
</div>

<style>
	.live-stage {
		position: relative;
		width: 100%;
		/* Reserved height so the poster→canvas swap causes zero CLS. */
		height: clamp(340px, 56vh, 520px);
		overflow: hidden;
		border-radius: 8px;
		background: #18181b;
	}

	.poster {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 8px 12px;
		opacity: 1;
		transition: opacity 320ms ease;
	}
	.poster--hidden {
		opacity: 0;
		pointer-events: none;
	}
	@media (prefers-reduced-motion: reduce) {
		.poster {
			transition: none;
		}
	}

	.live-stage :global(canvas.stage-canvas) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
	}
</style>
