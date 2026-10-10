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
	it('opens on the payoff: all 21 million bitcoin as oil, captioned from frame 0', () => {
		const f = clipFrame(0, I);
		expect(f.stop).toBe('open');
		expect(f.litres).toBeCloseTo(stopLitres('all', 'crude', I), 3);
		expect(f.caption).toBe(1);
		expect(f.flash).toBe(0);
	});

	it('smash-cuts to one sat by 2.1 s', () => {
		const f = clipFrame(2.15, I);
		expect(f.stop).toBe('sat');
		expect(f.btc).toBeCloseTo(1e-8, 12);
		expect(f.flash).toBeGreaterThan(0);
	});

	it('stops are in order, short, and the whole cut is under 50 s', () => {
		let last = 0;
		for (const s of STOPS) {
			expect(s.at).toBeGreaterThanOrEqual(last);
			expect(s.until).toBeGreaterThan(s.at);
			expect(s.until - s.at).toBeLessThan(8.25);
			last = s.until;
		}
		expect(BEATS.duration).toBe(STOPS[STOPS.length - 1].until);
		expect(BEATS.duration).toBeLessThan(50);
	});

	it('never holds a still frame: a climb, a caption or a chart is always moving', () => {
		for (const s of STOPS.filter((x) => !['history', 'end'].includes(x.key))) {
			expect(s.until - s.at).toBeLessThanOrEqual(3.4);
		}
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

	it('climbs monotonically from one sat to all 21 million, counter showing only mid-climb', () => {
		let prev = 0;
		const start = STOPS.find((s) => s.key === 'sat')!.at;
		const end = STOPS.find((s) => s.key === 'all')!.at;
		for (let t = start; t <= end; t += 0.02) {
			const f = clipFrame(t, I);
			expect(f.litres).toBeGreaterThanOrEqual(prev * (1 - 1e-12));
			prev = f.litres;
			if (f.counter > 0.05) expect(f.caption).toBe(0);
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

	it('ends on the field again, so a replay loops into the opening', () => {
		const z = clipFrame(BEATS.duration - 0.01, I);
		expect(z.stop).toBe('end');
		expect(z.litres).toBeCloseTo(clipFrame(0, I).litres, 6);
		expect(z.cta).toBe(1);
		expect(z.chart).toBe(0);
	});
});

describe('the oil clip camera', () => {
	it('starts in among the jacks and pulls back to the whole field before the cut', () => {
		expect(clipFrame(0, I).zoom).toBeCloseTo(14, 6);
		expect(clipFrame(1.0, I).zoom).toBeLessThan(clipFrame(0.5, I).zoom);
		expect(clipFrame(1.9, I).zoom).toBeCloseTo(1, 6);
	});
});
