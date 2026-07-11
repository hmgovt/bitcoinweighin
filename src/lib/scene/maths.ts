/**
 * Scene maths — pure functions ported VERBATIM from the live-scene prototype
 * (`prototypes/live-scene.html`, signed off 2026-06-11). Every camera,
 * staging and glow decision here was iterated in the prototype; this module
 * is the production home for that maths so it can be unit-tested in isolation
 * from the WebGL island (`LiveStage.svelte`).
 *
 * Nothing in this file owns commodity pricing or density. The cube edge comes
 * from the schema via `cubeEdgeMetres` → `computeCubeEdgeMm` (volume.ts); these
 * functions take the resulting `edge` (metres) as a plain number. No new
 * pricing constants live here (audit Q2). The constants below are camera-rig
 * geometry — focal length, azimuth, framing margins — inherent to the shot,
 * exactly as the prototype defined them.
 */

import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import type { Commodity } from '../commodities.js';
import { computeCubeEdgeMm } from '../volume.js';

// ── Rig constants (verbatim from the prototype) ────────────────────────────

/** Camera field of view, degrees. Both the live camera and the virtual
 *  framing camera use 35° in the prototype. */
export const FOV_DEG = 35;

/** Fixed azimuth — the cube is viewed from front-left so two faces read. */
export const AZIMUTH_RAD = MathUtils.degToRad(-32);

/**
 * Total model height of the Shiba in the scene, metres. The prototype scales
 * the gltf so its full height ≈ 0.52 m (a 40 cm-at-the-shoulder Shiba once
 * head and ears are included — the readout states "40 cm at the shoulder").
 * The framing maths and the model scale must use the SAME value or the dog
 * stops being an honest scale anchor, so it lives here as the single source.
 */
export const DOG_TOTAL_HEIGHT_M = 0.52;

/** Framing floor: below a 5 cm dominant the camera stops dollying closer, so
 *  a sub-millimetre cube still renders as a visible speck the dog sniffs at. */
export const FRAMING_FLOOR_M = 0.05;

/**
 * Horizontal reach of the Shiba's nose from its placement origin when it
 * leans its head toward the cube, metres — `DOG_TOTAL_HEIGHT_M × 0.577` for
 * this model (a compact-breed snout-to-origin reach roughly 58% of total
 * height once the head lean is included). Not an arbitrary number: the
 * ORIGINAL `besidePlacement`'s gap floor (0.14) plus its 0.16 offset already
 * summed to 0.30 m — the nose was implicitly tuned to just reach a speck
 * cube's surface at minimum scale (the "sniffing" shot signed off for small
 * cubes). This constant makes that tuning explicit so the occlusion-clearance
 * maths below can reuse it instead of re-deriving it.
 */
const DOG_NOSE_REACH_RATIO = 0.577;
export const DOG_NOSE_REACH_M = DOG_TOTAL_HEIGHT_M * DOG_NOSE_REACH_RATIO; // ≈ 0.30 m

/**
 * Framing margin. The dominant element fills `1 / 2.2` of the frame height.
 * Lifted from 1.7 → 2.2 in the prototype: the cube shows two faces at this
 * azimuth and its near corner sits closer than the aim plane, so 1.7 let it
 * swallow the frame.
 */
export const FRAMING_MARGIN = 2.2;

/** Camera height is capped at 1 m — monoliths are looked UP at. The uncapped
 *  rule lifted the camera with the cube (4 m+ at monolith scale), from where
 *  the foreground ground is invisible. That was the off-piste bug (twice). */
export const CAM_HEIGHT_MAX_M = 1.0;
export const CAM_HEIGHT_MIN_M = 0.05;

/** Dog foreground distance clamp — safety only. With the 1 m camera cap the
 *  unprojected ground hit lands inside this band by construction; the clamp
 *  exists so a degenerate camera can never slide the dog down the ray. */
export const DOG_DISTANCE_MIN_M = 3.5;
export const DOG_DISTANCE_MAX_M = 8.5;

/** Foreground mark in screen-space NDC (lower centre-right). Pinned to the
 *  screen, not the world, so it can never drift out of frame as scales change. */
export const DOG_FOREGROUND_NDC = { x: 0.42, y: -0.72 } as const;

