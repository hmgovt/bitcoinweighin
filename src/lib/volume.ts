/**
 * Volume computation — two distinct functions per the spec.
 *
 * 1. computeIntrinsicVolumeCm3 — true material volume for text readouts
 * 2. computeDisplayWidthMm — visual sprite scaling for rendering
 */

import type { Commodity, RenderStage, TileConfig } from './commodities.js';

/**
 * Compute the intrinsic material volume in cm³.
 *
 * This is the actual volume of pure substance. Used in readout strips:
 * "0.5 BTC = 11 oz silver = 342 g · 32.6 cm³"
 */
export function computeIntrinsicVolumeCm3(amount: number, commodity: Commodity): number {
	// Volume-native: oil in barrels → 1 barrel = 158,987 cm³
	if (commodity.unit === 'barrel') {
		return amount * 158_987;
	}

	// Mass-based with solid density
	if (commodity.unitMassGrams && commodity.densityGPerCm3) {
		const massGrams = amount * commodity.unitMassGrams;
		return massGrams / commodity.densityGPerCm3;
	}

	// Bulk commodities (agri) — use bulk density
	if (commodity.unitMassGrams && commodity.bulkDensityKgPerM3) {
		const massKg = (amount * commodity.unitMassGrams) / 1000;
		const volumeM3 = massKg / commodity.bulkDensityKgPerM3;
		return volumeM3 * 1_000_000;
	}

	throw new Error(`Cannot compute volume for ${commodity.id}: missing density data`);
}

/**
 * Compute the total mass in grams for a commodity amount.
 */
export function computeMassGrams(amount: number, commodity: Commodity): number | null {
	if (!commodity.unitMassGrams) {
		// Volume-native commodities (oil) don't have a simple mass-per-unit
		if (commodity.unit === 'barrel' && commodity.densityGPerCm3) {
			// 1 barrel = 158.987 litres = 158,987 cm³
			return amount * 158_987 * commodity.densityGPerCm3;
		}
		return null;
	}
	return amount * commodity.unitMassGrams;
}

/**
 * Compute the displayed physical width in millimetres for sprite scaling.
 *
 * Uses cube-root scaling: visual size grows as the cube root of the
 * quantity ratio relative to the stage's reference amount.
 */
export function computeDisplayWidthMm(amount: number, stage: RenderStage): number {
	const quantityRatio = amount / stage.referenceAmount;
	const scaleFactor = Math.cbrt(quantityRatio);
	return stage.realWorldWidthMetres * 1000 * scaleFactor;
}

/**
 * Pick the appropriate render stage for a given commodity amount.
 *
 * Throws if called for a cube-mode commodity — those don't have stages.
 * Callers must guard on commodity.renderStyle before calling.
 */
export function pickStage(amount: number, commodity: Commodity): RenderStage {
	if (!commodity.render) {
		throw new Error(
			`pickStage called for ${commodity.id} which has no render progression (renderStyle: ${commodity.renderStyle})`
		);
	}
	const stages = commodity.render.stages;
	for (const stage of stages) {
		if (stage.maxValue === null || amount <= stage.maxValue) {
			return stage;
		}
	}
	// Fallback to last stage
	return stages[stages.length - 1];
}

// ── Cube-mode helpers ──────────────────────────────────────────

/**
 * Compute the edge length in millimetres of a cube whose volume equals
 * the intrinsic substance volume of the given amount of commodity.
 *
 * Used by cube-mode commodities (gold, silver, platinum, copper, ...).
 * Continuous across the full slider range — no stages, no thresholds.
 */
export function computeCubeEdgeMm(amount: number, commodity: Commodity): number {
	if (amount <= 0) return 0;
	const volumeCm3 = computeIntrinsicVolumeCm3(amount, commodity);
	// cm³ → cm → mm
	return Math.cbrt(volumeCm3) * 10;
}

/** Universal scale-reference height in metres (the Shiba). */
export const SHIBA_HEIGHT_M = 0.4;
/** Padding factor applied to the dominant element when sizing the viewport. */
export const VIEWPORT_MARGIN = 1.1;
/**
 * Pixel gap from the viewport's vertical midline to the inner corner of
 * each element. Cube's visible bottom-right corner sits at midline − GAP;
 * Shiba's visible bottom-left corner sits at midline + GAP. Neither
 * crosses the midline at any slider position — both scale outward from
 * these fixed points only.
 */
export const GAP_FROM_MIDLINE_PX = 100;

/**
 * Visible-content bounding-box width as a fraction of the 1600 × 1600
 * sprite canvas. Used to keep the *visible* outer edge of the dominant
 * element within its side of the row when the horizontal clamp binds.
 *   cube@2x.png    bbox (244, 331, 1296, 1409) → 0.6575
 *   shiba_inu.webp bbox (486, 490, 1008, 1203) → 0.3263
 */
