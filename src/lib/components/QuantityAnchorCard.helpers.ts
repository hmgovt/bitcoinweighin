/**
 * Helper logic for QuantityAnchorCard, extracted so it can be unit-tested
 * without mounting the Svelte component.
 */

export interface QuantityAnchor {
	id: string;
	quantityKg: number;
	displayName: string;
	description: string;
	source?: string;
	priority: 1 | 2;
	/**
	 * Verb completing "This much {commodity} has never been ___." for the
	 * terminal impossibility band (see `selectImpossibilityBand`). Only
	 * meaningful on the largest anchor per commodity list; defaults to
	 * "mined" when absent.
	 */
	impossibilityVerb?: string;
}

/**
 * Pick the best anchor near `currentMassKg`. An anchor matches when the
 * current mass is within ±10% of its `quantityKg` value (relative to the
 * anchor, not the current mass). Among matches, lowest `priority` wins
 * (1 beats 2); ties broken by ascending `quantityKg`. Returns null when
 * no anchor is in range, the list is empty, or `currentMassKg <= 0`.
 */
export function selectAnchor(
	anchors: QuantityAnchor[],
	currentMassKg: number
): QuantityAnchor | null {
	if (currentMassKg <= 0 || anchors.length === 0) return null;

	const matches = anchors.filter(
		(a) => a.quantityKg > 0 && Math.abs(a.quantityKg - currentMassKg) / a.quantityKg <= 0.1
	);
	if (matches.length === 0) return null;

	return [...matches].sort(
		(a, b) => a.priority - b.priority || a.quantityKg - b.quantityKg
	)[0];
}

export interface ImpossibilityBand {
	/** The largest anchor for the commodity — the threshold that was exceeded. */
	anchor: QuantityAnchor;
	/** currentMassKg / anchor.quantityKg. Always > 1. */
	multiple: number;
}

/**
 * Detect the terminal "impossibility" band (delight pass, 2026-07-10,
 * brief §1.2): once `currentMassKg` exceeds the largest anchor's
 * `quantityKg` for a commodity, there is no bigger real-world quantity of
 * the substance to compare against — the honest statement is that the
 * amount has never existed, quantified as a multiple of the largest
 * anchor it exceeds (for gold/silver, "all gold/silver ever mined").
 *
 * This only fires strictly beyond the largest anchor's own value.
 * `selectAnchor`'s ±10% tolerance window around that same anchor takes
 * priority in the caller (QuantityAnchorCard renders the impossibility
 * band only when `selectAnchor` returns null), so in practice the band
 * engages once `currentMassKg` is comfortably past the tolerance ceiling.
 *
 * Returns null when the list is empty, `currentMassKg <= 0`, or
 * `currentMassKg` does not exceed the largest anchor.
 */
export function selectImpossibilityBand(
	anchors: QuantityAnchor[],
	currentMassKg: number
): ImpossibilityBand | null {
	if (currentMassKg <= 0 || anchors.length === 0) return null;

	const terminal = anchors.reduce((max, a) => (a.quantityKg > max.quantityKg ? a : max));
	if (currentMassKg <= terminal.quantityKg) return null;

	return { anchor: terminal, multiple: currentMassKg / terminal.quantityKg };
}
