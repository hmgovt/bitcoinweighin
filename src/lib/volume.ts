/**
 * Volume computation — two distinct functions per the spec.
 *
 * 1. computeIntrinsicVolumeCm3 — true material volume for text readouts
 * 2. computeDisplayWidthMm — visual sprite scaling for rendering
 */

import type { Commodity, RenderStage } from './commodities.js';

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
 */
export function pickStage(amount: number, commodity: Commodity): RenderStage {
	const stages = commodity.render.stages;
	for (const stage of stages) {
		if (stage.maxValue === null || amount <= stage.maxValue) {
			return stage;
		}
	}
	// Fallback to last stage
	return stages[stages.length - 1];
}
