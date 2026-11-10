/**
 * score-ride.ts — an original score for the Moon-ride video, synthesised
 * from code (so it's ours outright: no licence, no copyright claims), cut to
 * the ride's own beats as computed by src/lib/moonRide.ts:
 *
 *   still pile → lift-off → the climb (an arpeggio that quickens with the
 *   log-altitude climb, filters opening, a riser) → the crest (a hit, then
 *   space) → the pull-back → the end card (a low boom and a bell).
 *
 * Writes a dry mix and a reverb impulse response as float WAVs, then ffmpeg
 * convolves, limits and loudness-normalises to -16 LUFS.
 *
 *   npx tsx scripts/clips/score-ride.ts --btc=21000000 --out=output/clips/ride-score.wav
 *   (defaults: all 21M at the dataset's last close; timings match make-ride-clip.ts)
 */
import { readFile, writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { ffmpeg } from '../dive-capture.ts';
import { rideTiming, stackHeightM } from '../../src/lib/moonRide.ts';

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const SR = 48000;

// ── The cue sheet, from the ride maths and make-ride-clip.ts's defaults ──
const LEAD_S = 1.2; // pile standing still before the ride starts
const HOLD_S = 3; // ride's closing caption before the end card
const END_S = 3.5; // end card

async function cues() {
	let btc = Number(arg('btc') ?? 21_000_000);
	let price = Number(arg('price') ?? 0);
	if (!price) {
		const rows = JSON.parse(await readFile('static/data/prices.json', 'utf8')) as Record<string, { btc_usd: number | null }>;
		const d = Object.keys(rows).sort().filter((k) => rows[k].btc_usd).pop()!;
		price = rows[d].btc_usd!;
	}
	const t = rideTiming(stackHeightM(btc * price));
	const lift = LEAD_S;
	const climb = lift + t.liftS;
	const crest = climb + t.climbS;
	const pull = crest + t.crestS;
	const card = pull + t.pullS;
	const end = card + HOLD_S;
	return { lift, climb, crest, pull, card, end, total: end + END_S };
}

// ── Building blocks ──
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
/** 0→1 over [a, a+fa], 1 until b, 1→0 over [b, b+fb]. */
const gate = (t: number, a: number, b: number, fa = 0.3, fb = 0.3) => Math.min(smooth((t - a) / fa), 1 - smooth((t - b) / fb));
let seed = 12345;
const noise = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 31 - 1; };

class OnePole { y = 0; step(x: number, fc: number) { const a = 1 - Math.exp((-2 * Math.PI * fc) / SR); this.y += a * (x - this.y); return this.y; } }
class Svf { lp = 0; bp = 0; step(x: number, fc: number, q = 0.7) { const f = 2 * Math.sin((Math.PI * Math.min(fc, SR / 6)) / SR); const hp = x - this.lp - q * this.bp; this.bp += f * hp; this.lp += f * this.bp; return this.bp; } }

