/**
 * /power-law — BTC/USD against two power laws and a fitted pair of
 * log-periodic oscillations. The fit runs here at build time on the full
 * daily series (so it refreshes with every daily deploy); the page then
 * evaluates the curves client-side out to whatever horizon the reader picks.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PageServerLoad } from './$types';
import { fitOscillations, peakBetween, type PricePoint } from '$lib/power-law.js';

export const prerender = true;

export const load: PageServerLoad = async () => {
	const prices = JSON.parse(
		readFileSync(join(process.cwd(), 'static', 'prices.json'), 'utf-8')
	) as Record<string, { btc: number }>;

	const series: PricePoint[] = Object.keys(prices)
		.sort()
		.map((d) => ({ t: Date.parse(`${d}T00:00:00Z`), btc: prices[d].btc }))
		.filter((p) => p.btc > 0);

	const fit = fitOscillations(series);

	// Weekly is plenty for a chart this wide; always keep the latest close.
	const actual: [number, number][] = [];
	for (let i = 0; i < series.length; i += 7) actual.push([series[i].t, series[i].btc]);
	const last = series[series.length - 1];
	if (actual[actual.length - 1][0] !== last.t) actual.push([last.t, last.btc]);

	// The notebook's headline number: Combined-model peak inside 2029–2030.
	const notebookPeak = peakBetween(
		Date.UTC(2029, 0, 1),
		Date.UTC(2030, 11, 31),
		fit.coefficients
	);

	return {
		actual,
		coefficients: fit.coefficients,
		fitStart: fit.fitStart,
		fitEnd: fit.fitEnd,
		latest: { t: last.t, btc: last.btc },
		notebookPeak,
	};
};
