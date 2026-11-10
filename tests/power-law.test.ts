/**
 * power-law.test.ts — the TS port of the "Power Laws and Log-Periodic
 * Oscillations" notebook must reproduce the Python/numpy result.
 *
 * Golden values were produced by running the notebook's maths with numpy
 * (np.linalg.lstsq) on static/prices.json truncated at 2026-08-24 (last close 2026-08-23).
 */
import { describe, it, expect } from 'vitest';
import {
	fitOscillations,
	evaluate,
	peakBetween,
	forecastPeaks,
	perrenod,
	dacoinminster,
	daysSinceGenesis,
	type PricePoint,
} from '../src/lib/power-law.js';
import prices from '../static/prices.json';

const CUTOFF = '2026-08-24';
const all = prices as unknown as Record<string, { btc: number }>;
const series: PricePoint[] = Object.keys(all)
	.filter((d) => d <= CUTOFF)
	.sort()
	.map((d) => ({ t: Date.parse(`${d}T00:00:00Z`), btc: all[d].btc }));

describe('power-law baselines', () => {
	it('counts whole days from the genesis block', () => {
		expect(daysSinceGenesis(Date.UTC(2009, 0, 3))).toBe(0);
		expect(daysSinceGenesis(Date.UTC(2010, 0, 3))).toBe(365);
	});

	it('evaluates both power laws', () => {
		const t = Date.UTC(2025, 0, 1);
		const days = daysSinceGenesis(t);
		expect(dacoinminster(t)).toBeCloseTo(4.42e-17 * days ** 5.6, 6);
		expect(perrenod(t)).toBeCloseTo(0.00688 * (days / 365.2425) ** 5.848, 6);
	});
});

describe('fitOscillations', () => {
	it('matches numpy lstsq on the same data', () => {
		const fit = fitOscillations(series);
		const golden = [
			0.09515748073348505, -0.12279253137571232, 0.2410719393400273, -0.23977457006237907,
			0.11666543808453385,
		];
		fit.coefficients.forEach((c, i) => expect(c).toBeCloseTo(golden[i], 9));
		expect(new Date(fit.fitStart).toISOString().slice(0, 10)).toBe('2021-08-23');
	});

	it('recovers known coefficients from a synthetic series', () => {
		const truth = [0.05, 0.1, -0.2, 0.15, 0.03];
		const synth: PricePoint[] = [];
		for (let t = Date.UTC(2019, 0, 1); t <= Date.UTC(2026, 0, 1); t += 86_400_000) {
			synth.push({ t, btc: evaluate(t, truth).combined });
		}
		const fit = fitOscillations(synth);
		fit.coefficients.forEach((c, i) => expect(c).toBeCloseTo(truth[i], 9));
	});
});

describe('peaks', () => {
	const { coefficients, fitEnd } = fitOscillations(series);

	it("reproduces the notebook's 2029–2030 combined peak", () => {
		const pk = peakBetween(Date.UTC(2029, 0, 1), Date.UTC(2030, 11, 31), coefficients);
		expect(new Date(pk.t).toISOString().slice(0, 10)).toBe('2030-08-16');
		expect(pk.price).toBeCloseTo(1316641.8067723392, 2);
	});

	it('finds local maxima beyond 2030 when the horizon is extended', () => {
		const peaks = forecastPeaks(fitEnd, Date.UTC(2060, 11, 31), coefficients);
		expect(peaks.length).toBeGreaterThan(1);
		expect(peaks.some((p) => new Date(p.t).toISOString().startsWith('2030-08-16'))).toBe(true);
		expect(peaks.some((p) => p.t > Date.UTC(2031, 0, 1))).toBe(true);
		for (let i = 1; i < peaks.length; i++) expect(peaks[i].t).toBeGreaterThan(peaks[i - 1].t);
	});
});
