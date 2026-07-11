import { describe, it, expect } from 'vitest';
import {
	BILL_LENGTH_MM,
	BILL_WIDTH_MM,
	BILL_THICKNESS_MM,
	BILL_MASS_G,
	stackHeightMm,
	selectBillTier,
	cubicGridDims,
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

describe('selectBillTier', () => {
	it('returns null for non-positive counts', () => {
		expect(selectBillTier(0)).toBeNull();
		expect(selectBillTier(-1)).toBeNull();
	});

	it('loose below 100 notes', () => {
		expect(selectBillTier(1)).toBe('loose');
		expect(selectBillTier(99)).toBe('loose');
	});

	it('strap from 100 to 999 notes', () => {
		expect(selectBillTier(100)).toBe('strap');
		expect(selectBillTier(999)).toBe('strap');
	});

	it('bundle from 1,000 to 99,999 notes', () => {
		expect(selectBillTier(1000)).toBe('bundle');
		expect(selectBillTier(99_999)).toBe('bundle');
	});

	it('cube from 100,000 to 9,999,999 notes', () => {
		expect(selectBillTier(100_000)).toBe('cube');
		expect(selectBillTier(9_999_999)).toBe('cube');
	});

	it('pallet at 10,000,000 notes and above', () => {
		expect(selectBillTier(10_000_000)).toBe('pallet');
		expect(selectBillTier(2_310_000_000_000)).toBe('pallet');
	});
});

describe('cubicGridDims', () => {
	it('returns a zeroed grid for n <= 0', () => {
		const g = cubicGridDims(0, 1, 1, 1);
		expect(g).toEqual({ colsX: 0, colsZ: 0, layersY: 0, extentXMm: 0, extentZMm: 0, extentYMm: 0 });
	});

	it('unit cubes: perfect cube counts produce equal-side grids', () => {
		expect(cubicGridDims(8, 1, 1, 1)).toMatchObject({ colsX: 2, colsZ: 2, layersY: 2 });
		expect(cubicGridDims(27, 1, 1, 1)).toMatchObject({ colsX: 3, colsZ: 3, layersY: 3 });
		expect(cubicGridDims(1000, 1, 1, 1)).toMatchObject({ colsX: 10, colsZ: 10, layersY: 10 });
	});

	it('the grid always holds at least n items', () => {
		for (const n of [1, 5, 100, 110, 12345]) {
			const g = cubicGridDims(n, 66.294, 155.956, 109.22);
			expect(g.colsX * g.colsZ * g.layersY).toBeGreaterThanOrEqual(n);
		}
	});

	it('100 bundles (66.294 x 155.956 x 109.22 mm each) -> 7 x 3 x 5, roughly equal extents', () => {
		const g = cubicGridDims(100, 66.294, 155.956, 109.22);
		expect(g).toMatchObject({ colsX: 7, colsZ: 3, layersY: 5 });
		expect(g.colsX * g.colsZ * g.layersY).toBe(105);
		const extents = [g.extentXMm, g.extentZMm, g.extentYMm];
		const ratio = Math.max(...extents) / Math.min(...extents);
		expect(ratio).toBeLessThan(1.3); // "roughly cubic" — no side more than 30% off the others
	});

	it('110 bundles (the 1 BTC worked example) -> 8 x 3 x 5', () => {
		const g = cubicGridDims(110, 66.294, 155.956, 109.22);
		expect(g).toMatchObject({ colsX: 8, colsZ: 3, layersY: 5 });
		expect(g.colsX * g.colsZ * g.layersY).toBeGreaterThanOrEqual(110);
	});
});
