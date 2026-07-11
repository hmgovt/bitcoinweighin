/**
 * Magnetic slider detents (delight brief §1.5b). Pure snap maths — the page
 * computes detent positions once via its own btcToSlider (no duplicate log
 * maths here) and calls `applyDetent` per input event.
 */

/** Snap window, in slider steps (of the page's 10,000-step range). */
export const DETENT_WINDOW_STEPS = 4;

/**
 * BTC values that get a detent: 1 sat, 1k sats, 1M sats, 0.1, 1, the current
 * block reward (6.25 — the dry wink; kept even though the subsidy has since
 * halved, it's the number people know), and the 21M cap.
 */
export const DETENT_BTC_VALUES = [0.00000001, 0.00001, 0.01, 0.1, 1, 6.25, 21_000_000] as const;

/**
 * Snap `sliderPos` to the nearest detent within `window` steps; nearest wins
 * when two windows overlap. Returns the (possibly unchanged) position.
 */
export function applyDetent(
	sliderPos: number,
	detentPositions: number[],
	window: number = DETENT_WINDOW_STEPS
): number {
	let best: number | null = null;
	let bestDist = Infinity;
	for (const d of detentPositions) {
		const dist = Math.abs(sliderPos - d);
		if (dist <= window && dist < bestDist) {
			best = d;
			bestDist = dist;
		}
	}
	return best ?? sliderPos;
}