export const CUBE_VISIBLE_WIDTH_FRACTION = (1296 - 244) / 1600;
export const SHIBA_VISIBLE_WIDTH_FRACTION = (1008 - 486) / 1600;

/**
 * Map real-world metres to viewport pixels for the cube + Shiba scene.
 *
 * Viewport height (in real-world metres) equals the larger of cube edge
 * and Shiba height, times a 10 % margin. The dominant element fills its
 * side; the other element scales down proportionally. The horizontal
 * clamp engages only at narrow viewports / extreme amounts: it shrinks
 * pxPerMetre so the dominant element's *visible* outer edge stays
 * within `(viewportWidthPx / 2) − GAP_FROM_MIDLINE_PX` of its anchor.
 */
export function computePxPerMetre(
	cubeEdgeM: number,
	viewportHeightPx: number,
	viewportWidthPx: number
): number {
	if (viewportHeightPx <= 0) return 0;
	const viewportHeightM = Math.max(SHIBA_HEIGHT_M, cubeEdgeM) * VIEWPORT_MARGIN;
	const fromHeight = viewportHeightPx / viewportHeightM;
	if (viewportWidthPx <= 0) return fromHeight;
	const sidePx = Math.max(0, viewportWidthPx / 2 - GAP_FROM_MIDLINE_PX);
	const cubeDominates = cubeEdgeM >= SHIBA_HEIGHT_M;
	const fromWidth = cubeDominates
		? cubeEdgeM > 0
			? sidePx / (cubeEdgeM * CUBE_VISIBLE_WIDTH_FRACTION)
			: Infinity
		: sidePx / (SHIBA_HEIGHT_M * SHIBA_VISIBLE_WIDTH_FRACTION);
	return Math.min(fromHeight, fromWidth);
}

/** Convert a real-world metres dimension to pixels at the scene's scale. */
export function spritePixelSize(realSizeM: number, pxPerMetre: number): number {
	return realSizeM * pxPerMetre;
}

export interface ScaleReference {
	id: string;
	displayName: string;
	realSizeMetres: number;
	spritePath: string;
	description: string;
	culturalNote?: string;
	/**
	 * Which bounding-box dimension `realSizeMetres` refers to. Read by the
	 * Blender render scripts to scale the imported source to the canonical
	 * 0.5 m longest dimension (lighting-rig consistency per
	 * `assets/materials-reference.md`). Defaults to "longest" when omitted;
	 * existing 19 entries omit the field and inherit that default.
	 */
	measurementAxis?: 'length' | 'height' | 'longest';
	/**
	 * Optional path to an animated .gltf for the easter-egg renderer. When
	 * present, the reference renderer can swap the static sprite for a
	 * <model-viewer> element on hover / sustained tap / `?easter=doge`.
	 * References without this field stay static-only.
	 */
	animatedModelPath?: string;
}

// (`pickClosestReference` was deleted on 2026-05-04 when the cycling
// reference library was replaced with the universal Shiba; CubeRenderer
// now reads the single Shiba entry from scale-references.json directly.)

// ── Tile-mode helpers ──────────────────────────────────────────

export interface TileState {
	/** Number of fully-filled tiles */
	fullTiles: number;
	/** Fractional fill of the trailing tile (0–1) */
	trailingFill: number;
	/** Index into fillStates array for the trailing tile */
	trailingFillIndex: number;
	/** Total tile count (fullTiles + trailingFill) */
	totalTiles: number;
	/** Whether we've hit the tile cap and should show comparison card */
	capped: boolean;
}

/**
 * Compute tile state for a tile-mode stage.
 *
 * The tile count is the ratio of the current amount to the stage's
 * referenceAmount (each tile represents one referenceAmount).
 */
export function computeTileState(amount: number, stage: RenderStage): TileState {
	if (!stage.tileConfig) {
		return { fullTiles: 0, trailingFill: 0, trailingFillIndex: 0, totalTiles: 0, capped: false };
	}

	const totalTiles = amount / stage.referenceAmount;
	const cap = stage.tileConfig.capAtTiles;
	const capped = totalTiles > cap;
	const effectiveTiles = capped ? cap : totalTiles;

	const fullTiles = Math.floor(effectiveTiles);
	const trailingFill = effectiveTiles - fullTiles;

	// Map trailing fill to nearest fill-state index (5 states: 0, 0.25, 0.5, 0.75, 1.0)
	const fillCount = stage.tileConfig.fillStates.length;
	const trailingFillIndex = Math.round(trailingFill * (fillCount - 1));

	return {
		fullTiles,
		trailingFill,
		trailingFillIndex,
		totalTiles,
		capped,
	};
}
