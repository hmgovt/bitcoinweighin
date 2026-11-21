/**
 * The long "cyber Manhattan" cut, for TikTok: just over a minute, built to
 * hook in the first second and to loop.
 *
 *   0 s    the payoff first: every bitcoin ever mined, already filling 98% of
 *          the island, the headline on screen in frame one;
 *   3.4 s  the fill drains to one coin at the Battery, then climbs a ladder
 *          of real stacks, a new one every ~8.5 s (each its own re-hook):
 *          the 2010 pizza, the US government, BlackRock vs Strategy, Satoshi;
 *   52.5 s every coin mined again, ending on the opening frame so it loops.
 *
 * Rendered by /clip/manhattan-long, captured by
 * scripts/clips/make-manhattan-clip.ts --cut=long. Pure: everything is a
 * function of the clip time and the stacks, so a capture is repeatable.
 */
import { DEVELOPABLE_M2, landM2, frontierStreet, USD_PER_M2 } from '../manhattan.js';

export interface Stacks {
	/** BTC-USD at the close the clip is priced at. */
	price: number;
	/** Every coin mined by then. */
	mined: number;
	usGov: number;
	blackrock: number;
	strategy: number;
	satoshi: number;
}

export interface Beat {
	id: string;
	t0: number;
	t1: number;
	/** BTC this beat ends on. */
	btc: number;
	/** When the amount climbs to `btc`, seconds (absolute); none for a held beat. */
	climb?: [number, number];
	eyebrow: string;
	head: string;
	/** Replaces `head` once the climb is done (the finale's answer). */
	headAfter?: string;
	/** The answer, shown once the climb is done. */
	result: string;
	/** A line under it, over [a, b] seconds (absolute). */
	sub?: { text: string; a: number; b: number };
}

export const DURATION = 64;
/** The fill drains from every coin mined to one, over these seconds. */
const DRAIN: [number, number] = [3.4, 4.6];
/** A Midtown block between avenues, 200 × 800 ft, m² (as LAND_YARDSTICKS). */
const MIDTOWN_BLOCK_M2 = 200 * 800 * 0.09290304;
const DOORMAT_M2 = 0.5;
const SQFT_PER_M2 = 10.7639104;

const n0 = (n: number) => Math.round(n).toLocaleString('en-US');
/** "1.6%", "4.2%", "98%". */
export const pct = (share: number) => (share < 0.1 ? `${(share * 100).toFixed(1)}%` : `${Math.round(share * 100)}%`);
/** "about 4½", "1", "35": Midtown blocks, to the half. */
const blocks = (m2: number) => {
	const h = Math.round((m2 / MIDTOWN_BLOCK_M2) * 2) / 2;
	return `${Math.floor(h)}${h % 1 ? '½' : ''}`;
};

