import { describe, it, expect } from 'vitest';
import {
	MACHINES,
	frontierAt,
	machineKg,
	machineM3,
	fleetHistory,
	fleetAt,
	btcSupplyAt,
	cubeEdgeM,
	LIFETIME_YEARS,
	type HashPoint,
} from '../src/lib/hashweight/fleet.js';
import { syntheticHashrate } from './fixtures/hashrate-synthetic.js';

const T = (d: string) => Date.parse(d + 'T00:00:00Z');
const DAY = 86_400_000;

/** A flat hashrate from `start` for `days`, one point a day. */
function flat(start: string, days: number, eh: number): HashPoint[] {
	return Array.from({ length: days }, (_, i) => ({ ts: T(start) + i * DAY, eh }));
}

describe('machines', () => {
	it('is in shipping order, each more efficient per kilogram than the last', () => {
		for (let i = 1; i < MACHINES.length; i++) {
			expect(T(MACHINES[i].from + '-01')).toBeGreaterThan(T(MACHINES[i - 1].from + '-01'));
			expect(machineKg(MACHINES[i]) / MACHINES[i].ths).toBeLessThan(machineKg(MACHINES[i - 1]) / MACHINES[i - 1].ths);
		}
	});

	it('adds the separate power supply for the S5–S9 era only', () => {
		const s9 = MACHINES.find((m) => m.id === 's9')!;
		const s21 = MACHINES.find((m) => m.id === 's21')!;
		expect(machineKg(s9)).toBeCloseTo(6.5, 6);
		expect(machineKg(s21)).toBe(15.4);
		expect(machineM3(s21)).toBeCloseTo(0.4 * 0.195 * 0.29, 9);
	});

	it('picks the frontier by date', () => {
		expect(frontierAt(T('2014-03-01')).id).toBe('s5'); // before the list: lower bound
		expect(frontierAt(T('2016-05-31')).id).toBe('s7');
		expect(frontierAt(T('2016-06-01')).id).toBe('s9');
		expect(frontierAt(T('2023-06-01')).id).toBe('s19xp');
		expect(frontierAt(T('2026-09-01')).id).toBe('s21xp');
	});
});

describe('the cohort model', () => {
	it('builds a flat network from one cohort of the frontier machine', () => {
		const s = fleetHistory(flat('2017-01-01', 60, 10));
		const last = s[s.length - 1];
		const s9 = MACHINES.find((m) => m.id === 's9')!;
		expect(last.capacityEh).toBeCloseTo(10, 9);
		expect(Object.keys(last.mix)).toEqual(['s9']);
		expect(last.machines).toBeCloseTo(10e6 / s9.ths, 3);
		expect(last.massKg).toBeCloseTo((10e6 / s9.ths) * machineKg(s9), 0);
	});

	it('keeps machines that are switched off: a dip does not lighten the fleet', () => {
		const pts = [...flat('2021-01-01', 120, 160), ...flat('2021-05-01', 90, 80)];
		const s = fleetHistory(pts);
		const before = fleetAt(s, T('2021-04-30'))!;
		const after = s[s.length - 1];
		expect(after.eh).toBe(80);
		expect(after.capacityEh).toBeCloseTo(before.capacityEh, 9);
		expect(after.massKg).toBeCloseTo(before.massKg, 3);
	});

	it(`retires a cohort after ${LIFETIME_YEARS} years and rebuilds it on the newer frontier`, () => {
		const s = fleetHistory(flat('2016-07-01', 365 * 6, 1));
		const y4 = fleetAt(s, T('2020-07-01'))!;
		const y6 = s[s.length - 1];
		expect(Object.keys(y4.mix)).toEqual(['s9']);
		expect(Object.keys(y6.mix)).toEqual(['s19pro']);
		expect(y6.capacityEh).toBeCloseTo(1, 9);
		expect(y6.massKg).toBeLessThan(y4.massKg / 3); // same hashrate, far lighter
	});

	it('averages over 30 days, so a one-day spike barely counts', () => {
		const pts = flat('2022-01-01', 60, 200);
		pts[40] = { ...pts[40], eh: 400 };
		const s = fleetHistory(pts);
		expect(s[s.length - 1].capacityEh).toBeLessThan(210);
	});

	it('gives a plausible fleet for a realistic history', () => {
		const s = fleetHistory(syntheticHashrate());
		const now = s[s.length - 1];
		// ~5–6 million machines, ~70–110 thousand tonnes, a ~50 m cube.
		expect(now.machines / 1e6).toBeGreaterThan(4);
		expect(now.machines / 1e6).toBeLessThan(8);
		expect(now.massKg / 1e6).toBeGreaterThan(70);
		expect(now.massKg / 1e6).toBeLessThan(110);
		expect(cubeEdgeM(now.volumeM3)).toBeGreaterThan(40);
		expect(cubeEdgeM(now.volumeM3)).toBeLessThan(60);
		// 2019: an S9 network.
		const y2019 = fleetAt(s, T('2019-01-01'))!;
		expect(y2019.mix.s9 / y2019.capacityEh).toBeGreaterThan(0.9);
		// Mass never falls while capacity only grows or is replaced.
		for (let i = 1; i < s.length; i++) expect(s[i].capacityEh).toBeGreaterThanOrEqual(s[i - 1].capacityEh);
	});

	it('handles empty, unsorted and bad input', () => {
		expect(fleetHistory([])).toEqual([]);
		const s = fleetHistory([
			{ ts: T('2020-02-01'), eh: 110 },
			{ ts: T('2020-01-01'), eh: NaN },
			{ ts: T('2020-01-15'), eh: 100 },
		]);
		expect(s.map((p) => p.ts)).toEqual([T('2020-01-15'), T('2020-02-01')]);
		expect(fleetAt([], 0)).toBeNull();
	});
});

describe('bitcoin in existence', () => {
	it('hits the halving supplies exactly and interpolates between', () => {
		expect(btcSupplyAt(T('2024-04-20'))).toBe(19_687_500);
		expect(btcSupplyAt(T('2016-07-09'))).toBe(15_750_000);
		const sep2026 = btcSupplyAt(T('2026-09-24'));
		expect(sep2026).toBeGreaterThan(20_000_000);
		expect(sep2026).toBeLessThan(20_150_000);
	});
});
