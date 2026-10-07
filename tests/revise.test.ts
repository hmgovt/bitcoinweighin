import { describe, it, expect } from 'vitest';
import { latestOnOrBefore, reviseRows, setFilled, type NdjsonRow } from '../scripts/revise.js';

const rows = (dates: string[], brent: number): NdjsonRow[] => dates.map((date) => ({ date, btc: 1, brent }));

describe('latestOnOrBefore', () => {
	const data = new Map([
		['2026-09-11', 110],
		['2026-09-14', 125],
	]);
	it('takes the exact date', () => expect(latestOnOrBefore(data, '2026-09-14')).toEqual({ value: 125, matchedDate: '2026-09-14' }));
	it('carries back over a weekend', () => expect(latestOnOrBefore(data, '2026-09-13')).toEqual({ value: 110, matchedDate: '2026-09-11' }));
	it('has nothing before the first bar', () => expect(latestOnOrBefore(data, '2026-09-10')).toEqual({}));
});

describe('setFilled', () => {
	it('adds once, keeps other fields, and drops the key when empty', () => {
		const row: NdjsonRow = { date: '2026-10-01', forward_filled: ['xag'] };
		setFilled(row, 'brent', true);
		setFilled(row, 'brent', true);
		expect(row.forward_filled).toEqual(['xag', 'brent']);
		setFilled(row, 'xag', false);
		setFilled(row, 'brent', false);
		expect('forward_filled' in row).toBe(false);
	});
});

describe('reviseRows', () => {
	// The staircase: every day written while FRED's latest close was 10 Sep's.
	const fred = new Map([
		['2026-09-10', 109.51],
		['2026-09-11', 112.4],
		['2026-09-14', 125.0],
		['2026-09-15', 130.8],
	]);

	it('re-picks each day from the published series, weekends taking Friday', () => {
		const r = rows(['2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15'], 109.51);
		const changes = reviseRows(r, 'brent', fred, '2026-09-11');
		expect(r.map((x) => x.brent)).toEqual([112.4, 112.4, 112.4, 125.0, 130.8]);
		expect(changes).toHaveLength(5);
		expect(changes[4]).toEqual({ date: '2026-09-15', field: 'brent', from: 109.51, to: 130.8 });
		expect(r.every((x) => !x.forward_filled)).toBe(true);
	});

	it('flags days FRED has not reached yet, and clears them once it does', () => {
		const r = rows(['2026-09-15', '2026-09-16', '2026-09-17'], 109.51);
		reviseRows(r, 'brent', fred, '2026-09-15');
		expect(r.map((x) => [x.brent, x.forward_filled])).toEqual([
			[130.8, undefined],
			[130.8, ['brent']],
			[130.8, ['brent']],
		]);
		const later = new Map([...fred, ['2026-09-16', 128.1], ['2026-09-17', 126.5]]);
		const changes = reviseRows(r, 'brent', later, '2026-09-15');
		expect(r.map((x) => [x.brent, x.forward_filled])).toEqual([
			[130.8, undefined],
			[128.1, undefined],
			[126.5, undefined],
		]);
		expect(changes.map((c) => c.date)).toEqual(['2026-09-16', '2026-09-17']);
	});

	it('leaves rows before the window, and everything when the fetch is empty', () => {
		const r = rows(['2026-09-10', '2026-09-15'], 1);
		reviseRows(r, 'brent', fred, '2026-09-15');
		expect(r.map((x) => x.brent)).toEqual([1, 130.8]);
		expect(reviseRows(r, 'brent', new Map(), '2026-09-10')).toEqual([]);
		expect(r.map((x) => x.brent)).toEqual([1, 130.8]);
	});

	it('reports nothing when the rows already match', () => {
		const r = rows(['2026-09-14'], 125.0);
		expect(reviseRows(r, 'brent', fred, '2026-09-01')).toEqual([]);
	});
});
