/**
 * Sound for /mining — synthesised with Web Audio, off by default.
 *
 * It descends in scale with the page: the machine's fans (the site's shared
 * ASIC voice) muffle as the dive pushes in, then everything after the die face
 * is driven by the simulation — a tick per clock, a tone per hash pitched from
 * its own last bits, a chime per share, a hiss that follows switching
 * activity. At fast clocks the ticks become a click train, i.e. a tone at the
 * clock rate. A found block goes silent.
 */
import { createAsicFanVoice } from '$lib/components/AsicSoundEngine.js';
import type { Result } from './pipeline.js';

export type Zone = 'dive' | 'pipeline' | 'none';
const STORE_KEY = 'bwi-mining-sound';
const PENTA = [0, 3, 5, 7, 10];

export interface SoundInputs {
	playing: boolean;
	found: boolean;
	speed: number;
	clock: number;
	/** Fraction of flip-flops that flipped on the last clock (0–1). */
	activity: () => number;
}

export class MiningSound {
	on = false;
	private ctx: AudioContext | null = null;
	private zone: Zone = 'none';
	private diveBeat = 0;
	private nextT = 0;
	private activity = 0;
	private actClock = -1;
	private reduced: boolean;
	private inputs: () => SoundInputs;
	private cache = new Map<AudioParam, number>();
	private master!: GainNode;
	private fanBus!: GainNode;
	private fanLP!: BiquadFilterNode;
	private whineG!: GainNode;
	private bedG!: GainNode;
	private pulseOsc!: OscillatorNode;
	private pulseG!: GainNode;
	private clockBus!: GainNode;
	private fxBus!: GainNode;
	private noiseBuf!: AudioBuffer;
	private tickBuf!: AudioBuffer;
	private wave!: PeriodicWave;
	private listeners: (() => void)[] = [];

	constructor(inputs: () => SoundInputs, reduced: boolean) {
		this.inputs = inputs;
		this.reduced = reduced;
		try { this.on = localStorage.getItem(STORE_KEY) === '1'; } catch { this.on = false; }
		if (this.on) {
			// Browsers only allow audio after an interaction, so a remembered "on" starts at the first click or key.
			const unlock = () => { if (this.on) this.start(); };
			document.addEventListener('pointerdown', unlock, { once: true, capture: true });
			document.addEventListener('keydown', unlock, { once: true, capture: true });
			this.listeners.push(() => {
				document.removeEventListener('pointerdown', unlock, { capture: true });
				document.removeEventListener('keydown', unlock, { capture: true });
			});
		}
		const onVis = () => {
			if (!this.ctx) return;
			if (document.hidden) void this.ctx.suspend();
			else if (this.on) void this.ctx.resume();
		};
		document.addEventListener('visibilitychange', onVis);
		this.listeners.push(() => document.removeEventListener('visibilitychange', onVis));
	}

	setOn(v: boolean): void {
		this.on = v;
		try { localStorage.setItem(STORE_KEY, v ? '1' : '0'); } catch { /* storage unavailable */ }
		if (v) this.start();
		else if (this.ctx) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
	}

	setZone(z: Zone): void { this.zone = z; }

	destroy(): void {
		this.listeners.forEach((f) => f());
		void this.ctx?.close();
		this.ctx = null;
	}

	// ── graph ──────────────────────────────────────────────────────────────

	private start(): void {
		if (!this.ctx && !this.build()) { this.on = false; return; }
		const ctx = this.ctx!;
		void ctx.resume();
		this.master.gain.setTargetAtTime(0.8, ctx.currentTime, 0.3);
	}

