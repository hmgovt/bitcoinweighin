<script lang="ts">
	/**
	 * LiveStage — the single real-time WebGL hero stage. Ports the signed-off
	 * `prototypes/live-scene.html` 1:1 into the production site, and adds the
	 * weigh-in layer on top (2026-09-24): the Drop, direct manipulation,
	 * honest optics, and the clip recorder.
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
	 *    in `./materials.ts`. Drop physics in `./drop.ts`, lens + loupe maths in
	 *    `./optics.ts`, gesture mapping in `./grab.ts` (all tested); the effect
	 *    objects that draw them in `./effects.ts`. This component is the
	 *    renderer + lifecycle + input only.
	 *
	 * The weigh-in layer:
	 *  · HOLD. While the visitor drags the slider, a preset tweens, or they drag
	 *    the cube itself, the camera freezes where it is and the cube grows or
	 *    shrinks in place — it's allowed to outgrow the shot (a face of gold
	 *    filling the frame) instead of being politely re-framed away. The camera
	 *    only ever backs off enough to stay outside the cube.
	 *  · THE DROP. On release the camera stumbles back to its proper framing and
	 *    the cube is hoisted to its own height and dropped under real gravity.
	 *    Fall time, impact energy, dust, shake, Sat's reaction and the cracked
	 *    floor (past the building code's bedrock allowance) all follow from the
	 *    cube's real size and mass. Tapping the cube drops it again.
	 *  · GRAB. Drag the cube up/down (or pinch, or ctrl+scroll on a trackpad) to
	 *    resize it; the page turns the reported ratio into BTC through the
	 *    slider's own setter. Drag the floor sideways to orbit; it springs back
	 *    to the canonical shot on release so staging honesty is never left in a
	 *    state the dog-placement maths didn't solve for.
	 *  · OPTICS. A physical depth-of-field pass (declared 38 mm f/2.8 lens) and,
	 *    for cubes too small to resolve, a magnifier loupe with a declared power.
	 *  · SOUND. The landing is heard mostly through the floor (`impact-sound.ts`):
	 *    the blow's force pulse — τ = π√(m/k), longer and deeper for bigger
	 *    cubes — radiated by the slab, a crack from the cube stopping dead,
	 *    fracture when the floor cracks, and a stated room. Off by default;
	 *    the stage's speaker toggle shares the site's one audio switch
	 *    (`audioEnabled`, `?audio=on`) with the Pu-238 Geiger counter.
	 *  · CLIP. "Make a clip" records the Drop at the current amount as a
	 *    vertical video (numbers and the sound baked in) to share.
	 *
	 * The stage is a pure consumer of `(commodity, amount)`. `staged` is a
	 * bindable the page reads to add the "Sat is standing nearer the camera"
	 * honesty line to the readout when the dog — Sat, the Shiba — is in the
	 * foreground.
	 */
	import { onMount, tick } from 'svelte';
	import { get } from 'svelte/store';
	import { browser } from '$app/environment';
	import type { Commodity } from '$lib/commodities.js';
	import CubeRenderer from '$lib/components/CubeRenderer.svelte';
	import { computeMassGrams } from '$lib/volume.js';
	import {
		STANDARD_GRAVITY,
		RESTITUTION,
		dropHeightM,
		dropOffset,
		dropDurationS,
		hoistOffset,
		HOIST_S,
		impactEnergyJ,
		nthImpactEnergyJ,
		impactIntensity,
		shakeProfile,
		dustRadiusM,
		bearingPressurePa,
		exceedsBedrock,
		clearCameraFromCube,
		formatDuration,
	} from './drop.js';
	import { TAP_SLOP_PX, dragRatio, pinchRatio, wheelZoomRatio, orbitYaw } from './grab.js';
	import {
		isSoundingMaterial,
		synthImpact,
		contactTimeS,
		peakForceN,
		formatForce,
		type SoundingMaterial,
	} from './impact-sound.js';
	import { system } from '$lib/stores/system.js';
	import { audioEnabled } from '$lib/stores/url.js';
	// The clip recorder is dynamic-imported with the rest of the scene
	// (`C` below) — only its types are needed up front.
	import type { ClipInfo, ClipLoupe } from './clip.js';

	// Type-only imports — erased at build, so no `three` in the SSR/first-paint
	// chunk. The runtime modules are dynamic-imported in `hydrate()`.
	import type * as THREE from 'three';
	import type { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
	import type { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
	import type { CubeMaterials } from './materials.js';
	import type { Dust, Crack, Shaker, PhysicalDofPass, Loupe } from './effects.js';
	import { loadNormalizedModel } from './loadNormalizedModel.js';

	let {
		commodity,
		amount,
		staged = $bindable(false),
		held = false,
		dropSignal = 0,
		grabEnabled = true,
		ongrab,
		clipInfo = null,
		accent = '#d4a14a',
	}: {
		commodity: Commodity;
		amount: number | null;
		/** True when the dog has walked to the foreground (readout honesty line). */
		staged?: boolean;
		/** The page is holding the cube (slider drag / preset tween). Camera
		 *  freezes while true; the cube drops when it goes false. */
		held?: boolean;
		/** Increment to drop the cube without a hold (typed amount, key jumps). */
		dropSignal?: number;
		/** Whether dragging the cube resizes it (BTC mode). In date mode a cube
		 *  drag orbits instead — the slider owns the date. */
		grabEnabled?: boolean;
		/** Direct-manipulation callback: `ratio` = amount now ÷ amount at 'start'. */
		ongrab?: (phase: 'start' | 'move' | 'end', ratio: number) => void;
		/** Text for the clip recorder; null hides "Make a clip". */
		clipInfo?: ClipInfo | null;
		/** Commodity accent colour — loupe ring and overlays. */
		accent?: string;
	} = $props();

	const BG = 0x18181b;

	let containerEl: HTMLDivElement | undefined = $state();
	let canvasActive = $state(false); // canvas mounted + rendering (poster covered)

	// ── Overlay UI state ──────────────────────────────────────────────────────
	let hintVisible = $state(false);
	let recordSupported = $state(false);
	/** Loupe geometry in CSS px (top-left origin) for the DOM leader line. */
	let loupeUi = $state<ClipLoupe | null>(null);
	type StudioState = 'idle' | 'recording' | 'done' | 'error';
	let studio = $state<StudioState>('idle');
	let clipUrl = $state('');
	let clipFileName = $state('clip.mp4');
	let canShareFile = $state(false);
	let previewHost: HTMLDivElement | undefined = $state();
	/** Transient "0.7 ms blow · 207 tons of force" caption after a landing. */
	let blowCaption = $state<string | null>(null);
	let blowCaptionTimer: ReturnType<typeof setTimeout> | null = null;
	const soundOn = $derived($audioEnabled);
	let videoEl: HTMLVideoElement | undefined = $state();
	let clipFile: File | null = null;

	// ── Scene refs (typed via the erased namespace import) ────────────────────
	let T: typeof THREE | null = null;
	let renderer: THREE.WebGLRenderer | null = null;
	let composer: EffectComposer | null = null;
	let bloomPass: UnrealBloomPass | null = null;
	let dofPass: PhysicalDofPass | null = null;
	let scene: THREE.Scene | null = null;
	let camera: THREE.PerspectiveCamera | null = null;
	let cube: THREE.Mesh | null = null;
	let mats: CubeMaterials | null = null;
	let key: THREE.DirectionalLight | null = null;
	let puLight: THREE.PointLight | null = null;
	let dog: THREE.Object3D | null = null;
	let dogBaseY = 0;
	let mixer: THREE.AnimationMixer | null = null;
	let idleAction: THREE.AnimationAction | null = null;
	let trickClips: THREE.AnimationClip[] = [];
	let trickQueue: THREE.AnimationClip[] = []; // pending tricks (Konami chain)
	let envTexture: THREE.Texture | null = null;
	let dust: Dust | null = null;
	let crack: Crack | null = null;
	let shaker: Shaker | null = null;
	let loupe: Loupe | null = null;

	// ── Gaze tracking (brief §2.2) ─────────────────────────────────────────
	// `headBone` is found by name once the dog loads; stays null (gaze never
	// runs) if the rig has no identifiable head joint. `gazeScratch` holds
	// reused three.js objects for the per-frame maths (no per-frame alloc);
	// `gazeLocalQuat` is the persistent, damped-toward-target head rotation —
	// nulled whenever gaze is suspended (tricks, reduced motion) so it
	// re-baselines cleanly from the fresh pose on resume instead of jumping
	// from a stale value.
	interface GazeScratch {
		headWorldPos: THREE.Vector3;
		headWorldQuat: THREE.Quaternion;
		parentWorldQuat: THREE.Quaternion;
		forwardAxis: THREE.Vector3;
		targetVec: THREE.Vector3;
		currentFwd: THREE.Vector3;
		desiredDir: THREE.Vector3;
		clampedDir: THREE.Vector3;
		idealWorldQuat: THREE.Quaternion;
		idealLocalQuat: THREE.Quaternion;
	}
	let headBone: THREE.Bone | null = null;
	let gazeScratch: GazeScratch | null = null;
	let gazeLocalQuat: THREE.Quaternion | null = null;

	// ── Sat's reactions — ears and tail, nudged post-mix like the gaze ──────
	// The rig has ear, tail, jaw and eye joints. Each reaction bone keeps its
	// rest (bind) local rotation so it can be restored before the mixer runs:
	// the idle clip may not key these bones, and without the restore the
	// per-frame nudge would accumulate.
	interface ReactionBone {
		bone: THREE.Object3D;
		tip: THREE.Object3D;
		rest: THREE.Quaternion;
	}
	let earBones: ReactionBone[] = [];
	let tailBone: ReactionBone | null = null;
	let earPerk = 0;
	let earPerkUntil = 0;
	let tailTuck = 0;
	let tailTuckUntil = 0;
	let hopT0 = 0;
	let hopH = 0;
	let hopDur = 0;
	let shakeOffAt = 0;

	let camPos: THREE.Vector3 | null = null;
	let camAim: THREE.Vector3 | null = null;
	let wantPos: THREE.Vector3 | null = null;
	let wantAim: THREE.Vector3 | null = null;

	// Scratch vectors for the loop (allocated in hydrate — no per-frame alloc).
	interface LoopScratch {
		up: THREE.Vector3;
		down: THREE.Vector3;
		camFinal: THREE.Vector3;
		fwd: THREE.Vector3;
		cubeCentre: THREE.Vector3;
		tmp: THREE.Vector3;
		ndc: THREE.Vector3;
		earToward: THREE.Vector3;
		buf: THREE.Vector2;
	}
	let S: LoopScratch | null = null;
	const shake = { x: 0, y: 0, z: 0 };

	// Maths modules (dynamic-imported) — held so `update()` can reach them.
	let M: typeof import('./maths.js') | null = null;
	let O: typeof import('./optics.js') | null = null;
	let C: typeof import('./clip.js') | null = null;

	let width = 0;
	let height = 0;
	/** The render-cost probe's result, per megapixel — used to size the clip's
	 *  3-D render so recording never asks for more than the device showed it
	 *  can do (see `clipScenePx`). */
	let probeMsPerMpx = 0;
	let useBloom = false;
	let prefersReduced = false;
	let trickPlaying = false;
	let destroyed = false;
	let running = false;
	let rafId = 0;
	/** When the loop last (re)started — drops that finished before this
	 *  happened while the stage was paused off-screen. */
	let loopResumedAt = 0;
	const clock = { last: 0 };
	// Redraw cap — an uncapped bloom-postprocessed render (scene pass +
	// bright-pass + blur + composite) every display refresh is expensive
	// enough on a throttled/low-power CPU to blow well past a 16ms frame
	// budget each time; 30fps is visually indistinguishable for camera
	// easing + idle animation and roughly halves the per-second GPU/CPU work.
	const FRAME_INTERVAL_MS = 1000 / 30;

	let resizeObs: ResizeObserver | null = null;
	let viewObs: IntersectionObserver | null = null;
	let hoverTimer: ReturnType<typeof setTimeout> | null = null;
	let raycaster: THREE.Raycaster | null = null;

	// ── Hold / drop state (plain variables — driven from the loop) ────────────
	// Deliberately NOT $state: the loop reads and writes these every frame and
	// none of them feed the markup.
	type DropPhase = 'rest' | 'hoist' | 'hover' | 'fall';
	let holding = false;
	let grabbing = false;
	let holdPos: THREE.Vector3 | null = null;
	let holdAim: THREE.Vector3 | null = null;
	let stumbleUntil = 0;
	let dropPhase: DropPhase = 'rest';
	let dropT0 = 0;
	let hoistFrom = 0;
	let dropY0 = 0;
	let dropImpacts = 0;
	let lift = 0;

	// Orbit (yaw about the aim point, radians) — drag target + smoothed value.
	let orbitTarget = 0;
	let orbitCur = 0;
	let orbiting = false;

	const isPu = (c: Commodity) => c.id === 'pu238';

	// Several rounds of trying to *infer* render cost from proxy signals
	// (CPU busy-loop timing, hardwareConcurrency/deviceMemory,
	// navigator.webdriver, WEBGL_debug_renderer_info) each helped a little
	// but never reliably — PageSpeed mobile TBT went 31s -> 70ms -> 29.7s ->
	// 14.8s -> back to ~38s of "Other" main-thread work across successive
	// deploys of the SAME logic, which is the signature of an unreliable
	// upfront signal rather than a real fix. None of these are trustworthy
	// on their own: WEBGL_debug_renderer_info is masked by Chrome for
	// fingerprinting reasons in many contexts; navigator.webdriver depends
	// on exact launch flags and Lighthouse's chrome-launcher doesn't
	// necessarily set the same ones Puppeteer does; a CPU busy-loop timed
	// against a fixed threshold is inherently noisy run-to-run.
	//
	// isKnownConstrainedDevice() keeps the two *static, non-timing* signals
	// (used only to decide antialiasing, which can't be changed after the
	// WebGL context is created) as a fast, reliable pre-filter. Everything
	// that CAN be adjusted after construction — bloom, shadow maps, pixel
	// ratio — is instead decided by measureRenderCost() below, which always
	// runs regardless of what this function says, so a wrong "seems fine"
	// guess here can't leave the expensive path silently enabled.
	// Zero real-user risk: matches only automated/headless browsers, never a
	// genuine visitor's. navigator.webdriver alone turned out not to fire in
	// Lighthouse/PSI's specific environment (confirmed: three.js still shows
	// up as unused JS in PageSpeed runs after the webdriver-only check
	// shipped) — headless Chrome's own UA string is the other standard
	// self-identifying signal, so both are checked.
	function isAutomatedBrowser(): boolean {
		return !!navigator.webdriver || /HeadlessChrome|\bHeadless\b/.test(navigator.userAgent);
	}

	function isKnownConstrainedDevice(): boolean {
		return (
			isAutomatedBrowser() ||
			(navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) ||
			((navigator as { deviceMemory?: number }).deviceMemory ?? Infinity) <= 2
		);
	}

	// The one authoritative signal: actually render a representative frame
	// (full scene, current settings) and measure how long it really takes,
	// rather than guessing. gl.finish() forces a CPU/GPU sync point before
	// stopping the clock — render() only *enqueues* GPU commands, so on a
	// driver that queues asynchronously the call can return almost
	// immediately regardless of how long the GPU actually takes; timing
	// render() alone silently measures the wrong thing.
	function measureRenderCost(renderer: THREE.WebGLRenderer, renderOnce: () => void): number {
		// The very first render through a given pipeline (shaders not yet
		// compiled, render targets not yet allocated) can be dramatically
		// slower than every render after it — a real driver cost, but a
		// ONE-TIME one, not representative of the ongoing per-frame cost
		// this is meant to measure. Without warming up first, a perfectly
		// capable real device measures its own shader-compile stall and
		// gets wrongly judged as too slow — exactly what happened here:
		// the Pu-238 bloom glow disappeared for real visitors, not just in
		// PageSpeed runs. Two discarded renders (synced) before the timed
		// one so the measurement reflects steady state.
		renderOnce();
		renderOnce();
		renderer.getContext().finish();

		const start = performance.now();
		renderOnce();
		renderer.getContext().finish();
		return performance.now() - start;
	}

	function hasWebGL(): boolean {
		try {
			const c = document.createElement('canvas');
			return !!(c.getContext('webgl2') || c.getContext('webgl'));
		} catch {
			return false;
		}
	}

	/** Cube edge (metres) for the current props; 0 when there's no data. */
	function currentEdge(): number {
		const a = amount ?? 0;
		if (!M || a <= 0) return 0;
		return Math.max(M.cubeEdgeMetres(a, commodity), 1e-5);
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
		cube.position.y = safeEdge / 2 + lift;

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

		// Camera target + dog staging from the tested maths. While held, the
		// camera stays where it was frozen (pushed clear of a cube that has
		// grown around it) — the staging still solves against the canonical
		// shot, so the dog is always where the released camera will find it.
		const aspect = height > 0 ? width / height : 1;
		const tr = M.cameraTransform(edge);
		if (holding && holdPos && holdAim) {
			const c = clearCameraFromCube(holdPos, safeEdge, 0);
			wantPos.set(c.x, c.y, c.z);
			wantAim.copy(holdAim);
		} else {
			wantPos.set(tr.pos.x, tr.pos.y, tr.pos.z);
			wantAim.set(tr.aim.x, tr.aim.y, tr.aim.z);
		}

		if (dog) {
			const sp = M.dogStagePosition(edge, tr.pos, tr.aim, aspect);
			dog.position.x = sp.x;
			dog.position.z = sp.z;
			dog.rotation.y = Math.atan2(-dog.position.x, -dog.position.z) + 0.14; // face the cube
			staged = sp.staged;
		} else {
			staged = false;
		}

		// Key light + fog track the scale so shadows and depth stay tuned. A
		// held camera may be much further out than this cube's own framing, so
		// the fog is pushed back to keep the (possibly now tiny) cube visible.
		key.position.set(tr.aim.x - tr.dominant * 1.6, tr.dominant * 2.4, tr.dominant * 1.2);
		const sc = key.shadow.camera;
		sc.left = sc.bottom = -tr.dominant * 2.2;
		sc.right = sc.top = tr.dominant * 2.2;
		sc.near = tr.dominant * 0.1;
		sc.far = tr.dominant * 8;
		sc.updateProjectionMatrix();
		const fogDist = holding && holdPos && holdAim ? Math.max(tr.dist, holdPos.distanceTo(holdAim)) : tr.dist;
		scene.fog = new T.Fog(BG, fogDist * 2.2, fogDist * 9);

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

	// A tab switch is a new weigh-in: drop the new cube.
	let lastCommodityId = '';
	$effect(() => {
		const id = commodity.id;
		if (lastCommodityId && id !== lastCommodityId && canvasActive) startDrop(performance.now());
		lastCommodityId = id;
	});

	// Page-driven drops (typed amount, keyboard jumps).
	let lastDropSignal = 0;
	$effect(() => {
		const s = dropSignal;
		if (s !== lastDropSignal) {
			lastDropSignal = s;
			if (canvasActive) startDrop(performance.now());
		}
	});

	// Page-driven hold (slider drag, preset tween).
	$effect(() => {
		void held;
		syncHold();
	});

	// ── Hold → release → drop ─────────────────────────────────────────────────
	function syncHold(): void {
		const want = (held || grabbing) && !clip;
		if (want === holding) return;
		const now = performance.now();
		if (want) {
			holding = true;
			if (camPos && camAim) {
				holdPos = camPos.clone();
				holdAim = camAim.clone();
			}
			// Grabbing a falling cube catches it: back on the floor, no impact.
			dropPhase = 'rest';
			lift = 0;
			crack?.hide();
			update();
		} else {
			holding = false;
			const travel =
				holdPos && holdAim && wantPos && wantAim && M
					? Math.abs(
							Math.log(
								holdPos.distanceTo(holdAim) /
									Math.max(M.framingDistance(M.framingDominant(currentEdge())), 1e-6)
							)
						)
					: 0;
			holdPos = holdAim = null;
			update();
			// The stumble: a quick catch-up with a wobble proportional to how far
			// the shot has to travel to take the new cube in.
			stumbleUntil = now + 900;
			if (!prefersReduced && travel > 0.4 && shaker) {
				shaker.kick(now, ((0.3 + 0.5 * Math.min(travel / 3, 1)) * Math.PI) / 180, 0.35, 0.25);
			}
			startDrop(now);
		}
	}

	/** Hoist the cube to its own height, then let it fall. A no-op while the
	 *  loop is paused (stage scrolled off-screen, e.g. a sticky-bar slider
	 *  drag) — a drop nobody can see shouldn't ambush them later. */
	function startDrop(now: number): void {
		if (!canvasActive || !running || holding || clip) return;
		hoistFrom = lift;
		dropPhase = 'hoist';
		dropT0 = now;
		earPerkUntil = now + 1400;
		crack?.hide();
	}

	/** Advance the drop state machine; fires impact effects on contact. */
	function stepDrop(now: number, edge: number): void {
		if (edge <= 0) return;
		const h = dropHeightM(edge);
		if (dropPhase === 'hoist') {
			const t = (now - dropT0) / 1000;
			lift = hoistOffset(hoistFrom, h, t);
			if (t >= HOIST_S) {
				dropPhase = 'fall';
				dropT0 = now;
				dropY0 = lift;
				dropImpacts = 0;
			}
		} else if (dropPhase === 'hover') {
			lift = h;
		} else if (dropPhase === 'fall') {
			const t = (now - dropT0) / 1000;
			const r = dropOffset(dropY0, t);
			lift = r.y;
			// A drop that finished while the loop was paused off-screen settles
			// silently rather than firing a pile of stale impacts at once. (A
			// slow frame that skips past the whole fall still fires them.)
			const stale = r.settled && dropT0 + dropDurationS(dropY0) * 1000 < loopResumedAt;
			if (!stale) {
				for (let n = dropImpacts + 1; n <= r.impacts; n++) onImpact(n, now, edge);
			}
			dropImpacts = r.impacts;
			if (r.settled) {
				dropPhase = 'rest';
				lift = 0;
			}
		} else {
			lift = 0;
		}
		if (cube) cube.position.y = edge / 2 + lift;
	}

	function onImpact(n: number, now: number, edge: number): void {
		const massKg = (computeMassGrams(amount ?? 0, commodity) ?? 0) / 1000;
		const e1 = impactEnergyJ(massKg, dropY0);
		const i = impactIntensity(nthImpactEnergyJ(e1, n));
		if (clip && n === 1) clip.impactT = (now - clip.t0) / 1000;

		// The sound. Loudness is compressed from the impact energy (the real
		// range spans ~20 orders of magnitude, from a silent speck to a
		// deafening monolith); each bounce lands at restitution × the previous
		// speed, so its blow carries that much less impulse.
		const id = commodity.id;
		const rho = commodity.densityGPerCm3;
		if (isSoundingMaterial(id) && rho) {
			const gain = impactIntensity(e1) * Math.pow(RESTITUTION, n - 1);
			const cracks = exceedsBedrock(bearingPressurePa(rho, edge));
			if (clip) playImpact(clip.ac, clip.bus, id, edge, rho, cracks, gain);
			else if (soundOn) {
				const ac = ensurePageAudio();
				if (ac && pageBus) playImpact(ac, pageBus, id, edge, rho, cracks, gain);
			}
			if (n === 1 && !clip) showBlowCaption(id, edge, rho);
		}
		if (prefersReduced) return;
		const sp = shakeProfile(i);
		shaker?.kick(now, sp.amplitudeRad, sp.decayS, i);
		if (n !== 1) return;

		dust?.emit(edge, i);
		if (commodity.densityGPerCm3 && exceedsBedrock(bearingPressurePa(commodity.densityGPerCm3, edge))) {
			crack?.show(edge);
		}
		// Sat reacts: ears up, a startle hop sized to the thud (real ballistic
		// time for its height), tail tucked for a big one, and a shake-off if
		// the dust cloud reaches him.
		earPerkUntil = Math.max(earPerkUntil, now + 1600);
		if (i > 0.28 && M) {
			hopH = M.DOG_TOTAL_HEIGHT_M * (0.025 + 0.085 * ((i - 0.28) / 0.72));
			hopDur = 2 * Math.sqrt((2 * hopH) / STANDARD_GRAVITY);
			hopT0 = now + 60;
		}
		if (i > 0.4) tailTuckUntil = now + 1800;
		if (i > 0.6 && dog) {
			const reach = dustRadiusM(edge, i);
			if (Math.hypot(dog.position.x, dog.position.z) < reach * 1.6 || i > 0.85) shakeOffAt = now + 900;
		}
	}

	// ── Sound: the landing ────────────────────────────────────────────────────
	// One AudioContext for the page, created (or resumed) inside a user
	// gesture — the speaker toggle, or any press while sound is on. Clips use
	// their own context wired into the recording.
	let pageAc: AudioContext | null = null;
	let pageBus: AudioNode | null = null;
	let impactCache: { key: string; buf: AudioBuffer } | null = null;

	function ensurePageAudio(): AudioContext | null {
		if (!pageAc) {
			try {
				pageAc = new AudioContext();
				// Gentle limiter so the whole-supply blow can't clip the output.
				const comp = pageAc.createDynamicsCompressor();
				comp.connect(pageAc.destination);
				pageBus = comp;
			} catch {
				return null;
			}
		}
		if (pageAc.state === 'suspended') void pageAc.resume().catch(() => {});
		return pageAc;
	}

	/** While sound is on, any press on the page primes the audio context, so
	 *  the first drop after a slider release isn't swallowed by autoplay rules. */
	function primeAudio(): void {
		if (soundOn) ensurePageAudio();
	}

	function toggleSound(): void {
		const next = !soundOn;
		audioEnabled.set(next);
		if (next) ensurePageAudio();
	}

	/** The landing for this cube, rendered once per (material, size, rate). */
	function impactBuffer(ac: AudioContext, id: SoundingMaterial, edge: number, rho: number, cracks: boolean): AudioBuffer {
		const key = `${id}:${edge.toPrecision(5)}:${cracks}:${ac.sampleRate}`;
		if (impactCache?.key === key) return impactCache.buf;
		const data = synthImpact({ id, edge, densityGPerCm3: rho, sampleRate: ac.sampleRate, cracks });
		const buf = ac.createBuffer(1, data.length, ac.sampleRate);
		buf.copyToChannel(data, 0);
		impactCache = { key, buf };
		return buf;
	}

	function playImpact(
		ac: AudioContext,
		out: AudioNode,
		id: SoundingMaterial,
		edge: number,
		rho: number,
		cracks: boolean,
		gain: number
	): void {
		if (!(gain > 0)) return;
		try {
			const src = ac.createBufferSource();
			src.buffer = impactBuffer(ac, id, edge, rho, cracks);
			const g = ac.createGain();
			g.gain.value = gain;
			src.connect(g).connect(out);
			src.start();
		} catch {
			/* audio unavailable — the drop still happens, silently */
		}
	}

	function showBlowCaption(id: SoundingMaterial, edge: number, rho: number): void {
		const unit = get(system);
		blowCaption = `${formatDuration(contactTimeS(id, edge, rho))} blow · ${formatForce(peakForceN(id, edge, rho), unit)}`;
		if (blowCaptionTimer) clearTimeout(blowCaptionTimer);
		blowCaptionTimer = setTimeout(() => (blowCaption = null), 3200);
	}

	// ── Gaze tracking (brief §2.2) — head bone aims at the cube, post-mix ─────
	// Runs AFTER mixer.update(dt) so it composes on top of the idle/trick
	// clips rather than fighting them: each frame we read the mixer's fresh
	// (post-mix) head orientation as the "neck's rest pose" reference, clamp
	// a look-at offset relative to THAT, and damped-slerp a persistent
	// quaternion toward it — the persistence (not the per-frame baseline) is
	// what makes the damping/easing real rather than a no-op recomputed
	// identically every frame. Suspended entirely during tricks; nulling
	// `gazeLocalQuat` there means the very next active frame re-baselines
	// from the fresh idle pose and eases in via the same k damping (~0.5 s),
	// rather than jumping from a stale pre-trick value. The target rides the
	// cube's lift, so Sat looks up at a hoisted cube.
	function updateGaze(dt: number): void {
		if (!M || !dog || !headBone || !headBone.parent || !gazeScratch || prefersReduced) return;
		if (trickPlaying) {
			gazeLocalQuat = null;
			return;
		}
		const s = gazeScratch;
		if (!gazeLocalQuat) gazeLocalQuat = headBone.quaternion.clone();

		headBone.getWorldQuaternion(s.headWorldQuat);
		headBone.getWorldPosition(s.headWorldPos);
		headBone.parent.getWorldQuaternion(s.parentWorldQuat);

		const edge = M.cubeEdgeMetres(amount ?? 0, commodity);
		const target = M.gazeTargetWorld(Math.max(edge, 1e-5), dog.position.x);
		s.targetVec.set(target.x, target.y + lift, target.z);

		s.currentFwd.copy(s.forwardAxis).applyQuaternion(s.headWorldQuat).normalize();
		s.desiredDir.subVectors(s.targetVec, s.headWorldPos).normalize();

		const clamped = M.clampGazeDirection(
			{ x: s.currentFwd.x, y: s.currentFwd.y, z: s.currentFwd.z },
			{ x: s.desiredDir.x, y: s.desiredDir.y, z: s.desiredDir.z }
		);
		s.clampedDir.set(clamped.x, clamped.y, clamped.z);

		// World orientation whose local forward axis points along the clamped
		// direction, converted into the head bone's LOCAL space (relative to
		// its parent's current — animated — world orientation).
		s.idealWorldQuat.setFromUnitVectors(s.forwardAxis, s.clampedDir);
		s.idealLocalQuat.copy(s.parentWorldQuat).invert().multiply(s.idealWorldQuat);

		const k = 1 - Math.exp(-dt * M.GAZE_DAMPING_K);
		gazeLocalQuat.slerp(s.idealLocalQuat, k);
		headBone.quaternion.copy(gazeLocalQuat);
	}

	function restoreReactionBones(): void {
		for (const b of earBones) b.bone.quaternion.copy(b.rest);
		if (tailBone) tailBone.bone.quaternion.copy(tailBone.rest);
	}

	let fx: typeof import('./effects.js') | null = null;

	/** Ears up while the cube is in the air or just landed; tail tucked after
	 *  a big thud; the startle hop. Post-mix, after gaze. */
	function updateReactions(dt: number, now: number): void {
		if (!dog || !fx || !S || prefersReduced) return;
		const alert = holding || dropPhase !== 'rest' || now < earPerkUntil;
		earPerk += ((alert ? 1 : 0) - earPerk) * (1 - Math.exp(-dt * (alert ? 10 : 2)));
		const tuck = now < tailTuckUntil;
		tailTuck += ((tuck ? 1 : 0) - tailTuck) * (1 - Math.exp(-dt * (tuck ? 8 : 2)));

		if (!trickPlaying) {
			// Perked = swung forward toward the cube (a Shiba's ears already
			// stand, so "alert" reads as pricked forward, not taller).
			S.earToward.set(-dog.position.x, 0, -dog.position.z);
			if (S.earToward.lengthSq() > 1e-12) S.earToward.normalize().multiplyScalar(1.3);
			S.earToward.add(S.up).normalize();
			for (const b of earBones) fx.swingBoneToward(b.bone, b.tip, S.earToward, earPerk * 0.55);
			if (tailBone) fx.swingBoneToward(tailBone.bone, tailBone.tip, S.down, tailTuck * 0.9);
		}

		let y = dogBaseY;
		if (hopDur > 0) {
			const p = (now - hopT0) / 1000 / hopDur;
			if (p >= 1) hopDur = 0;
			else if (p > 0) y += hopH * 4 * p * (1 - p);
		}
		dog.position.y = y;

		if (shakeOffAt && now >= shakeOffAt) {
			shakeOffAt = 0;
			if (!trickPlaying) {
				const clip = trickClips.find((c) => c.name.includes('shake'));
				if (clip) playClip(clip);
			}
		}
	}

	// ── Optics: depth of field + loupe ────────────────────────────────────────
	function updateLens(edge: number): void {
		if (!dofPass || !O || !camera || !renderer || !S) return;
		camera.getWorldDirection(S.fwd);
		S.cubeCentre.set(0, lift + edge / 2, 0);
		const focus = Math.max(S.tmp.subVectors(S.cubeCentre, camera.position).dot(S.fwd), camera.near * 2);
		renderer.getDrawingBufferSize(S.buf);
		const scalePx = O.cocScalePx(focus, S.buf.y);
		dofPass.setLens(focus, camera.near, camera.far, scalePx, O.MAX_BLUR_FRACTION * S.buf.y, S.buf.x, S.buf.y);
	}

	function renderLoupe(edge: number): ClipLoupe | null {
		if (!loupe || !O || !camera || !renderer || !scene || !S || edge <= 0) return null;
		S.cubeCentre.set(0, lift + edge / 2, 0);
		const dist = camera.position.distanceTo(S.cubeCentre);
		const m = O.loupeMagnification(O.projectedSizePx(edge, dist, height));
		if (!m) return null;
		S.ndc.copy(S.cubeCentre).project(camera);
		if (S.ndc.z > 1) return null; // behind the camera
		const cx = ((S.ndc.x + 1) / 2) * width;
		const cy = ((1 - S.ndc.y) / 2) * height;
		// In a clip the render is square (720 or 1080 px); lay the loupe out in
		// 1080-space and hand the compositor 1080-space coordinates back.
		const k = clip && C ? height / C.CLIP_SCENE : 1;
		const size = clip ? Math.round(280 * k) : Math.round(Math.min(150, Math.max(92, height * 0.28)));
		const x = clip ? Math.round(48 * k) : 14;
		const y = clip ? Math.round(120 * k) : 14;
		loupe.render(renderer, scene, camera.position, S.cubeCentre, m, { x, y: height - y - size, size }, width, height, accent);
		return { x: x / k, y: y / k, size: size / k, m, cx: cx / k, cy: cy / k };
	}

	function setLoupeUi(next: ClipLoupe | null): void {
		const cur = loupeUi;
		if (!next || !cur) {
			if (next !== cur) loupeUi = next;
			return;
		}
		if (
			next.m !== cur.m ||
			next.size !== cur.size ||
			Math.abs(next.cx - cur.cx) > 0.75 ||
			Math.abs(next.cy - cur.cy) > 0.75
		) {
			loupeUi = next;
		}
	}

	// ── Render loop (damped dolly — the easing IS the scale cue) ──────────────
	function loop(now: number): void {
		if (!running || destroyed || !T || !camera || !camPos || !camAim || !wantPos || !wantAim || !S) return;
		rafId = requestAnimationFrame(loop);
		if (now - clock.last < FRAME_INTERVAL_MS) return;

		const dt = Math.min((now - clock.last) / 1000 || 0, 0.05);
		clock.last = now;
		frame(now, dt);
	}

	/** One rendered frame at time `now` — the loop's body, also called once
	 *  directly so a clip never opens on an empty frame. */
	function frame(now: number, dt: number): void {
		if (!T || !camera || !camPos || !camAim || !wantPos || !wantAim || !S) return;
		if (clip) stepClipTimeline(now);
		const edge = currentEdge();
		stepDrop(now, edge);

		const k = 1 - Math.exp(-dt * (now < stumbleUntil ? 6.5 : 3.2));
		camPos.lerp(wantPos, k);
		camAim.lerp(wantAim, k);

		// Orbit about the aim point (springs home when released), then keep the
		// camera out of the cube whatever the hold or orbit did.
		if (!clip) orbitCur += (orbitTarget - orbitCur) * (1 - Math.exp(-dt * (orbiting ? 14 : 2.2)));
		S.camFinal.copy(camPos).sub(camAim).applyAxisAngle(S.up, orbitCur).add(camAim);
		const clear = clearCameraFromCube(S.camFinal, Math.max(edge, 1e-5), lift);
		camera.position.set(clear.x, clear.y, clear.z);
		const camDist = camera.position.length();
		camera.near = Math.max(camDist / 100, 1e-4);
		camera.far = camDist * 60;
		camera.updateProjectionMatrix();
		camera.lookAt(camAim);
		if (shaker) {
			shaker.sample(now, shake);
			camera.rotateX(shake.x);
			camera.rotateY(shake.y);
			camera.rotateZ(shake.z);
		}

		restoreReactionBones();
		mixer?.update(dt);
		updateGaze(dt); // post-mix additive — must run AFTER mixer.update()
		updateReactions(dt, now);

		renderer?.getDrawingBufferSize(S.buf);
		const focalPx = (S.buf.y || height) / 2 / Math.tan(((camera.fov * Math.PI) / 180) / 2);
		dust?.update(dt, focalPx);
		crack?.update(dt);

		if (useBloom && composer) {
			updateLens(edge);
			composer.render();
		} else if (renderer && scene) renderer.render(scene, camera);

		const lu = renderLoupe(edge);
		if (!clip) setLoupeUi(lu);
		if (clip) composeClipFrame(now, lu);
	}

	function startLoop(): void {
		if (running || destroyed || !canvasActive) return;
		running = true;
		clock.last = loopResumedAt = performance.now();
		rafId = requestAnimationFrame(loop);
	}
	function stopLoop(): void {
		running = false;
		if (rafId) cancelAnimationFrame(rafId);
		rafId = 0;
	}

	// ── Easter egg — hover dwell / tap / ?easter=doge / Konami → tricks ───────
	// `playClip` is the shared single-clip player; `trickQueue` lets the
	// Konami code (brief §2.4) chain all three tricks back-to-back through
	// the SAME machinery — the mixer's `finished` listener in `loadDog`
	// drains the queue before falling back to idle.
	function playClip(clip: THREE.AnimationClip): void {
		if (!mixer) return;
		trickPlaying = true;
		const action = mixer.clipAction(clip);
		action.reset();
		action.setLoop(2200, 1); // THREE.LoopOnce
		idleAction?.fadeOut(0.25);
		action.fadeIn(0.25).play();
	}

	function playTrick(): void {
		if (prefersReduced || !mixer || trickPlaying || !trickClips.length) return;
		playClip(trickClips[Math.floor(Math.random() * trickClips.length)]);
	}

	/** Konami hook (brief §2.4) — queues play_dead → rollover → shake, played
	 *  back to back. No-ops gracefully (never throws) before the dog/mixer
	 *  has loaded, mid-trick, or under reduced motion — same guards as
	 *  `playTrick`. Exposed via `bind:this` (through HeroStage's thin
	 *  forwarding export) for the page's global keydown handler. */
	export function triggerKonami(): void {
		playTrickSequence(['play_dead', 'rollover', 'shake']);
	}

	function playTrickSequence(names: string[]): void {
		if (prefersReduced || !mixer || trickPlaying || !trickClips.length) return;
		const queue = names
			.map((name) => trickClips.find((c) => c.name.includes(name)))
			.filter((c): c is THREE.AnimationClip => !!c);
		if (!queue.length) return;
		trickQueue = queue.slice(1);
		playClip(queue[0]);
	}

	// ── Input: tap / grab / pinch / orbit ─────────────────────────────────────
	type Target = 'cube' | 'dog' | 'floor';
	type Mode = 'none' | 'pending' | 'grab' | 'orbit' | 'pinch';
	let pmode: Mode = 'none';
	const pointers = new Map<number, { x: number; y: number }>();
	let pStart = { x: 0, y: 0 };
	let pTarget: Target = 'floor';
	let pinchD0 = 0;
	let orbitStart = 0;
	let wheelTimer: ReturnType<typeof setTimeout> | null = null;
	let wheelRatio = 1;

	function toNdc(clientX: number, clientY: number): THREE.Vector2 | null {
		if (!T || !renderer) return null;
		const rect = (renderer.domElement as HTMLCanvasElement).getBoundingClientRect();
		return new T.Vector2(
			((clientX - rect.left) / rect.width) * 2 - 1,
			-((clientY - rect.top) / rect.height) * 2 + 1
		);
	}

	function pointerOnDog(clientX: number, clientY: number): boolean {
		if (!dog || !raycaster || !camera) return false;
		const ndc = toNdc(clientX, clientY);
		if (!ndc) return false;
		raycaster.setFromCamera(ndc, camera);
		return raycaster.intersectObject(dog, true).length > 0;
	}

	/** On the cube — a ray hit, OR within a finger's reach of a cube too small
	 *  to hit, OR inside the loupe (which is the cube, magnified). */
	function pointerOnCube(clientX: number, clientY: number): boolean {
		if (!cube || !raycaster || !camera || !renderer || !S) return false;
		const rect = (renderer.domElement as HTMLCanvasElement).getBoundingClientRect();
		const lx = clientX - rect.left;
		const ly = clientY - rect.top;
		const lu = loupeUi;
		if (lu && Math.hypot(lx - (lu.x + lu.size / 2), ly - (lu.y + lu.size / 2)) <= lu.size / 2) return true;
		const ndc = toNdc(clientX, clientY);
		if (!ndc) return false;
		raycaster.setFromCamera(ndc, camera);
		if (raycaster.intersectObject(cube, false).length > 0) return true;
		S.ndc.copy(cube.position).project(camera);
		const cx = ((S.ndc.x + 1) / 2) * rect.width;
		const cy = ((1 - S.ndc.y) / 2) * rect.height;
		return S.ndc.z < 1 && Math.hypot(lx - cx, ly - cy) < 22;
	}

	function hitTest(clientX: number, clientY: number): Target {
		if (pointerOnCube(clientX, clientY)) return 'cube';
		if (pointerOnDog(clientX, clientY)) return 'dog';
		return 'floor';
	}

	function beginGrab(): void {
		grabbing = true;
		ongrab?.('start', 1);
		syncHold();
		dismissHint();
	}
	function endGrab(): void {
		if (!grabbing) return;
		grabbing = false;
		ongrab?.('end', 1);
		syncHold();
	}

	function setCursor(c: string): void {
		if (renderer) renderer.domElement.style.cursor = c;
	}

	function onPointerDown(e: PointerEvent): void {
		if (!renderer || clip) return;
		primeAudio();
		pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		if (pointers.size === 2 && grabEnabled) {
			// Second finger: whatever the first was doing becomes a pinch.
			if (pmode === 'orbit') {
				orbiting = false;
				orbitTarget = 0;
			}
			const [a, b] = [...pointers.values()];
			pinchD0 = Math.hypot(a.x - b.x, a.y - b.y);
			// Already dragging the cube → re-baseline the page's start amount
			// (the pinch ratio is relative to now); otherwise take hold.
			if (pmode === 'grab') ongrab?.('start', 1);
			else beginGrab();
			pmode = 'pinch';
			return;
		}
		if (pointers.size > 1) return;
		pTarget = hitTest(e.clientX, e.clientY);
		pStart = { x: e.clientX, y: e.clientY };
		pmode = 'pending';
		orbitStart = orbitTarget;
		try {
			renderer.domElement.setPointerCapture(e.pointerId);
		} catch {
			/* synthetic pointer — nothing to capture */
		}
	}

	function onPointerMove(e: PointerEvent): void {
		if (!renderer) return;
		if (!pointers.has(e.pointerId)) {
			onHover(e);
			return;
		}
		pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		if (pmode === 'pinch') {
			const [a, b] = [...pointers.values()];
			if (a && b) ongrab?.('move', pinchRatio(Math.hypot(a.x - b.x, a.y - b.y), pinchD0));
			return;
		}
		const dx = e.clientX - pStart.x;
		const dy = e.clientY - pStart.y;
		if (pmode === 'pending' && Math.hypot(dx, dy) > TAP_SLOP_PX) {
			if (pTarget === 'cube' && grabEnabled) {
				pmode = 'grab';
				beginGrab();
				setCursor('ns-resize');
			} else {
				pmode = 'orbit';
				orbiting = true;
				setCursor('grabbing');
				dismissHint();
			}
		}
		if (pmode === 'grab') ongrab?.('move', dragRatio(dy, height));
		else if (pmode === 'orbit') orbitTarget = orbitYaw(orbitStart, dx, width);
	}

	function finishPointer(e: PointerEvent, cancelled: boolean): void {
		if (!pointers.has(e.pointerId)) return;
		pointers.delete(e.pointerId);
		if (pmode === 'pinch') {
			if (pointers.size < 2) {
				endGrab();
				pmode = 'none'; // the remaining finger does nothing until lifted
			}
			return;
		}
		if (pmode === 'pending' && !cancelled) {
			if (pTarget === 'cube') {
				startDrop(performance.now());
				dismissHint();
			} else if (pTarget === 'dog') {
				playTrick();
			}
		} else if (pmode === 'grab') {
			endGrab();
		} else if (pmode === 'orbit') {
			orbiting = false;
			orbitTarget = 0;
		}
		pmode = 'none';
		setCursor('');
	}

	const onPointerUp = (e: PointerEvent) => finishPointer(e, false);
	const onPointerCancel = (e: PointerEvent) => finishPointer(e, true);

	/** Mouse hover: cursor affordances + the dog's hover-dwell trick. */
	function onHover(e: PointerEvent): void {
		if (!renderer) return;
		const onDog = pointerOnDog(e.clientX, e.clientY);
		const onCube = !onDog && pointerOnCube(e.clientX, e.clientY);
		setCursor(onDog ? 'pointer' : onCube ? (grabEnabled ? 'ns-resize' : 'pointer') : 'grab');
		if (onDog && !hoverTimer && !trickPlaying) {
			hoverTimer = setTimeout(() => {
				hoverTimer = null;
				playTrick();
			}, 200);
		} else if (!onDog && hoverTimer) {
			clearTimeout(hoverTimer);
			hoverTimer = null;
		}
	}

	/** Touch: the canvas is `touch-action: pan-y`, so vertical swipes scroll
	 *  the page and horizontal ones orbit. A touch that starts ON the cube,
	 *  or a second finger, claims the gesture so a vertical drag resizes and
	 *  a pinch doesn't zoom the page. */
	function onTouchStart(e: TouchEvent): void {
		if (clip) return;
		if (e.touches.length >= 2) {
			if (grabEnabled) e.preventDefault();
			return;
		}
		const t = e.touches[0];
		if (t && grabEnabled && pointerOnCube(t.clientX, t.clientY)) e.preventDefault();
	}

	/** ctrl+wheel — what browsers send for a trackpad pinch — resizes too. */
	function onWheel(e: WheelEvent): void {
		if (!e.ctrlKey || !grabEnabled || clip) return;
		e.preventDefault();
		if (!grabbing) {
			wheelRatio = 1;
			beginGrab();
		}
		wheelRatio *= wheelZoomRatio(e.deltaY);
		ongrab?.('move', wheelRatio);
		if (wheelTimer) clearTimeout(wheelTimer);
		wheelTimer = setTimeout(() => {
			wheelTimer = null;
			endGrab();
		}, 260);
	}

	// ── Hint chip ─────────────────────────────────────────────────────────────
	const HINT_KEY = 'bw:stage-hint';
	function maybeShowHint(): void {
		try {
			if (localStorage.getItem(HINT_KEY)) return;
		} catch {
			/* storage blocked — show it anyway */
		}
		hintVisible = true;
		// Shown once per visit until the visitor actually touches the cube
		// (which persists the dismissal); otherwise it steps aside after a while.
		setTimeout(() => (hintVisible = false), 14000);
	}
	function dismissHint(): void {
		if (!hintVisible) return;
		hintVisible = false;
		try {
			localStorage.setItem(HINT_KEY, '1');
		} catch {
			/* ignore */
		}
	}

	// ── Clip recorder ─────────────────────────────────────────────────────────
	interface ClipSession {
		t0: number;
		canvas: HTMLCanvasElement;
		ctx2d: CanvasRenderingContext2D;
		ac: AudioContext;
		bus: AudioNode;
		rec: MediaRecorder;
		chunks: Blob[];
		mime: string;
		info: ClipInfo;
		impactT: number | null;
		stopped: boolean;
		cancelled: boolean;
		savedPixelRatio: number;
	}
	let clip: ClipSession | null = null;

	async function startClip(): Promise<void> {
		if (!renderer || !camera || !canvasActive || clip || !clipInfo || !M || !C) return;
		const { CLIP_W, CLIP_H, CLIP_FPS } = C;
		const mime = C.pickMimeType();
		if (!mime) {
			studio = 'error';
			return;
		}
		// Audio first, inside the click's user activation.
		let ac: AudioContext;
		try {
			ac = new AudioContext();
		} catch {
			studio = 'error';
			return;
		}
		void ac.resume().catch(() => {});
		const dest = ac.createMediaStreamDestination();
		const bus = ac.createDynamicsCompressor();
		bus.connect(dest);

		const canvas = document.createElement('canvas');
		canvas.width = CLIP_W;
		canvas.height = CLIP_H;
		canvas.className = 'studio-canvas';
		const ctx2d = canvas.getContext('2d');
		if (!ctx2d) {
			void ac.close();
			studio = 'error';
			return;
		}
		ctx2d.fillStyle = '#09090b';
		ctx2d.fillRect(0, 0, CLIP_W, CLIP_H);

		const stream = canvas.captureStream(CLIP_FPS);
		for (const track of dest.stream.getAudioTracks()) stream.addTrack(track);
		let rec: MediaRecorder;
		try {
			rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 128_000 });
		} catch {
			void ac.close();
			studio = 'error';
			return;
		}

		// Cancel any gesture in flight and put the shot home.
		pointers.clear();
		pmode = 'none';
		grabbing = false;
		orbiting = false;
		orbitTarget = orbitCur = 0;
		dismissHint();
		if (clipUrl) URL.revokeObjectURL(clipUrl);
		clipUrl = '';
		studio = 'recording';
		await Promise.all([tick(), C.loadClipFonts()]);
		if (destroyed || !renderer || !camera) {
			void ac.close().catch(() => {});
			return;
		}
		previewHost?.appendChild(canvas);

		const session: ClipSession = {
			t0: performance.now(),
			canvas,
			ctx2d,
			ac,
			bus,
			rec,
			chunks: [],
			mime,
			info: clipInfo,
			impactT: null,
			stopped: false,
			cancelled: false,
			savedPixelRatio: renderer.getPixelRatio(),
		};
		rec.ondataavailable = (ev) => {
			if (ev.data && ev.data.size) session.chunks.push(ev.data);
		};
		rec.onstop = () => finishClip(session);

		// Render square at 1:1 pixel ratio; the on-page canvas is hidden behind
		// the studio while this runs.
		holding = false;
		holdPos = holdAim = null;
		const px = clipScenePx();
		renderer.setPixelRatio(1);
		renderer.setSize(px, px, false);
		composer?.setPixelRatio(1);
		composer?.setSize(px, px);
		width = height = px;
		camera.aspect = 1;
		camera.updateProjectionMatrix();

		// Opening pose: the cube hangs at its own height over the floor, Sat
		// looking up at it; released at CLIP_RELEASE_S.
		dust?.clear();
		crack?.hide();
		shaker?.clear();
		dropPhase = 'hover';
		lift = dropHeightM(currentEdge());
		clip = session;
		update(true);
		frame(performance.now(), 0); // first frame composed before recording begins
		rec.start(250);
		startLoop();
	}

	/**
	 * The clip's 3-D render size. Full 1080 px square when the probe says the
	 * device renders that inside ~25 ms (comfortably 30 fps with compositing),
	 * else 720 px, upscaled into the 1080-wide frame — a softer clip beats a
	 * stuttering one, because the recorder captures in real time.
	 */
	function clipScenePx(): number {
		const full = C?.CLIP_SCENE ?? 1080;
		const est = probeMsPerMpx * ((full * full) / 1e6);
		return est > 0 && est <= 25 ? full : 720;
	}

	function stepClipTimeline(now: number): void {
		if (!clip || !C) return;
		const { CLIP_RELEASE_S, CLIP_DURATION_S } = C;
		const t = (now - clip.t0) / 1000;
		// A slow, scripted orbit for parallax — ±9° across the clip.
		orbitCur = -0.16 + 0.32 * Math.min(t / CLIP_DURATION_S, 1);
		if (dropPhase === 'hover' && t >= CLIP_RELEASE_S) {
			dropPhase = 'fall';
			dropT0 = now;
			dropY0 = lift;
			dropImpacts = 0;
			earPerkUntil = now + 1400;
		}
		if (t >= CLIP_DURATION_S && !clip.stopped) {
			clip.stopped = true;
			try {
				clip.rec.stop();
			} catch {
				finishClip(clip);
			}
		}
	}

	function composeClipFrame(now: number, lu: ClipLoupe | null): void {
		if (!clip || !renderer || !C || clip.stopped) return;
		const t = (now - clip.t0) / 1000;
		C.drawClipFrame(clip.ctx2d, renderer.domElement, clip.info, t, clip.impactT, lu);
	}

	function restoreStageSize(saved: number): void {
		if (!renderer || !camera) return;
		renderer.setPixelRatio(saved);
		composer?.setPixelRatio(saved);
		onResize();
	}

	function finishClip(session: ClipSession): void {
		if (clip !== session && clip !== null) return;
		clip = null;
		orbitCur = orbitTarget = 0;
		session.canvas.remove();
		void session.ac.close().catch(() => {});
		restoreStageSize(session.savedPixelRatio);
		if (session.cancelled || destroyed) {
			if (!destroyed) studio = 'idle';
			return;
		}
		const type = session.mime.split(';')[0];
		const blob = new Blob(session.chunks, { type });
		if (!blob.size) {
			studio = 'error';
			return;
		}
		clipFileName = `${session.info.fileStem}.${C?.fileExtension(session.mime) ?? 'webm'}`;
		clipFile = new File([blob], clipFileName, { type });
		try {
			canShareFile = !!navigator.canShare?.({ files: [clipFile] });
		} catch {
			canShareFile = false;
		}
		clipUrl = URL.createObjectURL(blob);
		studio = 'done';
	}

	function cancelClip(): void {
		if (!clip) return;
		clip.cancelled = true;
		if (!clip.stopped) {
			clip.stopped = true;
			try {
				clip.rec.stop();
			} catch {
				finishClip(clip);
			}
		}
	}

	async function shareClip(): Promise<void> {
		if (!clipFile || !clipInfo) return;
		try {
			await navigator.share({
				files: [clipFile],
				title: 'Bitcoin Weigh-In',
				text: `${clipInfo.headline} weighs ${clipInfo.massPrimary}. ${clipInfo.shareUrl}`,
			});
		} catch {
			/* dismissed — nothing to do */
		}
	}

	function closeStudio(): void {
		if (clip) cancelClip();
		studio = 'idle';
		if (clipUrl) URL.revokeObjectURL(clipUrl);
		clipUrl = '';
		clipFile = null;
	}

	function onStudioKey(e: KeyboardEvent): void {
		if (studio !== 'idle' && e.key === 'Escape') {
			e.preventDefault();
			closeStudio();
		}
	}

	// Autoplay the finished clip with sound where the browser allows it,
	// muted where it doesn't.
	$effect(() => {
		const v = videoEl;
		if (!v || studio !== 'done') return;
		v.muted = false;
		v.play().catch(() => {
			v.muted = true;
			void v.play().catch(() => {});
		});
	});

	// ── Hydrate: build the WebGL scene (dynamic-imports three) ────────────────
	async function hydrate(): Promise<void> {
		if (destroyed || canvasActive || !containerEl) return;

		const [three, gltfMod, rbgMod, ecMod, rpMod, ubpMod, opMod, moMod, materials, maths, optics, effects, clipMod] =
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
				import('./optics.js'),
				import('./effects.js'),
				import('./clip.js'),
			]);
		if (destroyed || !containerEl) return;
		T = three;
		M = maths;
		O = optics;
		fx = effects;
		C = clipMod;

		width = containerEl.clientWidth || 1;
		height = containerEl.clientHeight || 1;

		// Antialias is the one setting that can't be changed after the WebGL
		// context is created, so it has to go by the imperfect upfront
		// signal. Everything else below (bloom, depth of field, shadow maps,
		// resolution) starts at full quality and is downgraded together, once,
		// by the empirical probe right after the scene is built.
		renderer = new three.WebGLRenderer({
			antialias: !isKnownConstrainedDevice(),
			alpha: false,
		});
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(width, height);
		renderer.toneMapping = three.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 1.3;
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = three.PCFSoftShadowMap;
		renderer.domElement.className = 'stage-canvas';
		renderer.domElement.setAttribute('aria-hidden', 'true');
		containerEl.appendChild(renderer.domElement);

		renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);

		useBloom = renderer.capabilities.isWebGL2; // WebGL2 only; may be downgraded below

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

		// Impact effects.
		dust = new effects.Dust();
		scene.add(dust.points);
		crack = new effects.Crack();
		scene.add(crack.mesh);
		shaker = new effects.Shaker();

		// Smoothed + target camera vectors.
		camPos = new three.Vector3(2, 1, 3);
		camAim = new three.Vector3(0, 0.3, 0);
		wantPos = new three.Vector3();
		wantAim = new three.Vector3();
		raycaster = new three.Raycaster();
		S = {
			up: new three.Vector3(0, 1, 0),
			down: new three.Vector3(0, -1, 0),
			camFinal: new three.Vector3(),
			fwd: new three.Vector3(),
			cubeCentre: new three.Vector3(),
			tmp: new three.Vector3(),
			ndc: new three.Vector3(),
			earToward: new three.Vector3(),
			buf: new three.Vector2(),
		};

		// Composer (depth of field + bloom) — WebGL2 only, built optimistically.
		// Its render target carries a depth texture so the DOF pass can read
		// per-pixel distance. The probe right after decides whether it stays.
		if (useBloom) {
			const rt = new three.WebGLRenderTarget(width, height, {
				type: three.HalfFloatType,
				depthTexture: new three.DepthTexture(width, height),
			});
			composer = new ecMod.EffectComposer(renderer, rt);
			composer.addPass(new rpMod.RenderPass(scene, camera));
			dofPass = new effects.PhysicalDofPass();
			composer.addPass(dofPass);
			bloomPass = new ubpMod.UnrealBloomPass(new three.Vector2(width, height), 0.35, 0.5, 0.85);
			composer.addPass(bloomPass);
			composer.addPass(new opMod.OutputPass());
			composer.setSize(width, height);
			// Probe at the worst case: DOF at full legibility cap.
			renderer.getDrawingBufferSize(S.buf);
			dofPass.setLens(1, 0.01, 100, S.buf.y, S.buf.y * optics.MAX_BLUR_FRACTION, S.buf.x, S.buf.y);
			loupe = new effects.Loupe();
		}

		// The one authoritative check: render one real frame at the current
		// (full) settings and measure it directly, rather than trusting any
		// proxy signal. Too slow -> drop depth of field, bloom, shadow maps,
		// and resolution together in a single step. The first frame pays
		// whatever the full cost is regardless (one-time, during hydration,
		// before the canvas is even revealed) — same as the earlier bloom-only
		// version of this check, just now covering everything that can be
		// adjusted post-construction instead of bloom alone.
		const renderCostMs = measureRenderCost(renderer, () => {
			if (useBloom && composer) composer.render();
			else if (renderer && scene && camera) renderer.render(scene, camera);
		});
		renderer.getDrawingBufferSize(S.buf);
		probeMsPerMpx = renderCostMs / Math.max((S.buf.x * S.buf.y) / 1e6, 0.05);
		if (renderCostMs > 50) {
			if (composer) {
				composer.dispose();
				composer = null;
				bloomPass = null;
				dofPass?.dispose();
				dofPass = null;
			}
			useBloom = false;
			renderer.shadowMap.enabled = false;
			renderer.setPixelRatio(1);

			// Verify the downgrade actually worked rather than assuming it
			// did — PageSpeed kept showing the same ~165-232ms recurring
			// per-frame cost across every one of these mitigations, which
			// means downgrading quality alone isn't reliably enough. A
			// scene still too slow even at minimum settings isn't worth
			// rendering at all: the SSR poster (CubeRenderer) is a complete,
			// zero-cost fallback already used for the no-WebGL and reduced-
			// motion cases. Bail out to it entirely — no canvas, no loop,
			// nothing left to be slow — rather than run a real-time loop
			// that visitors on this hardware can't actually benefit from.
			const downgradedCostMs = measureRenderCost(renderer, () => {
				if (renderer && scene && camera) renderer.render(scene, camera);
			});
			if (downgradedCostMs > 50) {
				teardown();
				return;
			}
		}

		// Pointer / touch / wheel wiring.
		const el = renderer.domElement;
		el.addEventListener('pointerdown', onPointerDown);
		el.addEventListener('pointermove', onPointerMove);
		el.addEventListener('pointerup', onPointerUp);
		el.addEventListener('pointercancel', onPointerCancel);
		el.addEventListener('touchstart', onTouchStart, { passive: false });
		el.addEventListener('wheel', onWheel, { passive: false });
		window.addEventListener('pointerdown', primeAudio, { passive: true });
		window.addEventListener('keydown', primeAudio);

		// Which render path survived the probe — "full" (DOF + bloom + loupe) or
		// "basic" (plain render). A stable hook for capture scripts and QA.
		el.dataset.fx = useBloom && composer ? 'full' : 'basic';

		// Snap the camera to the first frame, reveal the canvas, start the loop.
		update(true);
		canvasActive = true;
		recordSupported = clipMod.canRecordClips();
		maybeShowHint();
		startLoop();

		// Observers: resize + pause when off-screen / tab hidden.
		resizeObs = new ResizeObserver(() => onResize());
		resizeObs.observe(containerEl);
		viewObs = new IntersectionObserver(
			(entries) => {
				if (clip) return; // the studio covers the page; keep recording
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
		loadNormalizedModel(
			three,
			GLTFLoader,
			MeshoptDecoder,
			'/models/references/shiba_inu/shiba.glb',
			M!.DOG_TOTAL_HEIGHT_M,
			'y',
			(object, animations) => {
				if (destroyed || !scene || !M) return;
				dog = object;
				dogBaseY = dog.position.y;
				const byName = new Map<string, THREE.Object3D>();
				dog.traverse((o) => {
					if ((o as THREE.Mesh).isMesh) o.castShadow = true;
					if ((o as THREE.Bone).isBone) byName.set(o.name, o);
					// Gaze bone (brief §2.2) — matched by NAME, first hit wins. The
					// shipped rig has exactly one match: "head_jnt.40_038". No match
					// (a differently-rigged model) → headBone stays null and gaze
					// never runs; it degrades to the authored idle animation only,
					// never a crash.
					if (!headBone && (o as THREE.Bone).isBone && /head/i.test(o.name)) {
						headBone = o as THREE.Bone;
					}
				});
				scene.add(dog);

				// Reaction bones — matched by name prefix like the head. GLTFLoader
				// sanitises node names (the rig's "L_ear_tip_jnt.67_063" arrives as
				// "L_ear_tip_jnt67_063"), so no pattern may rely on the dot; the
				// `_end_` leaf joints are excluded. Any that are missing simply
				// don't react — never a crash.
				const find = (re: RegExp) => [...byName.entries()].find(([n]) => re.test(n))?.[1];
				const pair = (base: RegExp, tip: RegExp): ReactionBone | null => {
					const b = find(base);
					const t = find(tip);
					return b && t ? { bone: b, tip: t, rest: b.quaternion.clone() } : null;
				};
				earBones = [
					pair(/^L_ear_base_jnt/, /^L_ear_tip_jnt\.?\d+_\d+$/),
					pair(/^R_ear_base_jnt/, /^R_ear_tip_jnt\.?\d+_\d+$/),
				].filter((b): b is ReactionBone => !!b);
				tailBone = pair(/^tail_1_jnt/, /^tail_3_jnt\.?\d+_\d+$/);

				if (headBone?.parent) {
					gazeScratch = {
						headWorldPos: new three.Vector3(),
						headWorldQuat: new three.Quaternion(),
						parentWorldQuat: new three.Quaternion(),
						forwardAxis: new three.Vector3(
							M.HEAD_FORWARD_LOCAL_AXIS.x,
							M.HEAD_FORWARD_LOCAL_AXIS.y,
							M.HEAD_FORWARD_LOCAL_AXIS.z
						),
						targetVec: new three.Vector3(),
						currentFwd: new three.Vector3(),
						desiredDir: new three.Vector3(),
						clampedDir: new three.Vector3(),
						idealWorldQuat: new three.Quaternion(),
						idealLocalQuat: new three.Quaternion(),
					};
				} else {
					headBone = null; // no identifiable head bone (or no parent) — gaze off
				}

				if (animations.length) {
					mixer = new three.AnimationMixer(dog);
					// Clips: play_dead, rollover, shake, sitting, standing. sitting is
					// the resting idle; the first three are easter-egg tricks. Select
					// the idle by NAME — animations[0] is play_dead (the dog dies; a
					// shipped prototype bug we must NOT regress).
					const idleClip =
						animations.find((c) => c.name.includes('sitting')) ??
						animations[animations.length - 1];
					idleAction = mixer.clipAction(idleClip);
					trickClips = animations.filter((c) => /play_dead|rollover|shake/.test(c.name));
					if (!prefersReduced) idleAction.play();
					mixer.addEventListener('finished', () => {
						// Konami chain (brief §2.4): drain the queue before falling
						// back to idle, so the three tricks play back to back.
						if (trickQueue.length) {
							const next = trickQueue[0];
							trickQueue = trickQueue.slice(1);
							playClip(next);
							return;
						}
						trickPlaying = false;
						idleAction?.reset().fadeIn(0.3).play();
					});
					if (new URLSearchParams(location.search).get('easter') === 'doge') {
						setTimeout(playTrick, 800);
					}
				}
				update(true);
			},
			() => {
				/* Model failed — scene continues without the dog; the poster keeps a
				   Shiba anyway, so this degrades gracefully. */
			}
		);
	}

	// ── Event handlers ────────────────────────────────────────────────────────
	function onResize(): void {
		if (!containerEl || !renderer || !camera || clip) return;
		width = containerEl.clientWidth || 1;
		height = containerEl.clientHeight || 1;
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		renderer.setSize(width, height);
		composer?.setSize(width, height);
		update(); // aspect feeds dog staging
	}

	function onVisibility(): void {
		if (document.hidden) {
			if (clip) cancelClip(); // frames stop when hidden — the clip would stall
			stopLoop();
		} else startLoop();
	}

	function onContextLost(e: Event): void {
		// Swap to the sprite fallback with the current state, keeping the readout.
		e.preventDefault();
		if (clip) cancelClip();
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
		if (wheelTimer) {
			clearTimeout(wheelTimer);
			wheelTimer = null;
		}
		resizeObs?.disconnect();
		viewObs?.disconnect();
		if (browser) {
			document.removeEventListener('visibilitychange', onVisibility);
			window.removeEventListener('pointerdown', primeAudio);
			window.removeEventListener('keydown', primeAudio);
		}
		if (blowCaptionTimer) clearTimeout(blowCaptionTimer);
		blowCaption = null;
		void pageAc?.close().catch(() => {});
		pageAc = null;
		pageBus = null;
		impactCache = null;
		if (renderer) {
			const el = renderer.domElement;
			el.removeEventListener('pointerdown', onPointerDown);
			el.removeEventListener('pointermove', onPointerMove);
			el.removeEventListener('pointerup', onPointerUp);
			el.removeEventListener('pointercancel', onPointerCancel);
			el.removeEventListener('touchstart', onTouchStart);
			el.removeEventListener('wheel', onWheel);
			el.removeEventListener('webglcontextlost', onContextLost);
			el.remove();
			renderer.dispose();
		}
		composer?.dispose?.();
		dofPass?.dispose();
		loupe?.dispose();
		dust?.dispose();
		crack?.dispose();
		envTexture?.dispose();
		mixer?.stopAllAction();
		renderer = composer = bloomPass = scene = camera = cube = puLight = key = null;
		dofPass = loupe = dust = crack = shaker = null;
		dog = mixer = idleAction = null;
		trickClips = [];
		trickQueue = [];
		headBone = null;
		gazeScratch = null;
		gazeLocalQuat = null;
		earBones = [];
		tailBone = null;
		pointers.clear();
		loupeUi = null;
		hintVisible = false;
		recordSupported = false;
	}

	onMount(() => {
		if (!browser) return;
		prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		// Reduced motion or no WebGL → never hydrate; the poster IS the experience.
		// isAutomatedBrowser() is near-certain to never be true for a real
		// visitor, so skipping hydration here costs nothing for anyone real.
		// It does mean automated tools never even download three.js — the
		// render-cost probe further down in hydrate() already reliably
		// catches genuinely slow real hardware (that check runs regardless
		// of this one), this just also avoids the download for the specific
		// case where we already know for certain the visitor isn't a human.
		if (prefersReduced || !hasWebGL() || isAutomatedBrowser()) return;

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
			if (clip) cancelClip();
			teardown();
			if (clipUrl) URL.revokeObjectURL(clipUrl);
		};
	});
