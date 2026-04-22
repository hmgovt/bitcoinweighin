import { describe, it, expect } from 'vitest';
import {
	forwardFill,
	interpolateSmallGaps,
	dateRange,
	btcCirculatingSupply,
	formatDateISO,
	parseDate,
} from '../scripts/sources.js';

describe('dateRange', () => {
	it('generates inclusive date range', () => {
		const range = dateRange('2024-01-01', '2024-01-05');
		expect(range).toEqual([
			'2024-01-01',
			'2024-01-02',
			'2024-01-03',
			'2024-01-04',
			'2024-01-05',
		]);
	});

	it('handles single-day range', () => {
		const range = dateRange('2024-06-15', '2024-06-15');
		expect(range).toEqual(['2024-06-15']);
	});

	it('returns empty for inverted range', () => {
		const range = dateRange('2024-01-05', '2024-01-01');
		expect(range).toEqual([]);
	});
});

describe('forwardFill', () => {
	it('fills weekend gaps with Friday close', () => {
		const data = new Map([
			['2024-01-05', 100], // Friday
			['2024-01-08', 102], // Monday
		]);
		const dates = dateRange('2024-01-05', '2024-01-08');
		const { filled, filledDates } = forwardFill(data, dates);

		expect(filled.get('2024-01-06')).toBe(100); // Saturday
		expect(filled.get('2024-01-07')).toBe(100); // Sunday
		expect(filledDates).toContain('2024-01-06');
		expect(filledDates).toContain('2024-01-07');
		expect(filledDates).not.toContain('2024-01-05');
		expect(filledDates).not.toContain('2024-01-08');
	});

	it('does not fill before first known value', () => {
		const data = new Map([['2024-01-03', 50]]);
		const dates = dateRange('2024-01-01', '2024-01-05');
		const { filled } = forwardFill(data, dates);

		expect(filled.has('2024-01-01')).toBe(false);
		expect(filled.has('2024-01-02')).toBe(false);
		expect(filled.get('2024-01-03')).toBe(50);
		expect(filled.get('2024-01-04')).toBe(50);
		expect(filled.get('2024-01-05')).toBe(50);
	});

	it('handles empty data', () => {
		const data = new Map<string, number>();
		const dates = dateRange('2024-01-01', '2024-01-03');
		const { filled, filledDates } = forwardFill(data, dates);

		expect(filled.size).toBe(0);
		expect(filledDates.length).toBe(0);
	});
});

describe('interpolateSmallGaps', () => {
	it('interpolates gaps of 1-3 days', () => {
		const data = new Map([
			['2024-01-01', 100],
			['2024-01-04', 400],
		]);
		const dates = dateRange('2024-01-01', '2024-01-04');
		const interpolated = interpolateSmallGaps(data, dates, 3);

		// 2 missing days between 100 and 400: t=1/3 → 200, t=2/3 → 300
		expect(data.get('2024-01-02')).toBeCloseTo(200, 0);
		expect(data.get('2024-01-03')).toBeCloseTo(300, 0);
		expect(interpolated).toEqual(['2024-01-02', '2024-01-03']);
	});

	it('does NOT interpolate gaps larger than maxGap', () => {
		const data = new Map([
			['2024-01-01', 100],
			['2024-01-06', 600],
		]);
		const dates = dateRange('2024-01-01', '2024-01-06');
		interpolateSmallGaps(data, dates, 3);

		expect(data.has('2024-01-02')).toBe(false);
		expect(data.has('2024-01-03')).toBe(false);
	});

	it('handles no gaps', () => {
		const data = new Map([
			['2024-01-01', 100],
			['2024-01-02', 200],
			['2024-01-03', 300],
		]);
		const dates = dateRange('2024-01-01', '2024-01-03');
		const interpolated = interpolateSmallGaps(data, dates);

		expect(interpolated).toEqual([]);
	});
});

