import { describe, it, expect } from 'vitest';
import { getCommodityPrice, computeCommodityAmount, type DayPrices } from '../src/lib/prices.js';
import { getCommodity } from '../src/lib/commodities.js';

const cash = getCommodity('cash')!;
const dayPrices: DayPrices = { btc: 110_000 } as DayPrices;

describe('cash pricing', () => {
	it('one note is worth exactly one dollar', () => {
		expect(getCommodityPrice(cash, dayPrices)).toBe(1);
	});

	it('note count = BTC amount x live BTC/USD price', () => {
		expect(computeCommodityAmount(0.001, cash, dayPrices)).toBeCloseTo(110, 6);
		expect(computeCommodityAmount(1, cash, dayPrices)).toBeCloseTo(110_000, 6);
		expect(computeCommodityAmount(100, cash, dayPrices)).toBeCloseTo(11_000_000, 3);
	});

	it('returns null when there is no BTC price for the day', () => {
		expect(computeCommodityAmount(1, cash, undefined)).toBeNull();
	});
});
