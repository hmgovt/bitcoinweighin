/**
 * "What does bitcoin buy in oil?" — the vertical video for TikTok, Reels and
 * Shorts, played on the real oil stage by /clip/oil and captured frame by
 * frame by scripts/clips/make-oil-clip.ts.
 *
 * Cut for a casual viewer's first two seconds: it opens on the payoff (every
 * bitcoin there will ever be, as one oil field, lit) and smash-cuts to a
 * single sat, then climbs back up in three-second stops: a car's tank →
 * 1 BTC of drums → 1,000 BTC → El Salvador → Strategy → all 21 million →
 * "you can't put crude in a car": the pump → 1 BTC in barrels, 2013 to
 * today → back to the field, so a replay loops into the opening.
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
	| 'open'
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
	| 'history'
	| 'end';

export interface Stop {
	key: StopKey;
	/** Arrival (end of the climb to it) and departure, seconds. */
	at: number;
	until: number;
	fuel: Fuel;
	/** Reached by a hard cut, not a climb from the previous stop. */
	cut?: boolean;
}

/** The stops, in order. Each is reached by a climb starting at the previous stop's `until`, unless it cuts. */
export const STOPS: Stop[] = [
	{ key: 'open', at: 0, until: 2.1, fuel: 'crude' },
	{ key: 'sat', at: 2.1, until: 4.6, fuel: 'crude', cut: true },
	{ key: 'tank', at: 5.3, until: 8, fuel: 'crude' },
	{ key: 'one', at: 8.7, until: 11.6, fuel: 'crude' },
	{ key: 'thousand', at: 12.3, until: 15, fuel: 'crude' },
	{ key: 'elSalvador', at: 15.7, until: 18.4, fuel: 'crude' },
	{ key: 'strategy', at: 19.1, until: 22, fuel: 'crude' },
	{ key: 'all', at: 22.8, until: 26.2, fuel: 'crude' },
	{ key: 'noCrude', at: 26.2, until: 28.6, fuel: 'crude', cut: true },
	{ key: 'gasoline', at: 28.9, until: 31.6, fuel: 'gasoline' },
	{ key: 'diesel', at: 31.9, until: 34.4, fuel: 'diesel' },
	{ key: 'history', at: 34.4, until: 42.6, fuel: 'crude', cut: true },
	{ key: 'end', at: 42.6, until: 47, fuel: 'crude', cut: true },
];

export const BEATS = {
	/** The history beat walks 2013 → today over this span. */
	historyFrom: 35.2,
	historyTo: 41.2,
	duration: 47,
} as const;

export interface OilClipFrame {
	/** Litres on the stage, and the BTC they cost. */
	litres: number;
	btc: number;
	/** The stop being shown or climbed to. */
	stop: StopKey;
	fuel: Fuel;
	/** Caption opacity and pop (1 = settled; >1 = still punching in). */
	caption: number;
	pop: number;
	/** The running counter, shown while climbing between stops. */
	counter: number;
	/** History beat: the chart's opacity and how far along 2013 → today it is drawn. */
	chart: number;
	historyProgress: number;
	/** The date the history beat has reached (empty outside it). */
	historyDate: string;
	/** The call to action over the closing field. */
	cta: number;
	/** A white flash on each hard cut, 0–1. */
	flash: number;
	/** Camera push-in on the stage's framing (1 = the stage's own). */
	zoom: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
	const t = clamp01(x);
	return t * t * (3 - 2 * t);
};

export const perLitre = (fuel: Fuel, i: OilClipInputs) =>
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
		case 'open':
		case 'all':
		case 'end':
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
	if (h.length === 1) return h[0];
	const x = clamp01(p) * (h.length - 1);
	const k = Math.min(h.length - 2, Math.floor(x));
	const u = x - k;
	const a = h[k];
	const b = h[k + 1];
	return { date: u < 0.5 ? a.date : b.date, barrels: Math.exp(Math.log(a.barrels) * (1 - u) + Math.log(b.barrels) * u) };
}

export function clipFrame(t: number, i: OilClipInputs): OilClipFrame {
	const B = BEATS;
	// The current stop: the first whose departure is still ahead.
	let n = STOPS.findIndex((s) => t < s.until);
	if (n < 0) n = STOPS.length - 1;
	const s = STOPS[n];
	const prev = n > 0 ? STOPS[n - 1] : null;
	const climbing = !!prev && !s.cut && t < s.at;

	let litres: number;
	let historyProgress = 0;
	let historyDate = '';
	if (s.key === 'history') {
		historyProgress = smooth((t - B.historyFrom) / (B.historyTo - B.historyFrom));
		const h = historyAt(historyProgress, i);
		historyDate = h.date;
		litres = h.barrels * LITRES_PER_BARREL;
	} else if (climbing) {
		// Log-spaced: every order of magnitude gets the same screen time.
		const from = stopLitres(prev!.key, prev!.fuel, i);
		const to = stopLitres(s.key, s.fuel, i);
		const g = smooth((t - prev!.until) / (s.at - prev!.until));
		litres = Math.exp(Math.log(from) + (Math.log(to) - Math.log(from)) * g);
	} else litres = stopLitres(s.key, s.fuel, i);

	// Captions punch in on arrival (a 0.22 s scale-down from 1.18) and fade just before leaving.
	const since = t - s.at;
	// The opening line is on screen from frame 0: it is the thumbnail and the hook.
	const fadeIn = s.key === 'open' ? 1 : smooth(since / 0.12);
	const caption = climbing ? 0 : Math.min(fadeIn, 1 - smooth((t - (s.until - 0.18)) / 0.18));
	const lastCut = [...STOPS].reverse().find((x) => x.cut && x.at <= t);
	return {
		litres,
		btc: (litres * perLitre(s.fuel, i)) / i.btcUsd,
		stop: s.key,
		fuel: s.fuel,
		caption,
		pop: s.key === 'open' ? 1 : 1 + 0.18 * (1 - smooth(since / 0.22)),
		counter: climbing ? Math.min(smooth((t - prev!.until) / 0.1), 1 - smooth((t - (s.at - 0.08)) / 0.08)) : 0,
		chart: s.key === 'history' ? Math.min(smooth(since / 0.3), 1 - smooth((t - (s.until - 0.25)) / 0.25)) : 0,
		historyProgress,
		historyDate,
		cta: s.key === 'end' ? smooth((since - 0.3) / 0.3) : 0,
		flash: lastCut && lastCut.key !== 'end' ? 0.55 * (1 - smooth((t - lastCut.at) / 0.18)) : 0,
		// The open starts in among the pump jacks and pulls back to the whole field by 1.8 s;
		// the car stops sit a little closer than the stage frames them.
		zoom: s.key === 'open' ? Math.pow(14, 1 - smooth(t / 1.8)) : s.key === 'sat' || s.key === 'tank' ? 1.15 : 1,
	};
}
