import { GLOBAL_ANNUAL_GRAMS } from './CocaineBrickStack.helpers.js';
import { formatImpossibilityLine } from '$lib/format.js';

/**
 * Mass-tier-switching denomination copy for the cocaine still panel.
 * Single readout line that adapts as the slider moves.
 *
 * Tiers (cumulative thresholds):
 *   < 1 g                    lines (30 mg each)
 *   < 1000 g (= 1 kg)        retail bags (~1 g each)
 *   < 1000 kg (= 1 tonne)    1-kg bricks
 *   < 100,000 kg (= 100 t)   pallets · bricks
 *   above                    fraction of one year of global production,
 *                            then years (UNODC 2024 estimate ~2,250 t/yr)
 */
export function denomination(massKg: number): string {
	if (massKg <= 0) return '';
	const massG = massKg * 1000;

	if (massG < 1) return `≈ ${Math.round(massG / 0.03)} lines (30 mg each)`;
	if (massG < 1000) return `≈ ${Math.round(massG)} retail bags (~1 g each)`;
	if (massKg < 1000) return `≈ ${Math.round(massKg)} 1-kg bricks`;
	if (massKg < 100000) {
		const pallets = Math.round(massKg / 1000);
		return `≈ ${pallets.toLocaleString()} pallets · ≈ ${Math.round(massKg).toLocaleString()} bricks`;
	}

	const yearsOfGlobal = massKg / 2_250_000;
	if (yearsOfGlobal < 1) {
		return `≈ ${Math.round(yearsOfGlobal * 100)}% of one year of global production`;
	}
	return `≈ ${yearsOfGlobal.toFixed(1)} years of global production`;
}

/**
 * Honesty line for masses beyond a full year of global cocaine production
 * (delight pass, 2026-07-10, brief §1.2 + §6 — the one permitted cocaine
 * change). Mirrors the gold/silver "impossibility" band in
 * QuantityAnchorCard.helpers.ts: once the displayed mass exceeds the
 * largest real annual quantity of the substance, the honest statement is
 * that it has never been produced in a single year, quantified against
 * the actual global annual figure.
 *
 * Deliberately reuses `GLOBAL_ANNUAL_GRAMS` from CocaineBrickStack.helpers
 * (UNODC 2024 estimate, ~2,250 t/yr) rather than introducing a second,
 * slightly different annual-production constant — `denomination()` above
 * already frames masses past 100 t as a fraction/multiple of this same
 * figure, and two different cited totals for "global annual production"
 * on the same panel would undercut the site's precision. (UNODC's most
 * recent World Drug Report puts 2022 output at a record ~2,757 t; see
 * /methodology for the range — this feature keeps the lower, previously
 * established figure per the "choose the conservative figure" rule.)
 *
 * Returns null at or below one year of global production.
 */
export function cocaineImpossibilityLine(massKg: number): string | null {
	const annualKg = GLOBAL_ANNUAL_GRAMS / 1000;
	if (!(massKg > annualKg)) return null;

	const { headline, blurb } = formatImpossibilityLine({
		subject: 'cocaine',
		verb: 'produced in a year',
		referenceLabel: 'Global annual production',
		referenceKg: annualKg,
		multiple: massKg / annualKg,
	});
	return `${headline} ${blurb}`;
}
