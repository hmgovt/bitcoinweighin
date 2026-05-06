/**
 * Formatting utilities for mass, volume, and commodity amounts.
 */

import type { UnitSystem } from './stores/url.js';

// ── Mass formatting ─────────────────────────────────────────────

const GRAMS_PER_OZ = 28.3495;
const GRAMS_PER_LB = 453.592;
const GRAMS_PER_TROY_OZ = 31.1035;

export function formatMass(grams: number, unit: UnitSystem): string {
	if (unit === 'imperial') {
		if (grams < GRAMS_PER_OZ) {
			return `${formatNum(grams / GRAMS_PER_TROY_OZ)} troy oz`;
		}
		const lbs = grams / GRAMS_PER_LB;
		if (lbs < 1) {
			return `${formatNum(grams / GRAMS_PER_OZ)} oz`;
		}
		if (lbs < 2000) {
			return `${formatNum(lbs)} lb`;
		}
		return `${formatNum(lbs / 2000)} tons`;
	}

	// Metric
	if (grams < 1) {
		return `${formatNum(grams * 1000)} mg`;
	}
	if (grams < 1000) {
		return `${formatNum(grams)} g`;
	}
	if (grams < 1_000_000) {
		return `${formatNum(grams / 1000)} kg`;
	}
	return `${formatNum(grams / 1_000_000)} tonnes`;
}

/**
 * Mass formatter for non-metal commodities (e.g. cocaine).
 *
 * `formatMass` falls back to "troy oz" below 1 oz because metals are
 * priced in troy oz — the right vocabulary for gold/silver readouts but
 * meaningless for substances priced by gram. This variant uses a
 * consumer-substance ladder: ng / µg / mg / oz / lb / short tons
 * (imperial) and ng / µg / mg / g / kg / tonnes (metric). The sub-mg
 * range is unit-agnostic — there is no imperial vocabulary that small.
 */
export function formatMassConsumer(grams: number, unit: UnitSystem): string {
	if (grams <= 0) return unit === 'imperial' ? '0 oz' : '0 g';

	if (grams < 1e-6) return `${formatNum(grams * 1e9)} ng`;
	if (grams < 1e-3) return `${formatNum(grams * 1e6)} µg`;
	if (grams < 1) return `${formatNum(grams * 1000)} mg`;

	if (unit === 'imperial') {
		if (grams < GRAMS_PER_LB) return `${formatNum(grams / GRAMS_PER_OZ)} oz`;
		const lbs = grams / GRAMS_PER_LB;
		if (lbs < 2000) return `${formatNum(lbs)} lb`;
		return `${formatNum(lbs / 2000)} short tons`;
	}

	// Metric
	if (grams < 1000) return `${formatNum(grams)} g`;
	if (grams < 1_000_000) return `${formatNum(grams / 1000)} kg`;
	return `${formatNum(grams / 1_000_000)} tonnes`;
}

// ── Volume formatting ───────────────────────────────────────────

const CM3_PER_FL_OZ = 29.5735;
const CM3_PER_GALLON = 3785.41;

export function formatVolume(cm3: number, unit: UnitSystem): string {
	if (unit === 'imperial') {
		if (cm3 < CM3_PER_FL_OZ) {
			return `${formatNum(cm3 / CM3_PER_FL_OZ)} fl oz`;
		}
		const gallons = cm3 / CM3_PER_GALLON;
		if (gallons < 1) {
			return `${formatNum(cm3 / CM3_PER_FL_OZ)} fl oz`;
		}
		return `${formatNum(gallons)} gal`;
	}

	// Metric
	if (cm3 < 1) {
		return `${formatNum(cm3 * 1000)} mm³`;
	}
	if (cm3 < 1000) {
		return `${formatNum(cm3)} cm³`;
	}
	const litres = cm3 / 1000;
	if (litres < 1000) {
		return `${formatNum(litres)} L`;
	}
	return `${formatNum(cm3 / 1_000_000)} m³`;
}

// ── Commodity amount formatting ─────────────────────────────────

