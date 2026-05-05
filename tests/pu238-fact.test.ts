import { describe, it, expect } from 'vitest';
import { pu238Fact } from '../src/lib/components/Pu238FactCard.helpers.js';

describe('pu238Fact', () => {
	it('returns "About a grain" below 1 g', () => {
		expect(pu238Fact(0)).toBe('About a grain');
		expect(pu238Fact(0.5)).toBe('About a grain');
		expect(pu238Fact(0.999)).toBe('About a grain');
	});

	it('returns RTG-pellet copy at exactly 1 g', () => {
		expect(pu238Fact(1)).toBe('About a heat-source pellet for a small RTG');
	});

	it('returns CubeSat copy at 10 g', () => {
		expect(pu238Fact(10)).toBe(
			'Roughly the canonical fuel for a CubeSat-scale deep-space mission'
		);
	});

	it('returns GPHS-module copy at 50 g', () => {
		expect(pu238Fact(50)).toContain('GPHS fuel module');
	});

	it('returns several-GPHS-modules copy at 200 g', () => {
		expect(pu238Fact(200)).toBe('Several GPHS modules — enough for a small RTG');
	});

	it('returns Voyager copy at 1000 g (≈ 1 kg)', () => {
		expect(pu238Fact(1000)).toContain('Voyager 1');
	});

	it('returns critical-mass copy at 5000 g', () => {
		expect(pu238Fact(5000)).toContain('critical mass');
	});

	it('returns multi-mission copy at 10000 g', () => {
		expect(pu238Fact(10000)).toContain('Multiple flagship');
	});

	it('returns "more than all Pu-238 ever produced" at 50000+ g', () => {
		expect(pu238Fact(50000)).toContain('all Pu-238 ever produced');
		expect(pu238Fact(100000)).toContain('all Pu-238 ever produced');
	});

	it('boundary check: 9.999 g uses the under-10 string, 10 g switches', () => {
		expect(pu238Fact(9.999)).toBe('About a heat-source pellet for a small RTG');
		expect(pu238Fact(10)).not.toBe('About a heat-source pellet for a small RTG');
	});
});
