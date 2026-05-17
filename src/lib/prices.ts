/**
 * Price data loader.
 *
 * Merges live prices (from public/prices.json, loaded at build time)
 * with illustrative prices (from src/lib/illustrative-prices.json).
 */

import type { Commodity } from './commodities.js';
import illustrativePrices from './illustrative-prices.json';

export interface DayPrices {
	btc: number;
	btc_supply: number;
	[field: string]: number;
}

export type PriceData = Record<string, DayPrices>;

export interface IllustrativeEntry {
	pricePerUnit: number;
	unit: string;
	unitMassGrams?: number;
	asOfDate: string;
	sources: string[];
	methodology: string;
	notes: string;
}

export type IllustrativePrices = Record<string, IllustrativeEntry>;

export const ILLUSTRATIVE_PRICES: IllustrativePrices =
	illustrativePrices as unknown as IllustrativePrices;

// ── Cocaine (tiered illustrative pricing) ───────────────────────

export interface CocaineTier {
	pricePerKg: number;
	range: [number, number];
	purityAssumption: string;
	asOfDate: string;
	source: string;
}

export interface CocainePriceData {
	tiers: { producer: CocaineTier; wholesale: CocaineTier; retail: CocaineTier };
	primaryTier: 'producer' | 'wholesale' | 'retail';
	sources: string[];
	methodology: string;
	notes: string;
}

export const COCAINE_PRICE_DATA: CocainePriceData = (
	illustrativePrices as unknown as { cocaine: CocainePriceData }
).cocaine;

/**
 * Get the price per unit for a commodity on a given date.
 *
 * For live commodities: looks up priceField in prices.json day record.
 * For illustrative commodities: returns the static illustrative price.
 *
 * Returns the number of commodity units that 1 USD buys (inverted from
 * the raw per-unit price). The caller multiplies by the BTC/USD price
 * and the BTC amount to get the final commodity quantity.
 */
export function getCommodityPrice(
	commodity: Commodity,
	dayPrices: DayPrices | undefined
): number | null {
	if (commodity.dataQuality === 'illustrative') {
		// Cocaine: priced via the wholesale tier midpoint per spec
		// (the canonical equivalence). Other tiers are surfaced separately
		// by TieredPricingTable for comparison context.
		if (commodity.id === 'cocaine') {
			const tier = COCAINE_PRICE_DATA.tiers.wholesale;
			// commodity.unit === 'gram' → return USD/g
			return tier.pricePerKg / 1000;
		}
		const entry = ILLUSTRATIVE_PRICES[commodity.id];
		if (!entry) return null;
		return entry.pricePerUnit;
	}

	if (!dayPrices) return null;
	const price = dayPrices[commodity.priceField];
	if (price === undefined || price === null || price === 0) return null;
	return price;
}

/**
 * Compute the number of commodity units that a given BTC amount buys
 * at a given date's prices.
 */
export function computeCommodityAmount(
	btcAmount: number,
	commodity: Commodity,
	dayPrices: DayPrices | undefined
): number | null {
	if (!dayPrices) return null;
	const btcPrice = dayPrices.btc;
	if (!btcPrice) return null;

	const commodityPrice = getCommodityPrice(commodity, dayPrices);
	if (commodityPrice === null) return null;

	// USD value of the BTC amount
	const usdValue = btcAmount * btcPrice;

	return usdValue / commodityPrice;
}

/**
 * Get available date range from price data.
 */
export function getDateRange(prices: PriceData): { first: string; last: string } {
	const dates = Object.keys(prices).sort();
	return { first: dates[0], last: dates[dates.length - 1] };
}
