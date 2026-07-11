/**
 * Pure geometry/tier maths for the Cash commodity — a WebGL stack of $1
 * bills. Every constant below is the U.S. Bureau of Engraving and
 * Printing's published note dimension, identical across denominations.
 * See docs/handoff/14-cash.md for the full spec and worked examples.
 */

export const BILL_LENGTH_MM = 155.956; // 6.14 in
export const BILL_WIDTH_MM = 66.294; // 2.61 in
export const BILL_THICKNESS_MM = 0.10922; // 0.0043 in
export const BILL_MASS_G = 1;

/** Total height of a straight stack of `noteCount` notes, in millimetres. */
export function stackHeightMm(noteCount: number): number {
	if (!(noteCount > 0)) return 0;
	return noteCount * BILL_THICKNESS_MM;
}
