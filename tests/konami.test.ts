import { describe, it, expect } from 'vitest';
import { createKonamiTracker, KONAMI_SEQUENCE } from '../src/lib/konami.js';

describe('createKonamiTracker', () => {
	it('matches the full sequence', () => {
		const t = createKonamiTracker();
		const results = KONAMI_SEQUENCE.map((k) => t.feed(k));
		expect(results.slice(0, -1).every((r) => r === 'progress')).toBe(true);
		expect(results[results.length - 1]).toBe('matched');
	});

	it('is case-insensitive for the trailing b/a', () => {
		const t = createKonamiTracker();
		const seq = [...KONAMI_SEQUENCE.slice(0, -2), 'B', 'A'];
		const results = seq.map((k) => t.feed(k));
		expect(results[results.length - 1]).toBe('matched');
	});

	it('progress increments monotonically through a correct sequence', () => {
		const t = createKonamiTracker();
		KONAMI_SEQUENCE.slice(0, -1).forEach((k, i) => {
			t.feed(k);
			expect(t.progress).toBe(i + 1);
		});
	});

	it('resets on a wrong key', () => {
		const t = createKonamiTracker();
		t.feed('ArrowUp');
		t.feed('ArrowUp');
		expect(t.feed('ArrowRight')).toBe('reset'); // expected ArrowDown
		expect(t.progress).toBe(0);
	});

	it('a mismatching key that happens to be the sequence start counts as progress, not a full reset', () => {
		const t = createKonamiTracker();
		t.feed('ArrowUp');
		t.feed('ArrowUp');
		t.feed('ArrowDown'); // now expects ArrowDown again
		expect(t.feed('ArrowUp')).toBe('progress'); // wrong, but restarts at index 1
		expect(t.progress).toBe(1);
	});

	it('unrelated keys (letters not in the sequence) fully reset', () => {
		const t = createKonamiTracker();
		t.feed('ArrowUp');
		t.feed('ArrowUp');
		expect(t.feed('q')).toBe('reset');
		expect(t.progress).toBe(0);
	});

	it('rearms immediately after a match — the sequence can be repeated', () => {
		const t = createKonamiTracker();
		KONAMI_SEQUENCE.forEach((k) => t.feed(k));
		const results2 = KONAMI_SEQUENCE.map((k) => t.feed(k));
		expect(results2[results2.length - 1]).toBe('matched');
	});

	it('reset() manually returns the tracker to the start', () => {
		const t = createKonamiTracker();
		t.feed('ArrowUp');
		t.feed('ArrowUp');
		t.reset();
		expect(t.progress).toBe(0);
		expect(t.feed('ArrowDown')).toBe('reset'); // back to expecting ArrowUp
	});

	it('does not match a near-miss sequence of the same length', () => {
		const t = createKonamiTracker();
		const nearMiss = [...KONAMI_SEQUENCE];
		nearMiss[nearMiss.length - 1] = 'x';
		const results = nearMiss.map((k) => t.feed(k));
		expect(results.includes('matched')).toBe(false);
	});

	it('the published sequence is the classic 10-key Konami code', () => {
		expect(KONAMI_SEQUENCE).toEqual([
			'ArrowUp',
			'ArrowUp',
			'ArrowDown',
			'ArrowDown',
			'ArrowLeft',
			'ArrowRight',
			'ArrowLeft',
			'ArrowRight',
			'b',
			'a',
		]);
	});
});
