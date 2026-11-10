/**
 * Direct manipulation — pure, tested. The visitor can grab the cube itself:
 * drag it up to grow it, down to shrink it, pinch on a phone or trackpad.
 * The stage reports a RATIO (new amount ÷ amount at grab start); the page
 * turns that into a BTC value through the same setter the slider uses, so
 * URL state stays canonical. Horizontal drags off the cube orbit the camera.
 *
 * The BTC range and rounding live here too, shared with the page's slider,
 * so a grab and a slider drag can never disagree about where 1 sat or 21M is.
 */

export const BTC_MIN = 0.00000001; // 1 sat
export const BTC_MAX = 21_000_000;

/** Vertical drag sensitivity: dragging the full stage height changes the
 *  amount by this many decades — i.e. the cube edge by a third as many.
 *  At 3, a stage-height pull makes the cube 10× wider, which keeps the
 *  cube's top edge roughly under the pointer when the camera is held. */
export const DECADES_PER_STAGE = 3;

/** Movement (CSS px) below which a press is a tap, not a drag. */
export const TAP_SLOP_PX = 6;

/** Orbit: a full stage-width drag turns the camera half a revolution,
 *  clamped so the cube's two readable faces stay in view. */
export const ORBIT_MAX_RAD = (70 * Math.PI) / 180;

/** Amount ratio for a vertical drag of `dyPx` (positive = downward). */
export function dragRatio(dyPx: number, stageHeightPx: number): number {
	if (!(stageHeightPx > 0)) return 1;
	return Math.pow(10, (-dyPx / stageHeightPx) * DECADES_PER_STAGE);
}

/** Amount ratio for a pinch: the cube's EDGE follows the finger spread, so
 *  the amount (∝ volume) follows its cube. */
export function pinchRatio(distance: number, startDistance: number): number {
	if (!(distance > 0) || !(startDistance > 0)) return 1;
	return Math.pow(distance / startDistance, 3);
}

/** Amount ratio for a ctrl+wheel event — what browsers send for a trackpad
 *  pinch. Same edge-follows-fingers rule as `pinchRatio`. */
export function wheelZoomRatio(deltaY: number): number {
	return Math.pow(Math.exp(-deltaY * 0.01), 3);
}

/** Orbit yaw for a horizontal drag of `dxPx` from `startYaw`, clamped. */
export function orbitYaw(startYaw: number, dxPx: number, stageWidthPx: number): number {
	if (!(stageWidthPx > 0)) return startYaw;
	const yaw = startYaw - (dxPx / stageWidthPx) * Math.PI;
	return Math.min(Math.max(yaw, -ORBIT_MAX_RAD), ORBIT_MAX_RAD);
}

export function clampBtc(btc: number): number {
	if (!Number.isFinite(btc)) return BTC_MIN;
	return Math.min(Math.max(btc, BTC_MIN), BTC_MAX);
}

/** Round a raw BTC value to the precision the slider commits at, so URLs
 *  stay short ("?btc=12.34", not "?btc=12.340000000000002"). */
export function roundBtc(raw: number): number {
	if (raw >= 1000) return Math.round(raw);
	if (raw >= 1) return Math.round(raw * 100) / 100;
	if (raw >= 0.001) return Math.round(raw * 10000) / 10000;
	return Math.max(Math.round(raw * 100000000) / 100000000, BTC_MIN);
}