export function formatCommodityAmount(
	amount: number,
	unitLabel: string
): string {
	return `${formatNum(amount)} ${unitLabel}`;
}

export function unitLabel(unit: string): string {
	switch (unit) {
		case 'troy_oz': return 'troy oz';
		case 'lb': return 'lb';
		case 'barrel': return 'bbl';
		case 'gram': return 'g';
		case 'kg': return 'kg';
		case 'pellet': return 'pellets';
		default: return unit;
	}
}

// ── Number formatting ───────────────────────────────────────────

function formatNum(n: number): string {
	if (n === 0) return '0';
	const abs = Math.abs(n);
	if (abs >= 1_000_000) {
		return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
	}
	if (abs >= 100) {
		return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
	}
	if (abs >= 1) {
		return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
	}
	if (abs >= 0.01) {
		return n.toLocaleString('en-US', { maximumFractionDigits: 3 });
	}
	// Very small numbers — use significant digits
	return n.toPrecision(3);
}

// ── Solid-volume formatting (cube-mode commodities) ────────────

const CM3_PER_IN3 = 16.387064;

/**
 * Volume formatting for solid substances. Imperial uses in³ / ft³;
 * metric uses cm³ / m³. Use this for cube-mode commodity readouts —
 * the existing `formatVolume` returns gallons / fl-oz which is right
 * for fluids (oil, coffee) but wrong for metals.
 */
export function formatVolumeSolid(cm3: number, unit: UnitSystem): string {
	if (cm3 <= 0) return unit === 'imperial' ? '0 in³' : '0 cm³';
	if (unit === 'imperial') {
		const in3 = cm3 / CM3_PER_IN3;
		// 1 ft³ = 1728 in³
		if (in3 < 1728) return `${formatNum(in3)} in³`;
		return `${formatNum(in3 / 1728)} ft³`;
	}
	if (cm3 < 1_000_000) return `${formatNum(cm3)} cm³`;
	return `${formatNum(cm3 / 1_000_000)} m³`;
}

// ── Length formatting (cube-edge readout, YAxis labels) ────────

const MM_PER_IN = 25.4;

/**
 * Length formatting with adaptive ladder.
 *   Imperial: in / ft / mi (switch at 12 in / 5280 ft).
 *   Metric:   mm / cm / m / km (switch at 10 mm / 1 m / 1 km).
 */
export function formatLength(metres: number, unit: UnitSystem): string {
	if (metres <= 0) return unit === 'imperial' ? '0 in' : '0 mm';
	if (unit === 'imperial') {
		const inches = (metres * 1000) / MM_PER_IN;
		if (inches < 12) return `${formatNum(inches)} in`;
		const feet = inches / 12;
		if (feet < 5280) return `${formatNum(feet)} ft`;
		return `${formatNum(feet / 5280)} mi`;
	}
	const mm = metres * 1000;
	if (mm < 10) return `${formatNum(mm)} mm`;
	if (mm < 1000) return `${formatNum(mm / 10)} cm`;
	if (metres < 1000) return `${formatNum(metres)} m`;
	return `${formatNum(metres / 1000)} km`;
}

// ── Two-unit pair formatting ───────────────────────────────────

/** Compose a "primary · secondary" line for cube-mode readout. */
export function formatPair(primary: string, secondary: string): string {
	return `${primary} · ${secondary}`;
}

// ── BTC formatting ──────────────────────────────────────────────

export function formatBtc(btc: number): string {
	if (btc >= 1000) {
		return btc.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' BTC';
	}
	if (btc >= 1) {
		return btc.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' BTC';
	}
	if (btc >= 0.001) {
		return btc.toLocaleString('en-US', { maximumFractionDigits: 4 }) + ' BTC';
	}
	if (btc >= 0.00000001) {
		const sats = Math.round(btc * 100_000_000);
		if (sats === 1) return '1 sat';
		if (sats < 1000) return `${sats} sats`;
		return sats.toLocaleString('en-US') + ' sats';
	}
	return btc.toExponential(2) + ' BTC';
}
