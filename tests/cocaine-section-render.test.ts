import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import HeroStage from '../src/lib/components/HeroStage.svelte';
import type { Commodity } from '../src/lib/commodities.js';

/**
 * Integration test: mount HeroStage with the cocaine tab active and assert the
 * relocated cocaine readout landed — the brick-stack SVG in the stage frame,
 * the "You could buy" mass readout, the three-tier pricing grid, and the
 * source provenance. (The standalone CommoditySection still-panel was retired
 * when cocaine became the 4th hero tab; its readout moved to CocaineReadout,
 * rendered here under the stage.)
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

function renderCocaine(amount: number, btcAmount: number) {
	return render(HeroStage, {
		props: {
			commodities: [cocaineEntry],
			selectedId: 'cocaine',
			amounts: { cocaine: amount },
			btcAmount,
			btcUsdPrice: 80_000,
			prices: null,
		},
	});
}

describe('HeroStage: cocaine tab dispatch', () => {
	it('renders the brick-stack SVG in the stage frame, not the WebGL stage', () => {
		const out = renderCocaine(1000, 1); // 1 kg → bricks tier
		expect(out.body).toContain('brick-stack');
		// The live WebGL stage is unmounted on the cocaine tab.
		expect(out.body).not.toContain('live-stage');
	});

	it('relocates the cocaine readout (mass + tiered pricing + sources)', () => {
		const out = renderCocaine(1000, 1);
		expect(out.body).toContain('cocaine-readout');
		expect(out.body).toContain('You could buy');
		expect(out.body).toContain('tiered-pricing');
		expect(out.body).toContain('UNODC 2024');
	});

	it('shows the Illustrative price badge for cocaine', () => {
		const out = renderCocaine(1000, 1);
		expect(out.body).toContain('Illustrative price');
	});

	it('does not fall through to a PhysicalRep "Unknown renderStyle" path', () => {
		const out = renderCocaine(1000, 1);
		expect(out.body).not.toContain('Unknown renderStyle');
		expect(out.body).not.toContain('not-implemented');
	});
});
