/**
 * The Manhattan comparison: how much of Manhattan's land a sum of bitcoin
 * buys, drawn as real tax lots filling up the island from the Battery.
 * Pure maths only; the map is built by scripts/build-manhattan.ts.
 *
 * Valuation: Barr, Smith & Kulkarni, "What's Manhattan worth? A land
 * values index from 1950 to 2014" (Regional Science and Urban Economics,
 * 2018) — all of Manhattan's developable land was worth about $1.74
 * trillion in 2014 (range $1.54–1.95T), from ~3,600 vacant-land sales.
 * That's the ground itself, without the buildings on it: the honest price
 * of an area, where an apartment's price per square foot is floor space
 * stacked many storeys up. It's a 2014 figure, stated as such; there is no
 * rigorous later total.
 *
 * The value is spread evenly over the developable land as drawn — every
 * tax lot but parks and open space, clipped to the shoreline (NYC Open
 * Data) — so the share of the island a sum buys is simply its value over
 * $1.74T, whatever the exact area.
 */
import map from './manhattan-map.json';

/** Developable land as drawn: every tax lot but parks and open space, m². */
export const DEVELOPABLE_M2 = map.developableM2;
/** All of Manhattan's developable land, 2014, USD — central estimate and range. */
export const LAND_VALUE_USD = 1.74e12;
export const LAND_VALUE_RANGE_USD = [1.54e12, 1.95e12] as const;
export const LAND_VALUE_YEAR = 2014;
/** Average value of a square metre of it, USD. */
export const USD_PER_M2 = LAND_VALUE_USD / DEVELOPABLE_M2;

/** Square metres of Manhattan land `btc` buys at `btcUsd`. */
export function landM2(btc: number, btcUsd: number): number {
	return (Math.max(0, btc) * Math.max(0, btcUsd)) / USD_PER_M2;
}

/** Share of all Manhattan's developable land, 0–∞. */
export function manhattanShare(btc: number, btcUsd: number): number {
	return landM2(btc, btcUsd) / DEVELOPABLE_M2;
}

export interface LandYardstick {
	label: string;
	m2: number;
}

/** Areas to read a patch against, ascending. */
export const LAND_YARDSTICKS: LandYardstick[] = [
	{ label: 'a doormat', m2: 0.5 },
	{ label: 'a parking space', m2: 12.5 },
	// The classic Manhattan lot: 20 × 100 ft.
	{ label: 'a brownstone lot', m2: 20 * 100 * 0.09290304 },
	// A typical Midtown block between avenues, 200 × 800 ft.
	{ label: 'a Midtown block', m2: 200 * 800 * 0.09290304 },
	{ label: 'Central Park', m2: 3.41e6 },
	{ label: "all of Manhattan's developable land", m2: DEVELOPABLE_M2 },
];

/** The largest yardstick at or below `m2`, and how many of it. */
export function nearestYardstick(m2: number): { label: string; multiple: number } | null {
	let best: LandYardstick | null = null;
	for (const y of LAND_YARDSTICKS) {
		if (y.m2 <= m2) best = y;
		else break;
	}
	return best ? { label: best.label, multiple: m2 / best.m2 } : null;
}

/** Running totals of lot areas in fill order: cum[i] = area of lots 0…i−1. */
export function cumulativeAreas(areas: ArrayLike<number>): Float64Array {
	const cum = new Float64Array(areas.length + 1);
	for (let i = 0; i < areas.length; i++) cum[i + 1] = cum[i] + areas[i];
	return cum;
}

/**
 * Which lots `m2` of land buys, in fill order: `whole` lots outright and
 * `fraction` (0–1) of the next. Exact — the owned area is always `m2`
 * (up to the whole island; `spare` is what's left over past it).
 */
export function lotsFor(m2: number, cum: Float64Array): { whole: number; fraction: number; spare: number } {
	const n = cum.length - 1;
	const a = Math.max(0, m2);
	if (a >= cum[n]) return { whole: n, fraction: 0, spare: a - cum[n] };
	let lo = 0;
	let hi = n;
	// Largest k with cum[k] <= a.
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (cum[mid] <= a) lo = mid;
		else hi = mid - 1;
	}
	const next = cum[lo + 1] - cum[lo];
	return { whole: lo, fraction: next > 0 ? (a - cum[lo]) / next : 0, spare: 0 };
}

/** The cross street a frontier `y` (m up the island, map frame) has reached. */
export function frontierStreet(y: number, streets: { name: string; y: number }[] = map.streets): string | null {
	let best: string | null = null;
	for (const s of streets) {
		if (s.y <= y) best = s.name;
		else break;
	}
	return best;
}
