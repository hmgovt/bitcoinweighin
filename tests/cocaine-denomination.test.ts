import { describe, it, expect } from 'vitest';
import { denomination } from '../src/lib/components/CocaineDenominationRow.helpers.js';

describe('denomination', () => {
	it('returns empty string for non-positive mass', () => {
		expect(denomination(0)).toBe('');
		expect(denomination(-1)).toBe('');
	});

	it('returns lines copy for sub-gram masses', () => {
		// 30 mg = 0.000030 kg → exactly 1 line
		expect(denomination(0.00003)).toBe('≈ 1 lines (30 mg each)');
		// 0.3 g = 0.0003 kg → 10 lines
		expect(denomination(0.0003)).toBe('≈ 10 lines (30 mg each)');
	});

	it('switches to retail bags at exactly 1 g', () => {
		expect(denomination(0.001)).toBe('≈ 1 retail bags (~1 g each)');
	});

	it('returns retail-bag copy mid-gram-range', () => {
		// 500 g = 0.5 kg → 500 bags
		expect(denomination(0.5)).toBe('≈ 500 retail bags (~1 g each)');
	});

	it('switches to 1-kg bricks at exactly 1 kg', () => {
		expect(denomination(1)).toBe('≈ 1 1-kg bricks');
	});

	it('returns brick copy mid-kg-range', () => {
		expect(denomination(500)).toBe('≈ 500 1-kg bricks');
	});

	it('switches to pallets at exactly 1000 kg (1 tonne)', () => {
		expect(denomination(1000)).toBe('≈ 1 pallets · ≈ 1,000 bricks');
	});

	it('formats large pallet counts with thousands separators', () => {
		expect(denomination(50000)).toBe('≈ 50 pallets · ≈ 50,000 bricks');
	});

	it('switches to global-production framing at exactly 100,000 kg (100 tonnes)', () => {
		// yearsOfGlobal = 100000 / 2_250_000 ≈ 0.0444 → 4%
		expect(denomination(100000)).toBe('≈ 4% of one year of global production');
	});

	it('returns "1.0 years of global production" at the UNODC 2024 annual figure', () => {
		expect(denomination(2_250_000)).toBe('≈ 1.0 years of global production');
	});

	it('returns "10.0 years of global production" at 22,500,000 kg', () => {
		expect(denomination(22_500_000)).toBe('≈ 10.0 years of global production');
	});

	it('boundary: 999 g uses retail-bag copy, 1000 g uses brick copy', () => {
		expect(denomination(0.999)).toBe('≈ 999 retail bags (~1 g each)');
		expect(denomination(1)).toBe('≈ 1 1-kg bricks');
	});

	it('boundary: 99,999 kg uses pallets, 100,000 kg uses global-production', () => {
		expect(denomination(99999)).toBe('≈ 100 pallets · ≈ 99,999 bricks');
		expect(denomination(100000)).toBe('≈ 4% of one year of global production');
	});
});
