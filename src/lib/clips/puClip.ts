/**
 * "What does bitcoin buy in plutonium-238?" — the vertical video (and its
 * 16:9 cut), played on the real hero stage (LiveStage) by /clip/pu238 and
 * captured frame by frame by scripts/clips/make-oil-clip.ts --clip=pu238.
 *
 * Cold open on Voyager 1's power source (about 800 bitcoin of it, glowing
 * beside Sat), a smash cut to one sat (a speck, under the stage's
 * magnifier), then a climb in three-second stops, each landing with the
 * stage's real Drop: 1 BTC → a year of US production → Voyager again →
 * Strategy → all 21 million (so hot the render whites out, and the caption
 * says so) → the honest twist (there's no market; at the programme's full
 * cost a bitcoin buys under a gram) → back to Voyager, so a replay loops.
 *
 * Pure: every value is a function of the clip time and the inputs.
 */
import { PU238_ANNUAL_PRODUCTION_G, PU238_OXIDE_W_PER_GRAM } from '../components/Pu238FactCard.helpers.js';

export interface PuClipInputs {
	btcUsd: number;
	/** Illustrative material price, USD per gram (illustrative-prices.json). */
	usdPerGram: number;
	/** The fully loaded programme cost, USD per gram, for the twist. */
	programUsdPerGram: number;
	strategyBtc: number;
}

/**
 * Voyager 1's launch fuel, grams: three MHW-RTGs of about 4.5 kg of
 * plutonium-238 each (NASA; Wikipedia, MHW-RTG).
 */
export const VOYAGER_G = 13_500;

export type PuStopKey = 'open' | 'sat' | 'one' | 'year' | 'voyager' | 'strategy' | 'all' | 'twist' | 'end';

export interface PuStop {
	key: PuStopKey;
	at: number;
	until: number;
	/** Reached by a hard cut, not a climb. */
	cut?: boolean;
}

export const PU_STOPS: PuStop[] = [
	{ key: 'open', at: 0, until: 2.3 },
	{ key: 'sat', at: 2.3, until: 5, cut: true },
	{ key: 'one', at: 5.7, until: 8.3 },
	{ key: 'year', at: 9, until: 11.9 },
	{ key: 'voyager', at: 12.6, until: 15.6 },
	{ key: 'strategy', at: 16.3, until: 19.8 },
	{ key: 'all', at: 20.5, until: 24.6 },
	{ key: 'twist', at: 24.6, until: 28.5, cut: true },
	{ key: 'end', at: 28.5, until: 33, cut: true },
];

export const PU_DURATION = 33;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
	const t = clamp01(x);
	return t * t * (3 - 2 * t);
};

/** Grams of plutonium-238 oxide a stop shows. */
export function stopGrams(key: PuStopKey, i: PuClipInputs): number {
	const at = (btc: number, perGram = i.usdPerGram) => (btc * i.btcUsd) / perGram;
	switch (key) {
		case 'sat':
			return at(1e-8);
		case 'one':
			return at(1);
		case 'year':
			return PU238_ANNUAL_PRODUCTION_G;
		case 'voyager':
			return VOYAGER_G;
		case 'strategy':
			return at(i.strategyBtc);
		case 'twist':
			return at(1, i.programUsdPerGram);
		case 'open':
		case 'end':
			return VOYAGER_G;
		default:
			return at(21_000_000);
	}
}

/** BTC that buys `g` grams at the material price. */
export const btcFor = (g: number, i: PuClipInputs) => (g * i.usdPerGram) / i.btcUsd;

export interface PuClipFrame {
	grams: number;
	stop: PuStopKey;
	/** Hold the cube while the amount climbs; release (and drop) on arrival. */
	held: boolean;
	caption: number;
	pop: number;
	counter: number;
	cta: number;
	flash: number;
	/** Watts of decay heat at the current amount. */
	watts: number;
}

export function puFrame(t: number, i: PuClipInputs): PuClipFrame {
	let n = PU_STOPS.findIndex((s) => t < s.until);
	if (n < 0) n = PU_STOPS.length - 1;
	const s = PU_STOPS[n];
	const prev = n > 0 ? PU_STOPS[n - 1] : null;
	const climbing = !!prev && !s.cut && t < s.at;

	let grams = stopGrams(s.key, i);
	if (climbing) {
		const from = stopGrams(prev!.key, i);
		const g = smooth((t - prev!.until) / (s.at - prev!.until));
		grams = Math.exp(Math.log(from) + (Math.log(grams) - Math.log(from)) * g);
	}
	const since = t - s.at;
	const fadeIn = s.key === 'open' ? 1 : smooth(since / 0.12);
	const lastCut = [...PU_STOPS].reverse().find((x) => x.cut && x.at <= t);
	return {
		grams,
		stop: s.key,
		held: climbing,
		caption: climbing ? 0 : Math.min(fadeIn, 1 - smooth((t - (s.until - 0.18)) / 0.18)),
		pop: s.key === 'open' ? 1 : 1 + 0.18 * (1 - smooth(since / 0.22)),
		counter: climbing ? Math.min(smooth((t - prev!.until) / 0.1), 1 - smooth((t - (s.at - 0.08)) / 0.08)) : 0,
		cta: s.key === 'end' ? smooth((since - 0.3) / 0.3) : 0,
		flash: lastCut && lastCut.key !== 'end' ? 0.55 * (1 - smooth((t - lastCut.at) / 0.18)) : 0,
		watts: grams * PU238_OXIDE_W_PER_GRAM,
	};
}

/** The stops at which the cube lands (a Drop): every arrival, including cuts. */
export function dropTimes(): number[] {
	return PU_STOPS.filter((s) => s.key !== 'open').map((s) => s.at);
}
