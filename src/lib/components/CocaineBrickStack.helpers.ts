/**
 * Pure layout maths for the cocaine "brick stack" visual (flag-gated
 * prototype, ?bricks=1). Mirrors the mass-tier ladder in
 * CocaineDenominationRow.helpers.ts but resolves to *renderable* geometry —
 * how many discrete elements to draw, the fractional trailing element, and a
 * cap so the SVG never explodes into thousands of nodes.
 *
 * Driven entirely by mass in grams. No DOM, no Svelte — unit-testable.
 *
 * Tier ladder (cumulative, continuous with the denomination copy):
 *   < 1 g                    lines       (30 mg each)
 *   1 g  – < 1 kg            retail bags (~1 g each)
 *   1 kg – < 1 t            1-kg bricks  (partial brick = cut block)
 *   1 t  – < 100 t          pallets      (1000 bricks/pallet)
 *   ≥ 100 t                 production   (years of global output ~2,250 t/yr)
 */

export type CocaineTier = 'lines' | 'bags' | 'bricks' | 'pallets' | 'production';

/** Grams per discrete unit in each counted tier. */
export const GRAMS_PER_LINE = 0.03; // 30 mg
export const GRAMS_PER_BAG = 1; // ~1 g retail bag
export const GRAMS_PER_BRICK = 1000; // 1 kg brick
export const BRICKS_PER_PALLET = 1000; // 1 t pallet
export const GRAMS_PER_PALLET = GRAMS_PER_BRICK * BRICKS_PER_PALLET; // 1,000,000 g
/** UNODC 2024 estimate: ~2,250 t/yr of global cocaine production. */
export const GLOBAL_ANNUAL_GRAMS = 2_250_000 * 1000; // 2.25e9 g

/** Per-tier render caps — bound total SVG node count to a few hundred. */
export const CAP_LINES = 24;
export const CAP_BAGS = 50;
export const CAP_BRICKS = 60;
export const CAP_PALLETS = 24;

/**
 * Trailing partial units below this fraction of a whole unit are suppressed —
 * a sliver of a brick/bag/pallet reads as visual noise and fights the
 * composition. Owner-accepted: the count label carries the true precision, so
 * a hidden 0.08-of-a-brick remainder is honest, not a lie. At or above this
 * fraction the partial renders (cut block / half-filled bag / shorter stack).
 */
export const PARTIAL_MIN_FRACTION = 0.15;

/** Tier boundaries in grams (lower-inclusive of the next tier). */
export const BAGS_MIN_G = 1; // 1 g
export const BRICKS_MIN_G = 1000; // 1 kg
export const PALLETS_MIN_G = 1_000_000; // 1 t
export const PRODUCTION_MIN_G = 100_000_000; // 100 t

/** Select the visual tier for a given mass in grams. */
export function selectTier(massG: number): CocaineTier | null {
	if (!(massG > 0)) return null;
	if (massG < BAGS_MIN_G) return 'lines';
	if (massG < BRICKS_MIN_G) return 'bags';
	if (massG < PALLETS_MIN_G) return 'bricks';
	if (massG < PRODUCTION_MIN_G) return 'pallets';
	return 'production';
}

export interface CountedLayout {
	tier: 'lines' | 'bags' | 'bricks' | 'pallets';
	/** Exact (fractional) total count of units at this tier. */
	exactCount: number;
	/** Whole units to render fully. */
	fullCount: number;
	/**
	 * Fractional remainder of the trailing unit (0–1). Rendered as a partial
	 * line / partial bag / cut brick / partial pallet stack. 0 when the count
	 * is a whole number or when capped.
	 */
	partialFraction: number;
	/** True once exactCount exceeds the tier cap; trailing partial suppressed. */
	capped: boolean;
	/** Units actually drawn = fullCount (+1 if partialFraction > 0). */
	renderedUnits: number;
}

/**
 * Resolve a counted tier (lines / bags / bricks / pallets) into render
 * geometry: how many whole units, the fractional trailing unit, and whether
 * the cap bound. Above the cap we render `cap` whole units and rely on the
 * "×N" label to carry the true magnitude (partial suppressed).
 */
export function countedLayout(massG: number): CountedLayout | null {
	const tier = selectTier(massG);
	if (tier === null || tier === 'production') return null;

	let perUnit: number;
	let cap: number;
	switch (tier) {
		case 'lines':
			perUnit = GRAMS_PER_LINE;
			cap = CAP_LINES;
			break;
		case 'bags':
			perUnit = GRAMS_PER_BAG;
			cap = CAP_BAGS;
			break;
		case 'bricks':
			perUnit = GRAMS_PER_BRICK;
			cap = CAP_BRICKS;
			break;
		case 'pallets':
			perUnit = GRAMS_PER_PALLET;
			cap = CAP_PALLETS;
			break;
	}

	const exactCount = massG / perUnit;
	const capped = exactCount > cap;

	if (capped) {
		return {
			tier,
			exactCount,
			fullCount: cap,
			partialFraction: 0,
			capped: true,
			renderedUnits: cap,
		};
	}

	const fullCount = Math.floor(exactCount);
	// Float noise guard: treat a trailing fraction within 1e-9 of whole as 0.
	let partialFraction = exactCount - fullCount;
	if (partialFraction < 1e-9) partialFraction = 0;
	if (partialFraction > 1 - 1e-9) partialFraction = 0;
	// Suppress a too-small trailing sliver (owner-accepted): below
	// PARTIAL_MIN_FRACTION the partial unit reads as noise; the count label
	// carries the precision instead. A trailing fraction this close to a whole
	// unit (> 1 − MIN) is already collapsed by the guard above; only the small
	// low-end slivers are dropped here.
	if (partialFraction > 0 && partialFraction < PARTIAL_MIN_FRACTION) partialFraction = 0;

	return {
		tier,
		exactCount,
		fullCount,
		partialFraction,
		capped: false,
		renderedUnits: fullCount + (partialFraction > 0 ? 1 : 0),
	};
}

export interface ProductionLayout {
	tier: 'production';
	/** Years of global production this mass represents. */
	years: number;
	/** Fraction of a single year (used when years < 1). */
	yearFraction: number;
}

/** Resolve the production tier (≥ 100 t) into a years-of-output figure. */
export function productionLayout(massG: number): ProductionLayout | null {
	if (selectTier(massG) !== 'production') return null;
	const years = massG / GLOBAL_ANNUAL_GRAMS;
	return { tier: 'production', years, yearFraction: years };
}

/**
 * Grid dimensions (cols × rows) to lay out `n` units compactly, preferring a
 * slightly-wider-than-tall arrangement. Used for the bag grid and the brick
 * courses.
 */
export function gridDims(n: number, maxCols: number): { cols: number; rows: number } {
	if (n <= 0) return { cols: 0, rows: 0 };
	const cols = Math.min(maxCols, Math.ceil(Math.sqrt(n)));
	const rows = Math.ceil(n / cols);
	return { cols, rows };
}

/**
 * Short human label for a count, e.g. 1_234 → "1,234". Kept here so the
 * component and tests agree on formatting.
 */
export function formatCount(n: number): string {
	return Math.round(n).toLocaleString('en-GB');
}
