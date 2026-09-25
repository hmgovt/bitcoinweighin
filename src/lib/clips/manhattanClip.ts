/**
 * The "cyber Manhattan" video clip: a quote card, then the whole island,
 * then a dive to what 1 BTC buys at the Battery and a pull-back as the
 * amount climbs to a holder's stack, filling real lots northward. Rendered
 * by /clip/manhattan and captured frame by frame by
 * scripts/clips/make-manhattan-clip.ts. Pure: everything here is a function
 * of the clip time, so every capture of the same inputs is the same video.
 */
import { DEVELOPABLE_M2, landM2, frontierStreet } from '../manhattan.js';

/** Beat boundaries, seconds. */
export const BEATS = {
	quoteEnd: 4.8,
	questionEnd: 7.6,
	growStart: 12,
	growEnd: 22,
	endCard: 26.5,
	duration: 30,
} as const;

export interface ClipFrame {
	/** Land shown as bought, m². */
	areaM2: number;
	/** Land the camera frames, m². */
	frameM2: number;
	btc: number;
	/** Cross street the fill has reached (null south of Wall Street). */
	street: string | null;
	/** Overlay opacities, 0–1. */
	quote: number;
	question: number;
	oneBtc: number;
	counter: number;
	result: number;
	footer: number;
	endCard: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
	const t = clamp01(x);
	return t * t * (3 - 2 * t);
};
/** 0→1 over [a, a+fade], 1 until b, 1→0 over [b, b+fade]. */
const window_ = (t: number, a: number, b: number, fade = 0.45) =>
	Math.min(smooth((t - a) / fade), 1 - smooth((t - b) / fade));

export function clipFrame(t: number, holderBtc: number, btcUsd: number): ClipFrame {
	const B = BEATS;
	let btc = 0;
	if (t >= B.questionEnd) {
		const g = smooth((t - B.growStart) / (B.growEnd - B.growStart));
		// Log-spaced: every order of magnitude gets the same screen time.
		btc = Math.pow(10, Math.log10(Math.max(holderBtc, 1)) * g);
	}
	const areaM2 = landM2(btc, btcUsd);
	return {
		areaM2,
		frameM2: t < B.questionEnd ? DEVELOPABLE_M2 : areaM2,
		btc,
		street: frontierStreet(areaM2),
		quote: 1 - smooth((t - (B.quoteEnd - 0.6)) / 0.6),
		question: window_(t, B.quoteEnd, B.questionEnd - 0.5),
		oneBtc: window_(t, B.questionEnd + 2.2, B.growStart - 0.2, 0.35),
		counter: window_(t, B.growStart - 0.2, B.endCard - 0.4, 0.35),
		result: smooth((t - (B.growEnd + 0.3)) / 0.5) * (1 - smooth((t - (B.endCard - 0.4)) / 0.45)),
		footer: smooth((t - B.quoteEnd) / 0.5),
		endCard: smooth((t - B.endCard) / 0.5),
	};
}
