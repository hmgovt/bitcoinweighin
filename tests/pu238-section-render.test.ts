import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import HeroStage from '../src/lib/components/HeroStage.svelte';
import type { Commodity } from '../src/lib/commodities.js';

/**
 * Integration test: mount HeroStage with the Pu-238 tab active and assert all
 * Pu-238-specific extras land — brand-voice clarification, activity readout,
 * source attribution, fact card, and the melt warning above the 1 kg
 * threshold. (The standalone CommoditySection was retired when the four
 * commodities became hero tabs; this coverage moved to HeroStage.)
 *
 * Closes the same silent-wiring gap that bit the original Stage 5 wiring.
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
	densityGPerCm3: 11.46, // PuO₂ fuel — see DECISIONS 2026-06-11
	cubeSpritePath: '/sprites/pu238/cube@2x.png',
	cubeShadowPath: '/sprites/pu238/cube-shadow@2x.png',
	sourceId: 'pu238',
	sourceName: 'test',
	dataQuality: 'illustrative',
	priceField: 'pu238',
	facts: [],
};

/** Render HeroStage with Pu-238 active at a given commodity-unit amount. */
function renderPu(amount: number, btcAmount: number) {
	return render(HeroStage, {
		props: {
			commodities: [pu238Entry],
			selectedId: 'pu238',
			amounts: { pu238: amount },
			btcAmount,
			btcUsdPrice: 80_000,
			prices: null,
		},
	});
}

describe('HeroStage: Pu-238 tab wiring', () => {
	it('renders the brand-voice clarification persistently above the readout', () => {
		const out = renderPu(16, 1);
		expect(out.body).toContain('the radioisotope that powers spacecraft');
		expect(out.body).toContain('Non-fissile, not weapons material');
	});

	it('shows the activity readout (Ci + dps) at non-zero amounts', () => {
		const out = renderPu(16, 1); // 16 g × 17 Ci/g = 272 Ci
		expect(out.body).toContain('activity');
		expect(out.body).toContain('272 Ci');
		expect(out.body).toContain('disintegrations / sec');
	});

	it('renders the source attribution row', () => {
		const out = renderPu(16, 1);
		expect(out.body).toContain('DOE Office of Nuclear Energy');
		expect(out.body).toContain('NASA Planetary Science');
		expect(out.body).toContain('Cassini OIG');
	});

	it('renders the Pu238FactCard rather than QuantityAnchorCard', () => {
		const out = renderPu(16, 1);
		// Pu238FactCard at ~16 g returns the "CubeSat-scale" copy
		// (the 10–49 g band; see Pu238FactCard.helpers.ts).
		expect(out.body).toContain('CubeSat-scale deep-space mission');
		expect(out.body).toContain('pu238-fact-card');
	});

	it('does NOT show the melt warning below 1 kg', () => {
		const out = renderPu(16, 1); // 16 g
		expect(out.body).not.toContain('Would melt itself in reality');
	});

	it('shows the melt warning at and above 1 kg', () => {
		const out = renderPu(1600, 100); // 1.6 kg — 100 BTC
		expect(out.body).toContain('Would melt itself in reality');
	});

	it('renders the GeigerCrackle toggle when commodity.geigerCrackle is true', () => {
		const out = renderPu(16, 1);
		expect(out.body).toContain('geiger-toggle');
		// Default off (audioEnabled store starts false): "Geiger" label.
		expect(out.body).toContain('Geiger');
	});
});