async function main() {
	const C = await cues();
	const N = Math.ceil(C.total * SR);
	const L = new Float32Array(N);
	const R = new Float32Array(N);

	// Chords (MIDI) and when they sound.
	const Am9 = [45, 52, 57, 59, 60];
	const Fmaj9 = [41, 48, 57, 60, 64, 67];
	const Cadd9 = [36, 48, 55, 62, 64];
	const G6 = [43, 50, 55, 59, 62, 64];
	const Esus = [40, 47, 52, 57, 59];
	const Cmaj9 = [36, 43, 52, 59, 62, 67];
	const climbLen = C.crest - C.climb;
	const seg = (i: number, n: number) => C.climb + (climbLen * i) / n;
	const chords: { notes: number[]; a: number; b: number; gain: number }[] = [
		{ notes: Am9, a: 0, b: seg(0, 5), gain: 0.6 },
		{ notes: Am9, a: seg(0, 5), b: seg(1, 5), gain: 0.8 },
		{ notes: Fmaj9, a: seg(1, 5), b: seg(2, 5), gain: 0.85 },
		{ notes: Cadd9, a: seg(2, 5), b: seg(3, 5), gain: 0.9 },
		{ notes: G6, a: seg(3, 5), b: seg(4, 5), gain: 0.95 },
		{ notes: Esus, a: seg(4, 5), b: C.crest, gain: 1 },
		{ notes: Cmaj9, a: C.crest, b: C.end, gain: 0.9 },
		{ notes: Am9, a: C.end, b: C.total + 1, gain: 0.7 },
	];

	// ── Pad: detuned saws per note, low-passed, cutoff following the ride. ──
	const cutoff = (t: number) => {
		if (t < C.climb) return 450;
		if (t < C.crest) return 500 * Math.pow(9, (t - C.climb) / climbLen);
		if (t < C.pull) return 6500 - 2500 * smooth((t - C.crest) / (C.pull - C.crest));
		if (t < C.end) return 3800;
		return 2000;
	};
	const detune = [-0.07, 0.02, 0.07, -0.02]; // semitones: L, L, R, R
	for (const ch of chords) {
		const i0 = Math.max(0, Math.floor((ch.a - 0.35) * SR));
		const i1 = Math.min(N, Math.ceil((ch.b + 0.35) * SR));
		for (const note of ch.notes) {
			const f = detune.map((d) => hz(note + d));
			const ph = [0, 0, 0, 0].map(() => (noise() + 1) / 2);
			const lpL = [new OnePole(), new OnePole()];
			const lpR = [new OnePole(), new OnePole()];
			const level = (ch.gain * 0.055) / Math.sqrt(ch.notes.length / 5) * (note < 45 ? 1.2 : 1);
			for (let i = i0; i < i1; i++) {
				const t = i / SR;
				const env = gate(t, ch.a, ch.b, 0.35, 0.35);
				if (env <= 0) continue;
				let l = 0, r = 0;
				for (let k = 0; k < 4; k++) {
					ph[k] += f[k] / SR; if (ph[k] >= 1) ph[k] -= 1;
					const s = 2 * ph[k] - 1;
					if (k < 2) l += s; else r += s;
				}
				const fc = cutoff(t);
				l = lpL[1].step(lpL[0].step(l, fc), fc);
				r = lpR[1].step(lpR[0].step(r, fc), fc);
				const fadeIn = smooth(t / 0.8);
				L[i] += l * level * env * fadeIn;
				R[i] += r * level * env * fadeIn;
			}
		}
	}

	// ── Sub: the chord roots an octave down, swelling in, and quiet in space. ──
	const roots: [number, number, number][] = chords.map((c) => [c.notes[0] - 12, c.a, c.b]);
	let subPh = 0;
	for (let i = 0; i < N; i++) {
		const t = i / SR;
		const r = roots.find(([, a, b]) => t >= a && t < b) ?? roots[roots.length - 1];
		subPh += hz(Math.max(r[0], 28)) / SR;
		const amp = 0.16 * smooth(t / 2) * (t >= C.crest && t < C.end ? 0.35 : 1) * (1 - smooth((t - (C.total - 1.2)) / 1.2));
		const s = Math.sin(2 * Math.PI * subPh) * amp;
		L[i] += s; R[i] += s;
	}

	// ── Arpeggio over the climb, quickening from 4 to 13 notes a second. ──
	const plucks: { t: number; midi: number; pan: number; amp: number }[] = [];
	const pattern = [0, 1, 2, 3, 4, 3, 2, 1];
	{
		let t = C.climb, k = 0;
		while (t < C.crest - 0.05) {
			const u = (t - C.climb) / climbLen;
			const ch = chords.find((c) => t >= c.a && t < c.b)!;
			const tones = ch.notes.slice(1).map((m) => m + 12);
			const m = tones[pattern[k % pattern.length] % tones.length] + (u > 0.6 && k % 8 >= 4 ? 12 : 0);
			plucks.push({ t, midi: m, pan: k % 2 ? 0.45 : -0.45, amp: 0.1 + 0.08 * u });
			t += 1 / (4 * Math.pow(13 / 4, u));
			k++;
		}
	}
	// Bells drifting in space after the crest, and one on the end card.
	const bellNotes: [number, number][] = [[0.25, 79], [1.05, 74], [1.9, 76], [2.6, 83], [3.6, 79], [4.5, 86], [5.3, 76]];
	const bells = bellNotes.map(([dt, m], i) => ({ t: C.crest + dt, midi: m, pan: [-0.5, 0.4, -0.2, 0.6, -0.6, 0.3, 0][i], amp: 0.06 }));
	bells.push({ t: C.end, midi: 81, pan: 0, amp: 0.11 }, { t: C.end + 0.02, midi: 76, pan: 0, amp: 0.07 });
	const addTone = (t0: number, midi: number, pan: number, amp: number, tau: number, partials: [number, number][]) => {
		const i0 = Math.floor(t0 * SR), len = Math.min(N - i0, Math.ceil(tau * 6 * SR));
		const f = hz(midi), gl = amp * Math.sqrt((1 - pan) / 2), gr = amp * Math.sqrt((1 + pan) / 2);
		for (let j = 0; j < len; j++) {
			const t = j / SR;
			let s = 0;
			for (const [ratio, w] of partials) s += w * Math.sin(2 * Math.PI * f * ratio * t) * Math.exp((-t * ratio) / tau);
			s *= Math.min(1, t / 0.004);
			L[i0 + j] += s * gl; R[i0 + j] += s * gr;
		}
	};
	for (const p of plucks) addTone(p.t, p.midi, p.pan, p.amp, 0.22, [[1, 1], [2, 0.25], [3, 0.08]]);
	for (const b of bells) addTone(b.t, b.midi, b.pan, b.amp, 1.6, [[1, 1], [2.76, 0.35], [5.4, 0.12]]);

	// Ping-pong echo on everything so far above the pad (cheap depth for the arp).
	{
		const d = Math.round(0.27 * SR), fb = 0.28;
		for (let i = d; i < N; i++) {
			L[i] += R[i - d] * fb * 0.5;
			R[i] += L[i - d] * fb * 0.5;
		}
	}

	// ── Riser into the crest: band-passed noise sweeping up. ──
	{
		const a = C.crest - Math.min(4.5, climbLen * 0.45);
		const svL = new Svf(), svR = new Svf();
		for (let i = Math.floor(a * SR); i < Math.floor(C.crest * SR); i++) {
			const t = i / SR, u = (t - a) / (C.crest - a);
			const fc = 300 * Math.pow(22, u);
			const amp = 0.22 * u * u * (1 - smooth((t - (C.crest - 0.03)) / 0.03));
			L[i] += svL.step(noise(), fc, 0.5) * amp;
			R[i] += svR.step(noise(), fc * 1.03, 0.5) * amp;
		}
	}

	// ── Hits: the crest (boom + air) and the end card (a softer boom). ──
	const boom = (t0: number, f0: number, f1: number, amp: number, tau: number) => {
		let ph = 0;
		const i0 = Math.floor(t0 * SR);
		for (let j = 0; j < Math.min(N - i0, tau * 5 * SR); j++) {
			const t = j / SR;
			ph += (f1 + (f0 - f1) * Math.exp(-t / 0.12)) / SR;
			const s = Math.sin(2 * Math.PI * ph) * amp * Math.exp(-t / tau) * Math.min(1, t / 0.003);
			L[i0 + j] += s; R[i0 + j] += s;
		}
	};
	boom(C.crest, 110, 46, 0.55, 0.7);
	boom(C.end, 90, 44, 0.35, 0.6);
	{
		const hp = new OnePole(), hp2 = new OnePole(), i0 = Math.floor(C.crest * SR);
		for (let j = 0; j < 2.5 * SR && i0 + j < N; j++) {
			const t = j / SR, n = noise();
			const x = n - hp.step(n, 5000);
			const y = noise() - hp2.step(noise(), 5000);
			const e = 0.07 * Math.exp(-t / 0.9) * Math.min(1, t / 0.01);
			L[i0 + j] += x * e; R[i0 + j] += y * e;
		}
	}

	// Fade out the last second.
	for (let i = 0; i < N; i++) { const g = 1 - smooth((i / SR - (C.total - 1)) / 1); L[i] *= g; R[i] *= g; }

	// ── Reverb IR: 2.6 s of decaying, darkening stereo noise. ──
	const irN = Math.round(2.6 * SR);
	const irL = new Float32Array(irN), irR = new Float32Array(irN);
	{
		const a = new OnePole(), b = new OnePole();
		for (let i = 0; i < irN; i++) {
			const t = i / SR, e = Math.exp(-t / 0.55), fc = 9000 * Math.exp(-t / 0.9) + 600;
			irL[i] = a.step(noise(), fc) * e;
			irR[i] = b.step(noise(), fc) * e;
		}
	}

	const out = resolve(arg('out') ?? 'output/clips/ride-score.wav');
	await mkdir(dirname(out), { recursive: true });
	const dir = await mkdtemp(join(tmpdir(), 'score-'));
	try {
		await writeFile(join(dir, 'dry.wav'), wav(L, R));
		await writeFile(join(dir, 'ir.wav'), wav(irL, irR));
		if (process.argv.includes('--keep')) await writeFile(out.replace(/\.wav$/, '-dry.wav'), wav(L, R));
		await ffmpeg([
			'-y', '-i', join(dir, 'dry.wav'),
			// A small multi-tap room (a convolution reverb coloured the mix at ~1.2 kHz), a gentle
			// high shelf so phone speakers get some air, then limit and normalise.
			'-af', 'aecho=0.9:0.6:47|83|131|197|263:0.32|0.26|0.21|0.16|0.12,highshelf=f=3000:g=2,alimiter=limit=0.89,loudnorm=I=-16:TP=-1.5:LRA=11',
			'-ar', String(SR), '-c:a', 'pcm_s16le', out,
		]);
		console.log(`✓ ${out}  ${C.total.toFixed(2)} s · crest at ${C.crest.toFixed(2)} s · end card at ${C.end.toFixed(2)} s`);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

/** Stereo 32-bit float WAV. */
function wav(l: Float32Array, r: Float32Array): Buffer {
	const n = l.length, data = Buffer.alloc(n * 8);
	for (let i = 0; i < n; i++) { data.writeFloatLE(l[i], i * 8); data.writeFloatLE(r[i], i * 8 + 4); }
	const h = Buffer.alloc(44);
	h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
	h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(2, 22);
	h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 8, 28); h.writeUInt16LE(8, 32); h.writeUInt16LE(32, 34);
	h.write('data', 36); h.writeUInt32LE(data.length, 40);
	return Buffer.concat([h, data]);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
