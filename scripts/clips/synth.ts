/**
 * synth.ts — the small synthesiser behind the clips' original scores
 * (score-ride.ts, score-manhattan.ts). Plain TypeScript into a stereo float
 * buffer; ffmpeg adds a small room, limits and normalises to -16 LUFS.
 * Everything is ours outright: no samples, no licences.
 */
import { writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { ffmpeg } from '../dive-capture.ts';

export const SR = 48000;
export const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
/** 0→1 over [a, a+fa], 1 until b, 1→0 over [b, b+fb]. */
export const gate = (t: number, a: number, b: number, fa = 0.3, fb = 0.3) => Math.min(smooth((t - a) / fa), 1 - smooth((t - b) / fb));

let seed = 12345;
/** Deterministic white noise in [-1, 1), so every render of a score is identical. */
export const noise = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 31 - 1; };

export class OnePole { y = 0; step(x: number, fc: number) { const a = 1 - Math.exp((-2 * Math.PI * fc) / SR); this.y += a * (x - this.y); return this.y; } }
export class Svf { lp = 0; bp = 0; step(x: number, fc: number, q = 0.7) { const f = 2 * Math.sin((Math.PI * Math.min(fc, SR / 6)) / SR); const hp = x - this.lp - q * this.bp; this.bp += f * hp; this.lp += f * this.bp; return this.bp; } }

export class Mix {
	readonly N: number;
	readonly L: Float32Array;
	readonly R: Float32Array;
	constructor(readonly seconds: number) {
		this.N = Math.ceil(seconds * SR);
		this.L = new Float32Array(this.N);
		this.R = new Float32Array(this.N);
	}
}

/** A pad: two detuned saws per side per note, two-pole low-passed at `cutoff(t)`, faded in and out over [a, b]. */
export function pad(m: Mix, notes: number[], a: number, b: number, gain: number, cutoff: (t: number) => number, fade = 0.35) {
	const detune = [-0.07, 0.02, 0.07, -0.02];
	const i0 = Math.max(0, Math.floor((a - fade) * SR)), i1 = Math.min(m.N, Math.ceil((b + fade) * SR));
	for (const note of notes) {
		const f = detune.map((d) => hz(note + d));
		const ph = [0, 0, 0, 0].map(() => (noise() + 1) / 2);
		const lpL = [new OnePole(), new OnePole()], lpR = [new OnePole(), new OnePole()];
		const level = ((gain * 0.055) / Math.sqrt(notes.length / 5)) * (note < 45 ? 1.2 : 1);
		for (let i = i0; i < i1; i++) {
			const t = i / SR, env = gate(t, a, b, fade, fade);
			if (env <= 0) continue;
			let l = 0, r = 0;
			for (let k = 0; k < 4; k++) {
				ph[k] += f[k] / SR; if (ph[k] >= 1) ph[k] -= 1;
				if (k < 2) l += 2 * ph[k] - 1; else r += 2 * ph[k] - 1;
			}
			const fc = cutoff(t);
			m.L[i] += lpL[1].step(lpL[0].step(l, fc), fc) * level * env;
			m.R[i] += lpR[1].step(lpR[0].step(r, fc), fc) * level * env;
		}
	}
}

/** A struck tone: sine partials [ratio, weight], each decaying (higher ones faster). */
export function tone(m: Mix, t0: number, midi: number, pan: number, amp: number, tau: number, partials: [number, number][]) {
	const i0 = Math.floor(t0 * SR);
	if (i0 >= m.N) return;
	const len = Math.min(m.N - i0, Math.ceil(tau * 6 * SR));
	const f = hz(midi), gl = amp * Math.sqrt((1 - pan) / 2), gr = amp * Math.sqrt((1 + pan) / 2);
	for (let j = 0; j < len; j++) {
		const t = j / SR;
		let s = 0;
		for (const [ratio, w] of partials) s += w * Math.sin(2 * Math.PI * f * ratio * t) * Math.exp((-t * ratio) / tau);
		s *= Math.min(1, t / 0.004);
		m.L[i0 + j] += s * gl; m.R[i0 + j] += s * gr;
	}
}
export const PLUCK: [number, number][] = [[1, 1], [2, 0.25], [3, 0.08]];
export const BELL: [number, number][] = [[1, 1], [2.76, 0.35], [5.4, 0.12]];

/** A pitched thump: sine gliding from f0 to f1. */
export function boom(m: Mix, t0: number, f0: number, f1: number, amp: number, tau: number) {
	let ph = 0;
	const i0 = Math.floor(t0 * SR);
	for (let j = 0; j < tau * 5 * SR && i0 + j < m.N; j++) {
		const t = j / SR;
		ph += (f1 + (f0 - f1) * Math.exp(-t / 0.12)) / SR;
		const s = Math.sin(2 * Math.PI * ph) * amp * Math.exp(-t / tau) * Math.min(1, t / 0.003);
		m.L[i0 + j] += s; m.R[i0 + j] += s;
	}
}

