import { describe, it, expect } from 'vitest';
import {
	pu238Fact,
	pu238DecayHeatLine,
	pu238ProductionLine,
	PU238_OXIDE_W_PER_GRAM,
	PU238_ANNUAL_PRODUCTION_G,
} from '../src/lib/components/Pu238FactCard.helpers.js';

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

describe('pu238DecayHeatLine', () => {
	it('returns null at zero or negative mass', () => {
		expect(pu238DecayHeatLine(0)).toBeNull();
		expect(pu238DecayHeatLine(-5)).toBeNull();
	});

	it('computes watts from oxide mass using PU238_OXIDE_W_PER_GRAM, not the pure-metal figure', () => {
		const line = pu238DecayHeatLine(100);
		// 100 g × 0.41 W/g = 41 W
		expect(line).toContain(`${Math.round(100 * PU238_OXIDE_W_PER_GRAM)} W`);
		// Sanity: must not match what pure-metal 0.567 W/g would produce (57 W).
		expect(line).not.toContain(`${Math.round(100 * 0.567)} W`);
	});

	it('describes low wattage with a small-appliance comparison', () => {
		expect(pu238DecayHeatLine(1)).toContain('phone charger');
	});

	it('describes mid wattage as "about half a space heater"', () => {
		// 700 g × 0.41 W/g ≈ 287 W — in the "about half a space heater" band
		expect(pu238DecayHeatLine(700)).toContain('about half a space heater');
	});

	it('always frames the heat as running for decades', () => {
		expect(pu238DecayHeatLine(5000)).toContain('running for decades');
	});

	it('switches to utility-scale comparisons and kW/MW units at extreme mass', () => {
		// 1 t of oxide → 410 kW: street-scale comparison, kW units.
		const street = pu238DecayHeatLine(1_000_000);
		expect(street).toContain('410 kW');
		expect(street).toContain('an entire street');
		// 21M BTC territory: ~310 t oxide → ~127 MW. MW units, power-station
		// comparison, and never the raw "127,000,000 W" figure.
		const monolith = pu238DecayHeatLine(310_000_000);
		expect(monolith).toContain('127 MW');
		expect(monolith).toContain('a small power station');
		expect(monolith).not.toContain('127,100,000');
	});

	it('never doubles the word "running" (every rung must precede the fixed tail cleanly)', () => {
		// Sweep one mass per ladder band, incl. both utility-scale rungs.
		for (const g of [1, 50, 700, 4000, 20_000, 1_000_000, 310_000_000]) {
			const line = pu238DecayHeatLine(g);
			expect(line).not.toBeNull();
			expect((line!.match(/running/g) ?? []).length).toBe(1);
		}
	});
});

describe('pu238ProductionLine', () => {
	it('returns null at zero or negative mass', () => {
		expect(pu238ProductionLine(0)).toBeNull();
		expect(pu238ProductionLine(-1)).toBeNull();
	});

	it('returns null at exactly one year of global production', () => {
		expect(pu238ProductionLine(PU238_ANNUAL_PRODUCTION_G)).toBeNull();
	});

	it('returns null just below one year of global production', () => {
		expect(pu238ProductionLine(PU238_ANNUAL_PRODUCTION_G - 1)).toBeNull();
	});

	it('fires just above one year of global production', () => {
		const line = pu238ProductionLine(PU238_ANNUAL_PRODUCTION_G + 1);
		expect(line).not.toBeNull();
		expect(line).toContain('1.0 years of global production');
	});

	it('computes the multiple from mass ÷ annual production, never hardcoded', () => {
		const line = pu238ProductionLine(PU238_ANNUAL_PRODUCTION_G * 4.7);
		expect(line).toBe('At this mass you would own roughly 4.7 years of global production.');
	});

	it('rounds and locale-groups large multiples', () => {
		const line = pu238ProductionLine(PU238_ANNUAL_PRODUCTION_G * 1200);
		expect(line).toBe('At this mass you would own roughly 1,200 years of global production.');
	});
});
