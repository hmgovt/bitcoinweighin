import { describe, it, expect } from 'vitest';
import {
	stageTier,
	countFor,
	lineHeightM,
	LINE,
	BAG,
	BRICK,
	PALLET,
	PALLET_LOAD_M,
	PALLET_FIELD_CAP,
	layoutLines,
	layoutBags,
	layoutBricks,
	layoutPallets,
	stageCamera,
	dogBeside,
	shotBounds,
	groundMark,
	DOG_REACH_M,
} from '../src/lib/cocaine-scene.js';

describe('tiers and counts', () => {
	it('maps grams to the readout tiers (production draws as pallets)', () => {
		expect(stageTier(0)).toBeNull();
		expect(stageTier(0.5)).toBe('lines');
		expect(stageTier(12)).toBe('bags');
		expect(stageTier(3_000)).toBe('bricks');
		expect(stageTier(5e6)).toBe('pallets');
		expect(stageTier(5e8)).toBe('pallets');
	});

	it('counts whole units and a drawable part-unit', () => {
		expect(countFor(2_800)).toMatchObject({ tier: 'bricks', whole: 2 });
		expect(countFor(2_800)!.part).toBeCloseTo(0.8, 9);
		// A sliver below 15% is not drawn; the readout carries it.
		expect(countFor(3_050)).toMatchObject({ whole: 3, part: 0 });
		// Always something to see.
		const one = countFor(0.001)!;
		expect(one.tier).toBe('lines');
		expect(one.whole + (one.part > 0 ? 1 : 0)).toBe(1);
	});
});

describe('the things, to scale', () => {
	it('a 30 mg line is a fraction of a millimetre tall', () => {
		const h = lineHeightM();
		expect(h * 1000).toBeGreaterThan(0.2);
		expect(h * 1000).toBeLessThan(1);
		// Height scales with mass at fixed footprint.
		expect(lineHeightM(0.06) / lineHeightM(0.03)).toBeCloseTo(2, 9);
		expect(LINE.lengthM).toBeGreaterThan(LINE.widthM * 10);
	});

	it('a 1 kg brick is a hardback book at under 1 g/cm³ as wrapped', () => {
		const cm3 = BRICK.lengthM * BRICK.widthM * BRICK.heightM * 1e6;
		expect(1000 / cm3).toBeGreaterThan(0.8);
		expect(1000 / cm3).toBeLessThan(1.3);
	});

	it('a pallet carries 1,000 bricks in 5 × 7 layers, about a metre tall', () => {
		expect(PALLET.perLayer * PALLET.layers).toBeGreaterThanOrEqual(1000);
		expect(5 * BRICK.lengthM).toBeLessThanOrEqual(PALLET.lengthM);
		expect(7 * BRICK.widthM).toBeLessThanOrEqual(PALLET.widthM);
		expect(PALLET_LOAD_M).toBeGreaterThan(1);
		expect(PALLET_LOAD_M).toBeLessThan(1.2);
	});

	it('a baggie holds a gram in a few millimetres', () => {
		const pouchCm3 = (BAG.widthM - 2 * BAG.sealM) * (BAG.lengthM * 0.6) * BAG.thickM * 0.5 * 1e6;
		expect(pouchCm3).toBeGreaterThan(1.5); // 1 g at 0.5 g/cm³ = 2 cm³
	});
});

