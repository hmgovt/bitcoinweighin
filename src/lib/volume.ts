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

	// Gas: volume at STP. 1 MMBtu ≈ 28.3 m³ at STP
	if (commodity.unit === 'mmbtu') {
		return amount * 28_300_000;
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
		// Volume-native commodities (oil, natgas) don't have a simple mass-per-unit
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

/**
 * Pick the reference whose realSizeMetres is closest to the cube edge
 * length (in metres) on a logarithmic scale.
 *
 * Library is assumed sorted ascending by realSizeMetres.
 */
export function pickClosestReference(
	cubeEdgeMm: number,
	references: ScaleReference[]
): ScaleReference {
	if (references.length === 0) {
		throw new Error('pickClosestReference: empty reference library');
	}
	if (cubeEdgeMm <= 0) return references[0];

	const cubeMetres = cubeEdgeMm / 1000;
	const cubeLog = Math.log10(cubeMetres);

	let best = references[0];
	let bestDist = Math.abs(Math.log10(best.realSizeMetres) - cubeLog);
	for (let i = 1; i < references.length; i++) {
		const dist = Math.abs(Math.log10(references[i].realSizeMetres) - cubeLog);
		if (dist < bestDist) {
			best = references[i];
			bestDist = dist;
		}
	}
	return best;
}


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