/** Band-passed noise sweeping from f0 to f1 over [a, b] (a riser up, a whoosh down), shaped by `amp(u)`. */
export function sweep(m: Mix, a: number, b: number, f0: number, f1: number, amp: (u: number) => number) {
	const sl = new Svf(), sr = new Svf();
	for (let i = Math.max(0, Math.floor(a * SR)); i < Math.min(m.N, Math.floor(b * SR)); i++) {
		const u = (i / SR - a) / (b - a), fc = f0 * Math.pow(f1 / f0, u), g = amp(u);
		m.L[i] += sl.step(noise(), fc, 0.5) * g;
		m.R[i] += sr.step(noise(), fc * 1.03, 0.5) * g;
	}
}

/** A burst of high-passed noise ("air" on a hit). */
export function air(m: Mix, t0: number, amp: number, tau: number) {
	const h1 = new OnePole(), h2 = new OnePole(), i0 = Math.floor(t0 * SR);
	for (let j = 0; j < tau * 3 * SR && i0 + j < m.N; j++) {
		const t = j / SR, a = noise(), b = noise();
		const e = amp * Math.exp(-t / tau) * Math.min(1, t / 0.01);
		m.L[i0 + j] += (a - h1.step(a, 5000)) * e; m.R[i0 + j] += (b - h2.step(b, 5000)) * e;
	}
}

/** A sine an octave or two down, following `root(t)` (MIDI, or null for silence). */
export function sub(m: Mix, root: (t: number) => number | null, amp: (t: number) => number) {
	let ph = 0;
	for (let i = 0; i < m.N; i++) {
		const t = i / SR, r = root(t);
		if (r === null) continue;
		ph += hz(Math.max(r, 28)) / SR;
		const s = Math.sin(2 * Math.PI * ph) * amp(t);
		m.L[i] += s; m.R[i] += s;
	}
}

/** Cross-channel echo on the whole mix so far. */
export function pingPong(m: Mix, delayS: number, fb: number) {
	const d = Math.round(delayS * SR);
	for (let i = d; i < m.N; i++) { m.L[i] += m.R[i - d] * fb * 0.5; m.R[i] += m.L[i - d] * fb * 0.5; }
}

export function fadeOut(m: Mix, seconds: number) {
	for (let i = 0; i < m.N; i++) { const g = 1 - smooth((i / SR - (m.seconds - seconds)) / seconds); m.L[i] *= g; m.R[i] *= g; }
}

/** The house sound: a soft boom and an A/E bell, on every end card. */
export function signature(m: Mix, t0: number) {
	boom(m, t0, 90, 44, 0.35, 0.6);
	tone(m, t0, 81, 0, 0.11, 1.6, BELL);
	tone(m, t0 + 0.02, 76, 0, 0.07, 1.6, BELL);
}

/** Room, a little air for phone speakers, limit, normalise to -16 LUFS; writes 16-bit WAV. */
export async function master(m: Mix, out: string, keepDry = false) {
	await mkdir(dirname(out), { recursive: true });
	const dir = await mkdtemp(join(tmpdir(), 'score-'));
	try {
		await writeFile(join(dir, 'dry.wav'), wav(m.L, m.R));
		if (keepDry) await writeFile(out.replace(/\.wav$/, '-dry.wav'), wav(m.L, m.R));
		await ffmpeg([
			'-y', '-i', join(dir, 'dry.wav'),
			'-af', 'aecho=0.9:0.6:47|83|131|197|263:0.32|0.26|0.21|0.16|0.12,highshelf=f=3000:g=2,alimiter=limit=0.89,loudnorm=I=-16:TP=-1.5:LRA=11',
			'-ar', String(SR), '-c:a', 'pcm_s16le', out,
		]);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

/** Stereo 32-bit float WAV. */
export function wav(l: Float32Array, r: Float32Array): Buffer {
	const n = l.length, data = Buffer.alloc(n * 8);
	for (let i = 0; i < n; i++) { data.writeFloatLE(l[i], i * 8); data.writeFloatLE(r[i], i * 8 + 4); }
	const h = Buffer.alloc(44);
	h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
	h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(2, 22);
	h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 8, 28); h.writeUInt16LE(8, 32); h.writeUInt16LE(32, 34);
	h.write('data', 36); h.writeUInt32LE(data.length, 40);
	return Buffer.concat([h, data]);
}