/** Pu-238 glow ramp endpoints (cube edge, metres) — deep-red at 4 mm to
 *  orange-yellow at 3.4 m. */
const GLOW_EDGE_MIN_M = 0.004;
const GLOW_EDGE_MAX_M = 3.4;

/** Bloom for the metal tabs. Threshold sits ABOVE white-fur brightness so the
 *  Shiba never haloes — only radiation and the hottest highlights bloom.
 *  Regression-pinned: the dog was haloing in the metal scenes at lower
 *  thresholds (`glow ramp` test, `materials.ts`). */
export const METAL_BLOOM = { strength: 0.25, threshold: 1.15 } as const;

export interface Vec3 {
	x: number;
	y: number;
	z: number;
}

// ── Cube edge (delegates to the schema — no pricing constants here) ─────────

/**
 * Cube edge in metres for `amount` of `commodity`. Thin wrapper over the
 * canonical `computeCubeEdgeMm` so the scene has one import and the cube-edge
 * formula stays in `volume.ts` (covered by `cube-edge-canonical.test.ts`).
 */
export function cubeEdgeMetres(amount: number, commodity: Commodity): number {
	return computeCubeEdgeMm(amount, commodity) / 1000;
}

// ── Framing (the dominant rule) ─────────────────────────────────────────────

/**
 * The dominant element the shot frames, metres. Continuous across the three
 * regimes by construction:
 *   macro  (edge ≪ dogH): dominant = edge×3   (dolly in on the cube)
 *   pair   (edge ≲ dogH): dominant = dogH      (today's two-shot)
 *   wide   (edge > dogH): dominant = edge       (cube fills, dog to foreground)
 * `max(min(edge×3, max(edge, dogH)), floor)` is continuous at the macro→pair
 * crossover (edge = dogH/3) and the pair→wide crossover (edge = dogH).
 */
export function framingDominant(edge: number, dogH: number = DOG_TOTAL_HEIGHT_M): number {
	return Math.max(Math.min(edge * 3, Math.max(edge, dogH)), FRAMING_FLOOR_M);
}

/** Dolly distance for a given dominant — solves the FOV so the dominant fills
 *  `1 / FRAMING_MARGIN` of the frame height. */
export function framingDistance(dominant: number): number {
	return (dominant * FRAMING_MARGIN) / (2 * Math.tan(MathUtils.degToRad(FOV_DEG) / 2));
}

/** Camera elevation, radians. Drops from 16° at speck scale to 5° at monolith
 *  scale so big cubes are looked up at. */
export function cameraElevationRad(edge: number): number {
	const t = MathUtils.clamp(
		(Math.log10(edge) - Math.log10(1e-4)) / (Math.log10(60) - Math.log10(1e-4)),
		0,
		1
	);
	return MathUtils.degToRad(MathUtils.lerp(16, 5, t));
}

/** Camera height, metres — capped at 1 m (the camY cap). */
export function cameraHeight(dominant: number): number {
	return MathUtils.clamp(dominant * 0.42, CAM_HEIGHT_MIN_M, CAM_HEIGHT_MAX_M);
}

// ── Staging ─────────────────────────────────────────────────────────────────

/**
 * Where the dog stands when beside the cube (front-right corner). This is
 * the RAW placement — `besideZ = edge * 0.45` sits slightly BEHIND the
 * cube's front-face plane (z = edge / 2), which is the root cause of the
 * dog-hidden-behind-the-cube bug in the ~0.5–1.2 m edge band: the camera
 * sits front-left, `LiveStage` rotates the dog to face the cube, and the
 * head leans toward the origin's -x/-z quadrant — straight into the cube's
 * occlusion wedge. Kept verbatim (still consumed by `aimBlend`/
 * `cameraTransform` for framing, which must NOT shift when the dog is pushed
 * clear — see `clearBesidePlacement`, which fixes the actual dog position). */
export function besidePlacement(edge: number): { gap: number; besideX: number; besideZ: number } {
	const gap = Math.max(0.14, edge * 0.18);
	const besideX = edge / 2 + gap + 0.16;
	const besideZ = edge * 0.45;
	return { gap, besideX, besideZ };
}

