import { describe, it, expect } from 'vitest';
import { TANKER_BEATS as B, tankerBtc, tankerFrame } from '../src/lib/clips/tankerClip.js';
import { VLCC_L } from '../src/lib/oil.js';

const I = { btcUsd: 82_563, brent: 125.44, elSalvadorBtc: 7_799 };

describe('the one-question tanker Short', () => {
	it('opens on an empty tanker with the question on screen', () => {
		const f = tankerFrame(0, I);
		expect(f.litres).toBe(0);
		expect(f.question).toBe(1);
		expect(f.url).toBe(0);
	});

	it('fills monotonically to exactly one VLCC by the answer', () => {
		let prev = -1;
		for (let t = B.fillFrom; t < B.answer; t += 0.05) {
			const f = tankerFrame(t, I);
			expect(f.litres).toBeGreaterThanOrEqual(prev);
			prev = f.litres;
		}
		expect(tankerFrame(B.answer + 0.5, I).litres).toBeCloseTo(VLCC_L, 0);
		expect(tankerBtc(I)).toBeCloseTo((2e6 * 125.44) / 82_563, 6);
	});

	it('lands the twist on El Salvador’s stack', () => {
		expect(tankerFrame(B.twistTo + 0.5, I).btc).toBeCloseTo(7_799, 6);
	});

	it('shows one caption at a time', () => {
		for (let t = 0; t <= B.duration; t += 0.05) {
			const f = tankerFrame(t, I);
			const shown = [f.answer, f.twist, Math.max(f.question, f.counter)].filter((o) => o > 0.05);
			expect(shown.length).toBeLessThanOrEqual(1);
		}
	});

	it('ends where it began, so a replay loops', () => {
		const a = tankerFrame(0, I);
		const z = tankerFrame(B.duration - 0.01, I);
		expect(z.litres).toBe(a.litres);
		expect(z.question).toBe(a.question);
		expect(z.url).toBeLessThan(0.01);
	});
});
