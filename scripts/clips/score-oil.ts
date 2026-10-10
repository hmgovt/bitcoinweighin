/**
 * score-oil.ts — the original score for "What does bitcoin buy in oil?",
 * cut to its beats (src/lib/clips/oilClip.ts). Built for a feed: it hits on
 * frame 0 and never stops moving.
 *
 *   the cold open (an impact on the first frame, a riser into "= ONE OIL
 *   FIELD" and a second hit) → the smash cut to one sat (a reverse whoosh,
 *   one drop) → the climb back up (a 120 bpm pulse, a sweep into each stop,
 *   a phrase a step higher at each arrival, chords opening as the amounts
 *   grow) → all 21 million (the big one) → "you can't put crude in a car"
 *   (the beat drops out) → the pump (the pulse back, lighter) → 2013 to
 *   today (ticks racing the chart into a hit) → the field again (the house
 *   sound, settling so a replay loops into the opening hit).
 *
 *   npx tsx scripts/clips/score-oil.ts --out=output/clips/oil-score.wav
 */
import { resolve } from 'node:path';
import { BEATS, STOPS, type StopKey } from '../../src/lib/clips/oilClip.ts';
import { Mix, pad, tone, boom, sweep, air, sub, pingPong, fadeOut, signature, master, smooth, PLUCK, BELL } from './synth.ts';

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const B = BEATS;
const S = Object.fromEntries(STOPS.map((s) => [s.key, s])) as Record<StopKey, (typeof STOPS)[number]>;

// D minor, opening out as the amounts grow.
const Dm9 = [38, 50, 53, 57, 64];
const Bb = [34, 50, 53, 58, 62];
const Gm9 = [43, 50, 55, 58, 69];
const A7sus = [45, 52, 57, 59, 64];
const F = [41, 48, 53, 57, 60];
const C = [36, 48, 52, 55, 62];

/** A drum-machine pulse: a kick on every beat and a closed hat between, over [a, b). */
function pulse(m: Mix, a: number, b: number, beat: number, level: number) {
	for (let t = a; t < b - 0.01; t += beat) {
		boom(m, t, 120, 44, 0.22 * level, 0.16);
		air(m, t + beat / 2, 0.016 * level, 0.03);
	}
}

