import { describe, it, expect } from 'vitest';
import {
	selectTier,
	countedLayout,
	productionLayout,
	gridDims,
	formatCount,
	CAP_LINES,
	CAP_BAGS,
	CAP_BRICKS,
	CAP_PALLETS,
	GRAMS_PER_PALLET,
	GLOBAL_ANNUAL_GRAMS,
	PARTIAL_MIN_FRACTION,
} from '../src/lib/components/CocaineBrickStack.helpers.js';

describe('selectTier', () => {
	it('returns null for non-positive mass', () => {
		expect(selectTier(0)).toBeNull();
		expect(selectTier(-5)).toBeNull();
	});

	it('lines below 1 g', () => {
		expect(selectTier(0.03)).toBe('lines');
		expect(selectTier(0.999)).toBe('lines');
	});

	it('bags from 1 g to <1 kg', () => {
		expect(selectTier(1)).toBe('bags');
		expect(selectTier(500)).toBe('bags');
		expect(selectTier(999.999)).toBe('bags');
	});

	it('bricks from 1 kg to <1 t', () => {
		expect(selectTier(1000)).toBe('bricks');
		expect(selectTier(500_000)).toBe('bricks');
		expect(selectTier(999_999)).toBe('bricks');
	});

	it('pallets from 1 t to <100 t', () => {
		expect(selectTier(1_000_000)).toBe('pallets');
		expect(selectTier(50_000_000)).toBe('pallets');
		expect(selectTier(99_999_999)).toBe('pallets');
	});

	it('production at and above 100 t', () => {
		expect(selectTier(100_000_000)).toBe('production');
		expect(selectTier(5_000_000_000)).toBe('production');
	});
});

describe('countedLayout — lines', () => {
	it('exactly 1 line at 30 mg', () => {
		const l = countedLayout(0.03)!;
		expect(l.tier).toBe('lines');
		expect(l.fullCount).toBe(1);
		expect(l.partialFraction).toBe(0);
		expect(l.renderedUnits).toBe(1);
	});

	it('renders a partial trailing line', () => {
		// 0.045 g = 1.5 lines → 1 full + 0.5 partial
		const l = countedLayout(0.045)!;
		expect(l.fullCount).toBe(1);
		expect(l.partialFraction).toBeCloseTo(0.5, 6);
		expect(l.renderedUnits).toBe(2);
	});

	it('suppresses a trailing sliver below PARTIAL_MIN_FRACTION', () => {
		// 1.08 lines → 1 full + 0.08 partial, below the 0.15 floor → dropped.
		const l = countedLayout(0.03 * 1.08)!;
		expect(l.fullCount).toBe(1);
		expect(l.partialFraction).toBe(0);
		expect(l.renderedUnits).toBe(1);
		// 1.2 lines → 0.2 partial, at/above the floor → kept.
		const k = countedLayout(0.03 * 1.2)!;
		expect(k.partialFraction).toBeCloseTo(0.2, 6);
		expect(k.renderedUnits).toBe(2);
		expect(PARTIAL_MIN_FRACTION).toBe(0.15);
	});

	it('caps lines and suppresses the partial', () => {
		// 0.03 * (CAP_LINES + 5) g → well over the cap
		const l = countedLayout(0.03 * (CAP_LINES + 5))!;
		expect(l.capped).toBe(true);
		expect(l.fullCount).toBe(CAP_LINES);
		expect(l.partialFraction).toBe(0);
		expect(l.exactCount).toBeCloseTo(CAP_LINES + 5, 6);
	});
});

describe('countedLayout — bags', () => {
	it('dozens of bags with a partial', () => {
		// 30.4 g → 30 full bags + 0.4 partial
		const l = countedLayout(30.4)!;
		expect(l.tier).toBe('bags');
		expect(l.fullCount).toBe(30);
		expect(l.partialFraction).toBeCloseTo(0.4, 6);
		expect(l.renderedUnits).toBe(31);
	});

	it('caps the bag grid', () => {
		const l = countedLayout(CAP_BAGS + 100)!;
		expect(l.capped).toBe(true);
		expect(l.fullCount).toBe(CAP_BAGS);
		expect(l.renderedUnits).toBe(CAP_BAGS);
	});
});

