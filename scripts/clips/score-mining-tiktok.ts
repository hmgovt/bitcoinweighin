/**
 * score-mining-tiktok.ts — synthwave for the mining TikTok cut
 * (make-mining-tiktok.ts): detuned saw pads over a minor progression, a
 * 16th-note arpeggio, a pulsing sub, and micropercussion (noise ticks, a soft
 * pitched kick, offbeat clicks), with a hit on frame one and on every cut.
 * The last bar resolves into the first, so the loop has no seam.
 *
 *   npx tsx scripts/clips/score-mining-tiktok.ts --out=output/clips/mining-tiktok-score.wav
 */
import { resolve } from 'node:path';
import { Mix, pad, tone, boom, sweep, air, sub, pingPong, master, PLUCK, BELL } from './synth.ts';

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

/** The cut's beats, seconds (make-mining-tiktok.ts). */
const CUTS = [0, 3.2, 6.7, 10.0, 13.6, 16.9, 20.5];
const DURATION = 22.7;
const BPM = 112;
const beat = 60 / BPM;

// Am – F – C – G, two bars each, as in every synthwave track worth its neon.
const CHORDS: [number[], number][] = [
	[[57, 60, 64, 69], 45],
	[[53, 57, 60, 65], 41],
	[[48, 55, 60, 64], 36],
	[[55, 59, 62, 67], 43],
];
const bar = 4 * beat;
const chordAt = (t: number) => CHORDS[Math.floor(t / (2 * bar)) % CHORDS.length];

async function main() {
	const m = new Mix(DURATION);

	// Pads, a bar pair at a time, the filter breathing with each phrase.
	for (let t = 0, i = 0; t < DURATION; t += 2 * bar, i++) {
		const [notes] = CHORDS[i % CHORDS.length];
		pad(m, notes, t, Math.min(DURATION + 0.2, t + 2 * bar + 0.15), 0.45, (u) => 900 + 700 * Math.sin(((u - t) / (2 * bar)) * Math.PI), 0.08);
	}
	// Arp: 16ths up and down the chord, an octave up, ping-ponged.
	const pattern = [0, 1, 2, 3, 2, 1, 2, 3];
	for (let k = 0, t = 0; t < DURATION - 0.05; k++, t = (k * beat) / 4) {
		const [notes] = chordAt(t);
		tone(m, t, notes[pattern[k % pattern.length]] + 12, k % 2 ? 0.4 : -0.4, 0.035 + 0.01 * (k % 4 === 0 ? 1 : 0), 0.11, PLUCK);
	}
	pingPong(m, beat * 0.75, 0.3);
	// Sub on the root, pumping on the beat.
	sub(m, (t) => chordAt(t)[1], (t) => 0.14 * (0.55 + 0.45 * Math.min(1, ((t % beat) / beat) * 3)));

	// Micropercussion: soft kick on the beat, tiny ticks on 16ths, clicks on offbeats.
	for (let k = 0, t = 0; t < DURATION; k++, t = k * beat) {
		boom(m, t, 70, 44, 0.22, 0.14);
		air(m, t + beat / 2, 0.022, 0.03);
		for (const q of [0.25, 0.75]) air(m, t + q * beat, 0.009, 0.012);
		if (k % 4 === 3) tone(m, t + beat * 0.5, 96, 0.5, 0.02, 0.04, PLUCK);
	}

	// A hit on frame one and every cut; a short riser into each.
	for (const [i, c] of CUTS.entries()) {
		boom(m, c, 88, 40, 0.35, 0.35);
		air(m, c, 0.04, 0.25);
		tone(m, c + 0.03, chordAt(c)[0][3] + 12, i % 2 ? 0.25 : -0.25, 0.05, 0.9, BELL);
		if (i > 0) sweep(m, c - 0.7, c, 600, 5000, (u) => 0.06 * u * u);
	}

	const out = resolve(arg('out') ?? 'output/clips/mining-tiktok-score.wav');
	await master(m, out);
	console.log(`✓ ${out}  ${DURATION} s at ${BPM} bpm`);
}

main().catch((e) => { console.error(e); process.exit(1); });
