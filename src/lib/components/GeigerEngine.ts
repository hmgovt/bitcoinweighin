/**
 * GeigerEngine — Pu-238 Geiger crackle synthesiser.
 *
 * Pure TypeScript state machine + Web Audio synthesis. Pulled out of
 * the Svelte component so the click-rate maths and gating logic are
 * testable without DOM/browser-audio mocks.
 *
 * Audibility predicate: enabled && inViewport && tabVisible &&
 * currentRate >= 1. Any of those flipping false clears the next-click
 * timeout immediately. Re-enabling fires the next click on the
 * Poisson-distributed schedule from "now", not the original time —
 * the click stream is memoryless, so resuming mid-gap is correct.
 *
 * Click synthesis: band-limited noise burst (3–5 ms envelope, ~4 kHz
 * centre with ±500 Hz randomisation per click). Synthesised in real
 * time, not sampled — no audio asset to license, and each click is
 * unique so the loop doesn't read as mechanical.
 */

/**
 * Tuning constant. Spec calibration (06-pu238.md, §"Click rate is
 * linear in mass"): clicksPerSecond = massGrams × 17 × SAMPLE_RATIO.
 * At 0.18 the canonical positions land:
 *   1 g     →   3 clicks/sec  (sparse, distinct)
 *   16 g    →  49 clicks/sec  (1 BTC: "clear counter ~50/sec")
 *   160 g   → 490 clicks/sec  (10 BTC: "rapid counter ~500/sec")
 *   1.6 kg+ → capped at 1000  ("continuous hiss")
 */
export const SAMPLE_RATIO = 0.18;

/** Hard cap on schedule rate. Above ~1000/sec the perceptual difference is nil. */
export const MAX_CLICKS_PER_SEC = 1000;

/** Specific activity of Pu-238 in Ci/g. Used for the readout, mirrored here so the engine is self-contained. */
export const SPECIFIC_ACTIVITY_CI_PER_GRAM = 17;

/** Mass below 1 g produces fewer than 3 clicks/sec — perceptually silence. */
export const MASS_THRESHOLD_GRAMS = 1;

/** CustomEvent name dispatched on each click — visual indicator listens. */
export const GEIGER_CLICK_EVENT = 'geiger:click';

/**
 * Compute the scheduler's target rate (clicks/sec) for a given mass.
 * Returns 0 below the 1 g threshold so the engine knows to silence.
 */
export function clicksPerSecond(massGrams: number): number {
	if (massGrams < MASS_THRESHOLD_GRAMS) return 0;
	return Math.min(MAX_CLICKS_PER_SEC, massGrams * SPECIFIC_ACTIVITY_CI_PER_GRAM * SAMPLE_RATIO);
}

/**
 * Sample a Poisson-distributed inter-arrival time in milliseconds for a
 * click stream at the given rate (clicks/sec). Memoryless: every call
 * draws an independent inter-arrival, so resuming after a pause does
 * not bias the schedule. Caller is responsible for guarding rate > 0.
 */
export function poissonIntervalMs(rate: number, rng: () => number = Math.random): number {
	if (rate <= 0) return Infinity;
	// -ln(U)/λ where U ~ Uniform(0, 1). Math.random() can return 0 but
	// not 1; -log(0) is +Infinity; clamp at a tiny epsilon to avoid that.
	const u = Math.max(rng(), 1e-12);
	return (-Math.log(u) / rate) * 1000;
}

export interface GeigerEngineOptions {
	/** Optional injected window (for SSR-safe construction in tests). */
	windowRef?: Window;
	/** Optional RNG override for deterministic tests. */
	rng?: () => number;
}

/**
 * Mutable engine instance. One per Pu-238 panel mount. The Svelte
 * component owns the lifecycle: construct on mount, destroy on
 * unmount, push state changes via setMass / setEnabled / setInViewport
 * / setTabVisible.
 */
export class GeigerEngine {
	private audioContext: AudioContext | null = null;
	private nextClickTimeoutId: ReturnType<typeof setTimeout> | null = null;

	private currentRate = 0;
	private enabled = false;
	private inViewport = false;
	private tabVisible = true;

	private readonly windowRef: Window | undefined;
	private readonly rng: () => number;

	constructor(opts: GeigerEngineOptions = {}) {
		this.windowRef = opts.windowRef ?? (typeof window !== 'undefined' ? window : undefined);
		this.rng = opts.rng ?? Math.random;
	}

