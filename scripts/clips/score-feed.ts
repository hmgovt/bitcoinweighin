/**
 * score-feed.ts — original scores for the feed-cut clips, built from each
 * clip's own beats so the music lands where the pictures do:
 *
 *   frame 0: an impact and a riser into the hook's answer and a second hit
 *   → each hard cut: a falling whoosh and a single note
 *   → each climb: a 120 bpm pulse and a rising sweep into the next stop
 *   → each arrival: a short phrase a step higher than the last
 *   → the climax: the big one → a twist: the beat drops out, one low note
 *   → the end: the house sound, settling so a replay loops into frame 0.
 *
 *   npx tsx scripts/clips/score-feed.ts --clip=pu238 --out=output/clips/pu238-score.wav
 *   npx tsx scripts/clips/score-feed.ts --clip=manhattan --out=output/clips/manhattan-score.wav
 *
 * (The oil clip has its own, scripts/clips/score-oil.ts.)
 */
import { resolve } from 'node:path';
import { PU_DURATION, PU_STOPS } from '../../src/lib/clips/puClip.ts';
import { BEATS as MB } from '../../src/lib/clips/manhattanClip.ts';
import { Mix, pad, tone, boom, sweep, air, sub, pingPong, fadeOut, signature, master, smooth, PLUCK, BELL } from './synth.ts';

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

/** A clip's beats, in the terms the score needs. */
interface Cue {
	/** Seconds. */
	at: number;
	kind: 'cut' | 'arrive' | 'climax' | 'twist' | 'end';
	/** For an arrival: when its climb began (a sweep runs from here to `at`). */
	from?: number;
}
interface Plan {
	duration: number;
	/** When the hook's answer lands (the second hit). */
	hookHit: number;
	cues: Cue[];
	/** Where the pulse runs. */
	pulse: [number, number][];
}

function puPlan(): Plan {
	const cues: Cue[] = [];
	PU_STOPS.forEach((s, k) => {
		if (s.key === 'open') return;
		const prev = PU_STOPS[k - 1];
		if (s.key === 'end') cues.push({ at: s.at, kind: 'end' });
		else if (s.key === 'twist') cues.push({ at: s.at, kind: 'twist' });
		else if (s.key === 'all') cues.push({ at: s.at, kind: 'climax', from: prev.until });
		else if (s.cut) cues.push({ at: s.at, kind: 'cut' });
		else cues.push({ at: s.at, kind: 'arrive', from: prev.until });
	});
	const S = Object.fromEntries(PU_STOPS.map((s) => [s.key, s]));
	return { duration: PU_DURATION, hookHit: 0.7, cues, pulse: [[S.sat.at + 0.5, S.all.until]] };
}

function manhattanPlan(): Plan {
	return {
		duration: MB.duration,
		hookHit: 0.6,
		cues: [
			{ at: MB.openEnd, kind: 'cut' },
			{ at: MB.oneBtc, kind: 'arrive', from: MB.openEnd },
			{ at: MB.growEnd, kind: 'arrive', from: MB.growStart },
			{ at: MB.allEnd, kind: 'climax', from: MB.allStart },
			{ at: MB.endCard, kind: 'end' },
		],
		pulse: [[MB.growStart - 0.5, MB.allEnd + 2]],
	};
}

// D minor, opening out as the amounts grow.
const CHORDS = [
	[38, 50, 53, 57, 64],
	[34, 50, 53, 58, 62],
	[43, 50, 55, 58, 69],
	[41, 48, 53, 57, 60],
	[45, 52, 57, 59, 64],
	[38, 50, 53, 57, 64],
];

async function main() {
	const clip = arg('clip') ?? 'pu238';
	const P = clip === 'manhattan' ? manhattanPlan() : puPlan();
	const m = new Mix(P.duration);
	const beat = 0.5;

	// ── Frame 0: an impact, a riser, the answer's hit. ──
	boom(m, 0, 90, 32, 0.6, 0.6);
	air(m, 0, 0.05, 0.4);
	tone(m, 0.02, 62, -0.3, 0.07, 1.4, BELL);
	tone(m, 0.02, 69, 0.3, 0.06, 1.4, BELL);
	const first = P.cues[0]?.at ?? 2;
	pad(m, CHORDS[0], 0, first, 0.55, (t) => 500 + 2500 * smooth(t / P.hookHit), 0.05);
	sweep(m, 0.15, P.hookHit, 400, 5000, (u) => 0.12 * u * u);
	boom(m, P.hookHit, 80, 36, 0.5, 0.45);
	tone(m, P.hookHit + 0.02, 74, 0, 0.09, 1.2, BELL);

	// ── The pulse. ──
	for (const [a, b] of P.pulse) {
		for (let t = a; t < b - 0.01; t += beat) {
			boom(m, t, 120, 44, 0.22, 0.16);
			air(m, t + beat / 2, 0.016, 0.03);
		}
	}

	// ── The cues. ──
	let step = 0;
	let chordAt = 0;
	const roots: [number, number, number][] = [];
	P.cues.forEach((c, k) => {
		const next = P.cues[k + 1]?.at ?? P.duration;
		if (c.kind === 'cut') {
			sweep(m, c.at - 0.35, c.at + 0.1, 5000, 200, (u) => 0.14 * Math.sin(Math.PI * u));
			tone(m, c.at + 0.15, 96, 0.2, 0.08, 0.25, PLUCK);
		}
		if (c.kind === 'arrive' || c.kind === 'climax') {
			const chord = CHORDS[Math.min(++chordAt, CHORDS.length - 1)];
			if (c.from !== undefined) sweep(m, c.from, c.at, 300 + 150 * step, 3000 + 600 * step, (u) => 0.13 * u * u);
			pad(m, chord, c.at - 0.2, next, 0.45 + 0.05 * step, () => 700 + 300 * step);
			roots.push([chord[0], c.at - 0.2, next]);
			const root = 72 + 2 * step;
			[[0, root + 7], [0.12, root + 3], [0.24, root + 10]].forEach(([dt, n], i) => tone(m, c.at + dt, n, i % 2 ? 0.35 : -0.35, 0.07, 0.4, PLUCK));
			step++;
		}
		if (c.kind === 'climax') {
			boom(m, c.at, 70, 30, 0.65, 0.8);
			air(m, c.at, 0.05, 0.6);
			tone(m, c.at + 0.05, 62, -0.2, 0.08, 1.6, BELL);
			tone(m, c.at + 0.05, 69, 0.2, 0.07, 1.6, BELL);
		}
		if (c.kind === 'twist') {
			tone(m, c.at + 0.05, 50, 0, 0.13, 0.9, BELL);
			pad(m, [38, 45], c.at, next, 0.3, () => 300, 0.2);
		}
		if (c.kind === 'end') {
			pad(m, CHORDS[0], c.at - 0.2, P.duration, 0.5, () => 1200, 0.3);
			signature(m, c.at);
		}
	});
	sub(m, (t) => roots.find(([, a, b]) => t >= a && t < b)?.[0] ?? null, () => 0.14);
	pingPong(m, 0.25, 0.2);
	fadeOut(m, 1.2);

	const out = resolve(arg('out') ?? `output/clips/${clip}-score.wav`);
	await master(m, out, process.argv.includes('--keep'));
	console.log(`✓ ${out}  ${P.duration} s · ${P.cues.length} cues`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
