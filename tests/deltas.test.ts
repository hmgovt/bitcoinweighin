/**
 * deltas.test.ts — behavioural tests for the shared src/lib/deltas.ts
 * module (day-over-day weight-delta reframe: homepage Daily Delta line +
 * X bot). Includes a caption-parity fixture: the exact strings the OLD
 * scripts/bot/deltas.ts produced (captured by running it directly against
 * static/prices.json BEFORE the 2026-07-09 refactor into src/lib), which
 * the new shared module must still reproduce byte-for-byte for the same
 * inputs.
 */
import { describe, it, expect } from 'vitest';
import {
	gramsPerBtc,
	nearestObject,
	pickVerb,
	formatGrams,
	computeDelta,
	type DeltaObjectsFile,
	type Rung,
} from '../src/lib/deltas.js';
import deltaObjects from '../src/lib/delta-objects.json';
import prices from '../static/prices.json';

const objs = deltaObjects as unknown as DeltaObjectsFile;

describe('gramsPerBtc', () => {
	it('fixed pricing (cocaine): grams = btc price / usdPerGram', () => {
		const day = { btc: 60000 };
		expect(gramsPerBtc(objs, 'cocaine', day)).toBeCloseTo(60000 / 30, 6);
	});

	it('fixed pricing (pu238): grams = btc price / usdPerGram', () => {
		const day = { btc: 60000 };
		expect(gramsPerBtc(objs, 'pu238', day)).toBeCloseTo(60000 / 5000, 6);
	});

	it('live pricing per troy oz (gold): grams = btc price / (xau / troyOzGrams)', () => {
		const day = { btc: 60000, xau: 2000 };
		const usdPerGram = 2000 / objs.troyOzGrams;
		expect(gramsPerBtc(objs, 'gold', day)).toBeCloseTo(60000 / usdPerGram, 6);
	});
});

describe('nearestObject', () => {
	const ladder: Rung[] = [
		{ g: 5, name: 'five' },
		{ g: 10, name: 'ten' },
		{ g: 100, name: 'hundred' },
	];

	it('picks the exact match', () => {
		expect(nearestObject(ladder, 10).name).toBe('ten');
	});

	it('picks the nearest rung below', () => {
		expect(nearestObject(ladder, 6).name).toBe('five');
	});

	it('picks the nearest rung above', () => {
		expect(nearestObject(ladder, 8).name).toBe('ten');
	});

	it('clamps to the smallest rung below the whole ladder', () => {
		expect(nearestObject(ladder, 0).name).toBe('five');
	});

	it('clamps to the largest rung above the whole ladder', () => {
		expect(nearestObject(ladder, 10000).name).toBe('hundred');
	});
});

describe('pickVerb', () => {
	it('is deterministic for the same seed', () => {
		const pool = ['a', 'b', 'c', 'd'];
		expect(pickVerb(pool, '2026-07-09gold')).toBe(pickVerb(pool, '2026-07-09gold'));
	});

	it('always returns a member of the pool', () => {
		const pool = ['put on', 'gained', 'added'];
		for (const seed of ['x', 'y', 'z', '2026-01-01silver']) {
			expect(pool).toContain(pickVerb(pool, seed));
		}
	});
});

describe('formatGrams', () => {
	it('formats sub-gram amounts to 2 decimals', () => {
		expect(formatGrams(0.44)).toBe('0.44 g');
	});
	it('formats single-digit gram amounts to 1 decimal', () => {
		expect(formatGrams(8)).toBe('8.0 g');
	});
	it('formats double-digit+ gram amounts rounded', () => {
		expect(formatGrams(46)).toBe('46 g');
	});
	it('formats kilo-scale amounts with 1 decimal under 10 kg', () => {
		expect(formatGrams(3474.6)).toBe('3.5 kg');
	});
	it('formats large kilo-scale amounts with 0 decimals at/above 10 kg', () => {
		expect(formatGrams(15000)).toBe('15 kg');
	});
});

describe('computeDelta — steady threshold', () => {
	// Threshold is 15% of the nearest rung's weight. gold's smallest rung is
	// 5 g -> 0.75 g cutoff.
	const goldLadder = objs.ladders.gold;
	const smallest = goldLadder.reduce((a, b) => (a.g < b.g ? a : b));
	const cutoff = smallest.g * 0.15;

	it('calls a move just under the cutoff "steady"', () => {
		const prev = { date: '2026-01-01', day: { btc: 100000, xau: 2000 } };
		// Construct a curr day whose gramsPerBtc delta is just under cutoff.
		const before = gramsPerBtc(objs, 'gold', prev.day);
		const targetAfter = before + cutoff * 0.9;
		// xau_after solves gramsPerBtc(gold, {btc:100000, xau: xau_after}) = targetAfter
		const usdPerGramAfter = 100000 / targetAfter;
		const xauAfter = usdPerGramAfter * objs.troyOzGrams;
		const curr = { date: '2026-01-02', day: { btc: 100000, xau: xauAfter } };
		const r = computeDelta(objs, 'gold', prev, curr);
		expect(r.direction).toBe('steady');
		expect(r.caption).toContain('held steady');
	});

	it('calls a move just over the cutoff a gain or loss', () => {
		const prev = { date: '2026-01-01', day: { btc: 100000, xau: 2000 } };
		const before = gramsPerBtc(objs, 'gold', prev.day);
		const targetAfter = before + cutoff * 1.5;
		const usdPerGramAfter = 100000 / targetAfter;
		const xauAfter = usdPerGramAfter * objs.troyOzGrams;
		const curr = { date: '2026-01-02', day: { btc: 100000, xau: xauAfter } };
		const r = computeDelta(objs, 'gold', prev, curr);
		expect(r.direction).toBe('gain');
		expect(r.caption).not.toContain('held steady');
	});
});

