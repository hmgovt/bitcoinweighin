import { describe, it, expect } from 'vitest';
import {
	framingDominant,
	framingDistance,
	cameraHeight,
	cameraTransform,
	dogStagePosition,
	dogGroundMark,
	puGlowRamp,
	METAL_BLOOM,
	DOG_TOTAL_HEIGHT_M,
	DOG_DISTANCE_MIN_M,
	DOG_DISTANCE_MAX_M,
	CAM_HEIGHT_MAX_M,
	CAM_HEIGHT_MIN_M,
	FRAMING_FLOOR_M,
} from '../src/lib/scene/maths.js';
import { getCommodity } from '../src/lib/commodities.js';

/**
 * Scene-maths regressions for the live stage. These pin the camera/staging/
 * glow behaviour signed off in `prototypes/live-scene.html` (2026-06-11). Two
 * off-piste regressions that session were BOTH staging maths (the camera
 * lifting with the cube, then the dog sliding down the clamp ray) — the dog
 * ground-hit block below is the guard against a third.
 */

const dogH = DOG_TOTAL_HEIGHT_M;

// Three viewport aspect ratios the stage runs at: tall phone, square, wide
// desktop. The staging is aspect-sensitive through the NDC unprojection.
const ASPECTS = [0.5, 1.0, 16 / 9];

describe('framing — dominant rule continuity at band crossovers', () => {
	const EPS = 1e-6;

	it('is continuous at the macro→pair crossover (edge = dogH/3)', () => {
		const e = dogH / 3;
		const below = framingDominant(e - EPS);
		const above = framingDominant(e + EPS);
		expect(framingDominant(e)).toBeCloseTo(dogH, 5);
		expect(Math.abs(above - below)).toBeLessThan(1e-4);
	});

	it('is continuous at the pair→wide crossover (edge = dogH)', () => {
		const below = framingDominant(dogH - EPS);
		const above = framingDominant(dogH + EPS);
		expect(framingDominant(dogH)).toBeCloseTo(dogH, 5);
		expect(Math.abs(above - below)).toBeLessThan(1e-4);
	});

	it('is continuous at the floor crossover (edge = floor/3)', () => {
		const e = FRAMING_FLOOR_M / 3;
		const below = framingDominant(e - EPS);
		const above = framingDominant(e + EPS);
		expect(Math.abs(above - below)).toBeLessThan(1e-4);
	});

	it('has no jumps anywhere across the full working range', () => {
		// Dense geometric sweep 50 µm → 80 m; adjacent samples must not jump
		// more than the step itself scaled — proves global continuity.
		let prev = framingDominant(5e-5);
		for (let logE = Math.log10(5e-5); logE <= Math.log10(80); logE += 0.01) {
			const d = framingDominant(10 ** logE);
			// Within a 1.023× edge step, dominant (which tracks edge or edge×3)
			// can grow at most ~3.1% — assert no discontinuous leap.
			expect(d / prev).toBeLessThan(1.1);
			expect(d).toBeGreaterThanOrEqual(FRAMING_FLOOR_M - 1e-9);
			prev = d;
		}
	});

	it('selects the right regime in each band', () => {
		expect(framingDominant(0.001)).toBeCloseTo(0.05, 5); // floored speck
		expect(framingDominant(0.1)).toBeCloseTo(0.3, 5); // macro: edge×3
		expect(framingDominant(0.4)).toBeCloseTo(dogH, 5); // pair: dogH
		expect(framingDominant(5)).toBeCloseTo(5, 5); // wide: edge
	});

	it('dolly distance grows monotonically with the dominant', () => {
		expect(framingDistance(1)).toBeGreaterThan(framingDistance(0.5));
		expect(framingDistance(10)).toBeGreaterThan(framingDistance(1));
	});
});

describe('camera height — the camY cap', () => {
	it('never exceeds 1 m and never drops below the 5 cm floor', () => {
		for (let logE = -5; logE <= 2; logE += 0.1) {
			const edge = 10 ** logE;
			const { pos, dominant } = cameraTransform(edge);
			expect(cameraHeight(dominant)).toBeLessThanOrEqual(CAM_HEIGHT_MAX_M + 1e-9);
			expect(cameraHeight(dominant)).toBeGreaterThanOrEqual(CAM_HEIGHT_MIN_M - 1e-9);
			expect(pos.y).toBeLessThanOrEqual(CAM_HEIGHT_MAX_M + 1e-9);
			expect(pos.y).toBeGreaterThanOrEqual(CAM_HEIGHT_MIN_M - 1e-9);
		}
	});

	it('caps at exactly 1 m once the cube towers (dominant ≥ ~2.4 m)', () => {
		expect(cameraHeight(10)).toBe(CAM_HEIGHT_MAX_M);
		expect(cameraHeight(58)).toBe(CAM_HEIGHT_MAX_M);
	});

	it('floors at 5 cm for sub-millimetre cubes', () => {
		expect(cameraHeight(framingDominant(1e-5))).toBe(CAM_HEIGHT_MIN_M);
	});
});

