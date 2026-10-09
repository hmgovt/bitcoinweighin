/**
 * score-oil.ts — the original score for "What does bitcoin buy in oil?",
 * cut to its beats (src/lib/clips/oilClip.ts):
 *
 *   the hook card (a low drone, a slow pulse) → each stop on the climb, one
 *   sat to all 21 million (a rising whoosh into it, then a short music-box
 *   phrase a step higher than the last, over chords that open as the amounts
 *   grow) → all 21 million (a deep boom) → "But you can't put crude in a
 *   car." (the music drops out) → the pump (a lighter, plucked groove) →
 *   2013 to today (ticks running with the chart over a slow build) → the end
 *   card (the house boom and bell).
 *
 *   npx tsx scripts/clips/score-oil.ts --out=output/clips/oil-score.wav
 */
import { resolve } from 'node:path';
import { BEATS, STOPS } from '../../src/lib/clips/oilClip.ts';
import { Mix, pad, tone, boom, sweep, air, sub, pingPong, fadeOut, signature, master, smooth, PLUCK, BELL } from './synth.ts';

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const B = BEATS;
const S = Object.fromEntries(STOPS.map((s) => [s.key, s])) as Record<(typeof STOPS)[number]['key'], (typeof STOPS)[number]>;

// D minor, opening out as the amounts grow.
const Dm9 = [38, 50, 53, 57, 64];
const Bb = [34, 50, 53, 58, 62];
const Gm9 = [43, 50, 55, 58, 69];
const A7sus = [45, 52, 57, 59, 64];
const F = [41, 48, 53, 57, 60];
const C = [36, 48, 52, 55, 62];

async function main() {
	const m = new Mix(B.duration);
	const climb = STOPS.slice(0, STOPS.findIndex((s) => s.key === 'all') + 1);

	// ── The hook: a low drone and a slow pulse. ──
	pad(m, Dm9, 0, B.hookEnd + 0.4, 0.5, () => 380, 0.8);
	for (let t = 0.4; t < B.hookEnd - 0.3; t += 0.9) boom(m, t, 66, 46, 0.14, 0.22);
	tone(m, 0.7, 86, -0.3, 0.03, 1.8, BELL);
	tone(m, 2.6, 81, 0.3, 0.03, 1.8, BELL);

	// ── The climb: chords open with each stop; a whoosh into each, a phrase on arrival. ──
	const chords = [Dm9, Dm9, Bb, Gm9, F, A7sus, Dm9];
	climb.forEach((s, k) => {
		const start = k ? climb[k - 1].until : B.hookEnd;
		const open = 380 + 220 * k;
		pad(m, chords[k], start, k + 1 < climb.length ? climb[k + 1].at : s.until, 0.45 + 0.07 * k, () => open);
		if (k) sweep(m, climb[k - 1].until, s.at, 300 + 150 * k, 2400 + 600 * k, (u) => 0.12 * Math.sin(Math.PI * u));
		// A phrase a step higher at each stop: the amounts climbing.
		const root = 74 + 2 * k;
		[[0, root + 7], [0.18, root + 3], [0.36, root], [0.7, root + 5]].forEach(([dt, n], i) =>
			tone(m, s.at + 0.25 + dt, n, i % 2 ? 0.35 : -0.35, 0.06, 0.5, PLUCK)
		);
	});
	const roots: [number, number, number][] = climb.map((s, k) => [chords[k][0], k ? climb[k - 1].until : B.hookEnd, s.until]);
	sub(m, (t) => roots.find(([, a, b]) => t >= a && t < b)?.[0] ?? null, (t) => 0.13 * smooth((t - B.hookEnd) / 1.5) * (1 - smooth((t - S.all.until) / 0.6)));
	pingPong(m, 0.24, 0.22);

	// ── All 21 million: the deep one. ──
	boom(m, S.all.at, 76, 34, 0.5, 0.7);
	air(m, S.all.at, 0.04, 0.6);
	tone(m, S.all.at + 0.4, 69, -0.2, 0.08, 1.6, BELL);
	tone(m, S.all.at + 0.9, 74, 0.2, 0.07, 1.8, BELL);

	// ── "But you can't put crude in a car." The music drops out; one low note. ──
	tone(m, S.noCrude.at + 0.1, 50, 0, 0.12, 0.9, BELL);
	pad(m, [38, 45], S.noCrude.at, S.noCrude.until, 0.25, () => 300, 0.5);

	// ── At the pump: a lighter plucked groove, F then C. ──
	pad(m, F, S.gasoline.at - 0.3, S.gasoline.until, 0.4, () => 900);
	pad(m, C, S.diesel.at - 0.3, S.diesel.until, 0.4, () => 1000);
	{
		const groove = [0, 7, 12, 7, 3, 7, 12, 14];
		let k = 0;
		for (let t = S.gasoline.at; t < S.diesel.until - 0.2; t += 0.25, k++) {
			const base = t < S.diesel.at ? 65 : 60;
			tone(m, t, base + groove[k % groove.length], k % 2 ? 0.4 : -0.4, 0.045, 0.16, PLUCK);
		}
	}

	// ── 2013 → today: ticks running with the chart over a slow build, a riser to the end. ──
	pad(m, Gm9, S.diesel.until, B.historyFrom + 4, 0.5, (t) => 500 + 600 * smooth((t - S.diesel.until) / 6));
	pad(m, Bb, B.historyFrom + 4, B.historyFrom + 8, 0.6, () => 1200);
	pad(m, A7sus, B.historyFrom + 8, B.historyTo, 0.7, () => 1600, 0.06);
	pad(m, Dm9, B.historyTo, B.endCard + 0.3, 0.6, () => 1400);
	{
		let t = B.historyFrom;
		let k = 0;
		while (t < B.historyTo - 0.05) {
			const u = (t - B.historyFrom) / (B.historyTo - B.historyFrom);
			tone(m, t, 74 + [0, 3, 7, 10][k % 4] + (u > 0.5 ? 2 : 0), k % 2 ? 0.45 : -0.45, 0.035 + 0.035 * u, 0.12, PLUCK);
			t += 1 / (3 + 9 * u);
			k++;
		}
	}
	sweep(m, B.historyTo - 3, B.historyTo, 300, 6000, (u) => 0.16 * u * u);
	boom(m, B.historyTo, 72, 40, 0.3, 0.5);

	// ── The end card: the house sound. ──
	signature(m, B.endCard);
	fadeOut(m, 1.5);

	const out = resolve(arg('out') ?? 'output/clips/oil-score.wav');
	await master(m, out, process.argv.includes('--keep'));
	console.log(`✓ ${out}  ${B.duration} s · ${STOPS.length} stops · end card ${B.endCard} s`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