/**
 * Aim blend weights. `w` ramps the aim from the cube toward the pair midpoint
 * as the cube approaches the dog; `wFg` ramps the dog from beside the cube to
 * the foreground as the cube towers (1.2 → 3.5 m edge). `aimX` converges back
 * on the cube as the dog relocates (the dog moves instead of the camera).
 */
export function aimBlend(
	edge: number,
	besideX: number,
	dogH: number = DOG_TOTAL_HEIGHT_M
): { w: number; wFg: number; aimX: number; pairMid: number } {
	const pairMid = (edge / 2 + besideX) / 2;
	const w = MathUtils.smoothstep(edge, dogH / 6, dogH / 3);
	const wFg = MathUtils.smoothstep(edge, 1.2, 3.5);
	const aimX = w * pairMid * (1 - wFg);
	return { w, wFg, aimX, pairMid };
}

/**
 * Full camera transform for a cube edge: smoothed-target position + aim, plus
 * the derived dominant/dist/wFg the staging needs. Mirrors the prototype's
 * `wantPos`/`wantAim` block (the live loop damps toward these).
 */
export function cameraTransform(
	edge: number,
	dogH: number = DOG_TOTAL_HEIGHT_M
): {
	pos: Vec3;
	aim: Vec3;
	dominant: number;
	dist: number;
	wFg: number;
	besideX: number;
	besideZ: number;
} {
	const dominant = framingDominant(edge, dogH);
	const dist = framingDistance(dominant);
	const elev = cameraElevationRad(edge);
	const azim = AZIMUTH_RAD;
	const { besideX, besideZ } = besidePlacement(edge);
	const { aimX, wFg } = aimBlend(edge, besideX, dogH);

	const pos: Vec3 = {
		x: aimX + dist * Math.cos(elev) * Math.sin(azim),
		y: cameraHeight(dominant),
		z: dist * Math.cos(elev) * Math.cos(azim),
	};
	const aim: Vec3 = { x: aimX, y: dominant * 0.32, z: 0 };
	return { pos, aim, dominant, dist, wFg, besideX, besideZ };
}

// ── Occlusion clearance (the whole dog must clear the cube) ────────────────

/**
 * Exact segment-vs-AABB clearance test (Kay–Kajiya slab method). The cube
 * sits on the ground, occupying [-e/2, e/2] × [0, e] × [-e/2, e/2]; `margin`
 * inflates every face outward so a "just clears" sample keeps genuine
 * separation rather than grazing the surface. Returns true when the segment
 * from `from` to `to` does NOT enter the (inflated) box anywhere along its
 * length — i.e. the point at `to` is not occluded by the cube as seen from a
 * camera at `from`. Exact and corner-case-free, unlike a silhouette-plane
 * approach.
 */
function segmentClearsCube(from: Vec3, to: Vec3, edge: number, margin: number): boolean {
	const half = edge / 2 + margin;
	const lo: Vec3 = { x: -half, y: -margin, z: -half };
	const hi: Vec3 = { x: half, y: edge + margin, z: half };
	let tMin = 0;
	let tMax = 1;
	for (const axis of ['x', 'y', 'z'] as const) {
		const d = to[axis] - from[axis];
		const f = from[axis];
		if (Math.abs(d) < 1e-12) {
			if (f < lo[axis] || f > hi[axis]) return true; // parallel & outside this slab — clear
			continue;
		}
		let t1 = (lo[axis] - f) / d;
		let t2 = (hi[axis] - f) / d;
		if (t1 > t2) [t1, t2] = [t2, t1];
		tMin = Math.max(tMin, t1);
		tMax = Math.min(tMax, t2);
		if (tMin > tMax) return true; // slabs stop overlapping — segment misses the box
	}
	return false; // an overlap survives all three slabs — the box sits on the segment
}

