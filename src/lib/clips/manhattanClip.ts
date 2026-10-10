/**
 * The "cyber Manhattan" video, cut for the feed: it opens on the payoff
 * (the whole island, a holder's land already lit) with Saylor's phrase on
 * screen from frame 0, dives to what 1 BTC buys at the Battery, climbs lot
 * by lot to the holder's stack, then to all 21 million, and ends over the
 * island again so a replay loops into the opening. Rendered by
 * /clip/manhattan and captured frame by frame by
 * scripts/clips/make-manhattan-clip.ts. Pure: everything here is a function
 * of the clip time, so every capture of the same inputs is the same video.
 */
import { DEVELOPABLE_M2, landM2, frontierStreet } from '../manhattan.js';

/** Beat boundaries, seconds. */
export const BEATS = {
	/** The open: the island, the holder's land lit, the quote. */
	openEnd: 2.4,
	/** 1 BTC at the Battery (the camera dives in from the open). */
	oneBtc: 3.3,
	growStart: 6,
	growEnd: 12.6,
	/** The holder's result. */
	resultEnd: 16.6,
	/** The climb to all 21 million, and its result. */
	allStart: 17.2,
	allEnd: 18.4,
	endCard: 22.4,
	duration: 26,
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
	open: number;
	oneBtc: number;
	counter: number;
	result: number;
	all: number;
	endCard: number;
	/** Caption pop (1 = settled) for whichever caption just arrived. */
	pop: number;
}

const ALL_BTC = 21_000_000;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
	const t = clamp01(x);
	return t * t * (3 - 2 * t);
};
/** 0→1 over [a, a+fade], 1 until b, 1→0 over [b, b+fade]. */
const window_ = (t: number, a: number, b: number, fade = 0.15) =>
	Math.min(smooth((t - a) / fade), 1 - smooth((t - b) / fade));
const logLerp = (a: number, b: number, g: number) => Math.pow(10, Math.log10(a) + (Math.log10(b) - Math.log10(a)) * g);

export function clipFrame(t: number, holderBtc: number, btcUsd: number): ClipFrame {
	const B = BEATS;
	let btc: number;
	if (t < B.openEnd) btc = holderBtc;
	else if (t < B.growStart) btc = 1;
	else if (t < B.allStart) btc = logLerp(1, Math.max(holderBtc, 1), smooth((t - B.growStart) / (B.growEnd - B.growStart)));
	else btc = logLerp(Math.max(holderBtc, 1), ALL_BTC, smooth((t - B.allStart) / (B.allEnd - B.allStart)));
	const areaM2 = landM2(btc, btcUsd);
	// The open and the close frame the whole island; otherwise the camera follows the land.
	const frameM2 = t < B.openEnd || t >= B.endCard ? DEVELOPABLE_M2 : areaM2;
	const arrived = t < B.openEnd ? 0 : t < B.growStart ? B.oneBtc : t < B.allStart ? B.growEnd : B.allEnd;
	return {
		areaM2,
		frameM2,
		btc,
		street: frontierStreet(areaM2),
		open: t < B.openEnd - 0.15 ? 1 : 1 - smooth((t - (B.openEnd - 0.15)) / 0.15),
		oneBtc: window_(t, B.oneBtc, B.growStart - 0.2),
		counter: window_(t, B.growStart, B.growEnd - 0.1, 0.1) + window_(t, B.allStart, B.allEnd - 0.1, 0.1),
		result: window_(t, B.growEnd, B.resultEnd),
		all: window_(t, B.allEnd, B.endCard - 0.2),
		endCard: smooth((t - B.endCard) / 0.3),
		pop: t < B.openEnd ? 1 : 1 + 0.18 * (1 - smooth((t - arrived) / 0.22)),
	};
}