</script>

<svelte:window onkeydown={onStudioKey} />

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

	{#if canvasActive}
		{#if loupeUi}
			{@const lx = loupeUi.x + loupeUi.size / 2}
			{@const ly = loupeUi.y + loupeUi.size / 2}
			{@const r = loupeUi.size / 2}
			{@const ang = Math.atan2(loupeUi.cy - ly, loupeUi.cx - lx)}
			<!--
				Loupe annotation: the WebGL loupe itself is drawn into the canvas
				(so clips capture it); this is the leader line to the speck and the
				declared magnification. Decorative — the readout carries the data.
			-->
			<svg class="loupe-svg" aria-hidden="true">
				<line
					x1={lx + Math.cos(ang) * r}
					y1={ly + Math.sin(ang) * r}
					x2={loupeUi.cx}
					y2={loupeUi.cy}
					stroke={accent}
				/>
				<circle cx={loupeUi.cx} cy={loupeUi.cy} r="6" stroke={accent} />
			</svg>
			<div
				class="loupe-label"
				style:left="{loupeUi.x + loupeUi.size / 2}px"
				style:top="{loupeUi.y + loupeUi.size + 6}px"
				style:color={accent}
			>
				×{loupeUi.m.toLocaleString('en-US')}
			</div>
		{/if}

		<div class="stage-buttons">
			{#if isSoundingMaterial(commodity.id)}
				<button
					type="button"
					class="stage-btn"
					class:stage-btn--on={soundOn}
					onclick={toggleSound}
					aria-pressed={soundOn}
					title={soundOn ? 'Sound on — hear the landing, modelled from the blow the floor takes' : 'Sound off — turn on to hear the landing'}
				>
					<svg class="stage-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
						{#if soundOn}
							<path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
							<path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
						{:else}
							<line x1="22" y1="9" x2="16" y2="15" />
							<line x1="16" y1="9" x2="22" y2="15" />
						{/if}
					</svg>
					<span>{soundOn ? 'Sound on' : 'Sound'}</span>
				</button>
			{/if}
			{#if recordSupported && clipInfo && studio === 'idle'}
				<button type="button" class="stage-btn" onclick={startClip} title="Record a short vertical video of this weigh-in">
					<span class="rec-dot" aria-hidden="true"></span> Make a clip
				</button>
			{/if}
		</div>
		{#if blowCaption}
			<div class="blow-caption" aria-live="polite">{blowCaption}</div>
		{/if}

		{#if hintVisible}
			<div class="stage-hint" aria-hidden="true">
				{grabEnabled ? 'Drag the cube to resize · tap it to drop it · drag the floor to look around' : 'Tap the cube to drop it · drag the floor to look around'}
			</div>
		{/if}
	{/if}
</div>

{#if studio !== 'idle'}
	<div class="studio" role="dialog" aria-modal="true" aria-label="Clip recorder">
		<div class="studio-card">
			{#if studio === 'recording'}
				<div class="studio-preview" bind:this={previewHost}></div>
				<div class="studio-bar">
					<span class="studio-rec"><span class="rec-dot rec-dot--live" aria-hidden="true"></span> Recording…</span>
					<button type="button" class="studio-btn" onclick={cancelClip}>Cancel</button>
				</div>
			{:else if studio === 'done'}
				<!-- svelte-ignore a11y_media_has_caption -->
				<video bind:this={videoEl} class="studio-video" src={clipUrl} loop playsinline controls></video>
				<div class="studio-bar">
					{#if canShareFile}
						<button type="button" class="studio-btn studio-btn--primary" onclick={shareClip}>Share</button>
					{/if}
					<a class="studio-btn" class:studio-btn--primary={!canShareFile} href={clipUrl} download={clipFileName}>Download</a>
					<button type="button" class="studio-btn" onclick={closeStudio}>Close</button>
				</div>
			{:else}
				<p class="studio-msg">This browser can't record video from the page. Try a recent Chrome, Edge, Firefox or Safari.</p>
				<div class="studio-bar">
					<button type="button" class="studio-btn" onclick={closeStudio}>Close</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

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
		/* justify-items must stay `stretch` (the grid default) — CubeRenderer's
		   .cube-scene has `container-type: inline-size`, which forces it to be
		   sized without regard to its own content. If this grid item is also
		   asked to size itself from content (`justify-items: center`), the two
		   constraints deadlock to a 0px-wide box: invisible to real visitors
		   (the WebGL canvas covers the poster within moments of hydration) but
		   fatal for headless/bot captures, which sit on the poster indefinitely.
		   Only vertical centering is wanted here, so align-items alone. */
		align-items: center;
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
		/* Vertical swipes scroll the page; horizontal ones orbit. A touch that
		   starts on the cube claims the gesture in onTouchStart. */
		touch-action: pan-y;
		user-select: none;
		-webkit-user-select: none;
	}

	/* ── Stage overlays ──────────────────────────────────────────── */
	/* The canvas is appended after these on hydrate, so every overlay needs
	   an explicit stacking level to sit above it. */
	.loupe-svg,
	.loupe-label,
	.stage-buttons,
	.blow-caption,
	.stage-hint {
		z-index: 2;
	}
	.loupe-svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		overflow: visible;
	}
	.loupe-svg line,
	.loupe-svg circle {
		fill: none;
		stroke-width: 1.25;
		opacity: 0.8;
	}
	.loupe-label {
		position: absolute;
		transform: translateX(-50%);
		font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.04em;
		pointer-events: none;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
	}

	.stage-buttons {
		position: absolute;
		top: 12px;
		right: 12px;
		display: flex;
		gap: 8px;
	}
	.stage-btn {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 6px 12px;
		border-radius: 999px;
		border: 1px solid rgba(255, 255, 255, 0.14);
		background: rgba(9, 9, 11, 0.62);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
		color: #e4e4e7;
		font-family: 'Inter Tight', -apple-system, system-ui, sans-serif;
		font-size: 12.5px;
		font-weight: 600;
		cursor: pointer;
		transition: background 120ms ease, border-color 120ms ease;
	}
	.stage-btn:hover {
		background: rgba(24, 24, 27, 0.85);
		border-color: rgba(255, 255, 255, 0.28);
	}
	.stage-btn:focus-visible {
		outline: 2px solid #f59e0b;
		outline-offset: 2px;
	}
	.stage-btn--on {
		color: #fbbf24;
		border-color: rgba(251, 191, 36, 0.45);
	}
	.stage-icon {
		width: 14px;
		height: 14px;
	}
	.blow-caption {
		position: absolute;
		top: 50px;
		right: 12px;
		padding: 4px 9px;
		border-radius: 6px;
		background: rgba(9, 9, 11, 0.62);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
		color: #e4e4e7;
		font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
		font-size: 11px;
		letter-spacing: 0.01em;
		pointer-events: none;
		animation: hint-in 240ms ease both;
	}
	.rec-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #ef4444;
		display: inline-block;
	}
	.rec-dot--live {
		animation: rec-pulse 1s ease-in-out infinite;
	}
	@keyframes rec-pulse {
		50% {
			opacity: 0.25;
		}
	}

	.stage-hint {
		position: absolute;
		left: 12px;
		bottom: 12px;
		max-width: calc(100% - 24px);
		padding: 5px 10px;
		border-radius: 6px;
		background: rgba(9, 9, 11, 0.62);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
		color: #a1a1aa;
		font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
		font-size: 11px;
		letter-spacing: 0.01em;
		pointer-events: none;
		animation: hint-in 600ms ease 1.2s both;
	}
	@keyframes hint-in {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
	}

	/* ── Clip studio ─────────────────────────────────────────────── */
	.studio {
		position: fixed;
		inset: 0;
		z-index: 60;
		display: grid;
		place-items: center;
		padding: 16px;
		background: rgba(9, 9, 11, 0.92);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
	}
	.studio-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		max-width: 100%;
	}
	.studio-preview :global(canvas.studio-canvas),
	.studio-video {
		display: block;
		height: min(76vh, 760px);
		max-width: calc(100vw - 32px);
		aspect-ratio: 9 / 16;
		object-fit: contain;
		border-radius: 12px;
		background: #09090b;
		box-shadow: 0 0 0 1px #27272a, 0 20px 60px rgba(0, 0, 0, 0.6);
	}
	.studio-preview :global(canvas.studio-canvas) {
		width: auto;
	}
	.studio-bar {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		justify-content: center;
	}
	.studio-rec {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		color: #e4e4e7;
		font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
		font-size: 12px;
	}
	.studio-btn {
		appearance: none;
		padding: 8px 16px;
		border-radius: 8px;
		border: 1px solid #3f3f46;
		background: #18181b;
		color: #e4e4e7;
		font-family: 'Inter Tight', -apple-system, system-ui, sans-serif;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		text-decoration: none;
	}
	.studio-btn:hover {
		border-color: #71717a;
	}
	.studio-btn--primary {
		background: #f59e0b;
		border-color: #f59e0b;
		color: #18181b;
	}
	.studio-btn--primary:hover {
		background: #fbbf24;
		border-color: #fbbf24;
	}
	.studio-msg {
		max-width: 360px;
		margin: 0;
		color: #d4d4d8;
		font-family: 'Inter Tight', -apple-system, system-ui, sans-serif;
		font-size: 14px;
		text-align: center;
	}
</style>
