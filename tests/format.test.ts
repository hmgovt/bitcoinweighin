import { describe, it, expect } from 'vitest';
import { formatMultiple, formatTonnes, formatImpossibilityLine } from '../src/lib/format.js';

describe('formatMultiple', () => {
	it('formats non-positive input as "0×"', () => {
		expect(formatMultiple(0)).toBe('0×');
		expect(formatMultiple(-4)).toBe('0×');
	});

	it('formats a low multiple with one decimal place', () => {
		expect(formatMultiple(4.7)).toBe('4.7×');
	});

	it('formats a multiple just above 1 with a decimal', () => {
		expect(formatMultiple(1.0001)).toBe('1×');
	});

	it('formats a large multiple as a rounded, locale-grouped whole number', () => {
		expect(formatMultiple(1200)).toBe('1,200×');
		expect(formatMultiple(1_001_100)).toBe('1,001,100×');
	});
});

describe('formatTonnes', () => {
	it('formats non-positive input as "0 t"', () => {
		expect(formatTonnes(0)).toBe('0 t');
		expect(formatTonnes(-1)).toBe('0 t');
	});

	it('formats the all-gold-mined figure', () => {
		expect(formatTonnes(213_000_000)).toBe('213,000 t');
	});

	it('formats the all-silver-mined figure', () => {
		expect(formatTonnes(1_740_000_000)).toBe('1,740,000 t');
	});

	it('formats the cocaine annual-production figure', () => {
		expect(formatTonnes(2_250_000)).toBe('2,250 t');
	});
});

describe('formatImpossibilityLine', () => {
	it('constructs the gold-style construction with the computed multiple', () => {
		const line = formatImpossibilityLine({
			subject: 'gold',
			verb: 'mined',
			referenceLabel: 'All gold ever',
			referenceKg: 213_000_000,
			multiple: 4.7,
		});
		expect(line.headline).toBe('This much gold has never been mined.');
		expect(line.blurb).toBe('All gold ever: ~213,000 t — you are holding 4.7× that.');
	});

	it('constructs the cocaine-style construction with a different verb and label', () => {
		const line = formatImpossibilityLine({
			subject: 'cocaine',
			verb: 'produced in a year',
			referenceLabel: 'Global annual production',
			referenceKg: 2_250_000,
			multiple: 2,
		});
		expect(line.headline).toBe('This much cocaine has never been produced in a year.');
		expect(line.blurb).toBe('Global annual production: ~2,250 t — you are holding 2× that.');
	});
});
