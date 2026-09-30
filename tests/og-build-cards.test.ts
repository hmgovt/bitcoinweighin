import { describe, it, expect } from 'vitest';
import { cardLinks } from '../scripts/og/build-cards.js';
import { cardKey, CARD_PRESETS } from '../functions/_card.js';

describe('pre-rendered link cards', () => {
	it('covers every commodity at 1 BTC and every holder, the landing view, year ends and the extras', () => {
		const links = cardLinks(['commodity=cash&btc=1&date=2013-09-30', 'btc=0.0001&commodity=gold'], [2013, 2014]);
		const keys = new Set(links.map(cardKey));
		for (const c of ['gold', 'silver', 'pu238', 'cocaine', 'cash', 'manhattan']) {
			expect(keys.has(`${c}_b-1`)).toBe(true);
			for (const p of CARD_PRESETS) expect(keys.has(`${c}_p-${p}`)).toBe(true);
		}
		expect(keys.has('gold_b-500')).toBe(true);
		expect(keys.has('gold_b-1_2013-12-31')).toBe(true);
		expect(keys.has('cash_b-1_2013-09-30')).toBe(true);
		expect(keys.has('gold_b-0p0001')).toBe(true);
	});
});
