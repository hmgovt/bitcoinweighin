import { describe, it, expect } from 'vitest';
import { applyDetent, DETENT_WINDOW_STEPS, DETENT_BTC_VALUES } from '../src/lib/detent.js';

describe('applyDetent', () => {
	const detents = [100, 5000, 9996];

	it('snaps inside the window', () => {
		expect(applyDetent(103, detents)).toBe(100);
		expect(applyDetent(97, detents)).toBe(100);
		expect(applyDetent(5004, detents)).toBe(5000);
	});

	it('snaps exactly at the window boundary', () => {
		expect(applyDetent(100 + DETENT_WINDOW_STEPS, detents)).toBe(100);
		expect(applyDetent(100 - DETENT_WINDOW_STEPS, detents)).toBe(100);
	});

	it('does not snap outside the window', () => {
		expect(applyDetent(100 + DETENT_WINDOW_STEPS + 1, detents)).toBe(105);
		expect(applyDetent(2000, detents)).toBe(2000);
	});

	it('nearest detent wins when windows overlap', () => {
		const close = [100, 105];
		expect(applyDetent(102, close, 4)).toBe(100); // dist 2 vs 3
		expect(applyDetent(103, close, 4)).toBe(105); // dist 3 vs 2
	});

	it('a position sitting exactly on a detent stays put', () => {
		expect(applyDetent(5000, detents)).toBe(5000);
	});

	it('empty detent list is a no-op', () => {
		expect(applyDetent(1234, [])).toBe(1234);
	});

	it('the published detent value list is sorted and in slider range semantics', () => {
		// Guards accidental edits: 1 sat first, 21M last, strictly increasing.
		const values = [...DETENT_BTC_VALUES];
		expect(values[0]).toBe(0.00000001);
		expect(values[values.length - 1]).toBe(21_000_000);
		for (let i = 1; i < values.length; i++) {
			expect(values[i]).toBeGreaterThan(values[i - 1]);
		}
	});
});