	private build(): boolean {
		const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!AC) return false;
		const ctx = new AC();
		this.ctx = ctx;
		const comp = ctx.createDynamicsCompressor();
		comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
		this.master = this.gain(0);
		this.master.connect(comp);
		comp.connect(ctx.destination);
		this.noiseBuf = this.pink(4);
		this.tickBuf = this.makeTick();
		this.wave = this.impulseWave();
		// the machine: the site's ASIC fan voice, slow turbulence, a faint whine from the power stage
		this.fanBus = this.gain(0);
		this.fanBus.connect(this.master);
		this.fanLP = this.filt('lowpass', 3400, 0.4);
		const turb = this.gain(1);
		const lfo = ctx.createOscillator();
		const lfoG = this.gain(0.12);
		lfo.frequency.value = 0.17;
		lfo.connect(lfoG); lfoG.connect(turb.gain); lfo.start();
		createAsicFanVoice(ctx).output.connect(this.fanLP);
		this.fanLP.connect(turb);
		turb.connect(this.fanBus);
		this.whineG = this.gain(0);
		const whine = ctx.createOscillator();
		const vib = ctx.createOscillator();
		const vibG = this.gain(9);
		whine.frequency.value = 7400; vib.frequency.value = 2.7;
		vib.connect(vibG); vibG.connect(whine.frequency); whine.connect(this.whineG); this.whineG.connect(this.fanBus);
		whine.start(); vib.start();
		// the data: clock ticks, a hiss that follows switching activity, a click train for fast clocks
		this.clockBus = this.gain(1); this.clockBus.connect(this.master);
		this.fxBus = this.gain(1); this.fxBus.connect(this.master);
		this.bedG = this.gain(0);
		this.loopNoise(2.6).connect(this.filt('bandpass', 5200, 0.7)).connect(this.bedG);
		this.bedG.connect(this.clockBus);
		this.pulseOsc = ctx.createOscillator();
		this.pulseOsc.setPeriodicWave(this.wave);
		this.pulseOsc.frequency.value = 240;
		this.pulseG = this.gain(0);
		this.pulseOsc.connect(this.filt('lowpass', 6000)).connect(this.pulseG);
		this.pulseG.connect(this.clockBus);
		this.pulseOsc.start();
		return true;
	}

	private gain(v: number): GainNode { const g = this.ctx!.createGain(); g.gain.value = v; return g; }
	private filt(type: BiquadFilterType, f: number, q = 0.7): BiquadFilterNode {
		const b = this.ctx!.createBiquadFilter();
		b.type = type; b.frequency.value = f; b.Q.value = q;
		return b;
	}
	private set(param: AudioParam, v: number, tc: number): void {
		const k = this.cache.get(param);
		if (k !== undefined && Math.abs(k - v) < 1e-4) return;
		this.cache.set(param, v);
		param.setTargetAtTime(v, this.ctx!.currentTime, tc);
	}
	private pink(sec: number): AudioBuffer {
		const ctx = this.ctx!;
		const n = Math.floor(ctx.sampleRate * sec);
		const b = ctx.createBuffer(1, n, ctx.sampleRate);
		const d = b.getChannelData(0);
		let b0 = 0, b1 = 0, b2 = 0;
		for (let i = 0; i < n; i++) {
			const w = Math.random() * 2 - 1;
			b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
			d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
		}
		return b;
	}
	private makeTick(): AudioBuffer {
		const ctx = this.ctx!;
		const sr = ctx.sampleRate;
		const n = Math.floor(sr * 0.03);
		const b = ctx.createBuffer(1, n, sr);
		const d = b.getChannelData(0);
		for (let i = 0; i < n; i++) {
			const t = i / sr;
			d[i] = (Math.random() * 2 - 1) * Math.exp(-t / 0.0015) * 0.45 + Math.sin(2 * Math.PI * 2100 * t) * Math.exp(-t / 0.004) * 0.6;
		}
		return b;
	}
	private loopNoise(offset: number): AudioBufferSourceNode {
		const src = this.ctx!.createBufferSource();
		src.buffer = this.noiseBuf; src.loop = true; src.start(0, offset);
		return src;
	}
	/** A train of clicks as one oscillator: every harmonic at equal strength. Its frequency is the click rate. */
	private impulseWave(): PeriodicWave {
		const H = 160;
		const re = new Float32Array(H + 1);
		const im = new Float32Array(H + 1);
		for (let k = 1; k <= H; k++) re[k] = 1;
		return this.ctx!.createPeriodicWave(re, im);
	}

	// ── voices ─────────────────────────────────────────────────────────────

	private tickAt(t: number, level: number): void {
		const src = this.ctx!.createBufferSource();
		const g = this.gain(level);
		src.buffer = this.tickBuf; src.connect(g); g.connect(this.clockBus); src.start(t);
	}
	private tone(t: number, f: number, a: number, decay: number, bus: AudioNode = this.fxBus, attack = 0.003): void {
		const o = this.ctx!.createOscillator();
		const g = this.gain(0);
		o.frequency.value = f;
		g.gain.setValueAtTime(0, t);
		g.gain.linearRampToValueAtTime(a, t + attack);
		g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
		o.connect(g); g.connect(bus); o.start(t); o.stop(t + attack + decay + 0.05);
	}
	/** Each hash's tone comes from its own last bits, on a pentatonic scale so the stream stays gentle. */
	private blip(t: number, hex: string): void {
		const d = parseInt(hex.slice(-3), 16) % 10;
		const f = 440 * Math.pow(2, (PENTA[d % 5] + 12 * Math.floor(d / 5)) / 12);
		this.tone(t, f, 0.05, 0.14, this.clockBus);
		this.tone(t, f * 4, 0.008, 0.05, this.clockBus);
	}
	private ping(t: number): void { this.tone(t, 1318.5, 0.07, 1.1); this.tone(t, 1318.5 * 2.76, 0.018, 0.5); }
	private click(t: number, f: number): void {
		const src = this.ctx!.createBufferSource();
		const g = this.gain(0.3);
		src.buffer = this.tickBuf; src.playbackRate.value = f / 2100;
		src.connect(this.filt('bandpass', f, 4)).connect(g); g.connect(this.fxBus); src.start(t);
		this.tone(t, f / 2, 0.04, 0.09);
	}
	private swell(t: number): void {
		const lp = this.filt('lowpass', 700);
		lp.connect(this.fxBus);
		for (const [f, a] of [[110, 0.05], [164.81, 0.035]]) {
			const o = this.ctx!.createOscillator();
			const g = this.gain(0);
			o.frequency.value = f;
			g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.8); g.gain.setValueAtTime(a, t + 1.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
			o.connect(g); g.connect(lp); o.start(t); o.stop(t + 3.1);
		}
	}
	private sweepPulse(t: number, f0: number, f1: number, dur: number, peak: number): void {
		const o = this.ctx!.createOscillator();
		const g = this.gain(0);
		o.setPeriodicWave(this.wave);
		o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
		g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + dur * 0.3); g.gain.setValueAtTime(peak, t + dur * 0.8); g.gain.linearRampToValueAtTime(0, t + dur);
		o.connect(this.filt('lowpass', 6000)).connect(g); g.connect(this.fxBus); o.start(t); o.stop(t + dur + 0.05);
	}

	// ── driven by the page ─────────────────────────────────────────────────

	private get live(): boolean { return this.on && !!this.ctx && this.ctx.state === 'running'; }
	private get clockAudible(): boolean { return this.zone === 'pipeline' || (this.zone === 'dive' && this.diveBeat >= 3); }

	/** Call once per pipeline clock with that clock's comparator result. */
	onTick(res: Result | null): void {
		if (!this.live || !this.clockAudible) return;
		const sp = this.inputs().speed;
		const now = this.ctx!.currentTime;
		if (this.nextT < now + 0.02 || this.nextT > now + 0.3) this.nextT = now + 0.03;
		const t = this.nextT;
		this.nextT += 1 / sp;
		if (sp <= 60) this.tickAt(t, sp <= 15 ? 0.25 : 0.14);
		if (res && sp <= 15) this.blip(t, res.tok.hex);
		if (res && res.v === 'share') this.ping(t);
	}

	/** Call every animation frame. */
	update(): void {
		if (!this.live) return;
		const inp = this.inputs();
		const inDive = this.zone === 'dive';
		const b = Math.min(2, this.diveBeat);
		const fan = inDive && this.diveBeat <= 2;
		this.set(this.fanBus.gain, fan ? [0.4, 0.36, 0.24][b] : 0, fan ? 0.5 : 0.8);
		this.set(this.fanLP.frequency, [3400, 950, 520][b], 0.6);
		this.set(this.whineG.gain, inDive && this.diveBeat === 0 ? 0.006 : 0, 0.5);
		const clk = this.clockAudible && inp.playing && !inp.found;
		if (clk && inp.clock !== this.actClock) { this.actClock = inp.clock; this.activity = inp.activity(); }
		this.set(this.bedG.gain, clk ? 0.04 + 0.3 * this.activity : 0, 0.25);
		this.set(this.pulseG.gain, clk && inp.speed > 60 ? 0.06 : 0, 0.08);
		this.set(this.pulseOsc.frequency, inp.speed, 0.02);
	}

	/** The 3D dive moved to step `i` (0-based). */
	beat(i: number, instant = false): void {
		const prev = this.diveBeat;
		this.diveBeat = i;
		if (!this.live || instant || this.zone !== 'dive') return;
		const t = this.ctx!.currentTime + 0.05;
		if (i === 2 && prev < 2) [1760, 1480, 1245, 1047, 880].forEach((f, k) => this.click(t + 0.25 + k * 0.2, f));
		if (i === 3 && prev < 3) this.swell(t + 0.3);
		if (i === 4 && !this.reduced) this.sweepPulse(t, Math.max(4, this.inputs().speed), 1600, 2.5, 0.05);
	}

	/** clean_jobs: the discarded in-flight hashes as one quick falling burst. */
	flush(): void {
		if (this.live) this.sweepPulse(this.ctx!.currentTime + 0.02, 700, 160, 0.32, 0.06);
	}
}
