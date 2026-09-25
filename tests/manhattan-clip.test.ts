import { describe, it, expect } from 'vitest';
import { BEATS, clipFrame } from '../src/lib/clips/manhattanClip.js';
import { DEVELOPABLE_M2, landM2 } from '../src/lib/manhattan.js';

const PRICE = 84_249;
const STRATEGY = 846_000;

describe('the cyber-Manhattan clip timeline', () => {
	it('opens on the quote over the whole island, with nothing bought', () => {
		const f = clipFrame(1, STRATEGY, PRICE);
		expect(f.quote).toBe(1);
		expect(f.areaM2).toBe(0);
		expect(f.frameM2).toBe(DEVELOPABLE_M2);
		expect(f.endCard).toBe(0);
	});

	it('dives to exactly 1 BTC before the climb', () => {
		const f = clipFrame(BEATS.growStart - 0.5, STRATEGY, PRICE);
		expect(f.btc).toBeCloseTo(1, 9);
		expect(f.frameM2).toBeCloseTo(landM2(1, PRICE), 9);
		expect(f.oneBtc).toBe(1);
	});

	it('climbs monotonically and lands on the holder’s exact stack', () => {
		let prev = 0;
		for (let t = BEATS.growStart; t <= BEATS.growEnd; t += 0.1) {
			const f = clipFrame(t, STRATEGY, PRICE);
			expect(f.btc).toBeGreaterThanOrEqual(prev);
			prev = f.btc;
		}
		const end = clipFrame(BEATS.growEnd, STRATEGY, PRICE);
		expect(end.btc).toBeCloseTo(STRATEGY, 6);
		expect(end.areaM2).toBeCloseTo(landM2(STRATEGY, PRICE), 3);
		expect(end.street).toBe('Fulton Street');
	});

	it('shows one headline at a time', () => {
		for (let t = 0; t <= BEATS.duration; t += 0.05) {
			const f = clipFrame(t, STRATEGY, PRICE);
			const tops = [f.question, f.oneBtc, f.result].filter((o) => o > 0.05);
			expect(tops.length).toBeLessThanOrEqual(1);
		}
		expect(clipFrame(BEATS.duration, STRATEGY, PRICE).endCard).toBe(1);
	});
});
