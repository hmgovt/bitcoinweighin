import { describe, it, expect } from 'vitest';
import {
	framingDominant,
	framingDistance,
	cameraHeight,
	cameraTransform,
	besidePlacement,
	clearBesidePlacement,
	dogFullyClear,
	dogStagePosition,
	dogGroundMark,
	puGlowRamp,
	METAL_BLOOM,
	DOG_TOTAL_HEIGHT_M,
	DOG_NOSE_REACH_M,
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
		const { pos, aim } = cameraTransform(0.8);
		const stage = dogStagePosition(0.8, pos, aim, 1.0);
		expect(stage.wFg).toBe(0);
		expect(stage.staged).toBe(false);
		// Position is the OCCLUSION-SAFE beside placement, not the raw
		// besidePlacement — at edge = 0.8 m (inside the reported failing band,
		// see the "occlusion" describe block below) the raw x/z is occluded, so
		// clearBesidePlacement necessarily differs from it.
		const clear = clearBesidePlacement(0.8, pos);
		expect(stage.x).toBeCloseTo(clear.x, 6);
		expect(stage.z).toBeCloseTo(clear.z, 6);
		expect(dogFullyClear(pos, stage.x, stage.z, 0.8)).toBe(true);
	});

	it('flags "standing nearer the camera" once wFg crosses 0.5', () => {
		const edge = 30; // deep in the wide band → wFg = 1
		const { pos, aim } = cameraTransform(edge);
		const stage = dogStagePosition(edge, pos, aim, 1.0);
		expect(stage.wFg).toBeGreaterThan(0.5);
		expect(stage.staged).toBe(true);
	});
});

/**
 * Occlusion — the whole dog (nose included) must never be hidden behind the
 * cube. Regression suite for the bug reported at 7,706 BTC of gold (≈ 0.6 m
 * cube edge): the RAW `besidePlacement` puts the dog's origin at
 * `besideZ = edge * 0.45`, slightly BEHIND the cube's front-face plane
 * (z = edge / 2). `LiveStage` then rotates the dog to face the cube, so its
 * head leans toward the origin's -x/-z quadrant — straight into the cube's
 * occlusion wedge as seen from the front-left camera (`AZIMUTH_RAD`). The
 * fix (`clearBesidePlacement` / `clearPointPlacement` in maths.ts) pushes the
 * dog — Z first (root cause: stop sitting behind the front face), then a
 * bounded sideways (+x) bisection — until the WHOLE dog (origin plus its
 * `DOG_NOSE_REACH_M` nose reach along the actual facing ray, at three
 * heights) clears an exact segment-vs-cube-AABB test (`dogFullyClear`), for
 * the camera actually used at that edge.
 */