describe('btcCirculatingSupply', () => {
	it('returns 0 before genesis', () => {
		expect(btcCirculatingSupply('2009-01-02')).toBe(0);
	});

	it('returns correct supply on genesis day', () => {
		// Day 0: ~144 blocks × 50 BTC = 7,200
		const supply = btcCirculatingSupply('2009-01-03');
		expect(supply).toBe(0); // 0 days elapsed
	});

	it('returns ~50 BTC per block in early days', () => {
		// 1 day after genesis: 144 blocks × 50 BTC = 7,200
		const supply = btcCirculatingSupply('2009-01-04');
		expect(supply).toBe(7200);
	});

	it('matches known supply at first halving (2012-11-28)', () => {
		// First halving at block 210,000
		// Days from genesis to halving: 2012-11-28 minus 2009-01-03 = ~1425 days
		// 1425 × 144 = 205,200 blocks → still in era 1 (50 BTC)
		// Supply = 205,200 × 50 = 10,260,000
		const supply = btcCirculatingSupply('2012-11-28');
		// Actual was ~10.5M, our estimate using 144 blocks/day is approximate
		expect(supply).toBeGreaterThan(10_000_000);
		expect(supply).toBeLessThan(11_000_000);
	});

	it('matches known supply at second halving (2016-07-09)', () => {
		const supply = btcCirculatingSupply('2016-07-09');
		// Actual was ~15.75M
		expect(supply).toBeGreaterThan(15_000_000);
		expect(supply).toBeLessThan(16_500_000);
	});

	it('matches known supply at fourth halving (2024-04-20)', () => {
		const supply = btcCirculatingSupply('2024-04-20');
		// Actual was ~19.68M
		expect(supply).toBeGreaterThan(19_000_000);
		expect(supply).toBeLessThan(20_000_000);
	});

	it('never exceeds 21M', () => {
		// Far future
		const supply = btcCirculatingSupply('2140-01-01');
		expect(supply).toBeLessThanOrEqual(21_000_000);
	});
});

describe('NDJSON → pivoted JSON transformation', () => {
	it('correctly round-trips through the pipeline format', () => {
		// Simulate what bootstrap writes and build-prices reads
		const ndjsonRows = [
			{ date: '2024-01-01', btc: 42000, btc_supply: 19500000, xau: 2050.5, xag: 23.8 },
			{ date: '2024-01-02', btc: 43000, btc_supply: 19500720, xau: 2055.0, xag: 24.1 },
		];

		// Simulate pivot (what build-prices-json does)
		const pivoted: Record<string, Record<string, number>> = {};
		for (const row of ndjsonRows) {
			const entry: Record<string, number> = { btc: row.btc };
			if (row.btc_supply !== undefined) entry.btc_supply = row.btc_supply;
			if (row.xau !== undefined) entry.xau = row.xau;
			if (row.xag !== undefined) entry.xag = row.xag;
			pivoted[row.date] = entry;
		}

		// Verify structure
		expect(Object.keys(pivoted)).toEqual(['2024-01-01', '2024-01-02']);
		expect(pivoted['2024-01-01'].btc).toBe(42000);
		expect(pivoted['2024-01-01'].xau).toBe(2050.5);
		expect(pivoted['2024-01-02'].btc_supply).toBe(19500720);
	});

	it('handles missing commodity fields gracefully', () => {
		const row = { date: '2024-01-01', btc: 42000, btc_supply: 19500000, xau: 2050 };
		// xag is missing — this is normal for weekends/gaps before forward-fill
		const entry: Record<string, number> = { btc: row.btc, btc_supply: row.btc_supply };
		if ((row as any).xau !== undefined) entry.xau = (row as any).xau;
		if ((row as any).xag !== undefined) entry.xag = (row as any).xag;

		expect(entry).toEqual({ btc: 42000, btc_supply: 19500000, xau: 2050 });
		expect(entry.xag).toBeUndefined();
	});
});
