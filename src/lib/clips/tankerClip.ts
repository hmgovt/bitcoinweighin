/**
 * "How many bitcoin fill a supertanker?" — the one-question Short. Built
 * from YouTube's read of the long oil Short (viewers left at 11 s, just
 * before its first tanker): the tanker and the question are on screen from
 * frame 0, something changes every 3 s or so, and it ends on the same empty
 * tanker and the same question, so a replay is seamless.
 *
 *   0.0  an empty VLCC, "HOW MANY BITCOIN FILL A SUPERTANKER?" — guess
 *   0.9  the hold fills, a BTC counter racing up with it
 *   7.4  the answer lands
 *  10.6  the twist: El Salvador's bitcoin, more tankers filling
 *  14.4  drained: the empty tanker, the question again (the loop)
 *
 * Rendered by /clip/tanker and captured by scripts/clips/make-oil-clip.ts
 * --clip=tanker. Pure: every value is a function of the clip time.
 */
import { LITRES_PER_BARREL, VLCC_L } from '../oil.js';

export interface TankerClipInputs {
	btcUsd: number;
	/** Brent, USD per barrel. */
	brent: number;
	elSalvadorBtc: number;
}

export const TANKER_BEATS = {
	fillFrom: 0.9,
	fillTo: 7.2,
	answer: 7.4,
	twistFrom: 10.6,
	twistTo: 12.6,
	twistUntil: 14.2,
	loop: 14.4,
	duration: 18,
} as const;

export interface TankerFrame {
	litres: number;
	btc: number;
	/** Overlay opacities, 0–1. */
	question: number;
	counter: number;
	answer: number;
	twist: number;
	/** The site's address under the closing question. */
	url: number;
	/** Caption pop (1 = settled). */
	pop: number;
	/** A white flash on the answer, 0–1. */
	flash: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
	const t = clamp01(x);
	return t * t * (3 - 2 * t);
};
const fadeIn = (t: number, a: number, d = 0.15) => smooth((t - a) / d);
const fadeOut = (t: number, b: number, d = 0.15) => 1 - smooth((t - b) / d);

/** Bitcoin that buys one VLCC's 2 million barrels of Brent. */
export const tankerBtc = (i: TankerClipInputs) => (VLCC_L / LITRES_PER_BARREL) * (i.brent / i.btcUsd);
/** Litres of Brent that `btc` buys. */
export const litresOf = (btc: number, i: TankerClipInputs) => ((btc * i.btcUsd) / i.brent) * LITRES_PER_BARREL;

export function tankerFrame(t: number, i: TankerClipInputs): TankerFrame {
	const B = TANKER_BEATS;
	const one = tankerBtc(i);
	let btc: number;
	if (t < B.fillFrom || t >= B.loop) btc = 0;
	else if (t < B.twistFrom) {
		// Fast at first, slowing into the brim: the last few percent tease the answer.
		const u = clamp01((t - B.fillFrom) / (B.fillTo - B.fillFrom));
		btc = one * (1 - Math.pow(1 - u, 2.2));
	} else btc = one + (i.elSalvadorBtc - one) * smooth((t - B.twistFrom) / (B.twistTo - B.twistFrom));
	const arrived = t < B.twistFrom ? B.answer : B.twistTo;
	const pop = t < B.answer ? 1 : 1 + 0.22 * (1 - smooth((t - arrived) / 0.22));
	return {
		litres: litresOf(btc, i),
		btc,
		question: t < B.loop ? fadeOut(t, B.answer - 0.1, 0.1) : fadeIn(t, B.loop, 0.1),
		counter: Math.min(fadeIn(t, B.fillFrom + 0.6, 0.2), fadeOut(t, B.answer - 0.1, 0.1)),
		answer: Math.min(fadeIn(t, B.answer, 0.08), fadeOut(t, B.twistFrom - 0.1, 0.1)),
		twist: Math.min(fadeIn(t, B.twistFrom, 0.1), fadeOut(t, B.twistUntil, 0.15)),
		// Gone again by the last frame, so it matches frame 0.
		url: Math.min(fadeIn(t, B.loop + 0.8, 0.3), fadeOut(t, B.duration - 0.4, 0.3)),
		pop,
		flash: t >= B.answer ? 0.5 * (1 - smooth((t - B.answer) / 0.25)) : 0,
	};
}