describe('occlusion — the whole dog must clear the cube (nose reach along facing)', () => {
	const COMMODITY_IDS = ['gold', 'silver', 'pu238'];

	// 24 log-spaced cube edges spanning 1 mm to 60 m — the full range the
	// slider can produce. `dogFullyClear`/`dogStagePosition` take `edge`
	// directly and are commodity-agnostic (density only enters upstream, in
	// `cubeEdgeMetres`); commodities are still looped, and their real
	// `densityGPerCm3` fetched from the schema, so this sweep matches the
	// file's established per-commodity convention and guards against any
	// future coupling between commodity and staging.
	const EDGE_SWEEP = Array.from({ length: 24 }, (_, i) => {
		const t = i / 23;
		return 10 ** (Math.log10(0.001) + t * (Math.log10(60) - Math.log10(0.001)));
	});

	it('reproduces the reported bug: the RAW beside placement is occluded at 0.6 m edge', () => {
		// Documents the root cause directly against the user's screenshot (7,706
		// BTC of gold ≈ 0.6 m edge) — pins the bug so a future refactor that
		// bypasses clearBesidePlacement fails loudly here, not just downstream.
		const edge = 0.6;
		const { pos } = cameraTransform(edge);
		const raw = besidePlacement(edge);
		expect(dogFullyClear(pos, raw.besideX, raw.besideZ, edge)).toBe(false);
		// The shipped placement clears the same camera/edge.
		const fixed = clearBesidePlacement(edge, pos);
		expect(dogFullyClear(pos, fixed.x, fixed.z, edge)).toBe(true);
	});

	it('no sample of the dog is occluded — every commodity, ~24 log-spaced edges (1 mm–60 m), every aspect', () => {
		for (const id of COMMODITY_IDS) {
			const density = getCommodity(id)?.densityGPerCm3;
			expect(density).toBeGreaterThan(0); // real schema density, not a stand-in
			for (const edge of EDGE_SWEEP) {
				const tr = cameraTransform(edge);
				for (const aspect of ASPECTS) {
					const stage = dogStagePosition(edge, tr.pos, tr.aim, aspect);
					const clear = dogFullyClear(tr.pos, stage.x, stage.z, edge);
					expect(clear, `commodity=${id} edge=${edge} aspect=${aspect}`).toBe(true);
				}
			}
		}
	});

	it('the beside→foreground blend path stays clear at every intermediate wFg (1.2–3.5 m band)', () => {
		// Finely-sampled sweep across the whole wFg transition — not just the
		// two endpoints. A naive lerp between two individually-clear endpoints
		// CAN dip through the wedge partway (the cube sits between them); this
		// is what actually caught that case during development (edges just
		// above 1.2 m, where wFg is small but nonzero) and is why the final
		// blended target is ALSO routed through the clearance net in
		// `dogStagePosition`, not just the beside anchor.
		let sawIntermediateWFg = false;
		for (let logE = Math.log10(1.2); logE <= Math.log10(3.5); logE += 0.01) {
			const edge = 10 ** logE;
			const tr = cameraTransform(edge);
			for (const aspect of ASPECTS) {
				const stage = dogStagePosition(edge, tr.pos, tr.aim, aspect);
				if (stage.wFg > 0 && stage.wFg < 1) sawIntermediateWFg = true;
				expect(
					dogFullyClear(tr.pos, stage.x, stage.z, edge),
					`edge=${edge} aspect=${aspect} wFg=${stage.wFg}`
				).toBe(true);
			}
		}
		expect(sawIntermediateWFg).toBe(true); // guard that the blend band was actually exercised
	});

	it('scale honesty: dog/cube camera-distance ratio stays ≥ 0.8 below the foreground threshold', () => {
		// Sideways (+x) pushes ONLY increase the dog's distance from camera
		// (safe direction); this guards against a future change leaning on
		// forward (+z) clearance instead, which would pull the dog closer to
		// camera, inflate its apparent size, and quietly break scale honesty.
		// Measured baseline for this fix is ≈0.995 at its tightest — 0.8 keeps
		// real margin below that while still catching a regression.
		const BOUND = 0.8;
		for (let logE = Math.log10(0.001); logE <= Math.log10(1.2); logE += 0.02) {
			const edge = 10 ** logE;
			const tr = cameraTransform(edge);
			const clear = clearBesidePlacement(edge, tr.pos);
			const dogPos = { x: clear.x, y: DOG_TOTAL_HEIGHT_M / 2, z: clear.z };
			const cubeCentre = { x: 0, y: edge / 2, z: 0 };
			const distDog = Math.hypot(
				tr.pos.x - dogPos.x,
				tr.pos.y - dogPos.y,
				tr.pos.z - dogPos.z
			);
			const distCube = Math.hypot(
				tr.pos.x - cubeCentre.x,
				tr.pos.y - cubeCentre.y,
				tr.pos.z - cubeCentre.z
			);
			expect(distDog / distCube, `edge=${edge}`).toBeGreaterThanOrEqual(BOUND);
		}
	});

	it('continuity: no popping as edge sweeps the full range (dense adjacent-sample check)', () => {
		// Mirrors the `framingDominant` continuity test's style — dense
		// geometric sweep, assert adjacent samples don't leap. Two allowances,
		// either of which is enough to pass a step:
		//  - a generous RATIO cap once the dog is following the foreground mark
		//    (edge > 1.2 m) — once wFg > 0 the dog's position tracks the
		//    camera's, and past the "wide" crossover the camera's own distance
		//    from origin scales roughly LINEARLY with edge (`framingDistance`),
		//    so the dog's absolute position keeps drifting at a steady, elevated
		//    rate all the way to 60 m — measured worst case ≈5.59 m of position
		//    change per metre of edge, confirmed pre-existing (the unfixed lerp
		//    has the same slope, ≈5.65, at the same edge) — not a regression.
		//  - an absolute-size floor (1 cm at this sampling resolution) below
		//    edge = 1.2 m — the correction's onset (where it starts binding,
		//    around edge ≈ 2.5 cm–9 cm depending on commodity) is itself
		//    steep-but-smooth (measured directly: the required push grows
		//    continuously from 0 to a few mm over a sub-millimetre edge range),
		//    so a few-millimetre step at this resolution is expected and
		//    imperceptible, not a pop.
		const aspect = 1.0;
		let prevEdge: number | null = null;
		let prev: { x: number; z: number } | null = null;
		for (let logE = Math.log10(0.0001); logE <= Math.log10(60); logE += 0.01) {
			const edge = 10 ** logE;
			const tr = cameraTransform(edge);
			const stage = dogStagePosition(edge, tr.pos, tr.aim, aspect);
			if (prev && prevEdge !== null) {
				const dEdge = edge - prevEdge;
				const dPos = Math.hypot(stage.x - prev.x, stage.z - prev.z);
				const followingForeground = edge > 1.2; // wFg can be > 0 here
				const maxRatio = followingForeground ? 8 : 1.5;
				const ok = dPos < 0.01 || dPos / dEdge < maxRatio;
				expect(ok, `edge=${prevEdge}→${edge} dPos=${dPos} ratio=${dPos / dEdge}`).toBe(true);
			}
			prevEdge = edge;
			prev = { x: stage.x, z: stage.z };
		}
	});

	it('DOG_NOSE_REACH_M is derived from DOG_TOTAL_HEIGHT_M, not a bare literal', () => {
		expect(DOG_NOSE_REACH_M).toBeCloseTo(DOG_TOTAL_HEIGHT_M * 0.577, 6);
		expect(DOG_NOSE_REACH_M).toBeCloseTo(0.3, 2);
	});

	it('converges to the untouched besidePlacement for small cubes (the signed-off "sniffing" shot)', () => {
		// Below ~2.5 cm the raw placement already clears (verified directly),
		// so clearBesidePlacement must be a no-op there — the small-cube
		// composition is unchanged, only the ~2.5 cm–1.2 m failing band moves.
		const edge = 0.005; // 5 mm — deep in the signed-off small-cube regime
		const { pos } = cameraTransform(edge);
		const raw = besidePlacement(edge);
		const clear = clearBesidePlacement(edge, pos);
		expect(clear.x).toBeCloseTo(raw.besideX, 6);
		// z is allowed a small, edge-scaled nudge only if the raw value were
		// ever behind the front face; at 5 mm the two are already within the
		// clearance margin's own floor (2 mm), i.e. imperceptible.
		expect(Math.abs(clear.z - raw.besideZ)).toBeLessThan(0.01);
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
