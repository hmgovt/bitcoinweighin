/**
 * drift.test.ts — cross-source constant equality.
 *
 * functions/_lib.ts openly declares itself a "minimal copy" of src/lib/
 * kept in sync by hand, and src/lib/delta-objects.json (consumed by both
 * the homepage's Daily Delta line and the X bot) has its own pricing
 * figures. Hand-sync has already drifted once (the cocaine OG price
 * shipped at $35/g while the site and bot used $30/g — see DECISIONS.md
 * 2026-06-09 audit, finding Q1). These tests pin every duplicated
 * pricing/format constant to its src/lib source so that class of bug
 * fails CI instead of shipping silently.
 */
import { describe, it, expect } from 'vitest';
import { OG_COMMODITIES } from '../functions/_lib.js';
import { getCommodity } from '../src/lib/commodities.js';
import illustrativePrices from '../src/lib/illustrative-prices.json';
import objects from '../src/lib/delta-objects.json';

describe('functions/_lib.ts OG_COMMODITIES vs src/lib/commodities.ts', () => {
	const ids = ['gold', 'silver', 'pu238', 'cocaine'] as const;

	for (const id of ids) {
		it(`${id}: unitMassGrams matches`, () => {
			const site = getCommodity(id);
			expect(site).toBeDefined();
			expect(OG_COMMODITIES[id].unitMassGrams).toBe(site!.unitMassGrams);
		});

		it(`${id}: densityGPerCm3 matches (or is absent on both)`, () => {
			const site = getCommodity(id);
			expect(site).toBeDefined();
			expect(OG_COMMODITIES[id].densityGPerCm3).toBe(site!.densityGPerCm3);
		});
	}
});

describe('functions/_lib.ts illustrative prices vs src/lib/illustrative-prices.json', () => {
	it('pu238: illustrativePricePerUnit matches pricePerUnit', () => {
		expect(OG_COMMODITIES.pu238.illustrativePricePerUnit).toBe(
			illustrativePrices.pu238.pricePerUnit
		);
	});

	it('cocaine: illustrativePricePerUnit matches the wholesale tier ($/kg -> $/g)', () => {
		const wholesalePerGram = illustrativePrices.cocaine.tiers.wholesale.pricePerKg / 1000;
		expect(OG_COMMODITIES.cocaine.illustrativePricePerUnit).toBe(wholesalePerGram);
	});
});

describe('src/lib/delta-objects.json pricing vs src/lib/illustrative-prices.json', () => {
	// The bot/homepage delta engine's fixed-price commodities (cocaine, pu238)
	// duplicate the USD/g figure that illustrative-prices.json already
	// carries. Live commodities (gold, silver) read prices.json directly and
	// have no separate constant to drift, so they're not asserted here.
	it('cocaine: usdPerGram matches the wholesale tier ($/kg -> $/g)', () => {
		const wholesalePerGram = illustrativePrices.cocaine.tiers.wholesale.pricePerKg / 1000;
		const rule = objects.pricing.cocaine;
		expect(rule.kind).toBe('fixed');
		if (rule.kind === 'fixed') expect(rule.usdPerGram).toBe(wholesalePerGram);
	});

	it('pu238: usdPerGram matches pricePerUnit', () => {
		const rule = objects.pricing.pu238;
		expect(rule.kind).toBe('fixed');
		if (rule.kind === 'fixed') expect(rule.usdPerGram).toBe(illustrativePrices.pu238.pricePerUnit);
	});
});
