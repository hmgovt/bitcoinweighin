/**
 * "What does bitcoin buy in oil?" — the long-form vertical video, played on
 * the real oil stage by /clip/oil and captured frame by frame by
 * scripts/clips/make-oil-clip.ts.
 *
 * The story: one sat (a couple of drops) → a car's tank → 1 BTC (a yard of
 * drums) → 1,000 BTC (a third of a supertanker) → El Salvador → Strategy
 * (a slice of Prudhoe Bay) → all 21 million → back to 1 BTC: you can't put
 * crude in a car, so gasoline and diesel at the pump → 1 BTC in barrels
 * from 2013 to today → the end card.
 *
 * Pure: every value is a function of the clip time and the inputs, so every
 * capture of the same day is the same video.
 */
import { LITRES_PER_BARREL, LITRES_PER_GALLON, CAR_TANK_L, type Fuel } from '../oil.js';

export interface OilClipInputs {
	/** BTC-USD at the clip's close. */
	btcUsd: number;
	/** Brent, USD per barrel; gasoline and diesel, USD per US gallon. */
	brent: number;
	gasoline: number;
	diesel: number;
	/** El Salvador's and Strategy's bitcoin (src/lib/entity-holdings.json). */
	elSalvadorBtc: number;
	strategyBtc: number;
	/** Barrels of Brent 1 BTC bought, by date, oldest first (the history beat). */
	history: { date: string; barrels: number }[];
}

export type StopKey =
	| 'sat'
	| 'tank'
	| 'one'
	| 'thousand'
	| 'elSalvador'
	| 'strategy'
	| 'all'
	| 'noCrude'
	| 'gasoline'
	| 'diesel'
	| 'history';

interface Stop {
	key: StopKey;
	/** Arrival (end of the climb to it) and departure, seconds. */
	at: number;
	until: number;
	fuel: Fuel;
}

/** The stops, in order. Each is reached by a climb starting at the previous stop's `until`. */
export const STOPS: Stop[] = [
	{ key: 'sat', at: 4.5, until: 10, fuel: 'crude' },
	{ key: 'tank', at: 12.5, until: 19, fuel: 'crude' },
	{ key: 'one', at: 22, until: 28.5, fuel: 'crude' },
	{ key: 'thousand', at: 31, until: 37, fuel: 'crude' },
	{ key: 'elSalvador', at: 39.5, until: 45.5, fuel: 'crude' },
	{ key: 'strategy', at: 48.5, until: 55, fuel: 'crude' },
	{ key: 'all', at: 58, until: 65, fuel: 'crude' },
	{ key: 'noCrude', at: 68, until: 72.5, fuel: 'crude' },
	{ key: 'gasoline', at: 73, until: 79, fuel: 'gasoline' },
	{ key: 'diesel', at: 79.5, until: 85, fuel: 'diesel' },
	{ key: 'history', at: 86.5, until: 101, fuel: 'crude' },
];

export const BEATS = {
	/** The hook card covers the stage until here. */
	hookEnd: 4.5,
	/** The history beat walks 2013 → today over this span. */
	historyFrom: 87.5,
	historyTo: 99,
	endCard: 101,
	duration: 106,
} as const;

export interface OilClipFrame {
	/** Litres on the stage. */
	litres: number;
	/** The stop being shown or approached. */
	stop: StopKey;
	fuel: Fuel;
	/** Headline opacity for the current stop, 0–1. */
	headline: number;
	hook: number;
	footer: number;
	endCard: number;
	/** History beat: the chart's opacity and how far along 2013 → today it is drawn. */
	chart: number;
	historyProgress: number;
	/** The date the history beat has reached (empty outside it). */
	historyDate: string;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
	const t = clamp01(x);
	return t * t * (3 - 2 * t);
};

const perLitre = (fuel: Fuel, i: OilClipInputs) =>
	fuel === 'crude' ? i.brent / LITRES_PER_BARREL : (fuel === 'gasoline' ? i.gasoline : i.diesel) / LITRES_PER_GALLON;

