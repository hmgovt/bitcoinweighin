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

/** Ascending by height — the ladder `nearestHeightComparison` walks below
 *  1% of the distance to the Moon (see that function). The Moon itself is
 *  handled as a dedicated regime, not a ladder rung, so it does not appear
 *  here. */
export const HEIGHT_COMPARISONS: HeightComparison[] = [
	{ label: 'an adult human', metres: 1.7 },
	{ label: 'a doorway', metres: 2.03 },
	{ label: 'the Statue of Liberty (pedestal to torch)', metres: 93 },
	{ label: 'the Eiffel Tower', metres: 330 },
	{ label: 'the Burj Khalifa', metres: 828 },
	{ label: 'Mount Everest', metres: 8849 },
	{ label: 'the Karman line (edge of space)', metres: 100_000 },
];

/** Average Earth-Moon distance, km (used to scale the tallest stacks —
 *  the ladder above tops out at the Karman line since nothing terrestrial
 *  is a useful comparison past that). */
export const DISTANCE_TO_MOON_KM = 384_400;
const MOON_DISTANCE_M = DISTANCE_TO_MOON_KM * 1000;

/** Existing convention: sub-10x multiples read as one decimal, larger ones
 *  round to a grouped integer — a fractional "2,523.4x" doesn't read any
 *  more precisely than "2,523x" but is noisier. */
function formatMultiple(multiple: number): string {
	return multiple < 10
		? multiple.toFixed(1)
		: Math.round(multiple).toLocaleString('en-US');
}

export type HeightComparisonResult =
	| { kind: 'ladder'; label: string; multiple: number; text: string }
	| { kind: 'moonPercent'; percent: number; text: string }
	| { kind: 'moonMultiple'; multiple: number; text: string };

/**
 * How `heightM` compares to a real-world reference, in one of three
 * regimes (tallest first):
 *  - at or past the Moon's average distance: a multiple of that distance,
 *  - at or past 1% of the way there: a plain percentage ("38% of the way
 *    to the Moon") — a multiple of the Karman line stops being legible
 *    once it runs into the thousands, while "38% of the way to the Moon"
 *    stays intuitive at any magnitude in this band,
 *  - below that: the terrestrial ladder (`HEIGHT_COMPARISONS`), same as
 *    before.
 * Returns null below the shortest ladder rung — a fraction of a doorway
 * isn't a useful comparison, so the readout falls back to the raw length
 * in that case (see BillReadout). `text` is a ready-to-render phrase so
 * call sites don't need to branch on `kind` themselves.
 */
export function nearestHeightComparison(heightM: number): HeightComparisonResult | null {
	if (heightM >= MOON_DISTANCE_M) {
		const multiple = heightM / MOON_DISTANCE_M;
		return {
			kind: 'moonMultiple',
			multiple,
			text: `about ${formatMultiple(multiple)}x the distance to the Moon`,
		};
	}
	if (heightM >= MOON_DISTANCE_M * 0.01) {
		const percent = Math.round((heightM / MOON_DISTANCE_M) * 100);
		return { kind: 'moonPercent', percent, text: `${percent}% of the way to the Moon` };
	}
	if (heightM < HEIGHT_COMPARISONS[0].metres) return null;
	let best = HEIGHT_COMPARISONS[0];
	for (const c of HEIGHT_COMPARISONS) {
		if (c.metres <= heightM) best = c;
		else break;
	}
	const multiple = heightM / best.metres;
	return {
		kind: 'ladder',
		label: best.label,
		multiple,
		text: `about ${formatMultiple(multiple)}x ${best.label}`,
	};
}

/** Notes per pallet load (10 × 10 × 10 bundles). */
export const NOTES_PER_PALLET = NOTES_PER_BUNDLE * 1000;
/** Horizontal pitch between pallets, × the load's footprint (the aisle). */
export const PALLET_PITCH = 1.12;
/** Height of the wooden pallet under a load, m. */
export const PALLET_DECK_M = 0.144;
/** Loose notes scattered around a stack, taken from the count, never added. */
export const STRAY_MAX = 7;

export interface CashParts {
	/** Loose notes scattered on the floor (curled, folded, flat). */
	strays: number;
	/** Loose notes in a small stack. */
	loose: number;
	/** Banded straps of 100. */
	straps: number;
	/** Bundles of 1,000 (ten straps). */
	bundles: number;
	/** Pallet loads of 1,000,000. */
	pallets: number;
	/** A last, part-filled bundle (bundle/cube tiers) or pallet (pallet tier), in notes. */
	partialNotes: number;
}

/**
 * How the stage draws `noteCount` notes, in the units cash is actually
 * handled in. Exact: the parts always add back up to the (whole) count —
 * the loose notes on the floor come out of it (from the remainder, never
 * by breaking open a whole strap or bundle), and a remainder is drawn as a
 * shorter bundle or pallet rather than rounded up to a whole one.
 */
export function cashParts(noteCount: number): CashParts {
	const parts: CashParts = { strays: 0, loose: 0, straps: 0, bundles: 0, pallets: 0, partialNotes: 0 };
	const n = Math.max(0, Math.floor(noteCount + 1e-6));
	const tier = selectBillTier(n);
	if (!tier) return parts;
	if (tier === 'pallet') {
		parts.pallets = Math.floor(n / NOTES_PER_PALLET);
		parts.partialNotes = n % NOTES_PER_PALLET;
		return parts;
	}
	if (tier === 'cube') {
		parts.bundles = Math.floor(n / NOTES_PER_BUNDLE);
		parts.partialNotes = n % NOTES_PER_BUNDLE;
		return parts;
	}
	// Strays come out of what's left over after whole straps/bundles, so a
	// scattered note never breaks open a unit (exactly 1,000 is one bundle).
	const unit = tier === 'loose' ? 1 : tier === 'strap' ? NOTES_PER_STRAP : NOTES_PER_BUNDLE;
	const whole = Math.floor(n / unit) * unit;
	const spare = tier === 'loose' ? n : n - whole;
	parts.strays = n >= 10 ? Math.min(STRAY_MAX, Math.floor(n / 10), spare) : 0;
	if (tier === 'loose') {
		parts.loose = n - parts.strays;
	} else if (tier === 'strap') {
		parts.straps = whole / NOTES_PER_STRAP;
		parts.loose = spare - parts.strays;
	} else {
		parts.bundles = whole / NOTES_PER_BUNDLE;
		parts.partialNotes = spare - parts.strays;
	}
	return parts;
}

/** Notes represented by `parts` — equals the whole note count by construction. */
export function cashPartsTotal(p: CashParts): number {
	return p.strays + p.loose + p.straps * NOTES_PER_STRAP + p.bundles * NOTES_PER_BUNDLE + p.pallets * NOTES_PER_PALLET + p.partialNotes;
}
