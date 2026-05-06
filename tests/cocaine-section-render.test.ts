import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import CommoditySection from '../src/lib/components/CommoditySection.svelte';
import type { Commodity } from '../src/lib/commodities.js';

/**
 * Integration test: mount CommoditySection with the cocaine commodity entry
 * and assert the still-with-readout panel landed in the rendered tree
 * (not PhysicalRep's "Unknown renderStyle" fallback).
 *
 * The Stage 5 wiring failed silently in the browser because Stage 3's unit
 * tests only exercised StillPanel / CocaineDenominationRow / TieredPricingTable
 * in isolation — they never went through CommoditySection's renderer-selection
 * branch. This test closes that gap.
 */

const cocaineEntry: Commodity = {
	id: 'cocaine',
	displayName: 'Cocaine',
	mvpLaunch: true,
	pageOrder: 4,
	renderStyle: 'still_with_readout',
	unit: 'gram',
	unitMassGrams: 1,
	sourceId: 'cocaine',
	sourceName: 'test',
	dataQuality: 'illustrative',
	priceField: 'cocaine',
	facts: [],
};

describe('CommoditySection: cocaine renderer dispatch', () => {
	it('renders the StillPanel for renderStyle="still_with_readout"', () => {
		const out = render(CommoditySection, {
			props: {
				commodity: cocaineEntry,
				amount: 1,
				btcAmount: 1,
				btcUsdPrice: 80_000,
				unitSys: 'imperial',
			},
		});
		// StillPanel emits these structural classes; CocaineDenominationRow
		// and TieredPricingTable are the readout-slot children.
		expect(out.body).toContain('still-panel');
		expect(out.body).toContain('still-image-wrapper');
		expect(out.body).toContain('cocaine-readout');
		expect(out.body).toContain('tiered-pricing');
	});

	it('does not fall through to PhysicalRep\'s "Unknown renderStyle" path', () => {
		const out = render(CommoditySection, {
			props: {
				commodity: cocaineEntry,
				amount: 1,
				btcAmount: 1,
				btcUsdPrice: 80_000,
				unitSys: 'imperial',
			},
		});
		expect(out.body).not.toContain('Unknown renderStyle');
		expect(out.body).not.toContain('not-implemented');
	});
});