/**
 * The origin plus three points along the Shiba's nose reach, in the
 * DETERMINISTIC direction `LiveStage` actually rotates it to face —
 * `Math.atan2(-x, -z) + 0.14`, reproduced here verbatim (local forward
 * (0, 0, 1) maps to world (sin θ, cos θ) under a three.js Y rotation).
 *
 * An early version of this sampled a blind 360° compass circle instead (the
 * initial implementation guidance's suggestion, to be robust to "any
 * facing"). Measured against the exact segment-vs-cube test, that version
 * had two real problems, both from testing directions the model never
 * actually occupies:
 *  1. FALSE POSITIVES on the signed-off small-cube "sniffing" shot — at
 *     tiny edges `DOG_NOSE_REACH_M` (0.30 m) is deliberately tuned to just
 *     reach a speck cube's surface (`besidePlacement`'s gap floor 0.14 +
 *     0.16 offset = 0.30), and a full circle always has SOME direction
 *     grazing the cube even when the real (facing-only) nose is nowhere
 *     near it — this alone contradicted the "converges to current
 *     behaviour for small cubes" requirement.
 *  2. A genuine discontinuity right at the edge where the correction starts
 *     binding (measured: the required push jumped from 0 to ~3.5 cm within
 *     0.2 mm of cube edge) — an artifact of only 8 discrete compass angles
 *     inconsistently catching a grazing corner that a denser angular
 *     sampling resolved differently at a different edge.
 *
 * Sampling the real, known facing ray instead fixes both: it matches what
 * is actually rendered, so it neither over- nor under-reports, and it
 * varies smoothly with (x, z, edge) since there is only one continuous
 * ray, not a discrete angular grid with a resolution-dependent worst case.
 */
function noseSamples(x: number, z: number): { x: number; z: number }[] {
	const facing = Math.atan2(-x, -z) + 0.14;
	const dirX = Math.sin(facing);
	const dirZ = Math.cos(facing);
	const pts: { x: number; z: number }[] = [{ x, z }];
	for (const t of [1 / 3, 2 / 3, 1]) {
		pts.push({ x: x + dirX * DOG_NOSE_REACH_M * t, z: z + dirZ * DOG_NOSE_REACH_M * t });
	}
	return pts;
}

/** Safety margin for occlusion checks — 2% of edge with a 2 mm floor. Small
 *  and mostly proportional on purpose: at sub-centimetre cube edges the
 *  model's nose is DELIBERATELY tuned to just reach a speck cube's surface
 *  (the signed-off "sniffing" shot), so a margin with a large absolute floor
 *  would flag that intentional near-touch as a false positive and drag the
 *  dog away from a composition that isn't broken. */
function clearanceMargin(edge: number): number {
	return Math.max(edge * 0.02, 0.002);
}

/**
 * Does the WHOLE dog — origin plus its nose reach along the actual facing
 * ray, sampled at three heights (ground, mid-body, head-top) — clear the
 * cube's occlusion wedge as seen from `camPos`? This is the single
 * definition of "fully visible" used by both the placement solver below and
 * the test suite: a passing test means the geometry actually clears, not
 * that two independently-written checks happen to agree.
 */
export function dogFullyClear(
	camPos: Vec3,
	x: number,
	z: number,
	edge: number,
	dogH: number = DOG_TOTAL_HEIGHT_M
): boolean {
	const margin = clearanceMargin(edge);
	const heights = [0, dogH / 2, dogH];
	for (const p of noseSamples(x, z)) {
		for (const y of heights) {
			if (!segmentClearsCube(camPos, { x: p.x, y, z: p.z }, edge, margin)) return false;
		}
	}
	return true;
}

/**
 * Push a candidate (x, z) just far enough that the WHOLE dog clears the
 * cube's occlusion wedge as seen from `camPos` — the ACTUAL camera transform
 * for this edge, computed from the UNADJUSTED `besidePlacement` (see
 * `cameraTransform`). Taking the already-computed camera in, rather than
 * recomputing it from an adjusted placement, breaks the feedback loop:
 * moving the dog never reshapes the shot that was framed for it (`aimBlend`'s
 * `pairMid` depends on the raw `besideX`, untouched by this function).
 *
 * Two moves, tried in strict preference order — sideways over forward, per
 * the scale-honesty requirement. Pushing +x only INCREASES the dog's camera
 * distance (safe: it can only help the ≥0.8 distance-ratio floor pinned in
 * tests), whereas pulling the dog toward the camera in +z would shrink that
 * ratio and inflate its apparent size:
 *
 *  1. Z — clamp to at least the cube's front-face plane plus a margin. For
 *     the beside anchor this directly addresses the documented root cause
 *     (`besideZ = edge * 0.45` sat BEHIND the front face, 0.45 < 0.5); it's a
 *     no-op for candidates already in front (e.g. the foreground mark, which
 *     sits metres closer to the camera than any cube in the blend band).
 *  2. X — bounded bisection (deterministic, ≤48 steps) for the minimal
 *     sideways push that clears whatever the Z move didn't already fix.
 *
 * Used both for the raw beside anchor (`clearBesidePlacement` below) AND for
 * the final beside→foreground blended target in `dogStagePosition` — a
 * straight line between two clear endpoints can still dip through the wedge
 * partway (the cube sits between them), so every point the dog can actually
 * occupy is pushed through this same net, not just the two endpoints.
 *
 * Converges to a no-op as edge → 0 (both moves are no-ops once the candidate
 * already clears, true for cubes ≲ 2.5 cm) — the small-cube "sniffing"
 * composition is unchanged. Pure and self-contained; cheap enough to call
 * every frame.
 */
