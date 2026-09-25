import { describe, it, expect } from 'vitest';
import {
	NOTE_M,
	MOON_M,
	RIDE_MARKERS,
	RIDE_START_M,
	stackHeightM,
	rideAvailable,
	rideTiming,
	climbAltitude,
	markerPassed,
	nextMarker,
	endViewTopM,
	rideSummary,
} from '../src/lib/moonRide.js';

describe('moon ride — stack and markers', () => {
	it('stacks a note at 0.10922 mm', () => {
		expect(NOTE_M).toBeCloseTo(0.00010922, 12);
		expect(stackHeightM(84_550)).toBeCloseTo(9.2345, 3); // ~1 BTC at $84,550
		expect(stackHeightM(-5)).toBe(0);
	});

	it('lists the markers in ascending order, ending at the Moon', () => {
		for (let i = 1; i < RIDE_MARKERS.length; i++) {
			expect(RIDE_MARKERS[i].metres).toBeGreaterThan(RIDE_MARKERS[i - 1].metres);
		}
		expect(RIDE_MARKERS.at(-1)!.id).toBe('moon');
		expect(RIDE_MARKERS.at(-1)!.metres).toBe(384_400_000);
	});

	it('finds the marker just passed and the next one up', () => {
		expect(markerPassed(50)).toBeNull();
		expect(markerPassed(4_620)!.id).toBe('burj');
		expect(nextMarker(4_620)!.id).toBe('everest');
		expect(markerPassed(MOON_M)!.id).toBe('moon');
		expect(nextMarker(MOON_M)).toBeNull();
	});

	it('only offers a ride once the stack is taller than a doorway', () => {
		expect(rideAvailable(1.9)).toBe(false);
		expect(rideAvailable(2)).toBe(true);
	});
});

describe('moon ride — the climb', () => {
	it('climbs from head height to exactly the top of the stack', () => {
		for (const h of [2, 9.23, 4_620, 194_000_000]) {
			expect(climbAltitude(0, h)).toBeCloseTo(RIDE_START_M, 9);
			expect(climbAltitude(1, h) / h).toBeCloseTo(1, 9);
		}
	});

	it('is monotonic and spends equal time per decade mid-climb', () => {
		const h = 194_000_000;
		let prev = 0;
		for (let u = 0; u <= 1.0001; u += 0.02) {
			const a = climbAltitude(u, h);
			expect(a).toBeGreaterThanOrEqual(prev);
			prev = a;
		}
		// Symmetric easing: halfway through the time is halfway through the decades.
		const mid = climbAltitude(0.5, h);
		expect(Math.log10(mid / RIDE_START_M)).toBeCloseTo(Math.log10(h / RIDE_START_M) / 2, 9);
	});

	it('takes longer for taller stacks, within bounds', () => {
		const a = rideTiming(9).climbS;
		const b = rideTiming(4_620).climbS;
		const c = rideTiming(194_000_000).climbS;
		expect(a).toBeGreaterThanOrEqual(3.5);
		expect(b).toBeGreaterThan(a);
		expect(c).toBeGreaterThan(b);
		expect(c).toBeLessThanOrEqual(12);
	});
});

describe('moon ride — closing view and summary', () => {
	it('frames the stack plus the next marker when it is within reach', () => {
		// 4.62 km: Everest (8,849 m) is under 2.5x, so it's in shot.
		expect(endViewTopM(4_620)).toBeCloseTo(8_849 * 1.08, 6);
		// 9.2 m: the Statue of Liberty is 10x taller, so just sky over the stack.
		expect(endViewTopM(9.2)).toBeCloseTo(9.2 * 1.2, 9);
		// Halfway to the Moon: the Moon is in shot.
		expect(endViewTopM(194_000_000)).toBeCloseTo(MOON_M * 1.06, 3);
	});

	it('puts the whole supply at the Moon when 1 BTC = ~$167,600, whatever today’s price', () => {
		const s = rideSummary(500 * 84_550, 84_550);
		expect(s.heightM).toBeCloseTo(4_617.2, 0);
		expect(s.supplyHeightM / 1000).toBeCloseTo(193_925, -2);
		expect(s.supplyMoonShare).toBeCloseTo(0.5045, 3);
		expect(s.moonPriceUsd).toBeGreaterThan(167_500);
		expect(s.moonPriceUsd).toBeLessThan(167_700);
		expect(rideSummary(1, 120_000).moonPriceUsd).toBeCloseTo(s.moonPriceUsd, 6);
		// And the BTC needed at today's price: ~41.6M, about twice the supply.
		expect(s.btcToMoon / 1e6).toBeCloseTo(41.63, 1);
	});
});
