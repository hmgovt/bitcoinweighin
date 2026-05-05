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
