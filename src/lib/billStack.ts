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

export type BillTier = 'loose' | 'strap' | 'bundle' | 'cube' | 'pallet';

/** Real cash-handling units: a strap bands 100 notes; a bundle is 10 straps. */
export const NOTES_PER_STRAP = 100;
export const NOTES_PER_BUNDLE = 1000;
/** Past this many notes, bundles are arranged into a roughly-cubic grid. */
export const CUBE_TIER_MIN_NOTES = 100_000;
/** Past this many notes, render a receding field of pallet-scale blocks. */
export const PALLET_TIER_MIN_NOTES = 10_000_000;

/** Which real-world cash-handling unit best represents this many notes. */
export function selectBillTier(noteCount: number): BillTier | null {
	if (!(noteCount > 0)) return null;
	if (noteCount < NOTES_PER_STRAP) return 'loose';
	if (noteCount < NOTES_PER_BUNDLE) return 'strap';
	if (noteCount < CUBE_TIER_MIN_NOTES) return 'bundle';
	if (noteCount < PALLET_TIER_MIN_NOTES) return 'cube';
	return 'pallet';
}

export interface CubicGrid {
	colsX: number;
	colsZ: number;
	layersY: number;
	extentXMm: number;
	extentZMm: number;
	extentYMm: number;
}

/**
 * Arrange `n` identical items (each `itemWidthMm` x `itemLengthMm` x
 * `itemHeightMm`) into an integer 3D grid whose overall extents are as
 * close to equal as possible — the "roughly cubic stack" from the brief.
 * Closed-form target-extent solve (no brute-force search): if every axis
 * filled the same target extent `E`, the item count would be
 * `E^3 / (w*l*h)`; solve for `E`, round each axis's item count, then grow
 * whichever axis has the smallest extent until the grid holds >= n items.
 */
export function cubicGridDims(
	n: number,
	itemWidthMm: number,
	itemLengthMm: number,
	itemHeightMm: number
): CubicGrid {
	if (!(n > 0)) {
		return { colsX: 0, colsZ: 0, layersY: 0, extentXMm: 0, extentZMm: 0, extentYMm: 0 };
	}
	const targetExtent = Math.cbrt(n * itemWidthMm * itemLengthMm * itemHeightMm);
	let colsX = Math.max(1, Math.round(targetExtent / itemWidthMm));
	let colsZ = Math.max(1, Math.round(targetExtent / itemLengthMm));
	let layersY = Math.max(1, Math.round(targetExtent / itemHeightMm));

	while (colsX * colsZ * layersY < n) {
		const extents: [number, number, number] = [
			colsX * itemWidthMm,
			colsZ * itemLengthMm,
			layersY * itemHeightMm,
		];
		const minIdx = extents.indexOf(Math.min(...extents));
		if (minIdx === 0) colsX++;
		else if (minIdx === 1) colsZ++;
		else layersY++;
	}

	return {
		colsX,
		colsZ,
		layersY,
		extentXMm: colsX * itemWidthMm,
		extentZMm: colsZ * itemLengthMm,
		extentYMm: layersY * itemHeightMm,
	};
}

export interface HeightComparison {
	label: string;
	metres: number;
}

/** Ascending by height — the ladder `nearestHeightComparison` walks. */
export const HEIGHT_COMPARISONS: HeightComparison[] = [
	{ label: 'an adult human', metres: 1.7 },
	{ label: 'a doorway', metres: 2.03 },
	{ label: 'the Statue of Liberty (pedestal to torch)', metres: 93 },
	{ label: 'the Eiffel Tower', metres: 330 },
	{ label: 'the Burj Khalifa', metres: 828 },
	{ label: 'Mount Everest', metres: 8849 },
	{ label: 'the Karman line (edge of space)', metres: 100_000 },
	{ label: 'the Moon', metres: 384_400_000 },
];

/**
 * The tallest ladder rung at or below `heightM`, and how many multiples of
 * it the stack stands. Returns null below the shortest rung — a fraction
 * of a doorway isn't a useful comparison, so the readout falls back to the
 * raw length in that case (see BillReadout).
 */
export function nearestHeightComparison(
	heightM: number
): { label: string; multiple: number } | null {
	if (heightM < HEIGHT_COMPARISONS[0].metres) return null;
	let best = HEIGHT_COMPARISONS[0];
	for (const c of HEIGHT_COMPARISONS) {
		if (c.metres <= heightM) best = c;
		else break;
	}
	return { label: best.label, multiple: heightM / best.metres };
}
