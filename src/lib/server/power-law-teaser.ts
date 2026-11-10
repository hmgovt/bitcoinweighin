/**
 * Build-time summary for the homepage power-law teaser. Everything the card
 * needs (SVG path strings and a few numbers) is computed here, so the
 * homepage doesn't ship price history or model code to the browser.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	evaluate,
	firstCrossing,
	fitOscillations,
	forecastPeaks,
	type PricePoint,
} from '$lib/power-law.js';

export interface PowerLawTeaser {
	/** First day the Combined model reaches $1M, epoch ms (null if never by 2040). */
	millionAt: number | null;
	/** First forecast peak of the Combined model. */
	peak: { t: number; price: number } | null;
	latest: { t: number; btc: number };
	chart: {
		w: number;
		h: number;
		actual: string;
		trend: string;
		forecast: string;
		millionY: number;
		dot: { x: number; y: number } | null;
		todayX: number;
		years: { x: number; label: string }[];
	};
}

const W = 320;
const H = 180;
const PAD = { l: 4, r: 4, t: 10, b: 18 };
const LOG_MIN = 1; // $10
const LOG_MAX = 7; // $10M

export function buildPowerLawTeaser(): PowerLawTeaser {
	const prices = JSON.parse(
		readFileSync(join(process.cwd(), 'static', 'prices.json'), 'utf-8')
	) as Record<string, { btc: number }>;
	const series: PricePoint[] = Object.keys(prices)
		.sort()
		.map((d) => ({ t: Date.parse(`${d}T00:00:00Z`), btc: prices[d].btc }))
		.filter((p) => p.btc > 0);
	const { coefficients, fitEnd } = fitOscillations(series);
	const latest = series[series.length - 1];

	const t0 = Date.UTC(2013, 0, 1);
	const t1 = Date.UTC(2032, 11, 31);
	const x = (t: number) => PAD.l + ((t - t0) / (t1 - t0)) * (W - PAD.l - PAD.r);
	const y = (v: number) => {
		const f = (Math.log10(v) - LOG_MIN) / (LOG_MAX - LOG_MIN);
		return PAD.t + (1 - Math.max(0, Math.min(1, f))) * (H - PAD.t - PAD.b);
	};
	const path = (pts: [number, number][]) =>
		pts.map(([t, v], i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join('');

	// ~monthly samples keep the inlined SVG to a couple of KB.
	const STEP = 30 * 86_400_000;
	const actual: [number, number][] = [];
	for (let i = 0; i < series.length; i += 30) actual.push([series[i].t, series[i].btc]);
	actual.push([latest.t, latest.btc]);

	const trend: [number, number][] = [];
	for (let t = t0; t <= t1; t += STEP) trend.push([t, evaluate(t, coefficients).perrenod]);

	const forecast: [number, number][] = [];
	for (let t = fitEnd; t <= t1; t += STEP) forecast.push([t, evaluate(t, coefficients).combined]);
	forecast.push([t1, evaluate(t1, coefficients).combined]);

	const millionAt = firstCrossing(fitEnd, Date.UTC(2040, 0, 1), 1e6, coefficients);
	const peaks = forecastPeaks(fitEnd, t1, coefficients);

	const years = [2015, 2020, 2025, 2030].map((yr) => ({
		x: x(Date.UTC(yr, 0, 1)),
		label: String(yr),
	}));

	return {
		millionAt,
		peak: peaks[0] ?? null,
		latest: { t: latest.t, btc: latest.btc },
		chart: {
			w: W,
			h: H,
			actual: path(actual),
			trend: path(trend),
			forecast: path(forecast),
			millionY: y(1e6),
			dot: millionAt && millionAt <= t1 ? { x: x(millionAt), y: y(1e6) } : null,
			todayX: x(latest.t),
			years,
		},
	};
}
