import { describe, it, expect } from 'vitest';
import { BEATS, STOPS, clipFrame, historyAt, stopLitres, tankBtc, type OilClipInputs } from '../src/lib/clips/oilClip.js';
import { CAR_TANK_L, LITRES_PER_BARREL, LITRES_PER_GALLON } from '../src/lib/oil.js';

// The 8 Oct 2026 close.
const I: OilClipInputs = {
	btcUsd: 81_848.89,
	brent: 125.44,
	gasoline: 4.354,
	diesel: 6.199,
	elSalvadorBtc: 7799,
	strategyBtc: 848_000,
	history: [
		{ date: '2013-01-02', barrels: 0.1175 },
		{ date: '2025-10-06', barrels: 1865.7 },
		{ date: '2026-10-08', barrels: 652.49 },
	],
};

describe('the oil clip timeline', () => {
	it('stops are in order and each is held', () => {
		let last = 0;
		for (const s of STOPS) {
			expect(s.at).toBeGreaterThanOrEqual(last);
			expect(s.until).toBeGreaterThan(s.at);
			last = s.until;
		}
		expect(BEATS.endCard).toBeGreaterThanOrEqual(STOPS[STOPS.length - 1].at);
		expect(BEATS.duration).toBeGreaterThan(BEATS.endCard);
	});

	it('holds each stop at its exact amount', () => {
		for (const s of STOPS.filter((x) => x.key !== 'history')) {
			const f = clipFrame((s.at + s.until) / 2, I);
			expect(f.stop).toBe(s.key);
			expect(f.litres).toBeCloseTo(stopLitres(s.key, s.fuel, I), 6);
		}
	});

	it('shows 1 BTC as 652 barrels of crude, and as gallons at the pump', () => {
		expect(stopLitres('one', 'crude', I) / LITRES_PER_BARREL).toBeCloseTo(652.49, 1);
		expect(stopLitres('gasoline', 'gasoline', I) / LITRES_PER_GALLON).toBeCloseTo(18_798.6, 0);
		expect(stopLitres('diesel', 'diesel', I) / LITRES_PER_GALLON).toBeCloseTo(13_203.6, 0);
	});

	it('fills exactly one car tank at the tank stop', () => {
		expect(stopLitres('tank', 'crude', I)).toBeCloseTo(CAR_TANK_L, 9);
		expect(tankBtc(I) * 1e8).toBeCloseTo(53_016, -1);
	});

	it('climbs monotonically from one sat to all 21 million', () => {
		let prev = 0;
		const end = STOPS.find((s) => s.key === 'all')!.at;
		for (let t = BEATS.hookEnd; t <= end; t += 0.05) {
			const f = clipFrame(t, I);
			expect(f.litres).toBeGreaterThanOrEqual(prev * (1 - 1e-12));
			prev = f.litres;
		}
	});

	it('walks 1 BTC’s barrels from 2013 to the last close', () => {
		const start = clipFrame(BEATS.historyFrom, I);
		expect(start.litres / LITRES_PER_BARREL).toBeCloseTo(0.1175, 4);
		expect(start.historyDate).toBe('2013-01-02');
		const end = clipFrame(BEATS.historyTo + 0.5, I);
		expect(end.litres / LITRES_PER_BARREL).toBeCloseTo(652.49, 2);
		expect(end.historyDate).toBe('2026-10-08');
		expect(end.chart).toBe(1);
		expect(historyAt(0.5, I).barrels).toBeCloseTo(1865.7, 1);
	});

	it('opens on the hook card and closes on the end card, nothing else on top', () => {
		const a = clipFrame(1, I);
		expect(a.hook).toBe(1);
		expect(a.headline).toBe(0);
		const z = clipFrame(BEATS.duration - 0.5, I);
		expect(z.endCard).toBe(1);
		expect(z.headline).toBe(0);
		expect(z.chart).toBe(0);
	});
});
