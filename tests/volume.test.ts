import { describe, it, expect } from 'vitest';
import {
	computeIntrinsicVolumeCm3,
	computeDisplayWidthMm,
	computeMassGrams,
	pickStage,
} from '../src/lib/volume.js';
import { CORE_COMMODITIES, OPTIONAL_COMMODITIES, getCommodity } from '../src/lib/commodities.js';
import type { Commodity, RenderStage } from '../src/lib/commodities.js';

describe('computeIntrinsicVolumeCm3', () => {
	it('computes gold volume from density', () => {
		const gold = getCommodity('gold')!;
		// 1 troy oz gold = 31.1035 g / 19.3 g/cm³ ≈ 1.611 cm³
		const vol = computeIntrinsicVolumeCm3(1, gold);
		expect(vol).toBeCloseTo(1.611, 2);
	});

	it('computes silver volume from density', () => {
		const silver = getCommodity('silver')!;
		// 1 troy oz silver = 31.1035 g / 10.49 g/cm³ ≈ 2.965 cm³
		const vol = computeIntrinsicVolumeCm3(1, silver);
		expect(vol).toBeCloseTo(2.965, 2);
	});

	it('computes copper volume from density', () => {
		const copper = getCommodity('copper')!;
		// 1 lb copper = 453.592 g / 8.96 g/cm³ ≈ 50.624 cm³
		const vol = computeIntrinsicVolumeCm3(1, copper);
		expect(vol).toBeCloseTo(50.624, 0);
	});

	it('computes oil volume from barrel conversion', () => {
		const oil = getCommodity('oil_brent')!;
		// 1 barrel = 158,987 cm³
		const vol = computeIntrinsicVolumeCm3(1, oil);
		expect(vol).toBe(158_987);
	});

	it('computes oil volume for fractional barrels', () => {
		const oil = getCommodity('oil_brent')!;
		const vol = computeIntrinsicVolumeCm3(0.5, oil);
		expect(vol).toBe(79_493.5);
	});

	it('computes natural gas volume at STP', () => {
		const natgas = getCommodity('natgas')!;
		// 1 MMBtu ≈ 28.3 m³ = 28,300,000 cm³
		const vol = computeIntrinsicVolumeCm3(1, natgas);
		expect(vol).toBe(28_300_000);
	});

	it('computes uranium fuel pellet volume from density', () => {
		const pellet = getCommodity('uranium_fuel_pellet')!;
		// 1 pellet = 7 g / 10.97 g/cm³ ≈ 0.638 cm³
		const vol = computeIntrinsicVolumeCm3(1, pellet);
		expect(vol).toBeCloseTo(0.638, 2);
	});

	it('computes coffee volume from bulk density', () => {
		const coffee = getCommodity('coffee')!;
		// 1 lb coffee = 453.592 g = 0.4536 kg
		// 0.4536 kg / 380 kg/m³ = 0.001194 m³ = 1193.7 cm³
		const vol = computeIntrinsicVolumeCm3(1, coffee);
		expect(vol).toBeCloseTo(1193.7, 0);
	});

	it('scales linearly with amount', () => {
		const gold = getCommodity('gold')!;
		const vol1 = computeIntrinsicVolumeCm3(1, gold);
		const vol10 = computeIntrinsicVolumeCm3(10, gold);
		expect(vol10).toBeCloseTo(vol1 * 10, 6);
	});

	it('handles zero amount', () => {
		const gold = getCommodity('gold')!;
		expect(computeIntrinsicVolumeCm3(0, gold)).toBe(0);
	});

	it('works for all core commodities without throwing', () => {
		for (const c of CORE_COMMODITIES) {
			expect(() => computeIntrinsicVolumeCm3(1, c)).not.toThrow();
		}
	});

	it('works for all optional commodities without throwing', () => {
		for (const c of OPTIONAL_COMMODITIES) {
			expect(() => computeIntrinsicVolumeCm3(1, c)).not.toThrow();
		}
	});
});

describe('computeMassGrams', () => {
	it('computes gold mass from unit mass', () => {
		const gold = getCommodity('gold')!;
		expect(computeMassGrams(1, gold)).toBeCloseTo(31.1035, 2);
	});

	it('computes oil mass from volume and density', () => {
		const oil = getCommodity('oil_brent')!;
		// 1 barrel = 158,987 cm³ × 0.835 g/cm³ ≈ 132,754 g
		const mass = computeMassGrams(1, oil);
		expect(mass).toBeCloseTo(132_754, -2);
	});

	it('returns null for natgas (gaseous)', () => {
		const natgas = getCommodity('natgas')!;
		// natgas has no unitMassGrams and unit is mmbtu (not barrel)
		expect(computeMassGrams(1, natgas)).toBeNull();
	});

	it('computes uranium pellet mass', () => {
		const pellet = getCommodity('uranium_fuel_pellet')!;
		// 4500 pellets × 7 g = 31,500 g
		expect(computeMassGrams(4500, pellet)).toBe(31_500);
	});
});