describe('layouts', () => {
	it('lays out lines on a mirror big enough to hold them', () => {
		const { lines, mirror } = layoutLines(countFor(0.5)!); // 16.7 lines
		expect(lines).toHaveLength(17);
		expect(lines[16].fill).toBeCloseTo(0.67, 1);
		for (const l of lines) {
			expect(Math.abs(l.x) + LINE.lengthM / 2).toBeLessThan(mirror.w / 2);
			expect(Math.abs(l.z)).toBeLessThan(mirror.d / 2);
		}
	});

	it('heaps baggies: a few lie flat, hundreds make a mound', () => {
		const few = layoutBags(countFor(3)!);
		expect(few.bags).toHaveLength(3);
		const many = layoutBags(countFor(800)!);
		expect(many.bags).toHaveLength(800);
		expect(many.extent.h).toBeGreaterThan(few.extent.h * 3);
		expect(many.bags.every((b) => b.y >= 0 && Number.isFinite(b.x))).toBe(true);
		// Deterministic.
		expect(layoutBags(countFor(40)!).bags).toEqual(layoutBags(countFor(40)!).bags);
	});

	it('lays a few bricks in a row, then stacks them toward a pallet load', () => {
		const row = layoutBricks(countFor(3_000)!);
		expect(row.bricks).toHaveLength(3);
		expect(row.extent.h).toBeCloseTo(BRICK.heightM, 9);
		const stack = layoutBricks(countFor(999_000)!);
		expect(stack.bricks).toHaveLength(999);
		expect(stack.extent.h).toBeGreaterThan(1);
		expect(stack.extent.w).toBeLessThanOrEqual(PALLET.lengthM + 0.1);
	});

	it('fields pallets up to the cap, then blocks them at true count', () => {
		const field = layoutPallets(countFor(12e6)!);
		expect(field.pallets).toHaveLength(12);
		expect(field.block).toBeNull();
		const block = layoutPallets(countFor(40_000e6)!);
		expect(block.pallets).toHaveLength(0);
		expect(block.block!.count).toBe(40_000);
		const b = block.block!;
		expect(b.colsX * b.colsZ * b.layers).toBeGreaterThanOrEqual(40_000);
		expect(PALLET_FIELD_CAP).toBeGreaterThan(100);
	});
});

describe('camera and Sat', () => {
	it('looks down on flat things and flattens out for big ones', () => {
		const mirror = stageCamera({ w: 0.2, d: 0.12, h: 0.004 }, 16 / 9);
		const block = stageCamera({ w: 40, d: 40, h: 30 }, 16 / 9);
		expect(mirror.elev * (180 / Math.PI)).toBeGreaterThan(38);
		expect(block.elev * (180 / Math.PI)).toBeLessThan(15);
		expect(mirror.dist).toBeLessThan(1);
		expect(block.dist).toBeGreaterThan(40);
	});

	it('Sat stands clear of the load, and behind the mirror for lines', () => {
		const p = dogBeside({ w: 1, d: 1, h: 0.2 }, 'bricks');
		expect(p.x - DOG_REACH_M).toBeGreaterThan(0.5);
		// Beside lines he sits behind the mirror's far edge, facing it.
		const m = dogBeside({ w: 0.2, d: 0.12, h: 0.004 }, 'lines');
		expect(m.z).toBeLessThan(-0.06 - 0.15);
	});

	it('widens the shot to take Sat in, centred between them', () => {
		const ex = { w: 1, d: 1, h: 0.3 };
		const { extent, center } = shotBounds(ex, dogBeside(ex, 'bricks'));
		expect(extent.w).toBeGreaterThan(1.3);
		expect(center.x).toBeGreaterThan(0);
		expect(shotBounds(ex, null).center).toEqual({ x: 0, z: 0 });
		// A small heap keeps only Sat's paws in shot, so it stays big in frame.
		const small = { w: 0.2, d: 0.2, h: 0.02 };
		expect(shotBounds(small, dogBeside(small, 'bags')).extent.w).toBeLessThan(0.5);
	});

	it('finds the foreground mark on the floor, in front of the load and off it', () => {
		const ex = { w: 6, d: 5, h: 1.3 };
		const cam = stageCamera(ex, 16 / 9);
		const m = groundMark(cam.pos, cam.aim, 16 / 9, ex)!;
		// Nearer the camera than the load's middle…
		const toCam = Math.hypot(cam.pos.x - m.x, cam.pos.z - m.z);
		expect(toCam).toBeLessThan(Math.hypot(cam.pos.x, cam.pos.z));
		// …and not standing on it.
		expect(Math.abs(m.x) >= ex.w / 2 + DOG_REACH_M || Math.abs(m.z) >= ex.d / 2 + DOG_REACH_M).toBe(true);
		// A camera looking up never finds the floor.
		expect(groundMark({ x: 0, y: 1, z: 5 }, { x: 0, y: 3, z: 0 }, 1, ex, { x: 0, y: 0.9 })).toBeNull();
	});
});
