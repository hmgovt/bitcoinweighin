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
