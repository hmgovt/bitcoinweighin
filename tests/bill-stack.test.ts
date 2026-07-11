import { describe, it, expect } from 'vitest';
import {
	BILL_LENGTH_MM,
	BILL_WIDTH_MM,
	BILL_THICKNESS_MM,
	BILL_MASS_G,
	stackHeightMm,
} from '../src/lib/billStack.js';

describe('physical constants', () => {
	it('match the Bureau of Engraving and Printing published dimensions', () => {
		expect(BILL_LENGTH_MM).toBeCloseTo(155.956, 3);
		expect(BILL_WIDTH_MM).toBeCloseTo(66.294, 3);
		expect(BILL_THICKNESS_MM).toBeCloseTo(0.10922, 5);
		expect(BILL_MASS_G).toBe(1);
	});

	it('a strap of 100 notes is ~0.43 in thick (BEP public trivia cross-check)', () => {
		const strapThicknessIn = (100 * BILL_THICKNESS_MM) / 25.4;
		expect(strapThicknessIn).toBeCloseTo(0.43, 2);
	});
});

describe('stackHeightMm', () => {
	it('returns 0 for zero or negative counts', () => {
		expect(stackHeightMm(0)).toBe(0);
		expect(stackHeightMm(-5)).toBe(0);
	});

	it('110 notes -> ~12.01 mm (the 0.001 BTC worked example)', () => {
		expect(stackHeightMm(110)).toBeCloseTo(12.0142, 3);
	});

	it('110,000 notes -> ~12,014.2 mm (the 1 BTC worked example)', () => {
		expect(stackHeightMm(110_000)).toBeCloseTo(12_014.2, 1);
	});
});
