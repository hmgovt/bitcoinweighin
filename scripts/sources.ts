/**
 * Data source definitions for the Bitcoin Weigh-In pipeline.
 * Maps commodity IDs to their fetch configurations.
 */

export interface SourceConfig {
	id: string;
	type: 'stooq' | 'fred' | 'coingecko';
	symbol: string; // stooq symbol or FRED series ID
	field: string; // key name in prices.ndjson
}

export const SOURCES: SourceConfig[] = [
	// BTC (stooq)
	{ id: 'btc', type: 'stooq', symbol: 'btcusd', field: 'btc' },

	// Precious metals (stooq)
	{ id: 'gold', type: 'stooq', symbol: 'xauusd', field: 'xau' },
	{ id: 'silver', type: 'stooq', symbol: 'xagusd', field: 'xag' },
	{ id: 'platinum', type: 'stooq', symbol: 'xptusd', field: 'xpt' },

	// Industrial metals (stooq)
	{ id: 'copper', type: 'stooq', symbol: 'hg.c', field: 'hg' },

	// Agri (stooq)
	{ id: 'wheat', type: 'stooq', symbol: 'zw.c', field: 'wheat' },
	{ id: 'coffee', type: 'stooq', symbol: 'kc.c', field: 'coffee' },

	// Energy (FRED)
	{ id: 'oil_brent', type: 'fred', symbol: 'DCOILBRENTEU', field: 'brent' },
	{ id: 'natgas', type: 'fred', symbol: 'DHHNGSP', field: 'natgas' },
];

export const START_DATE = '2013-01-01';

export function formatDateCompact(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}${m}${d}`;
}

export function formatDateISO(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

export function yesterday(): Date {
	const d = new Date();
	d.setDate(d.getDate() - 1);
	d.setHours(0, 0, 0, 0);
	return d;
}

export function parseDate(s: string): Date {
	const [y, m, d] = s.split('-').map(Number);
	return new Date(y, m - 1, d);
}

/**
 * Generate all dates from start to end (inclusive), as ISO strings.
 */
export function dateRange(start: string, end: string): string[] {
	const dates: string[] = [];
	const cur = parseDate(start);
	const last = parseDate(end);
	while (cur <= last) {
		dates.push(formatDateISO(cur));
		cur.setDate(cur.getDate() + 1);
	}
	return dates;
}

/**
 * Forward-fill: for each date in the range, use the most recent known value.
 * Returns a Map<date, value> covering every date in the range.
 */
export function forwardFill(
	data: Map<string, number>,
	dates: string[]
): { filled: Map<string, number>; filledDates: string[] } {
	const filled = new Map<string, number>();
	const filledDates: string[] = [];
	let lastValue: number | undefined;

	for (const date of dates) {
		const val = data.get(date);
		if (val !== undefined) {
			lastValue = val;
			filled.set(date, val);
		} else if (lastValue !== undefined) {
			filled.set(date, lastValue);
			filledDates.push(date);
		}
		// If no value seen yet, skip (data starts later)
	}
	return { filled, filledDates };
}

/**
 * Linearly interpolate gaps of up to maxGap days.
 * Modifies the map in place.
 */
export function interpolateSmallGaps(
	data: Map<string, number>,
	dates: string[],
	maxGap: number = 3
): string[] {
	const interpolated: string[] = [];
	let i = 0;
	while (i < dates.length) {
		if (data.has(dates[i])) {
			i++;
			continue;
		}
		// Find gap extent
		const gapStart = i;
		while (i < dates.length && !data.has(dates[i])) i++;
		const gapEnd = i;
		const gapLen = gapEnd - gapStart;

		if (gapLen <= maxGap && gapStart > 0 && gapEnd < dates.length) {
			const before = data.get(dates[gapStart - 1])!;
			const after = data.get(dates[gapEnd])!;
			for (let j = 0; j < gapLen; j++) {
				const t = (j + 1) / (gapLen + 1);
				data.set(dates[gapStart + j], +(before + t * (after - before)).toFixed(6));
				interpolated.push(dates[gapStart + j]);
			}
		}
	}
	return interpolated;
}

/**
 * Calculate BTC circulating supply for a given date.
 * Based on block reward schedule: 50 BTC per block, halving every 210,000 blocks.
 * ~144 blocks per day (10-minute target).
 */
export function btcCirculatingSupply(dateStr: string): number {
	const genesis = new Date(2009, 0, 3); // 2009-01-03
	const target = parseDate(dateStr);
	const daysSinceGenesis = Math.floor(
		(target.getTime() - genesis.getTime()) / (1000 * 60 * 60 * 24)
	);
	if (daysSinceGenesis < 0) return 0;

	const blocksPerDay = 144;
	const totalBlocks = daysSinceGenesis * blocksPerDay;

	let supply = 0;
	let reward = 50;
	let blocksAccountedFor = 0;

	while (blocksAccountedFor < totalBlocks && reward >= 0.00000001) {
		const halvingBlock = Math.floor(blocksAccountedFor / 210000) * 210000 + 210000;
		const blocksInThisEra = Math.min(halvingBlock, totalBlocks) - blocksAccountedFor;
		supply += blocksInThisEra * reward;
		blocksAccountedFor += blocksInThisEra;
		reward /= 2;
	}

	return Math.round(supply);
}