describe('computeDisplayWidthMm', () => {
	it('returns reference width at reference amount', () => {
		const stage: RenderStage = {
			id: 'test',
			maxValue: 100,
			spritePath: '/test.webp',
			spriteWidthPx: 1600,
			realWorldWidthMetres: 0.3,
			referenceAmount: 500,
		};
		// At reference amount, scale factor = cbrt(1) = 1
		expect(computeDisplayWidthMm(500, stage)).toBe(300);
	});

	it('scales by cube root of quantity ratio', () => {
		const stage: RenderStage = {
			id: 'test',
			maxValue: null,
			spritePath: '/test.webp',
			spriteWidthPx: 1600,
			realWorldWidthMetres: 1.0,
			referenceAmount: 1000,
		};
		// 8× the amount → cbrt(8) = 2 → double the width
		const width = computeDisplayWidthMm(8000, stage);
		expect(width).toBeCloseTo(2000, 0);
	});

	it('shrinks below reference amount', () => {
		const stage: RenderStage = {
			id: 'test',
			maxValue: 100,
			spritePath: '/test.webp',
			spriteWidthPx: 1600,
			realWorldWidthMetres: 0.3,
			referenceAmount: 500,
		};
		// 1/8 the amount → cbrt(1/8) = 0.5 → half the width
		const width = computeDisplayWidthMm(500 / 8, stage);
		expect(width).toBeCloseTo(150, 0);
	});

	it('handles very small amounts', () => {
		const stage: RenderStage = {
			id: 'test',
			maxValue: null,
			spritePath: '/test.webp',
			spriteWidthPx: 1600,
			realWorldWidthMetres: 0.1,
			referenceAmount: 100,
		};
		const width = computeDisplayWidthMm(0.001, stage);
		expect(width).toBeGreaterThan(0);
		expect(width).toBeLessThan(10);
	});
});

describe('pickStage', () => {
	it('picks first stage for small amounts', () => {
		const silver = getCommodity('silver')!;
		const stage = pickStage(1, silver);
		expect(stage.id).toBe('coin');
	});

	it('picks last stage for large amounts', () => {
		const silver = getCommodity('silver')!;
		const stage = pickStage(1_000_000, silver);
		expect(stage.id).toBe('pallet');
	});

	it('picks correct mid-range stage', () => {
		const silver = getCommodity('silver')!;
		const stage = pickStage(100, silver);
		expect(stage.id).toBe('tube');
	});

	it('picks stage at exact boundary', () => {
		const silver = getCommodity('silver')!;
		// maxValue of coin stage is 25
		const stage = pickStage(25, silver);
		expect(stage.id).toBe('coin');
	});

	it('throws for cube-mode commodity (no progression)', () => {
		const gold = getCommodity('gold')!;
		expect(() => pickStage(1, gold)).toThrow(/no render progression/);
	});
});

describe('computeCubeEdgeMm', () => {
	it('returns 0 for non-positive amount', async () => {
		const { computeCubeEdgeMm } = await import('../src/lib/volume.js');
		const gold = getCommodity('gold')!;
		expect(computeCubeEdgeMm(0, gold)).toBe(0);
		expect(computeCubeEdgeMm(-1, gold)).toBe(0);
	});

	it('computes gold cube edge from intrinsic volume (cube root)', async () => {
		const { computeCubeEdgeMm } = await import('../src/lib/volume.js');
		const gold = getCommodity('gold')!;
		// 1 oz gold ≈ 1.611 cm³ → cbrt ≈ 1.172 cm = 11.72 mm
		expect(computeCubeEdgeMm(1, gold)).toBeCloseTo(11.72, 1);
	});

	it('scales as cube root of amount', async () => {
		const { computeCubeEdgeMm } = await import('../src/lib/volume.js');
		const gold = getCommodity('gold')!;
		const e1 = computeCubeEdgeMm(1, gold);
		const e1000 = computeCubeEdgeMm(1000, gold);
		// 1000× volume → 10× edge
		expect(e1000 / e1).toBeCloseTo(10, 2);
	});
});

describe('pickClosestReference', () => {
	const refs = [
		{ id: 'a', displayName: 'A', realSizeMetres: 0.001, spritePath: '', description: '' },
		{ id: 'b', displayName: 'B', realSizeMetres: 0.1, spritePath: '', description: '' },
		{ id: 'c', displayName: 'C', realSizeMetres: 10, spritePath: '', description: '' },
		{ id: 'd', displayName: 'D', realSizeMetres: 1000, spritePath: '', description: '' },
	];

	it('picks closest on log scale', async () => {
		const { pickClosestReference } = await import('../src/lib/volume.js');
		// 1 mm cube → matches 1 mm ref (a)
		expect(pickClosestReference(1, refs).id).toBe('a');
		// 100 mm cube = 0.1 m → matches b
		expect(pickClosestReference(100, refs).id).toBe('b');
		// 5 m cube = 5000 mm → between c (10 m) and d (1000 m); log-closer to c
		expect(pickClosestReference(5000, refs).id).toBe('c');
	});

	it('returns first reference for non-positive cube edge', async () => {
		const { pickClosestReference } = await import('../src/lib/volume.js');
		expect(pickClosestReference(0, refs).id).toBe('a');
	});

	it('throws on empty library', async () => {
		const { pickClosestReference } = await import('../src/lib/volume.js');
		expect(() => pickClosestReference(10, [])).toThrow(/empty reference library/);
	});
});
