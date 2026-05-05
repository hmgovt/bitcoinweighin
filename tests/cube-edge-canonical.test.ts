import { describe, it, expect } from 'vitest';
import { computeCubeEdgeMm } from '../src/lib/volume.js';
import { getCommodity } from '../src/lib/commodities.js';
import {
	selectAnchor,
	type QuantityAnchor,
} from '../src/lib/components/QuantityAnchorCard.helpers.js';
import anchorsData from '../src/lib/quantity-anchors.json';

/**
 * Stage 4 regression baseline. Without Playwright (deferred to Stage 7
 * per DECISIONS 2026-04-19), these numeric assertions stand in for the
 * "10 baseline screenshots" the prompt mentions — they catch density-
 * table regressions and `cbrt` math errors without browser tooling.
 *
 * The prompt's worked numbers ("12.5 cm at 1000 BTC", "23 m at 21M BTC")
 * are illustrative and depend on session-date BTC and gold prices. This
 * file deliberately tests amount-driven inputs (troy oz, kg) rather than
 * BTC-position inputs so the assertions stay stable as prices drift.
 */

const gold = getCommodity('gold')!;
const silver = getCommodity('silver')!;
const goldAnchors = (anchorsData.gold as unknown as QuantityAnchor[]);
const silverAnchors = (anchorsData.silver as unknown as QuantityAnchor[]);

describe('Gold + silver — cube edge math', () => {
	it('gold at 1 troy oz → ~11.72 mm cube edge', () => {
		// 1 troy oz = 31.1035 g; / 19.30 g/cm³ = 1.611 cm³; cbrt = 1.172 cm = 11.72 mm
		expect(computeCubeEdgeMm(1, gold)).toBeCloseTo(11.72, 1);
	});

	it('silver at 1 troy oz → ~14.37 mm cube edge', () => {
		// 1 troy oz = 31.1035 g; / 10.49 g/cm³ = 2.965 cm³; cbrt = 1.437 cm = 14.37 mm
		expect(computeCubeEdgeMm(1, silver)).toBeCloseTo(14.37, 1);
	});

	it('silver/gold edge ratio at equal amount = cbrt(19.30/10.49) ≈ 1.224', () => {
		// Same unitMassGrams (31.1035) → same mass at same amount → ratio is purely density-driven
		const ratio = computeCubeEdgeMm(1, silver) / computeCubeEdgeMm(1, gold);
		expect(ratio).toBeCloseTo(Math.cbrt(19.3 / 10.49), 3);
	});

	it('gold cube scales as cube root of amount (1000× amount → 10× edge)', () => {
		const e1 = computeCubeEdgeMm(1, gold);
		const e1000 = computeCubeEdgeMm(1000, gold);
		expect(e1000 / e1).toBeCloseTo(10, 2);
	});

	it('silver cube scales as cube root of amount (1000× amount → 10× edge)', () => {
		const e1 = computeCubeEdgeMm(1, silver);
		const e1000 = computeCubeEdgeMm(1000, silver);
		expect(e1000 / e1).toBeCloseTo(10, 2);
	});

	it('gold at sub-sat-equivalent (1e-8 troy oz) returns sub-millimetre edge', () => {
		// 1e-8 oz × 31.1035 g/oz = 3.11e-7 g; / 19.3 = 1.61e-8 cm³
		// cbrt(1.61e-8 cm³) ≈ 2.52e-3 cm = 0.0252 mm ≈ 25 µm
		const edge = computeCubeEdgeMm(1e-8, gold);
		expect(edge).toBeGreaterThan(0);
		expect(edge).toBeCloseTo(0.025, 2);
		expect(edge).toBeLessThan(0.1); // safely sub-millimetre
	});

	it('gold at 1B troy oz returns ~11.72 m edge (cbrt scaling at large mass)', () => {
		// 1B oz = 1e9 × 31.1035 g = 31.1B g = 31,103.5 tonnes
		// / 19.30 = 1.611e9 cm³; cbrt = 1172 cm = 11.72 m = 11720 mm
		const edge = computeCubeEdgeMm(1e9, gold);
		expect(edge).toBeCloseTo(11720, -2);
	});

	it('zero amount returns 0 edge (no NaN, no negative)', () => {
		expect(computeCubeEdgeMm(0, gold)).toBe(0);
		expect(computeCubeEdgeMm(0, silver)).toBe(0);
	});
});

describe('Gold + silver — quantity-anchor proximity at canonical masses', () => {
	it('gold at 12.44 kg → "≈ one Good Delivery bar" (priority 1)', () => {
		expect(selectAnchor(goldAnchors, 12.44)?.id).toBe('good_delivery_bar');
	});

	it('gold at 110.4 kg → "≈ Tutankhamun\'s innermost coffin"', () => {
		expect(selectAnchor(goldAnchors, 110.4)?.id).toBe('tutankhamun_coffin');
	});

	it('gold at 3,200 tonnes → "≈ one year of global gold production"', () => {
		expect(selectAnchor(goldAnchors, 3_200_000)?.id).toBe('annual_production');
	});

	it('silver at 40 tonnes → "≈ the Atocha shipwreck recovery"', () => {
		expect(selectAnchor(silverAnchors, 40_000)?.id).toBe('atocha');
	});

	it('silver at 3,110 tonnes → "≈ the Hunt Brothers\' 1980 corner"', () => {
		expect(selectAnchor(silverAnchors, 3_110_000)?.id).toBe('hunt_brothers');
	});

	it('returns null at masses far from any anchor (e.g. 1.5 kg gold)', () => {
		// 1.5 kg gold: nearest anchor is good_delivery_bar at 12.44 kg, way out of ±10%
		expect(selectAnchor(goldAnchors, 1.5)).toBeNull();
	});
});