function clearPointPlacement(
	edge: number,
	camPos: Vec3,
	x: number,
	z: number,
	dogH: number = DOG_TOTAL_HEIGHT_M
): { x: number; z: number } {
	const margin = clearanceMargin(edge);
	const clampedZ = Math.max(z, edge / 2 + margin);

	if (dogFullyClear(camPos, x, clampedZ, edge, dogH)) {
		return { x, z: clampedZ };
	}

	// Widen the bracket until it contains a clearing offset (in practice this
	// never needs more than a step or two beyond the initial guess).
	let lo = 0;
	let hi = edge * 3 + 2;
	for (let i = 0; i < 12 && !dogFullyClear(camPos, x + hi, clampedZ, edge, dogH); i++) {
		hi *= 2;
	}
	for (let i = 0; i < 48; i++) {
		const mid = (lo + hi) / 2;
		if (dogFullyClear(camPos, x + mid, clampedZ, edge, dogH)) hi = mid;
		else lo = mid;
	}
	return { x: x + hi, z: clampedZ };
}

/** Occlusion-safe beside-the-cube placement: `besidePlacement`'s raw (x, z)
 *  pushed clear via `clearPointPlacement` — see that function for the two
 *  moves and their preference order. */
export function clearBesidePlacement(
	edge: number,
	camPos: Vec3,
	dogH: number = DOG_TOTAL_HEIGHT_M
): { x: number; z: number } {
	const { besideX, besideZ } = besidePlacement(edge);
	return clearPointPlacement(edge, camPos, besideX, besideZ, dogH);
}

// ── Dog foreground ground mark (NDC unprojection) ───────────────────────────

/**
 * Unproject the fixed screen-space foreground mark onto the ground plane
 * (y = 0) through a virtual camera placed at `pos` looking at `aim`. Returns
 * the world-space ground hit, the post-clamp distance, and the raw (pre-clamp)
 * distance. Returns `null` when the ray does not point downward (no ground
 * hit) — the caller then leaves the dog beside the cube.
 *
 * The clamp to [3.5, 8.5] m is a safety net: with the 1 m camera cap the raw
 * distance already lands in-band, so the clamp should rarely bind. The old
 * hard clamp sliding the dog down the ray WAS the off-piste bug.
 */
export function dogGroundMark(
	pos: Vec3,
	aim: Vec3,
	aspect: number
): { x: number; z: number; distance: number; rawDistance: number } | null {
	const vcam = new PerspectiveCamera(FOV_DEG, aspect, 0.01, 1000);
	vcam.position.set(pos.x, pos.y, pos.z);
	vcam.lookAt(aim.x, aim.y, aim.z);
	vcam.updateProjectionMatrix();
	vcam.updateMatrixWorld();

	const p = new Vector3(DOG_FOREGROUND_NDC.x, DOG_FOREGROUND_NDC.y, 0.5).unproject(vcam);
	const dir = p.sub(vcam.position).normalize();
	if (dir.y >= -1e-4) return null;

	const s = -vcam.position.y / dir.y;
	const hit = vcam.position.clone().addScaledVector(dir, s);

	const gx = hit.x - vcam.position.x;
	const gz = hit.z - vcam.position.z;
	const L = Math.hypot(gx, gz);
	const Lc = MathUtils.clamp(L, DOG_DISTANCE_MIN_M, DOG_DISTANCE_MAX_M);

	return {
		x: vcam.position.x + (gx / L) * Lc,
		z: vcam.position.z + (gz / L) * Lc,
		distance: Lc,
		rawDistance: L,
	};
}