/** BTC that fills one car tank with crude. */
export function tankBtc(i: OilClipInputs): number {
	return (CAR_TANK_L * perLitre('crude', i)) / i.btcUsd;
}

/** The BTC shown at each stop (history excluded: it follows the dates). */
export function stopBtc(key: StopKey, i: OilClipInputs): number {
	switch (key) {
		case 'sat':
			return 1e-8;
		case 'tank':
			return tankBtc(i);
		case 'thousand':
			return 1000;
		case 'elSalvador':
			return i.elSalvadorBtc;
		case 'strategy':
			return i.strategyBtc;
		case 'all':
			return 21_000_000;
		default:
			return 1;
	}
}

/** Litres a stop shows: its BTC in its fuel. */
export function stopLitres(key: StopKey, fuel: Fuel, i: OilClipInputs): number {
	return (stopBtc(key, i) * i.btcUsd) / perLitre(fuel, i);
}

/** Barrels 1 BTC bought at history progress `p` (0 = first date, 1 = last), interpolated in log space. */
export function historyAt(p: number, i: OilClipInputs): { date: string; barrels: number } {
	const h = i.history;
	if (!h.length) return { date: '', barrels: 0 };
	const x = clamp01(p) * (h.length - 1);
	const k = Math.min(h.length - 2, Math.floor(x));
	if (k < 0) return h[0];
	const u = x - k;
	const a = h[k];
	const b = h[k + 1];
	return { date: u < 0.5 ? a.date : b.date, barrels: Math.exp(Math.log(a.barrels) * (1 - u) + Math.log(b.barrels) * u) };
}

export function clipFrame(t: number, i: OilClipInputs): OilClipFrame {
	const B = BEATS;
	// Which stop: the first whose departure is still ahead.
	let n = STOPS.findIndex((s) => t < s.until);
	if (n < 0) n = STOPS.length - 1;
	const s = STOPS[n];
	const prev = n > 0 ? STOPS[n - 1] : null;

	let litres: number;
	let historyProgress = 0;
	let historyDate = '';
	if (s.key === 'history') {
		historyProgress = smooth((t - B.historyFrom) / (B.historyTo - B.historyFrom));
		const h = historyAt(historyProgress, i);
		historyDate = h.date;
		const target = h.barrels * LITRES_PER_BARREL;
		// Glide from the previous stop down to 2013's first close before the walk starts.
		const from = prev ? stopLitres(prev.key, prev.fuel, i) : target;
		const g = smooth((t - (prev?.until ?? 0)) / (s.at - (prev?.until ?? 0)));
		litres = t < s.at ? Math.exp(Math.log(from) + (Math.log(target) - Math.log(from)) * g) : target;
	} else {
		const to = stopLitres(s.key, s.fuel, i);
		if (!prev || t >= s.at) litres = to;
		else {
			// Log-spaced climb: every order of magnitude gets the same screen time.
			const from = stopLitres(prev.key, prev.fuel, i);
			const g = smooth((t - prev.until) / (s.at - prev.until));
			litres = Math.exp(Math.log(from) + (Math.log(to) - Math.log(from)) * g);
		}
	}

	const fadeIn = smooth((t - (s.at + 0.15)) / 0.4);
	const fadeOut = 1 - smooth((t - (s.until - 0.45)) / 0.4);
	const inHistory = s.key === 'history';
	return {
		litres,
		stop: s.key,
		fuel: s.fuel,
		headline: t < B.hookEnd ? 0 : Math.min(fadeIn, inHistory ? 1 - smooth((t - (B.endCard - 0.4)) / 0.4) : fadeOut),
		hook: 1 - smooth((t - (B.hookEnd - 0.5)) / 0.5),
		footer: smooth((t - B.hookEnd) / 0.5) * (1 - smooth((t - B.endCard) / 0.4)),
		endCard: smooth((t - B.endCard) / 0.5),
		chart: inHistory ? smooth((t - (s.at - 0.6)) / 0.6) * (1 - smooth((t - (B.endCard - 0.4)) / 0.4)) : 0,
		historyProgress,
		historyDate,
	};
}