describe('dog ground-hit — distance stays within the clamp', () => {
	// 12 canonical slider positions: log-spaced BTC across the full range.
	const BTC_POSITIONS = Array.from({ length: 12 }, (_, i) =>
		10 ** (-8 + (i / 11) * (Math.log10(21_000_000) - -8))
	);

	// Per-commodity cube edge from the SCHEMA density (PuO₂ 11.46 flows from
	// commodities.ts) and the prototype's illustrative valuation — used only to
	// spread edges realistically; the maths under test never sees a price.
	const USD_PER_BTC = 100_000;
	const USD_PER_G: Record<string, number> = { gold: 110, silver: 1.1, pu238: 5000 };
	function edgeMetres(btc: number, id: string): number {
		const density = getCommodity(id)!.densityGPerCm3!;
		return Math.cbrt((btc * USD_PER_BTC) / USD_PER_G[id] / density) / 100;
	}

	it('post-clamp distance ∈ [3.5, 8.5] m for every staged position × commodity × aspect', () => {
		let stagedSeen = 0;
		for (const id of ['gold', 'silver', 'pu238']) {
			for (const btc of BTC_POSITIONS) {
				const edge = edgeMetres(btc, id);
				const { pos, aim, wFg } = cameraTransform(edge);
				for (const aspect of ASPECTS) {
					const mark = dogGroundMark(pos, aim, aspect);
					if (wFg > 0 && mark) {
						stagedSeen++;
						expect(mark.distance).toBeGreaterThanOrEqual(DOG_DISTANCE_MIN_M - 1e-6);
						expect(mark.distance).toBeLessThanOrEqual(DOG_DISTANCE_MAX_M + 1e-6);
						expect(Number.isFinite(mark.x)).toBe(true);
						expect(Number.isFinite(mark.z)).toBe(true);
					}
				}
			}
		}
		// The top BTC positions for all three commodities tower past 3.5 m —
		// guard that the assertion actually exercised the staged branch.
		expect(stagedSeen).toBeGreaterThan(0);
	});

	it('the camera cap keeps the RAW ground hit close (no degenerate slide)', () => {
		// Sweep the staged band directly. The off-piste bug had the dog sliding
		// far down the ray (the camera lifting with the cube put the hit tens of
		// metres out, or behind). With the 1 m cap the ray hits ground a few
		// metres out at every scale: a finite, positive, single-digit distance.
		// At the very threshold (edge ≈ 1.2 m) the raw can dip just below 3.5,
		// where the clamp legitimately lifts it — but it is NEVER large.
		for (let edge = 1.3; edge <= 58; edge *= 1.3) {
			const { pos, aim, wFg } = cameraTransform(edge);
			expect(wFg).toBeGreaterThan(0);
			for (const aspect of ASPECTS) {
				const mark = dogGroundMark(pos, aim, aspect);
				expect(mark).not.toBeNull();
				expect(mark!.rawDistance).toBeGreaterThan(0); // hit in front, not behind
				expect(mark!.rawDistance).toBeLessThan(10); // never a tens-of-metres slide
			}
		}
	});

	it('keeps the dog beside the cube below the foreground threshold (edge ≤ 1.2 m)', () => {
		const { pos, aim, besideX, besideZ } = cameraTransform(0.8);
		const stage = dogStagePosition(0.8, pos, aim, 1.0);
		expect(stage.wFg).toBe(0);
		expect(stage.staged).toBe(false);
		expect(stage.x).toBeCloseTo(besideX, 6);
		expect(stage.z).toBeCloseTo(besideZ, 6);
	});

	it('flags "standing nearer the camera" once wFg crosses 0.5', () => {
		const edge = 30; // deep in the wide band → wFg = 1
		const { pos, aim } = cameraTransform(edge);
		const stage = dogStagePosition(edge, pos, aim, 1.0);
		expect(stage.wFg).toBeGreaterThan(0.5);
		expect(stage.staged).toBe(true);
	});
});

describe('Pu-238 glow ramp — monotonic, bloom thresholds per commodity', () => {
	it('gT, emission, and light intensity are monotonic non-decreasing in edge', () => {
		let prev = puGlowRamp(1e-4);
		for (let logE = -4; logE <= 1.5; logE += 0.05) {
			const g = puGlowRamp(10 ** logE);
			expect(g.gT).toBeGreaterThanOrEqual(prev.gT - 1e-9);
			expect(g.emissiveIntensity).toBeGreaterThanOrEqual(prev.emissiveIntensity - 1e-9);
			expect(g.emissive.r).toBeGreaterThanOrEqual(prev.emissive.r - 1e-9);
			expect(g.emissive.g).toBeGreaterThanOrEqual(prev.emissive.g - 1e-9);
			expect(g.emissive.b).toBeGreaterThanOrEqual(prev.emissive.b - 1e-9);
			prev = g;
		}
	});

	it('clamps gT to [0, 1] at the ramp ends', () => {
		expect(puGlowRamp(0.001).gT).toBe(0); // ≤ 4 mm: deep red baseline
		expect(puGlowRamp(0.004).gT).toBe(0);
		expect(puGlowRamp(3.4).gT).toBe(1); // ≥ 3.4 m: orange-yellow ceiling
		expect(puGlowRamp(58).gT).toBe(1);
	});

	it('the Pu bloom threshold is 0.85 (glow radiates)', () => {
		expect(puGlowRamp(0.5).bloom.threshold).toBe(0.85);
		expect(puGlowRamp(58).bloom.threshold).toBe(0.85);
	});

	it('the metal bloom threshold sits ABOVE white-fur brightness (dog never haloes)', () => {
		// Regression: the Shiba was haloing in the metal scenes. The metal
		// threshold must stay above the Pu threshold AND above 1.0 (white fur).
		expect(METAL_BLOOM.threshold).toBe(1.15);
		expect(METAL_BLOOM.threshold).toBeGreaterThan(puGlowRamp(58).bloom.threshold);
		expect(METAL_BLOOM.threshold).toBeGreaterThan(1.0);
	});

	it('emissive intensity is pushed past the bloom threshold at scale', () => {
		// At full heat, emissiveIntensity (0.9 + 3.2) = 4.1 ≫ 0.85 threshold.
		expect(puGlowRamp(3.4).emissiveIntensity).toBeGreaterThan(0.85);
	});
});
