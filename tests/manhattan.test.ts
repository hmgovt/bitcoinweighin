import { describe, it, expect } from 'vitest';
import {
	DEVELOPABLE_M2,
	USD_PER_M2,
	LAND_YARDSTICKS,
	landM2,
	manhattanShare,
	nearestYardstick,
} from '../src/lib/manhattan.js';

const PRICE = 84_249; // BTC-USD in the dataset, 2026-09-24

describe('manhattan land', () => {
	it('prices developable land at ~$49,000/m² (~$4,560/sq ft)', () => {
		expect(DEVELOPABLE_M2 / 1e6).toBeCloseTo(35.48, 2);
		expect(USD_PER_M2).toBeGreaterThan(48_500);
		expect(USD_PER_M2).toBeLessThan(49_500);
		expect(USD_PER_M2 * 0.09290304).toBeCloseTo(4_556, -1);
	});

	it('buys under 2 m² per bitcoin and ~860 m² for 500', () => {
		expect(landM2(1, PRICE)).toBeCloseTo(1.72, 2);
		expect(landM2(500, PRICE)).toBeCloseTo(859, 0);
		expect(landM2(-1, PRICE)).toBe(0);
	});

	it('fits the whole 21M supply on the island — about all of it', () => {
		const share = manhattanShare(21_000_000, PRICE);
		expect(share).toBeGreaterThan(0.95);
		expect(share).toBeLessThan(1.1);
	});

	it('reads a patch against the nearest smaller yardstick', () => {
		for (let i = 1; i < LAND_YARDSTICKS.length; i++) {
			expect(LAND_YARDSTICKS[i].m2).toBeGreaterThan(LAND_YARDSTICKS[i - 1].m2);
		}
		expect(nearestYardstick(0.1)).toBeNull();
		expect(nearestYardstick(landM2(500, PRICE))!.label).toBe('a brownstone lot');
		expect(nearestYardstick(landM2(500, PRICE))!.multiple).toBeCloseTo(4.62, 1);
	});
});