describe('countedLayout — bricks (partial cut block)', () => {
	it('2.4 kg → 2 whole + 0.4 cut brick', () => {
		const l = countedLayout(2400)!;
		expect(l.tier).toBe('bricks');
		expect(l.fullCount).toBe(2);
		expect(l.partialFraction).toBeCloseTo(0.4, 6);
		expect(l.renderedUnits).toBe(3);
	});

	it('whole kg count has no partial', () => {
		const l = countedLayout(5000)!;
		expect(l.fullCount).toBe(5);
		expect(l.partialFraction).toBe(0);
		expect(l.renderedUnits).toBe(5);
	});

	it('~40 bricks under the cap', () => {
		const l = countedLayout(40_000)!;
		expect(l.fullCount).toBe(40);
		expect(l.capped).toBe(false);
		expect(l.renderedUnits).toBe(40);
	});

	it('caps the brick stack', () => {
		const l = countedLayout((CAP_BRICKS + 10) * 1000)!;
		expect(l.capped).toBe(true);
		expect(l.fullCount).toBe(CAP_BRICKS);
		expect(l.partialFraction).toBe(0);
	});
});

describe('countedLayout — pallets', () => {
	it('a few pallets with a partial stack', () => {
		// 3.5 t → 3 full pallets + 0.5 partial
		const l = countedLayout(3.5 * GRAMS_PER_PALLET)!;
		expect(l.tier).toBe('pallets');
		expect(l.fullCount).toBe(3);
		expect(l.partialFraction).toBeCloseTo(0.5, 6);
		expect(l.renderedUnits).toBe(4);
	});

	it('caps pallets', () => {
		const l = countedLayout((CAP_PALLETS + 5) * GRAMS_PER_PALLET)!;
		expect(l.capped).toBe(true);
		expect(l.fullCount).toBe(CAP_PALLETS);
	});

	it('returns null in the production tier', () => {
		expect(countedLayout(200_000_000)).toBeNull();
	});
});

describe('productionLayout', () => {
	it('null below the production tier', () => {
		expect(productionLayout(50_000_000)).toBeNull();
	});

	it('one year at the annual global figure', () => {
		const p = productionLayout(GLOBAL_ANNUAL_GRAMS)!;
		expect(p.tier).toBe('production');
		expect(p.years).toBeCloseTo(1, 6);
	});

	it('fractional year just above the 100 t boundary', () => {
		const p = productionLayout(100_000_000)!;
		// 100 t / 2250 t ≈ 0.0444
		expect(p.years).toBeCloseTo(0.04444, 4);
	});

	it('multiple years scale linearly', () => {
		const p = productionLayout(GLOBAL_ANNUAL_GRAMS * 5)!;
		expect(p.years).toBeCloseTo(5, 6);
	});
});

describe('gridDims', () => {
	it('zero for empty', () => {
		expect(gridDims(0, 10)).toEqual({ cols: 0, rows: 0 });
	});

	it('prefers a near-square grid under the column cap', () => {
		expect(gridDims(30, 10)).toEqual({ cols: 6, rows: 5 });
	});

	it('respects the column cap', () => {
		const g = gridDims(50, 8);
		expect(g.cols).toBe(8);
		expect(g.rows).toBe(Math.ceil(50 / 8));
	});
});

describe('formatCount', () => {
	it('groups thousands', () => {
		expect(formatCount(1234)).toBe('1,234');
		expect(formatCount(2_250_000)).toBe('2,250,000');
	});
	it('rounds fractional input', () => {
		expect(formatCount(40.6)).toBe('41');
	});
});

describe('node-count bound (perf)', () => {
	// Each rendered unit is a small handful of SVG nodes. Cap the worst-case
	// rendered-unit count across every tier and assert it stays modest.
	it('never renders more than the largest tier cap units', () => {
		const worst = Math.max(CAP_LINES, CAP_BAGS, CAP_BRICKS, CAP_PALLETS);
		for (const g of [0.5, 30, 2400, 40_000, 3.5e6, 5e9]) {
			const l = countedLayout(g);
			if (l) expect(l.renderedUnits).toBeLessThanOrEqual(worst);
		}
		expect(worst).toBeLessThanOrEqual(60);
	});
});
