import { describe, it, expect } from 'vitest';
import { BEATS, clipFrame } from '../src/lib/clips/manhattanClip.js';
import { DEVELOPABLE_M2, landM2 } from '../src/lib/manhattan.js';

const PRICE = 84_249;
const STRATEGY = 846_000;

describe('the cyber-Manhattan clip timeline (feed cut)', () => {
	it('opens on the payoff: the whole island, the holder’s land lit, the quote on screen from frame 0', () => {
		const f = clipFrame(0, STRATEGY, PRICE);
		expect(f.open).toBe(1);
		expect(f.areaM2).toBeCloseTo(landM2(STRATEGY, PRICE), 3);
		expect(f.frameM2).toBe(DEVELOPABLE_M2);
		expect(f.endCard).toBe(0);
	});

	it('dives to exactly 1 BTC by the first caption', () => {
		const f = clipFrame(BEATS.oneBtc + 0.5, STRATEGY, PRICE);
		expect(f.btc).toBeCloseTo(1, 9);
		expect(f.frameM2).toBeCloseTo(landM2(1, PRICE), 9);
		expect(f.oneBtc).toBe(1);
	});

	it('climbs monotonically and lands on the holder’s exact stack, then all 21 million', () => {
		let prev = 0;
		for (let t = BEATS.growStart; t <= BEATS.allEnd; t += 0.05) {
			const f = clipFrame(t, STRATEGY, PRICE);
			expect(f.btc).toBeGreaterThanOrEqual(prev * (1 - 1e-12));
			prev = f.btc;
		}
		const end = clipFrame(BEATS.growEnd + 0.5, STRATEGY, PRICE);
		expect(end.btc).toBeCloseTo(STRATEGY, 6);
		expect(end.street).toBe('Fulton Street');
		expect(clipFrame(BEATS.allEnd + 0.5, STRATEGY, PRICE).btc).toBeCloseTo(21_000_000, 3);
	});

	it('shows one caption at a time', () => {
		for (let t = 0; t <= BEATS.duration; t += 0.05) {
			const f = clipFrame(t, STRATEGY, PRICE);
			const shown = [f.open, f.oneBtc, Math.min(1, f.counter), f.result, f.all, f.endCard].filter((o) => o > 0.05);
			expect(shown.length).toBeLessThanOrEqual(1);
		}
	});

	it('ends over the whole island, so a replay loops into the opening', () => {
		const f = clipFrame(BEATS.duration - 0.01, STRATEGY, PRICE);
		expect(f.endCard).toBe(1);
		expect(f.frameM2).toBe(DEVELOPABLE_M2);
		expect(BEATS.duration).toBeLessThan(30);
	});
});
