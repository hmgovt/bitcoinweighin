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

/** Where the dog stands when beside the cube (front-right corner, pulled
 *  toward camera in +z so the cube can't occlude it at this azimuth). */
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
 */
export function dogStagePosition(
	edge: number,
	pos: Vec3,
	aim: Vec3,
	aspect: number,
	dogH: number = DOG_TOTAL_HEIGHT_M
): { x: number; z: number; wFg: number; staged: boolean } {
	const { besideX, besideZ } = besidePlacement(edge);
	const { wFg } = aimBlend(edge, besideX, dogH);

	if (wFg <= 0) {
		return { x: besideX, z: besideZ, wFg, staged: false };
	}
	const fg = dogGroundMark(pos, aim, aspect);
	if (!fg) {
		return { x: besideX, z: besideZ, wFg, staged: wFg > 0.5 };
	}
	return {
		x: MathUtils.lerp(besideX, fg.x, wFg),
		z: MathUtils.lerp(besideZ, fg.z, wFg),
		wFg,
		staged: wFg > 0.5,
	};
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
