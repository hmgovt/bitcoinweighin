/**
 * Shared loader for /snapshot/[year] and /snapshot index. Reads the
 * canonical prices.json at build time and derives per-year and
 * per-month summaries: BTC USD endpoints, BTC-to-gold/silver ratios,
 * highs/lows. Both routes prerender at adapter-static build time.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

interface PricesEntry {
	btc: number;
	xau?: number;
	xag?: number;
	[k: string]: number | undefined;
}

let cache:
	| {
			dates: string[];
			prices: Record<string, PricesEntry>;
	  }
	| null = null;

function loadPrices() {
	if (cache) return cache;
	const ROOT = process.cwd();
	const prices = JSON.parse(
		readFileSync(join(ROOT, 'static', 'prices.json'), 'utf-8')
	) as Record<string, PricesEntry>;
	const dates = Object.keys(prices).sort();
	cache = { dates, prices };
	return cache;
}

export interface YearMonth {
	month: string; // "YYYY-MM"
	lastDate: string;
	btcUsd: number;
	btcInGold: number | null;
	btcInSilver: number | null;
}

export interface YearSummary {
	year: number;
	firstDate: string;
	lastDate: string;
	tradingDays: number;
	btcStart: number;
	btcEnd: number;
	btcHigh: number;
	btcLow: number;
	btcChangePct: number;
	btcInGoldStart: number | null;
	btcInGoldEnd: number | null;
	btcInSilverStart: number | null;
	btcInSilverEnd: number | null;
	months: YearMonth[];
}

export function listYears(): number[] {
	const { dates } = loadPrices();
	const years = new Set<number>();
	for (const d of dates) years.add(Number(d.slice(0, 4)));
	return Array.from(years).sort((a, b) => a - b);
}

export function summarizeYear(year: number): YearSummary | null {
	const { dates, prices } = loadPrices();
	const yearStr = String(year);
	const yearDates = dates.filter((d) => d.startsWith(yearStr));
	if (!yearDates.length) return null;

	const first = yearDates[0];
	const last = yearDates[yearDates.length - 1];
	const startE = prices[first];
	const endE = prices[last];

	const btcs = yearDates.map((d) => prices[d].btc).filter((v) => Number.isFinite(v));
	const btcHigh = Math.max(...btcs);
	const btcLow = Math.min(...btcs);

	function ratio(e: PricesEntry, field: 'xau' | 'xag'): number | null {
		const denom = e[field];
		if (!denom || !e.btc) return null;
		return e.btc / denom;
	}

	// Month-end closes: last available trading day of each month in the year.
	const byMonth = new Map<string, string[]>();
	for (const d of yearDates) {
		const m = d.slice(0, 7);
		if (!byMonth.has(m)) byMonth.set(m, []);
		byMonth.get(m)!.push(d);
	}
	const months: YearMonth[] = Array.from(byMonth.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([month, dList]) => {
			const lastDate = dList[dList.length - 1];
			const e = prices[lastDate];
			return {
				month,
				lastDate,
				btcUsd: e.btc,
				btcInGold: ratio(e, 'xau'),
				btcInSilver: ratio(e, 'xag'),
			};
		});

	return {
		year,
		firstDate: first,
		lastDate: last,
		tradingDays: yearDates.length,
		btcStart: startE.btc,
		btcEnd: endE.btc,
		btcHigh,
		btcLow,
		btcChangePct: ((endE.btc - startE.btc) / startE.btc) * 100,
		btcInGoldStart: ratio(startE, 'xau'),
		btcInGoldEnd: ratio(endE, 'xau'),
		btcInSilverStart: ratio(startE, 'xag'),
		btcInSilverEnd: ratio(endE, 'xag'),
		months,
	};
}