async function main() {
	const m = new Mix(B.duration);
	const beat = 0.5; // 120 bpm

	// ── The cold open: an impact on frame 0, a riser, a second hit on the answer. ──
	boom(m, 0, 90, 32, 0.6, 0.6);
	air(m, 0, 0.05, 0.4);
	tone(m, 0.02, 62, -0.3, 0.07, 1.4, BELL);
	tone(m, 0.02, 69, 0.3, 0.06, 1.4, BELL);
	pad(m, Dm9, 0, S.open.until, 0.55, (t) => 500 + 2500 * smooth(t / 0.7), 0.05);
	sweep(m, 0.15, 0.7, 400, 5000, (u) => 0.12 * u * u);
	boom(m, 0.7, 80, 36, 0.5, 0.45);
	tone(m, 0.72, 74, 0, 0.09, 1.2, BELL);
	tone(m, 0.72, 81, 0, 0.06, 1.2, BELL);

	// ── The smash cut to one sat: a falling whoosh and a single drop. ──
	sweep(m, S.open.until - 0.35, S.sat.at + 0.1, 5000, 200, (u) => 0.14 * Math.sin(Math.PI * u));
	tone(m, S.sat.at + 0.15, 96, 0.2, 0.08, 0.25, PLUCK);
	tone(m, S.sat.at + 0.32, 91, -0.2, 0.05, 0.3, PLUCK);

	// ── The climb: a pulse, a sweep into each stop, a phrase on arrival, chords opening. ──
	const climb: StopKey[] = ['tank', 'one', 'thousand', 'elSalvador', 'strategy', 'all'];
	const chords = [Dm9, Bb, Gm9, F, A7sus, Dm9];
	pulse(m, S.sat.at + 0.5, S.all.until, beat, 1);
	pad(m, Dm9, S.sat.at, S.tank.at, 0.4, () => 500);
	climb.forEach((key, k) => {
		const s = S[key];
		const prev = STOPS[STOPS.indexOf(s) - 1];
		pad(m, chords[k], s.at - 0.2, s.until, 0.45 + 0.06 * k, () => 700 + 350 * k);
		sweep(m, prev.until, s.at, 300 + 200 * k, 3000 + 700 * k, (u) => 0.13 * u * u);
		const root = 72 + 2 * k;
		[[0, root + 7], [0.12, root + 3], [0.24, root + 10]].forEach(([dt, n], i) =>
			tone(m, s.at + dt, n, i % 2 ? 0.35 : -0.35, 0.07, 0.4, PLUCK)
		);
	});
	const roots: [number, number, number][] = climb.map((key, k) => [chords[k][0], S[key].at - 0.2, S[key].until]);
	sub(m, (t) => roots.find(([, a, b]) => t >= a && t < b)?.[0] ?? null, () => 0.14);
	pingPong(m, 0.25, 0.2);

	// ── All 21 million: the big one. ──
	boom(m, S.all.at, 70, 30, 0.65, 0.8);
	air(m, S.all.at, 0.05, 0.6);
	tone(m, S.all.at + 0.05, 62, -0.2, 0.08, 1.6, BELL);
	tone(m, S.all.at + 0.05, 69, 0.2, 0.07, 1.6, BELL);

	// ── "But you can't put crude in a car." The beat drops out; one low note. ──
	tone(m, S.noCrude.at + 0.05, 50, 0, 0.13, 0.9, BELL);
	pad(m, [38, 45], S.noCrude.at, S.noCrude.until, 0.3, () => 300, 0.2);

	// ── The pump: the pulse back, lighter, over F then C. ──
	pad(m, F, S.gasoline.at - 0.3, S.gasoline.until, 0.45, () => 1100);
	pad(m, C, S.diesel.at - 0.3, S.diesel.until, 0.45, () => 1200);
	pulse(m, S.gasoline.at - 0.3, S.diesel.until, beat, 0.75);
	{
		const groove = [0, 7, 12, 7, 3, 7, 12, 14];
		let k = 0;
		for (let t = S.gasoline.at - 0.3; t < S.diesel.until - 0.2; t += 0.25, k++) {
			const base = t < S.diesel.at ? 65 : 60;
			tone(m, t, base + groove[k % groove.length], k % 2 ? 0.4 : -0.4, 0.045, 0.14, PLUCK);
		}
	}

	// ── 2013 → today: ticks racing the chart into a hit. ──
	pad(m, Gm9, S.history.at, B.historyFrom + 2, 0.5, () => 900);
	pad(m, Bb, B.historyFrom + 2, B.historyFrom + 4, 0.6, () => 1400);
	pad(m, A7sus, B.historyFrom + 4, B.historyTo, 0.7, () => 2000, 0.06);
	pulse(m, S.history.at, B.historyTo, beat, 0.8);
	{
		let t = B.historyFrom;
		let k = 0;
		while (t < B.historyTo - 0.05) {
			const u = (t - B.historyFrom) / (B.historyTo - B.historyFrom);
			tone(m, t, 74 + [0, 3, 7, 10][k % 4] + (u > 0.5 ? 2 : 0), k % 2 ? 0.45 : -0.45, 0.04 + 0.03 * u, 0.1, PLUCK);
			t += 1 / (4 + 12 * u);
			k++;
		}
	}
	sweep(m, B.historyTo - 2, B.historyTo, 300, 6500, (u) => 0.16 * u * u);
	boom(m, B.historyTo, 76, 36, 0.4, 0.5);

	// ── The field again: the house sound, settling for the loop. ──
	pad(m, Dm9, S.end.at - 0.2, B.duration, 0.5, () => 1200, 0.3);
	signature(m, S.end.at);
	fadeOut(m, 1.2);

	const out = resolve(arg('out') ?? 'output/clips/oil-score.wav');
	await master(m, out, process.argv.includes('--keep'));
	console.log(`✓ ${out}  ${B.duration} s · ${STOPS.length} stops`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
