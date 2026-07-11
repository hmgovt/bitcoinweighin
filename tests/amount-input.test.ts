import { describe, it, expect } from 'vitest';
import { parseAmountInput, BTC_MIN, BTC_MAX } from '../src/lib/amount-input.js';

const PRICE = 100_000; // $100k/BTC — clean mental arithmetic in expectations

describe('parseAmountInput — plain BTC', () => {
	it('parses plain decimals and integers', () => {
		expect(parseAmountInput('0.5', PRICE)).toBe(0.5);
		expect(parseAmountInput('1.23', PRICE)).toBe(1.23);
		expect(parseAmountInput('21000000', PRICE)).toBe(21_000_000);
	});

	it('tolerates commas, underscores, and whitespace', () => {
		expect(parseAmountInput('21,000,000', PRICE)).toBe(21_000_000);
		expect(parseAmountInput('1_000', PRICE)).toBe(1000);
		expect(parseAmountInput('  0.5  ', PRICE)).toBe(0.5);
	});

	it('works without a price (BTC needs no conversion)', () => {
		expect(parseAmountInput('2', null)).toBe(2);
	});

	it('clamps to the slider range', () => {
		expect(parseAmountInput('0.000000001', PRICE)).toBe(BTC_MIN); // below 1 sat
		expect(parseAmountInput('99999999', PRICE)).toBe(BTC_MAX);
	});
});

describe('parseAmountInput — sats', () => {
	it('parses sat and sats suffixes', () => {
		expect(parseAmountInput('1 sat', PRICE)).toBe(0.00000001);
		expect(parseAmountInput('50000 sats', PRICE)).toBe(0.0005);
		expect(parseAmountInput('50000sats', PRICE)).toBe(0.0005);
	});

	it('accepts k/M magnitude suffixes on sats', () => {
		expect(parseAmountInput('10k sats', PRICE)).toBe(0.0001);
		expect(parseAmountInput('1.5M sats', PRICE)).toBe(0.015);
	});

	it('is case-insensitive', () => {
		expect(parseAmountInput('10K SATS', PRICE)).toBe(0.0001);
	});
});

describe('parseAmountInput — dollars', () => {
	it('converts through the day price', () => {
		expect(parseAmountInput('$25,000', PRICE)).toBe(0.25);
		expect(parseAmountInput('$100k', PRICE)).toBe(1);
		expect(parseAmountInput('$1M', PRICE)).toBe(10);
		expect(parseAmountInput('$1.5B', PRICE)).toBe(15_000);
	});

	it('tolerates a space after the dollar sign', () => {
		expect(parseAmountInput('$ 50,000', PRICE)).toBe(0.5);
	});

	it('rejects dollars when no valid price is available', () => {
		expect(parseAmountInput('$100', null)).toBeNull();
		expect(parseAmountInput('$100', 0)).toBeNull();
		expect(parseAmountInput('$100', NaN)).toBeNull();
	});

	it('rejects the $-with-sats combination', () => {
		expect(parseAmountInput('$100 sats', PRICE)).toBeNull();
	});
});

describe('parseAmountInput — rejection', () => {
	it.each([
		'',
		'   ',
		'abc',
		'1.2.3',
		'-5',
		'0',
		'$',
		'sats',
		'1q',
		'--1',
		'1e5', // scientific notation deliberately outside the grammar
		'∞',
	])('rejects %j', (raw) => {
		expect(parseAmountInput(raw, PRICE)).toBeNull();
	});

	it('rejects non-finite results defensively', () => {
		expect(parseAmountInput('$0.00000001', 1e-300)).not.toBe(Infinity);
	});
});