describe('computeDelta — sincePhrase override (date-scrub mode)', () => {
	it('defaults to "yesterday\'s close"', () => {
		const prev = { date: '2020-03-11', day: prices['2020-03-11'] };
		const curr = { date: '2020-03-12', day: prices['2020-03-12'] };
		const r = computeDelta(objs, 'gold', prev, curr);
		expect(r.caption).toContain("since yesterday's close");
	});

	it('uses the supplied sincePhrase instead', () => {
		const prev = { date: '2020-03-11', day: prices['2020-03-11'] };
		const curr = { date: '2020-03-12', day: prices['2020-03-12'] };
		const r = computeDelta(objs, 'gold', prev, curr, { sincePhrase: 'the previous close' });
		expect(r.caption).toContain('since the previous close');
		expect(r.caption).not.toContain("yesterday's close");
	});

	it('applies the override to the steady-day caption too', () => {
		const prev = { date: '2018-06-02', day: prices['2018-06-02'] };
		const curr = { date: '2018-06-03', day: prices['2018-06-03'] };
		const r = computeDelta(objs, 'cocaine', prev, curr, { sincePhrase: 'the previous close' });
		expect(r.direction).toBe('steady');
		expect(r.caption).toBe(
			'In cocaine, 1 BTC held steady overnight — within a rounding error of the previous close.'
		);
	});
});

describe('computeDelta — caption parity with the pre-refactor bot output', () => {
	// Captured with `npx tsx scripts/bot/deltas.ts` (old, pre-refactor,
	// Node-only version reading scripts/bot/objects.json) run against these
	// exact date pairs before src/lib/deltas.ts existed. static/prices.json
	// is append-only for historical dates, so these figures are stable.
	const fixture: Array<{
		commodity: 'gold' | 'silver' | 'pu238' | 'cocaine';
		prev: string;
		curr: string;
		caption: string;
	}> = [
		// 2020-03-11 -> 2020-03-12: COVID-crash day, all four "loss".
		{
			commodity: 'gold',
			prev: '2020-03-11',
			curr: '2020-03-12',
			caption: "In gold, 1 BTC gave back a golf ball since yesterday's close (−38 g).",
		},
		{
			commodity: 'silver',
			prev: '2020-03-11',
			curr: '2020-03-12',
			caption:
				"In silver, 1 BTC grew lighter by a newborn baby since yesterday's close (−3.5 kg).",
		},
		{
			commodity: 'pu238',
			prev: '2020-03-11',
			curr: '2020-03-12',
			caption:
				"In plutonium-238, 1 BTC grew lighter by a Tic Tac since yesterday's close (−0.44 g).",
		},
		{
			commodity: 'cocaine',
			prev: '2020-03-11',
			curr: '2020-03-12',
			caption: "In cocaine, 1 BTC shed a chicken egg since yesterday's close (−74 g).",
		},
		// 2017-12-16 -> 2017-12-17: bull-run day, all four "gain".
		{
			commodity: 'gold',
			prev: '2017-12-16',
			curr: '2017-12-17',
			caption: "In gold, 1 BTC grew heavier by a poker chip since yesterday's close (+8.0 g).",
		},
		{
			commodity: 'silver',
			prev: '2017-12-16',
			curr: '2017-12-17',
			caption: "In silver, 1 BTC picked up a basketball since yesterday's close (+612 g).",
		},
		{
			commodity: 'pu238',
			prev: '2017-12-16',
			curr: '2017-12-17',
			caption:
				"In plutonium-238, 1 BTC gained a honeybee since yesterday's close (+0.07 g).",
		},
		{
			commodity: 'cocaine',
			prev: '2017-12-16',
			curr: '2017-12-17',
			caption:
				"In cocaine, 1 BTC added a slice of bread since yesterday's close (+12 g).",
		},
		// 2018-06-02 -> 2018-06-03: mixed — cocaine falls under the steady cutoff.
		{
			commodity: 'gold',
			prev: '2018-06-02',
			curr: '2018-06-03',
			caption: "In gold, 1 BTC put on a US nickel since yesterday's close (+0.83 g).",
		},
		{
			commodity: 'silver',
			prev: '2018-06-02',
			curr: '2018-06-03',
			caption:
				"In silver, 1 BTC picked up a full can of soda since yesterday's close (+55 g).",
		},
		{
			commodity: 'pu238',
			prev: '2018-06-02',
			curr: '2018-06-03',
			caption:
				"In plutonium-238, 1 BTC picked up a grain of rice since yesterday's close (+0.01 g).",
		},
		{
			commodity: 'cocaine',
			prev: '2018-06-02',
			curr: '2018-06-03',
			caption:
				"In cocaine, 1 BTC held steady overnight — within a rounding error of yesterday's close.",
		},
	];

	for (const f of fixture) {
		it(`${f.commodity} ${f.prev} -> ${f.curr}`, () => {
			const prev = { date: f.prev, day: prices[f.prev] };
			const curr = { date: f.curr, day: prices[f.curr] };
			const r = computeDelta(objs, f.commodity, prev, curr);
			expect(r.caption).toBe(f.caption);
		});
	}
});