/** The beats, with every figure worked out from the stacks. */
export function beats(s: Stacks): Beat[] {
	const m2 = (btc: number) => landM2(btc, s.price);
	const share = (btc: number) => m2(btc) / DEVELOPABLE_M2;
	const reach = (btc: number) => `${pct(share(btc))} of Manhattan. Battery to ${frontierStreet(m2(btc)) ?? 'the Battery'}.`;
	const minedLine = `buys ${pct(share(s.mined))} of Manhattan.`;
	// The price at which the coins mined so far would buy all of it.
	const wholeAt = (DEVELOPABLE_M2 * USD_PER_M2) / s.mined;
	const [lead, trail] = s.strategy >= s.blackrock ? ['Strategy', 'BlackRock'] : ['BlackRock', 'Strategy'];
	const gap = Math.abs(m2(s.strategy) - m2(s.blackrock));
	const pizza = m2(10_000) / MIDTOWN_BLOCK_M2;
	return [
		{ id: 'hook', t0: 0, t1: DRAIN[0], btc: s.mined, eyebrow: 'Every bitcoin ever mined', head: minedLine, result: '',
			sub: { text: 'Here’s who owns which blocks.', a: 1.9, b: DRAIN[0] - 0.2 } },
		{ id: 'one', t0: DRAIN[0], t1: 10, btc: 1, eyebrow: '1 bitcoin', head: `${Math.round(m2(1) * SQFT_PER_M2)} sq ft at the Battery.`,
			result: `About ${Math.round(m2(1) / DOORMAT_M2)} doormats.` },
		{ id: 'pizza', t0: 10, t1: 18.5, btc: 10_000, climb: [10.6, 15.6], eyebrow: 'May 2010', head: '10,000 BTC bought two pizzas.',
			result: pizza > 0.9 && pizza < 1.5 ? 'Today: a whole Midtown block.' : `Today: ${blocks(m2(10_000))} Midtown blocks.` },
		{ id: 'usgov', t0: 18.5, t1: 27, btc: s.usGov, climb: [19.1, 24.1], eyebrow: 'The US government', head: `${n0(s.usGov)} BTC`, result: reach(s.usGov) },
		{ id: 'blackrock', t0: 27, t1: 35.5, btc: s.blackrock, climb: [27.6, 32.6], eyebrow: 'BlackRock vs Strategy', head: `BlackRock’s ETF: ${n0(s.blackrock)} BTC`, result: reach(s.blackrock) },
		{ id: 'strategy', t0: 35.5, t1: 44, btc: s.strategy, climb: [36.1, 39.6], eyebrow: 'BlackRock vs Strategy', head: `Strategy: ${n0(s.strategy)} BTC`,
			result: `${pct(share(s.strategy))}. ${lead} wins by ${blocks(gap)} Midtown blocks.`, sub: { text: `(${trail}: ${pct(share(trail === 'BlackRock' ? s.blackrock : s.strategy))})`, a: 40.4, b: 43.7 } },
		{ id: 'satoshi', t0: 44, t1: 52.5, btc: s.satoshi, climb: [44.6, 49.6], eyebrow: 'Satoshi (est.)', head: `${(s.satoshi / 1e6).toFixed(1)} million BTC, never moved.`, result: reach(s.satoshi) },
		{ id: 'mined', t0: 52.5, t1: DURATION, btc: s.mined, climb: [53.1, 59.1], eyebrow: 'Every bitcoin ever mined', head: `${n0(s.mined)} BTC`, headAfter: minedLine, result: '',
			sub: { text: `At $${n0(Math.round(wholeAt / 100) * 100)} a coin: the whole island.`, a: 60.1, b: 63.2 } },
	];
}

export interface LongFrame {
	beat: number;
	btc: number;
	areaM2: number;
	frameM2: number;
	street: string | null;
	/** Overlay opacities, 0–1. */
	block: number;
	head: number;
	headAfter: number;
	result: number;
	sub: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
	const t = clamp01(x);
	return t * t * (3 - 2 * t);
};
/** Log-spaced between two amounts: every order of magnitude gets the same time. */
const logLerp = (a: number, b: number, u: number) =>
	u <= 0 ? a : u >= 1 ? b : Math.pow(10, Math.log10(Math.max(a, 1)) + (Math.log10(Math.max(b, 1)) - Math.log10(Math.max(a, 1))) * u);

export function longFrame(t: number, B: Beat[], price: number): LongFrame {
	const tt = Math.min(Math.max(t, 0), DURATION);
	const i = Math.max(0, B.findIndex((b) => tt >= b.t0 && tt < b.t1) === -1 ? B.length - 1 : B.findIndex((b) => tt >= b.t0 && tt < b.t1));
	const b = B[i];
	let btc = b.btc;
	if (b.id === 'one') btc = logLerp(B[0].btc, 1, smooth((tt - DRAIN[0]) / (DRAIN[1] - DRAIN[0])));
	else if (b.climb) btc = logLerp(B[i - 1].btc, b.btc, smooth((tt - b.climb[0]) / (b.climb[1] - b.climb[0])));
	const areaM2 = landM2(btc, price);
	const done = b.climb ? b.climb[1] + 0.15 : b.id === 'one' ? DRAIN[1] + 1.4 : 0;
	// The finale holds to the last frame, which is the first: no fade out.
	const out = b.id === 'mined' ? 0 : smooth((tt - (b.t1 - 0.3)) / 0.3);
	// One coin's caption waits for the drain to land at the Battery.
	const into = b.id === 'hook' ? 1 : smooth((tt - (b.id === 'one' ? DRAIN[1] - 0.25 : b.t0)) / 0.25);
	const after = b.headAfter ? smooth((tt - done) / 0.35) : 0;
	return {
		beat: i,
		btc,
		areaM2,
		// The whole island at both ends, so the last frame is the first.
		frameM2: b.id === 'hook' || (b.id === 'mined' && tt >= done) ? DEVELOPABLE_M2 : areaM2,
		street: frontierStreet(areaM2),
		block: into * (1 - out),
		head: 1 - after,
		headAfter: after,
		result: b.result ? smooth((tt - done) / 0.3) : 0,
		sub: b.sub ? Math.min(smooth((tt - b.sub.a) / 0.3), 1 - smooth((tt - b.sub.b) / 0.3)) : 0,
	};
}
