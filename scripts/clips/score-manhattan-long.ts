/**
 * score-manhattan-long.ts — the original score for the long "cyber
 * Manhattan" cut, on its beats (src/lib/clips/manhattanLongClip.ts):
 *
 *   frame one hits (a boom on an open chord: no silent lead-in) → the drain
 *   to one coin (a falling whoosh) → one coin (a music-box phrase) → each
 *   stack's climb (ticks quickening like the counter, a short riser) and its
 *   answer (a hit and a bell), the chords moving up a step per stack → every
 *   coin mined (the longest climb, the biggest hit) → a lift in the last
 *   second back into the opening boom, so the loop has no seam.
 *
 *   npx tsx scripts/clips/score-manhattan-long.ts --out=output/clips/manhattan-long-score.wav
 */
import { resolve } from 'node:path';
import { beats, DURATION } from '../../src/lib/clips/manhattanLongClip.ts';
import { Mix, pad, tone, boom, sweep, air, sub, pingPong, signature, master, smooth, PLUCK, BELL } from './synth.ts';

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

// Only the timings are used; they don't depend on the stacks.
const B = beats({ price: 1, mined: 1, usGov: 1, blackrock: 1, strategy: 1, satoshi: 1 });
const at = (id: string) => B.find((b) => b.id === id)!;

const Am9 = [45, 52, 57, 59, 60];
const F = [41, 48, 53, 57, 60];
const Dm9 = [38, 50, 53, 57, 64];
const Esus = [40, 47, 52, 57, 59];
const G6 = [43, 50, 55, 59, 64];
const Am = [45, 52, 60];
/** Each climbing stack's chord and bass root, rising through the video. */
const CLIMBS: [string, number[], number][] = [
	['pizza', F, 29],
	['usgov', Dm9, 26],
	['blackrock', Esus, 28],
	['strategy', G6, 31],
	['satoshi', F, 29],
	['mined', Esus, 28],
];

async function main() {
	const m = new Mix(DURATION);
	const one = at('one');

	// ── Frame one: already playing. An open chord, a boom, air. ──
	pad(m, Am9, 0, one.t0 + 0.6, 0.6, (t) => 1500 - 1100 * smooth((t - one.t0) / 1.2), 0.02);
	boom(m, 0, 92, 40, 0.5, 0.5);
	air(m, 0, 0.05, 0.4);
	tone(m, 0.05, 81, 0, 0.07, 1.4, BELL);
	tone(m, at('hook').sub!.a, 88, 0.35, 0.04, 1.2, BELL);

	// ── The drain to one coin: a whoosh falling to the Battery. ──
	sweep(m, one.t0 - 0.1, one.t0 + 1.4, 5200, 260, (u) => 0.2 * Math.sin(Math.PI * Math.min(1, u * 1.1)));
	pad(m, Am, one.t0 + 1.2, at('pizza').t0 + 0.3, 0.3, () => 520);
	[[0, 88], [0.24, 84], [0.48, 81], [0.9, 76]].forEach(([dt, n], i) => tone(m, one.t0 + 1.4 + dt, n, i % 2 ? 0.3 : -0.3, 0.075, 0.5, PLUCK));

	// ── Each stack: a climb under ticks and a riser, then its answer. ──
	const roots: [number, number, number][] = [[33, 0, one.t0 + 0.4]];
	for (const [id, chord, root] of CLIMBS) {
		const b = at(id);
		const [c0, c1] = b.climb!;
		const len = c1 - c0;
		const last = id === 'mined';
		pad(m, chord, b.t0, b.t1 + (last ? 0 : 0.2), last ? 0.85 : 0.7, (t) => 500 * Math.pow(last ? 9 : 5, Math.min(1, Math.max(0, (t - c0) / len))), last ? 0.02 : 0.35);
		roots.push([root, b.t0, b.t1]);
		const order = [4, 2, 3, 1, 4, 3, 2, 1];
		let t = c0, k = 0;
		const top = last ? 16 : 11;
		while (t < c1 - 0.04) {
			const u = (t - c0) / len;
			tone(m, t, chord[order[k % order.length] % chord.length] + 24, k % 2 ? 0.45 : -0.45, 0.045 + 0.05 * u, 0.12, PLUCK);
			t += 1 / (3 * Math.pow(top / 3, u));
			k++;
		}
		const rise = last ? 3.5 : 1.8;
		sweep(m, c1 - rise, c1, 300, last ? 7000 : 4500, (u) => (last ? 0.2 : 0.12) * u * u * (1 - smooth((u - 0.992) / 0.008)));
		boom(m, c1, last ? 84 : 76, last ? 36 : 42, last ? 0.5 : 0.32, last ? 0.6 : 0.4);
		air(m, c1, last ? 0.05 : 0.03, 0.4);
		tone(m, c1 + 0.12, chord[chord.length - 1] + 12, -0.2, last ? 0.08 : 0.06, 1.2, BELL);
		if (id === 'pizza') [[0.45, 84], [0.62, 88], [0.79, 91]].forEach(([dt, n]) => tone(m, c1 + dt, n, 0.3, 0.05, 0.35, PLUCK));
	}
	pingPong(m, 0.21, 0.22);

	// ── The finale holds, then lifts back into frame one. ──
	const fin = at('mined');
	signature(m, fin.sub!.a);
	pad(m, Am9, fin.climb![1] + 0.4, DURATION + 0.1, 0.55, () => 1500, 0.6);
	sweep(m, DURATION - 0.9, DURATION, 400, 3200, (u) => 0.1 * u * u);
	roots.push([33, fin.climb![1], DURATION]);
	sub(m, (t) => roots.find(([, a, b]) => t >= a && t < b)?.[0] ?? null, () => 0.15);

	const out = resolve(arg('out') ?? 'output/clips/manhattan-long-score.wav');
	await master(m, out, process.argv.includes('--keep'));
	console.log(`✓ ${out}  ${DURATION} s · ${CLIMBS.length} climbs`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
