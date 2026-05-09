import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import CommoditySection from '../src/lib/components/CommoditySection.svelte';
import type { Commodity } from '../src/lib/commodities.js';

/**
 * Integration test: mount CommoditySection with the Pu-238 commodity and
 * assert the cube-mode panel lands with all Pu-238-specific extras —
 * brand-voice clarification, activity readout, source attribution, glow
 * overlay, fact card, and the melt warning above the 1 kg threshold.
 *
 * Mirrors tests/cocaine-section-render.test.ts; closes the same kind of
 * silent-wiring gap that bit Stage 5 in the browser before we added the
 * dispatch-path test.
 */

const pu238Entry: Commodity = {
	id: 'pu238',
	displayName: 'Plutonium-238',
	mvpLaunch: true,
	pageOrder: 3,
	renderStyle: 'cube',
	glowScales: true,
	geigerCrackle: true,
	specificActivityCiPerGram: 17,
	brandVoiceClarification:
		'Plutonium-238 — the radioisotope that powers spacecraft. Non-fissile, not weapons material.',
	unit: 'gram',
	unitMassGrams: 1,
	densityGPerCm3: 19.8,
	cubeSpritePath: '/sprites/pu238/cube@2x.png',
	cubeShadowPath: '/sprites/pu238/cube-shadow@2x.png',
	sourceId: 'pu238',
	sourceName: 'test',
	dataQuality: 'illustrative',
	priceField: 'pu238',
	facts: [],
};

describe('CommoditySection: Pu-238 panel wiring', () => {
	it('renders the brand-voice clarification persistently above the panel', () => {
		const out = render(CommoditySection, {
			props: {
				commodity: pu238Entry,
				amount: 16, // ~1 BTC at $80k
				btcAmount: 1,
				btcUsdPrice: 80_000,
				unitSys: 'imperial',
			},
		});
		expect(out.body).toContain('the radioisotope that powers spacecraft');
		expect(out.body).toContain('Non-fissile, not weapons material');
	});

	it('layers the CubeGlowOverlay onto the cube anchor', () => {
		const out = render(CommoditySection, {
			props: {
				commodity: pu238Entry,
				amount: 16,
				btcAmount: 1,
				btcUsdPrice: 80_000,
				unitSys: 'imperial',
			},
		});
		// CubeGlowOverlay renders this class.
		expect(out.body).toContain('cube-glow-overlay');
	});

	it('shows the activity readout (Ci + dps) at non-zero amounts', () => {
		const out = render(CommoditySection, {
			props: {
				commodity: pu238Entry,
				amount: 16, // 16 g × 17 Ci/g = 272 Ci
				btcAmount: 1,
				btcUsdPrice: 80_000,
				unitSys: 'imperial',
			},
		});
		expect(out.body).toContain('Activity:');
		expect(out.body).toContain('272 Ci');
		expect(out.body).toContain('disintegrations/sec');
	});

	it('renders the source attribution row', () => {
		const out = render(CommoditySection, {
			props: {
				commodity: pu238Entry,
				amount: 16,
				btcAmount: 1,
				btcUsdPrice: 80_000,
				unitSys: 'imperial',
			},
		});
		expect(out.body).toContain('DOE Office of Nuclear Energy');
		expect(out.body).toContain('NASA Planetary Science');
		expect(out.body).toContain('Cassini OIG');
	});

	it('renders the Pu238FactCard rather than QuantityAnchorCard', () => {
		const out = render(CommoditySection, {
			props: {
				commodity: pu238Entry,
				amount: 16,
				btcAmount: 1,
				btcUsdPrice: 80_000,
				unitSys: 'imperial',
			},
		});
		// Pu238FactCard at ~16 g returns the "CubeSat-scale" copy
		// (the 10–49 g band; see Pu238FactCard.helpers.ts).
		expect(out.body).toContain('CubeSat-scale deep-space mission');
		expect(out.body).toContain('pu238-fact-card');
	});

	it('does NOT show the melt warning below 1 kg', () => {
		const out = render(CommoditySection, {
			props: {
				commodity: pu238Entry,
				amount: 16, // 16 g
				btcAmount: 1,
				btcUsdPrice: 80_000,
				unitSys: 'imperial',
			},
		});
		expect(out.body).not.toContain('would melt itself in reality');
	});

	it('shows the melt warning at and above 1 kg', () => {
		const out = render(CommoditySection, {
			props: {
				commodity: pu238Entry,
				amount: 1600, // 1.6 kg — 100 BTC
				btcAmount: 100,
				btcUsdPrice: 80_000,
				unitSys: 'imperial',
			},
		});
		expect(out.body).toContain('would melt itself in reality');
	});

	it('does not fall through to PhysicalRep\'s "Unknown renderStyle" path', () => {
		const out = render(CommoditySection, {
			props: {
				commodity: pu238Entry,
				amount: 16,
				btcAmount: 1,
				btcUsdPrice: 80_000,
				unitSys: 'imperial',
			},
		});
		expect(out.body).not.toContain('Unknown renderStyle');
		expect(out.body).not.toContain('not-implemented');
	});

	it('renders the GeigerCrackle toggle when commodity.geigerCrackle is true', () => {
		const out = render(CommoditySection, {
			props: {
				commodity: pu238Entry,
				amount: 16,
				btcAmount: 1,
				btcUsdPrice: 80_000,
				unitSys: 'imperial',
			},
		});
		expect(out.body).toContain('geiger-toggle');
		// Default off (audioEnabled store starts false): "Geiger" label,
		// not "Geiger on".
		expect(out.body).toContain('Geiger');
	});

	it('does NOT render the GeigerCrackle toggle when commodity.geigerCrackle is unset', () => {
		const noGeigerEntry = { ...pu238Entry, geigerCrackle: false };
		const out = render(CommoditySection, {
			props: {
				commodity: noGeigerEntry,
				amount: 16,
				btcAmount: 1,
				btcUsdPrice: 80_000,
				unitSys: 'imperial',
			},
		});
		expect(out.body).not.toContain('geiger-toggle');
	});
});