/**
 * Final dog ground position for a cube edge: blends from beside the cube to
 * the unprojected foreground mark by `wFg`. `staged` is true once the dog has
 * crossed past the "standing nearer the camera" honesty threshold (wFg > 0.5),
 * which the readout uses to add its staging line.
 *
 * The "beside" endpoint is `clearBesidePlacement`'s occlusion-safe (x, z),
 * not the raw `besidePlacement` — so the dog is never occluded at wFg = 0.
 * The blended (lerp) target is then ALSO routed through `clearPointPlacement`
 * before returning: a straight line between two clear endpoints can still
 * dip through the cube's wedge partway (measured directly — the naive lerp
 * fails for a real band of intermediate wFg just above the 1.2 m threshold),
 * so every point the dog can actually occupy gets the same clearance net,
 * not just the two endpoints.
 */
export function dogStagePosition(
	edge: number,
	pos: Vec3,
	aim: Vec3,
	aspect: number,
	dogH: number = DOG_TOTAL_HEIGHT_M
): { x: number; z: number; wFg: number; staged: boolean } {
	const { besideX } = besidePlacement(edge);
	const { wFg } = aimBlend(edge, besideX, dogH);
	const clear = clearBesidePlacement(edge, pos, dogH);

	if (wFg <= 0) {
		return { x: clear.x, z: clear.z, wFg, staged: false };
	}
	const fg = dogGroundMark(pos, aim, aspect);
	const target = fg
		? { x: MathUtils.lerp(clear.x, fg.x, wFg), z: MathUtils.lerp(clear.z, fg.z, wFg) }
		: clear;
	const safe = clearPointPlacement(edge, pos, target.x, target.z, dogH);
	return { x: safe.x, z: safe.z, wFg, staged: wFg > 0.5 };
}

// ── Pu-238 thermal glow ramp ────────────────────────────────────────────────

export interface PuGlow {
	/** 0→1 heat parameter (log-ramped with edge). */
	gT: number;
	/** Emissive colour, linear RGB — deep red → orange-yellow with size. */
	emissive: { r: number; g: number; b: number };
	/** Emissive intensity, pushed past the bloom threshold. */
	emissiveIntensity: number;
	/** Warm point-light intensity the cube spills onto ground + dog. */
	lightIntensity: number;
	/** Bloom pass strength + threshold for the Pu tab. */
	bloom: { strength: number; threshold: number };
}

/**
 * Pu-238 thermal glow for a cube edge. Bigger cube → worse surface-to-volume
 * ratio → hotter: colour climbs deep-red → orange-yellow, emission and the
 * point light scale up, and bloom strength ramps so the glow radiates. Verbatim
 * from the prototype's `update()` glow block. Monotonic in `edge`.
 */
// ── Gaze tracking (brief §2.2) ──────────────────────────────────────────────

/**
 * The head bone's own "nose forward" axis, in the bone's LOCAL space (i.e. as
 * a child of the neck). Derived once, offline, from the shipped rig's BIND
 * pose — not a guess: in `static/models/references/shiba_inu/shiba.glb`,
 * `nose_jnt` is a direct, ZERO-local-rotation child of `head_jnt` (their bind
 * quaternions are identical), so `normalize(nose_jnt.bindWorldPos -
 * head_jnt.bindWorldPos)`, rotated into `head_jnt`'s own local frame by the
 * inverse of its bind world quaternion, is an exact (not approximate) reading
 * of which local axis the snout points along. Computed via a one-off
 * `@gltf-transform/core` forward-kinematics script (bind-pose translations +
 * rotations composed root→head — no WebGL required, no runtime cost). Mostly
 * +Z — the whole rig's own forward axis (see the `+ 0.14` correction on
 * `dog.rotation.y` in `LiveStage.svelte`, which compensates for the body
 * itself sitting a few degrees off true +Z) — with a ~11.4° tilt toward -Y:
 * the snout points slightly down from the head joint, matching the model.
 */
export const HEAD_FORWARD_LOCAL_AXIS: Vec3 = { x: 0, y: -0.19842, z: 0.98012 };

