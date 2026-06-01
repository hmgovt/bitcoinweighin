/**
 * AsicSoundEngine — continuous ASIC fan-noise synthesiser.
 *
 * Models the acoustic character of an Antminer-class ASIC:
 *   - Two high-RPM fans (~6 000–6 500 RPM, 7 blades)
 *   - Blade-pass frequency: 7 × 6 200 / 60 ≈ 723 Hz
 *   - Second harmonic: ~1 450 Hz
 *   - Broadband turbulence noise throughout
 *   - Low-frequency motor rumble at ~100 Hz
 *
 * Three modes:
 *   'off'     — silent
 *   'solo'    — one home miner (Bitaxe-class, quiet 5V fan, ~350 Hz BPF)
 *   'network' — the full industrial fleet (overwhelming broadband roar)
 *
 * Audibility gates (same pattern as GeigerEngine):
 *   enabled (mode !== 'off') && inViewport && tabVisible
 *
 * AudioContext is created lazily on first setMode() call that enables
 * sound, honouring the browser autoplay policy.
 */

export type AsicMode = 'off' | 'solo' | 'network';

export class AsicSoundEngine {
	private audioContext: AudioContext | null = null;

	// Running noise source and master gain (null when stopped).
	private noiseSource: AudioBufferSourceNode | null = null;
	private masterGain: GainNode | null = null;
	private isRunning = false;

	private mode: AsicMode = 'off';
	private inViewport = false;
	private tabVisible = true;

	get audible(): boolean {
		return this.mode !== 'off' && this.inViewport && this.tabVisible;
	}

	setMode(mode: AsicMode): void {
		const wasAudible = this.audible;
		this.mode = mode;
		if (!wasAudible && this.audible) {
			this.ensureContext();
			this.start();
		} else if (wasAudible && !this.audible) {
			this.fadeOut();
		} else if (wasAudible && this.audible) {
			// Already running — just ramp the gain to match new mode.
			this.rampGain();
		}
	}

	setInViewport(v: boolean): void {
		const wasAudible = this.audible;
		this.inViewport = v;
		if (!wasAudible && this.audible) {
			this.ensureContext();
			this.start();
		} else if (wasAudible && !this.audible) {
			this.fadeOut();
		}
	}

	setTabVisible(v: boolean): void {
		const wasAudible = this.audible;
		this.tabVisible = v;
		if (!wasAudible && this.audible) {
			this.ensureContext();
			this.start();
		} else if (wasAudible && !this.audible) {
			this.fadeOut();
		}
	}

	destroy(): void {
		this.stopNoise();
		if (this.audioContext) {
			void this.audioContext.close();
			this.audioContext = null;
		}
	}

	// ── Private ─────────────────────────────────────────────────────────────

	private ensureContext(): AudioContext | null {
		if (this.audioContext) return this.audioContext;
		if (typeof AudioContext === 'undefined') return null;
		this.audioContext = new AudioContext();
		return this.audioContext;
	}

	private start(): void {
		if (this.isRunning) {
			this.rampGain();
			return;
		}
		const ctx = this.audioContext;
		if (!ctx) return;

		// ── Noise source (2-second looping white noise buffer) ──────────────
		const bufLen = 2 * ctx.sampleRate;
		const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
		const data = buf.getChannelData(0);
		for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

		this.noiseSource = ctx.createBufferSource();
		this.noiseSource.buffer = buf;
		this.noiseSource.loop = true;

		// ── Spectral shaping ─────────────────────────────────────────────────
		// Fan blade-pass frequency peak (~723 Hz for industrial ASIC).
		const bpf1 = ctx.createBiquadFilter();
		bpf1.type = 'bandpass';
		bpf1.frequency.value = 723;
		bpf1.Q.value = 3;

		// Second harmonic (~1 450 Hz).
		const bpf2 = ctx.createBiquadFilter();
		bpf2.type = 'bandpass';
		bpf2.frequency.value = 1450;
		bpf2.Q.value = 2;

		// Motor rotation rumble (~100 Hz fundamental).
		const lowShelf = ctx.createBiquadFilter();
		lowShelf.type = 'lowshelf';
		lowShelf.frequency.value = 200;
		lowShelf.gain.value = 8;

		// Cut harsh content above 8 kHz.
		const highShelf = ctx.createBiquadFilter();
		highShelf.type = 'highshelf';
		highShelf.frequency.value = 8000;
		highShelf.gain.value = -14;

		// ── Mix: tonal (BPF) + broadband paths ──────────────────────────────
		const tonalGain = ctx.createGain();
		tonalGain.gain.value = 0.45;

		const broadGain = ctx.createGain();
		broadGain.gain.value = 0.55;

		this.masterGain = ctx.createGain();
		this.masterGain.gain.value = 0; // start silent, ramp in below

		// Tonal path
		this.noiseSource.connect(bpf1);
		bpf1.connect(tonalGain);
		this.noiseSource.connect(bpf2);
		bpf2.connect(tonalGain);
		tonalGain.connect(this.masterGain);

		// Broadband path
		this.noiseSource.connect(lowShelf);
		lowShelf.connect(highShelf);
		highShelf.connect(broadGain);
		broadGain.connect(this.masterGain);

		this.masterGain.connect(ctx.destination);
		this.noiseSource.start();
		this.isRunning = true;

		// Fade in over 600 ms.
		const now = ctx.currentTime;
		const target = this.targetGain();
		this.masterGain.gain.setValueAtTime(0, now);
		this.masterGain.gain.linearRampToValueAtTime(target, now + 0.6);
	}

	private rampGain(): void {
		const ctx = this.audioContext;
		if (!ctx || !this.masterGain) return;
		const now = ctx.currentTime;
		this.masterGain.gain.cancelScheduledValues(now);
		this.masterGain.gain.linearRampToValueAtTime(this.targetGain(), now + 0.4);
	}

	private fadeOut(): void {
		const ctx = this.audioContext;
		if (!ctx || !this.masterGain) return;
		const now = ctx.currentTime;
		this.masterGain.gain.cancelScheduledValues(now);
		this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
		this.masterGain.gain.linearRampToValueAtTime(0, now + 0.6);
		// Clean up the source node after the fade completes.
		setTimeout(() => {
			if (!this.audible) this.stopNoise();
		}, 700);
	}

	private stopNoise(): void {
		if (this.noiseSource) {
			try { this.noiseSource.stop(); } catch { /* already stopped */ }
			this.noiseSource = null;
		}
		this.masterGain = null;
		this.isRunning = false;
	}

	/**
	 * Target master gain for the current mode.
	 *
	 * 'solo'    — a single Bitaxe at desk distance: quiet, intimate.
	 * 'network' — 4–5 million ASICs globally: industrial roar.
	 *
	 * We cannot reproduce the actual ~130 dB(A) of the full network in
	 * a browser — we represent the *perceptual contrast* instead.
	 */
	private targetGain(): number {
		switch (this.mode) {
			case 'solo':    return 0.06;
			case 'network': return 0.38;
			default:        return 0;
		}
	}
}
