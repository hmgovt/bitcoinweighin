import { describe, it, expect } from 'vitest';
import {
	DEVELOPABLE_M2,
	USD_PER_M2,
	LAND_VALUE_USD,
	LAND_YARDSTICKS,
	landM2,
	manhattanShare,
	nearestYardstick,
	cumulativeAreas,
	lotsFor,
	frontierStreet,
} from '../src/lib/manhattan.js';
import map from '../src/lib/manhattan-map.json';

const PRICE = 84_249; // BTC-USD in the dataset, 2026-09-24

describe('manhattan land — valuation', () => {
	it('spreads $1.74T over the drawn developable land (~32 km², about half the borough)', () => {
		expect(DEVELOPABLE_M2 / 1e6).toBeGreaterThan(30);
		expect(DEVELOPABLE_M2 / 1e6).toBeLessThan(36); // Barr et al.: ~60% of 59 km²
		expect(USD_PER_M2 * DEVELOPABLE_M2).toBeCloseTo(LAND_VALUE_USD, -3);
		expect(USD_PER_M2).toBeGreaterThan(48_000);
		expect(USD_PER_M2).toBeLessThan(58_000);
	});

	it('buys under 2 m² per bitcoin and several hundred m² for 500', () => {
		expect(landM2(1, PRICE)).toBeGreaterThan(1.4);
		expect(landM2(1, PRICE)).toBeLessThan(1.8);
		expect(landM2(500, PRICE)).toBeCloseTo(500 * landM2(1, PRICE), 6);
		expect(landM2(-1, PRICE)).toBe(0);
	});

	it('fits the whole 21M supply on the island — about all of it, whatever the area', () => {
		const share = manhattanShare(21_000_000, PRICE);
		expect(share).toBeCloseTo((21_000_000 * PRICE) / LAND_VALUE_USD, 9);
		expect(share).toBeGreaterThan(0.95);
		expect(share).toBeLessThan(1.1);
	});

	it('reads a patch against the nearest smaller yardstick', () => {
		for (let i = 1; i < LAND_YARDSTICKS.length; i++) {
			expect(LAND_YARDSTICKS[i].m2).toBeGreaterThan(LAND_YARDSTICKS[i - 1].m2);
		}
		expect(nearestYardstick(0.1)).toBeNull();
		expect(nearestYardstick(landM2(500, PRICE))!.label).toBe('a brownstone lot');
	});
});

describe('manhattan land — filling lots', () => {
	const cum = cumulativeAreas([100, 50, 200]);

	it('owns whole lots in fill order, then part of the next — exactly', () => {
		expect(lotsFor(0, cum)).toEqual({ whole: 0, fraction: 0, spare: 0 });
		expect(lotsFor(40, cum)).toEqual({ whole: 0, fraction: 0.4, spare: 0 });
		expect(lotsFor(100, cum)).toEqual({ whole: 1, fraction: 0, spare: 0 });
		expect(lotsFor(125, cum)).toEqual({ whole: 1, fraction: 0.5, spare: 0 });
		expect(lotsFor(250, cum).whole).toBe(2);
		expect(lotsFor(250, cum).fraction).toBeCloseTo(0.5, 9);
	});

	it('stops at the whole island and says what is left over', () => {
		expect(lotsFor(400, cum)).toEqual({ whole: 3, fraction: 0, spare: 50 });
	});

	it('names the cross street the frontier has reached', () => {
		const streets = [
			{ name: 'Wall Street', areaM2: 100 },
			{ name: '14th Street', areaM2: 500 },
			{ name: '42nd Street', areaM2: 900 },
		];
		expect(frontierStreet(50, streets)).toBeNull();
		expect(frontierStreet(600, streets)).toBe('14th Street');
		expect(frontierStreet(1e9, streets)).toBe('42nd Street');
	});

	it('ships a cross-street table that climbs the island in order', () => {
		expect(map.streets.length).toBeGreaterThan(150);
		for (let i = 1; i < map.streets.length; i++) {
			expect(map.streets[i].y).toBeGreaterThan(map.streets[i - 1].y);
			expect(map.streets[i].areaM2).toBeGreaterThanOrEqual(map.streets[i - 1].areaM2);
		}
		// All of the island south of 42nd Street: ~11.6 km², ~7.4M BTC at today's price.
		const s42 = map.streets.find((s) => s.name === '42nd Street')!;
		expect(s42.areaM2 / 1e6).toBeGreaterThan(10);
		expect(s42.areaM2 / 1e6).toBeLessThan(13);
		expect(map.streets[0].name).toBe('Wall Street');
		expect(map.streets.some((s) => s.name === '42nd Street')).toBe(true);
	});
});