/** Gaze clamp, radians — how far the head may turn away from wherever the
 *  current animation frame (idle sway, breathing, a trick's own head motion)
 *  already has it pointing before the clamp binds; i.e. relative to the
 *  neck's rest pose for that instant, not a fixed bind-pose reference. Yaw
 *  gets more latitude than pitch: a dog swivels its head side to side more
 *  freely than it cranes up or down. */
export const GAZE_MAX_YAW_RAD = MathUtils.degToRad(40);
export const GAZE_MAX_PITCH_RAD = MathUtils.degToRad(30);

/** Gaze damping rate, 1/s, for `1 - exp(-dt * k)`. Reaches ~95% of the way to
 *  the target in about 0.5 s (3 time constants) — which doubles as the
 *  "ease back in" time the brief asks for once a trick ends and the gaze
 *  override resumes from a fresh (zero-offset) baseline. */
export const GAZE_DAMPING_K = 6;

/**
 * The cube's top-front corner nearest the dog, world space — the point the
 * head aims at. `dogX` is the dog's own current world x (which side of the
 * cube it stands on); the sign picks the corner on the dog's side rather
 * than the far one, so the gaze target is always the visually "near" corner
 * at every scale, from a speck the dog looks down its nose at to a monolith
 * it looks up a wall at. Falls back to the +x corner if `dogX` is exactly 0
 * (before the dog has ever been staged) rather than collapsing to the cube's
 * centreline.
 */
export function gazeTargetWorld(edge: number, dogX: number): Vec3 {
	const half = edge / 2;
	return { x: half * Math.sign(dogX || 1), y: edge, z: half };
}

/**
 * Clamp a desired world-space gaze direction to a natural yaw/pitch budget
 * around `current` (the un-adjusted forward direction for this frame — the
 * neck's rest pose, whatever the idle/trick animation has it at right now).
 * Both vectors are unit direction vectors in the same (world) space.
 * Decomposed as azimuth (rotation about world Y) and elevation (angle above
 * the horizontal) rather than a raw angular clamp, so yaw and pitch can carry
 * different limits — deliberately axis/model-agnostic; converting to and
 * from the head bone's own local axis is the caller's job
 * (`HEAD_FORWARD_LOCAL_AXIS` above), not this function's.
 */
export function clampGazeDirection(
	current: Vec3,
	desired: Vec3,
	maxYawRad: number = GAZE_MAX_YAW_RAD,
	maxPitchRad: number = GAZE_MAX_PITCH_RAD
): Vec3 {
	const azimuthOf = (v: Vec3) => Math.atan2(v.x, v.z);
	const elevationOf = (v: Vec3) => Math.asin(MathUtils.clamp(v.y, -1, 1));

	const azCurrent = azimuthOf(current);
	const elCurrent = elevationOf(current);

	let yaw = azimuthOf(desired) - azCurrent;
	yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw)); // wrap to (-π, π]
	const pitch = elevationOf(desired) - elCurrent;

	const yawClamped = MathUtils.clamp(yaw, -maxYawRad, maxYawRad);
	const pitchClamped = MathUtils.clamp(pitch, -maxPitchRad, maxPitchRad);

	const az = azCurrent + yawClamped;
	const el = elCurrent + pitchClamped;
	return {
		x: Math.cos(el) * Math.sin(az),
		y: Math.sin(el),
		z: Math.cos(el) * Math.cos(az),
	};
}

export function puGlowRamp(edge: number): PuGlow {
	const gT = MathUtils.clamp(
		(Math.log10(edge) - Math.log10(GLOW_EDGE_MIN_M)) /
			(Math.log10(GLOW_EDGE_MAX_M) - Math.log10(GLOW_EDGE_MIN_M)),
		0,
		1
	);
	return {
		gT,
		emissive: {
			r: MathUtils.lerp(0.75, 1.0, gT),
			g: MathUtils.lerp(0.12, 0.45, gT),
			b: MathUtils.lerp(0.01, 0.08, gT),
		},
		emissiveIntensity: 0.9 + 3.2 * gT,
		lightIntensity: 6 * edge * edge * (0.4 + 2.6 * gT),
		bloom: { strength: 0.55 + 0.9 * gT, threshold: 0.85 },
	};
}
