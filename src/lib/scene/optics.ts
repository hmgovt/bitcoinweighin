/**
 * Honest optics — pure, tested. Two photographic scale cues, both derived
 * from a declared camera rather than tuned by eye:
 *
 *  · DEPTH OF FIELD. The stage camera is modelled as a full-frame camera
 *    (24 mm sensor height) whose focal length follows from the scene's 35°
 *    vertical field of view (≈ 38 mm), shot at f/2.8 and focused on the cube.
 *    The blur each pixel gets is that lens's real circle of confusion for its
 *    depth. Nothing is invented: macro shots come out with a creamy
 *    background because a real lens at 20 cm does that — it's why tilt-shift
 *    photos make cities look like toys — and wide shots come out sharp
 *    because a real lens at 25 m does that too. Blur is capped for
 *    legibility, so it is only ever UNDER-stated, never exaggerated.
 *
 *  · THE LOUPE. Below a few pixels the cube can't be resolved at all. A
 *    circular inset re-renders it through a narrower field of view from the
 *    same viewpoint — a true optical magnification, declared on screen
 *    (×10, ×200, …) — so a 68 µm fleck of gold is a visible cube rather than
 *    nothing.
 */

import { FOV_DEG } from './maths.js';

/** Full-frame sensor height, metres (36 × 24 mm). */
export const SENSOR_HEIGHT_M = 0.024;

/** Declared aperture. */
export const F_NUMBER = 2.8;

/** Legibility cap on blur-circle DIAMETER, as a fraction of frame height.
 *  Real macro blur at the framing floor is several times this; the cap only
 *  ever understates. */
export const MAX_BLUR_FRACTION = 0.05;

/** Focal length implied by a vertical field of view on the declared sensor, metres. */
export function focalLengthM(fovDeg: number = FOV_DEG, sensorHeightM: number = SENSOR_HEIGHT_M): number {
	return sensorHeightM / 2 / Math.tan(((fovDeg * Math.PI) / 180) / 2);
}

/**
 * Circle-of-confusion diameter for a point at distance `d` when focused at
 * `focus` (both metres, measured along the view axis), as a fraction of the
 * frame height. Thin-lens: c = A·f·|d − S| / (d·(S − f)), A = f/N.
 */
export function cocFraction(
	d: number,
	focus: number,
	fovDeg: number = FOV_DEG,
	fNumber: number = F_NUMBER,
	sensorHeightM: number = SENSOR_HEIGHT_M
): number {
	const f = focalLengthM(fovDeg, sensorHeightM);
	if (!(d > 0) || !(focus > f)) return 0;
	const A = f / fNumber;
	return (A * f * Math.abs(d - focus)) / (d * (focus - f) * sensorHeightM);
}

/**
 * The per-frame constant the DOF shader multiplies by |d − S| / d to get a
 * blur diameter in pixels: k = A·f / ((S − f)·H) × frameHeightPx. Equal to
 * the blur, in pixels, of a point at infinity.
 */
export function cocScalePx(
	focus: number,
	frameHeightPx: number,
	fovDeg: number = FOV_DEG,
	fNumber: number = F_NUMBER,
	sensorHeightM: number = SENSOR_HEIGHT_M
): number {
	const f = focalLengthM(fovDeg, sensorHeightM);
	if (!(focus > f)) return 0;
	return ((f / fNumber) * f) / ((focus - f) * sensorHeightM) * frameHeightPx;
}

// ── Loupe ───────────────────────────────────────────────────────────────────

/** Declared magnifications the loupe steps through. */
export const LOUPE_LADDER: readonly number[] = [
	2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000,
];

/** The loupe appears once the cube projects smaller than this (CSS px). */
export const LOUPE_TRIGGER_PX = 8;

/** Size the magnified cube should read at inside the loupe (CSS px). */
export const LOUPE_TARGET_PX = 72;

/** On-screen size of an object of `size` metres at `distance`, CSS px. */
export function projectedSizePx(
	size: number,
	distance: number,
	viewportHeightPx: number,
	fovDeg: number = FOV_DEG
): number {
	if (!(distance > 0)) return Infinity;
	const focalPx = viewportHeightPx / 2 / Math.tan(((fovDeg * Math.PI) / 180) / 2);
	return (size * focalPx) / distance;
}

/**
 * Magnification for the loupe, or null when the cube is big enough to read
 * unaided. Picks the ladder step that lands the cube closest (in log terms)
 * to LOUPE_TARGET_PX.
 */
export function loupeMagnification(projectedPx: number): number | null {
	if (!(projectedPx > 0) || projectedPx >= LOUPE_TRIGGER_PX) return null;
	const want = LOUPE_TARGET_PX / projectedPx;
	let best = LOUPE_LADDER[0];
	let bestErr = Infinity;
	for (const m of LOUPE_LADDER) {
		const err = Math.abs(Math.log(m / want));
		if (err < bestErr) {
			best = m;
			bestErr = err;
		}
	}
	return best;
}

/** Vertical FOV (degrees) of a camera magnified `m`× from `fovDeg`. */
export function magnifiedFovDeg(m: number, fovDeg: number = FOV_DEG): number {
	const half = ((fovDeg * Math.PI) / 180) / 2;
	return ((2 * Math.atan(Math.tan(half) / m)) * 180) / Math.PI;
}