	/** Returns true when all gates are open and the rate is non-zero. */
	get audible(): boolean {
		return this.enabled && this.inViewport && this.tabVisible && this.currentRate >= 1;
	}

	/** Current scheduler rate in clicks/sec — exposed for tests. */
	get rate(): number {
		return this.currentRate;
	}

	setMass(massGrams: number): void {
		const next = clicksPerSecond(massGrams);
		const wasAudible = this.audible;
		this.currentRate = next;
		// If the rate change crossed the audibility threshold either way,
		// reschedule (or stop) so the click stream tracks the slider.
		if (wasAudible && !this.audible) this.stop();
		else if (!wasAudible && this.audible) this.scheduleNext();
	}

	setEnabled(enabled: boolean): void {
		const wasAudible = this.audible;
		this.enabled = enabled;
		if (wasAudible && !this.audible) this.stop();
		else if (!wasAudible && this.audible) {
			this.ensureAudioContext();
			this.scheduleNext();
		}
	}

	setInViewport(inViewport: boolean): void {
		const wasAudible = this.audible;
		this.inViewport = inViewport;
		if (wasAudible && !this.audible) this.stop();
		else if (!wasAudible && this.audible) this.scheduleNext();
	}

	setTabVisible(tabVisible: boolean): void {
		const wasAudible = this.audible;
		this.tabVisible = tabVisible;
		if (wasAudible && !this.audible) this.stop();
		else if (!wasAudible && this.audible) this.scheduleNext();
	}

	/**
	 * Tear down. Clears the schedule and closes the audio context so
	 * the panel doesn't leak resources on navigation. After destroy the
	 * engine cannot be revived — construct a new one if needed.
	 */
	destroy(): void {
		this.stop();
		if (this.audioContext) {
			void this.audioContext.close();
			this.audioContext = null;
		}
	}

	/**
	 * Lazily construct the AudioContext on first user interaction.
	 * All modern browsers block context creation outside a user-gesture
	 * stack; setEnabled(true) is the gesture path.
	 */
	private ensureAudioContext(): AudioContext | null {
		if (this.audioContext) return this.audioContext;
		if (typeof AudioContext === 'undefined') return null;
		this.audioContext = new AudioContext();
		return this.audioContext;
	}

	private scheduleNext(): void {
		if (!this.audible) return;
		const intervalMs = poissonIntervalMs(this.currentRate, this.rng);
		this.nextClickTimeoutId = setTimeout(() => {
			this.emitClick();
			this.scheduleNext();
		}, intervalMs);
	}

	private emitClick(): void {
		this.synthesise();
		this.dispatchVisualPulse();
	}

	private synthesise(): void {
		const ctx = this.audioContext;
		if (!ctx) return;
		const sampleRate = ctx.sampleRate;
		// 5 ms noise burst.
		const lengthSamples = Math.max(1, Math.floor(sampleRate * 0.005));
		const buf = ctx.createBuffer(1, lengthSamples, sampleRate);
		const data = buf.getChannelData(0);
		for (let i = 0; i < lengthSamples; i++) {
			data[i] = this.rng() * 2 - 1;
		}

		const src = ctx.createBufferSource();
		src.buffer = buf;

		// Bandpass at 4 kHz ±500 Hz so each click has a slight tonal
		// shift — keeps the stream from reading as a single sample
		// being looped.
		const filter = ctx.createBiquadFilter();
		filter.type = 'bandpass';
		filter.frequency.value = 4000 + (this.rng() - 0.5) * 1000;
		filter.Q.value = 20;

		// Gain envelope: fast attack (0.5 ms), exponential decay to ~0
		// at 5 ms. Total click length stays in the 3–5 ms window the
		// spec calls for.
		const now = ctx.currentTime;
		const gain = ctx.createGain();
		gain.gain.setValueAtTime(0, now);
		gain.gain.linearRampToValueAtTime(0.5, now + 0.0005);
		gain.gain.exponentialRampToValueAtTime(0.001, now + 0.005);

		src.connect(filter);
		filter.connect(gain);
		gain.connect(ctx.destination);

		src.start(now);
		src.stop(now + 0.005);
	}

	private dispatchVisualPulse(): void {
		// Window event so the visual indicator can listen without a
		// direct reference back into the engine.
		this.windowRef?.dispatchEvent(new CustomEvent(GEIGER_CLICK_EVENT));
	}

	private stop(): void {
		if (this.nextClickTimeoutId !== null) {
			clearTimeout(this.nextClickTimeoutId);
			this.nextClickTimeoutId = null;
		}
	}
}
