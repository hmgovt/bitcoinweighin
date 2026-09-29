/**
 * score-manhattan.ts — the original score for the "cyber Manhattan" clip,
 * cut to its beats (src/lib/clips/manhattanClip.ts):
 *
 *   the quote card (a low drone and a slow pulse) → the whole island (a pad
 *   opening) → the dive to the Battery (a falling whoosh) → 1 BTC's tiny
 *   patch (one small music-box phrase) → the fill climbing lot by lot
 *   (ticks quickening like the counter over rising chords, a riser) →
 *   "4.1%… That's it." (the build cuts; a deflated low note) → the end card
 *   (the house boom and bell).
 *
 *   npx tsx scripts/clips/score-manhattan.ts --out=output/clips/manhattan-score.wav
 */
import { resolve } from 'node:path';
import { BEATS } from '../../src/lib/clips/manhattanClip.ts';
import { Mix, pad, tone, boom, sweep, air, sub, pingPong, fadeOut, signature, master, smooth, PLUCK, BELL } from './synth.ts';

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

const B = BEATS;
const oneBtc = B.questionEnd + 2.2; // the "1 BTC buys…" caption
const reveal = B.growEnd + 0.3; // "…4.1% of Manhattan's land"

const Am9 = [45, 52, 57, 59, 60];
const F = [41, 48, 53, 57, 60];
const Dm9 = [38, 50, 53, 57, 64];
const Esus = [40, 47, 52, 57, 59];
const Am = [45, 52, 60];

async function main() {
	const m = new Mix(B.duration);
	const growLen = B.growEnd - B.growStart;
	const g = (k: number) => B.growStart + (growLen * k) / 4;

	// ── Pads ──
	pad(m, Am9, 0, B.questionEnd + 1.2, 0.55, (t) => (t < B.quoteEnd ? 330 : t < B.questionEnd ? 330 + 1100 * smooth((t - B.quoteEnd) / 2.2) : 1430 - 900 * smooth((t - B.questionEnd) / 1.6)), 0.8);
	pad(m, Am9, B.questionEnd + 1.2, B.growStart, 0.3, () => 520);
	const cutoff = (t: number) => 600 * Math.pow(8, Math.min(1, Math.max(0, (t - B.growStart) / growLen)));
	pad(m, Am9, g(0), g(1), 0.8, cutoff);
	pad(m, F, g(1), g(2), 0.85, cutoff);
	pad(m, Dm9, g(2), g(3), 0.9, cutoff);
	pad(m, Esus, g(3), B.growEnd, 1, cutoff, 0.06);
	pad(m, Am, reveal, B.endCard + 0.2, 0.5, () => 900);
	pad(m, Am9, B.endCard, B.duration + 1, 0.55, () => 1600);

	// ── Sub: roots underneath, gone during the dive, back for the climb. ──
	const roots: [number, number, number][] = [[33, 0, B.questionEnd], [33, g(0), g(1)], [29, g(1), g(2)], [26, g(2), g(3)], [28, g(3), B.growEnd], [33, reveal, B.duration]];
	sub(m, (t) => roots.find(([, a, b]) => t >= a && t < b)?.[0] ?? null, (t) => 0.15 * smooth(t / 1.5) * (1 - smooth((t - (B.duration - 1.2)) / 1.2)));

	// ── The quote: a slow pulse and a distant shimmer. ──
	for (let t = 0.4; t < B.quoteEnd - 0.2; t += 0.86) boom(m, t, 70, 48, 0.16, 0.22);
	tone(m, 0.6, 88, -0.4, 0.03, 1.8, BELL);
	tone(m, 2.9, 84, 0.4, 0.03, 1.8, BELL);
	tone(m, B.quoteEnd + 0.2, 81, 0, 0.06, 1.6, BELL);

	// ── The dive: a whoosh falling from the sky to the Battery. ──
	sweep(m, B.questionEnd - 0.1, B.questionEnd + 1.9, 5200, 260, (u) => 0.2 * Math.sin(Math.PI * Math.min(1, u * 1.1)));

	// ── 1 BTC: one small music-box phrase. ──
	[[0, 88], [0.24, 84], [0.48, 81], [0.9, 76]].forEach(([dt, n], i) => tone(m, oneBtc + dt, n, i % 2 ? 0.3 : -0.3, 0.075, 0.5, PLUCK));

	// ── The fill: ticks quickening like the counter, from 3 to 16 a second. ──
	{
		const chordAt = (t: number) => (t < g(1) ? Am9 : t < g(2) ? F : t < g(3) ? Dm9 : Esus);
		const order = [4, 2, 3, 1, 4, 3, 2, 1];
		let t = B.growStart, k = 0;
		while (t < B.growEnd - 0.04) {
			const u = (t - B.growStart) / growLen, tones = chordAt(t);
			tone(m, t, tones[order[k % order.length] % tones.length] + 24, k % 2 ? 0.45 : -0.45, 0.05 + 0.05 * u, 0.12, PLUCK);
			t += 1 / (3 * Math.pow(16 / 3, u));
			k++;
		}
	}
	pingPong(m, 0.21, 0.24);
	sweep(m, B.growEnd - 3.5, B.growEnd, 300, 6500, (u) => 0.2 * u * u * (1 - smooth((u - 0.992) / 0.008)));

	// ── The reveal: the build stops dead; a low, deflated "that's it". ──
	boom(m, B.growEnd, 80, 38, 0.45, 0.55);
	air(m, B.growEnd, 0.04, 0.5);
	tone(m, reveal + 0.1, 72, -0.2, 0.07, 1.1, BELL);
	tone(m, reveal + 0.6, 69, 0.2, 0.07, 1.4, BELL);

	// ── The end card: the house sound. ──
	signature(m, B.endCard);
	fadeOut(m, 1.2);

	const out = resolve(arg('out') ?? 'output/clips/manhattan-score.wav');
	await master(m, out, process.argv.includes('--keep'));
	console.log(`✓ ${out}  ${B.duration} s · dive ${B.questionEnd} s · climb ${B.growStart}–${B.growEnd} s · end card ${B.endCard} s`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
