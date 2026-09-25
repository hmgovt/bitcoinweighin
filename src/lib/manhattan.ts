/**
 * The Manhattan comparison: how much of Manhattan's land a sum of bitcoin
 * buys. Pure maths only.
 *
 * Valuation: Barr, Smith & Kulkarni, "What's Manhattan worth? A land
 * values index from 1950 to 2014" (Regional Science and Urban Economics,
 * 2018) — all of Manhattan's developable land was worth about $1.74
 * trillion in 2014 (range $1.54–1.95T), from ~3,600 vacant-land sales.
 * "Developable" excludes parks, streets, highways, bridges and tunnels:
 * about 60% of the island's 22.8 sq mi of land. That's the ground itself,
 * without the buildings on it — the honest price of an area, where an
 * apartment's price per square foot is floor space stacked many storeys up.
 * It's a 2014 figure, stated as such; there is no rigorous later total.
 */

/** Manhattan's land area (US Census, 22.8 sq mi), m². */
export const MANHATTAN_LAND_M2 = 59.13e6;
/** Share of it that's developable (Barr et al.). */
export const DEVELOPABLE_SHARE = 0.6;
export const DEVELOPABLE_M2 = MANHATTAN_LAND_M2 * DEVELOPABLE_SHARE;
/** All of Manhattan's developable land, 2014, USD — central estimate and range. */
export const LAND_VALUE_USD = 1.74e12;
export const LAND_VALUE_RANGE_USD = [1.54e12, 1.95e12] as const;
export const LAND_VALUE_YEAR = 2014;
/** Average value of a square metre of developable Manhattan land, USD. */
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
