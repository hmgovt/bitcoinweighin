import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { scanMilestones, OZT_PER_KG, type PricesFile } from '../scripts/build-milestones.js';
import committedMilestones from '../static/milestones.json';

const ROOT = join(__dirname, '..');

describe('scanMilestones — pure scan logic', () => {
	it('finds the first day each threshold is crossed, in ascending order', () => {
		const prices: PricesFile = {
			'2020-01-01': { btc: 100, xau: 1500, xag: 18 }, // gold ratio 0.067, silver ratio 5.6
			'2020-01-02': { btc: 2000, xau: 1500, xag: 18 }, // gold ratio 1.33 -> crosses 1 ozt
			'2020-01-03': { btc: 16000, xau: 1500, xag: 18 }, // gold ratio 10.67 -> crosses 10 ozt
		};
		const found = scanMilestones(prices);
		const gold = found.filter((m) => m.commodity === 'gold');
		expect(gold.map((m) => m.date)).toEqual(['2020-01-02', '2020-01-03']);
		expect(gold.map((m) => m.label)).toEqual(['1 BTC = 1 ozt of gold', '1 BTC = 10 ozt of gold']);
	});

	it('a threshold never crossed in the data is silently omitted', () => {
		const prices: PricesFile = {
			'2020-01-01': { btc: 1, xau: 1500, xag: 18 },
		};
		expect(scanMilestones(prices)).toEqual([]);
	});

	it('skips days missing either price field (defensive)', () => {
		const prices: PricesFile = {
			'2020-01-01': { btc: 100, xau: 1500 }, // ratio 0.067 ozt — valid day, but doesn't cross
			'2020-01-02': { xau: 1500, xag: 18 }, // btc missing -> skip entirely
			'2020-01-03': { btc: 100000, xag: 18 }, // xau missing -> skip for gold
		};
		// No day ever has BOTH btc and xau above the 1 ozt threshold (day 1 is
		// under it, day 3 is missing xau entirely) -> no gold milestones, and
		// neither the field-missing day nor the below-threshold day crashes
		// the scan.
		const gold = scanMilestones(prices).filter((m) => m.commodity === 'gold');
		expect(gold).toEqual([]);
	});

	it('does not re-report an already-crossed threshold on a later dip', () => {
		const prices: PricesFile = {
			'2020-01-01': { btc: 2000, xau: 1500, xag: 18 }, // crosses 1 ozt gold
			'2020-01-02': { btc: 100, xau: 1500, xag: 18 }, // dips back below 1 ozt
			'2020-01-03': { btc: 2000, xau: 1500, xag: 18 }, // back above 1 ozt again
		};
		const gold = scanMilestones(prices).filter((m) => m.commodity === 'gold');
		expect(gold.length).toBe(1);
		expect(gold[0].date).toBe('2020-01-01');
	});

	it('a single day crossing multiple thresholds records all of them on that date', () => {
		const prices: PricesFile = {
			'2020-01-01': { btc: 1_000_000, xau: 1500, xag: 18 }, // gold ratio ~667 ozt
		};
		const gold = scanMilestones(prices).filter((m) => m.commodity === 'gold');
		expect(gold.every((m) => m.date === '2020-01-01')).toBe(true);
		expect(gold.map((m) => m.ozt)).toEqual([1, 10, OZT_PER_KG, 100]);
	});
});

describe('static/milestones.json has no regen drift', () => {
	it('scanning the committed static/prices.json reproduces the committed static/milestones.json exactly', () => {
		const prices = JSON.parse(
			readFileSync(join(ROOT, 'static', 'prices.json'), 'utf-8')
		) as PricesFile;
		const fresh = scanMilestones(prices);
		expect(fresh).toEqual(committedMilestones);
	});
});
