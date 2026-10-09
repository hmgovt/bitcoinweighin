import { describe, it, expect } from 'vitest';
import {
	CAR_TANK_L,
	DRUM_L,
	FIELD_JACKS,
	JACK_L,
	LITRES_PER_BARREL,
	MAX_CARS,
	MAX_DRUMS,
	MAX_TANKERS,
	PRUDHOE_L,
	VLCC_L,
	formatSpan,
	formatVolume,
	litresFor,
	oilScene,
	tankWords,
	usdPerLitre,
	worldSeconds,
} from '../src/lib/oil.js';

describe('usdPerLitre', () => {
	it('converts Brent per barrel and pump prices per US gallon', () => {
		const day = { btc: 80000, brent: 158.987294928, gasoline: 3.785411784, diesel: 7.570823568 };
		expect(usdPerLitre('crude', day)).toBeCloseTo(1, 9);
		expect(usdPerLitre('gasoline', day)).toBeCloseTo(1, 9);
		expect(usdPerLitre('diesel', day)).toBeCloseTo(2, 9);
	});
	it('is null when the day has no price', () => {
		expect(usdPerLitre('diesel', { btc: 1 })).toBeNull();
		expect(usdPerLitre('crude', undefined)).toBeNull();
		expect(usdPerLitre('crude', { brent: 0 })).toBeNull();
	});
});

describe('litresFor', () => {
	it('is the dollar value over the price per litre', () => {
		expect(litresFor(1, 80000, 0.8)).toBeCloseTo(100000, 6);
		expect(litresFor(0, 80000, 0.8)).toBe(0);
		expect(litresFor(1, 80000, null)).toBe(0);
	});
});

describe('oilScene', () => {
	it('fills car tanks up to MAX_CARS', () => {
		expect(oilScene(CAR_TANK_L / 2)).toEqual({ kind: 'tank', count: 1, lastFill: 0.5, exact: 0.5 });
		const s = oilScene(CAR_TANK_L * 2.25);
		expect(s.kind).toBe('tank');
		expect(s.count).toBe(3);
		expect(s.lastFill).toBeCloseTo(0.25, 9);
		expect(oilScene(CAR_TANK_L * MAX_CARS)).toMatchObject({ kind: 'tank', count: MAX_CARS, lastFill: 1 });
	});
	it('a whole number of containers is that many, full', () => {
		expect(oilScene(DRUM_L * 300)).toMatchObject({ kind: 'drums', count: 300, lastFill: 1 });
		expect(oilScene(VLCC_L * 3)).toMatchObject({ kind: 'tanker', count: 3, lastFill: 1 });
	});
	it('steps up the ladder: drums, tanker, field', () => {
		expect(oilScene(CAR_TANK_L * MAX_CARS + 1).kind).toBe('drums');
		expect(oilScene(DRUM_L * MAX_DRUMS + 1).kind).toBe('tanker');
		expect(oilScene(VLCC_L * MAX_TANKERS + 1).kind).toBe('field');
	});
	it('a tanker part-full reports its share of the hold', () => {
		const s = oilScene(VLCC_L * 0.4);
		expect(s.kind).toBe('tanker');
		expect(s.count).toBe(1);
		expect(s.lastFill).toBeCloseTo(0.4, 9);
	});
	it('the field caps at all of Prudhoe Bay, exact keeps counting', () => {
		const s = oilScene(PRUDHOE_L * 1.5);
		expect(s.kind).toBe('field');
		expect(s.count).toBe(FIELD_JACKS);
		expect(s.exact).toBeCloseTo(FIELD_JACKS * 1.5, 6);
		expect(JACK_L * FIELD_JACKS).toBeCloseTo(PRUDHOE_L, 0);
	});
	it('zero is an empty tank', () => {
		expect(oilScene(0)).toMatchObject({ kind: 'tank', lastFill: 0 });
	});
});

describe('formatting', () => {
	it('world use: 104 million barrels is a day', () => {
		expect(worldSeconds(104e6 * LITRES_PER_BARREL)).toBeCloseTo(86400, 6);
		expect(formatSpan(86400)).toBe('24 hours');
		expect(formatSpan(4.24)).toBe('4.2 seconds');
		expect(formatSpan(60)).toBe('60 seconds');
		expect(formatSpan(86400 * 30)).toBe('30 days');
	});
	it('volumes in litres or gallons', () => {
		expect(formatVolume(104000, 'metric')).toBe('104,000 L');
		expect(formatVolume(3.785411784e6, 'imperial')).toBe('1.00 million gal');
		expect(formatVolume(0.25, 'metric')).toBe('250 mL');
	});
	it('tank fractions in words', () => {
		expect(tankWords(1)).toBe('a full tank');
		expect(tankWords(0.5)).toBe('about half a tank');
		expect(tankWords(0.76)).toBe('about three quarters of a tank');
	});
});
