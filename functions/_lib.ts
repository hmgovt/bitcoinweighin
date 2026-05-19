/**
 * Pages Function helpers — minimal copy of the bits of src/lib/ we need to
 * compute commodity readouts without importing across the SvelteKit src
 * boundary. Keep values in sync with src/lib/commodities.ts and
 * src/lib/illustrative-prices.json.
 */

export interface OgCommodity {
	id: string;
	displayName: string;
	unit: 'troy_oz' | 'gram' | 'kg' | 'lb' | 'barrel' | 'pellet';
	unitLabel: string;
	unitMassGrams?: number;
	densityGPerCm3?: number;
	priceField: string;
	dataQuality: 'live' | 'illustrative';
	/** USD per unit, illustrative commodities only. */
	illustrativePricePerUnit?: number;
	/** Hex accent for the readout chrome. */
	accentColor: string;
	/** Relative path under /sprites/og/ — fetched and inlined into the OG. */
	cubeSpritePath?: string;
}

export const OG_COMMODITIES: Record<string, OgCommodity> = {
	gold: {
		id: 'gold',
		displayName: 'gold',
		unit: 'troy_oz',
		unitLabel: 'troy oz',
		unitMassGrams: 31.1035,
		densityGPerCm3: 19.3,
		priceField: 'xau',
		dataQuality: 'live',
		accentColor: '#fbbf24',
		cubeSpritePath: '/sprites/og/gold-cube.png',
	},
	silver: {
		id: 'silver',
		displayName: 'silver',
		unit: 'troy_oz',
		unitLabel: 'troy oz',
		unitMassGrams: 31.1035,
		densityGPerCm3: 10.49,
		priceField: 'xag',
		dataQuality: 'live',
		accentColor: '#e5e7eb',
		cubeSpritePath: '/sprites/og/silver-cube.png',
	},
	pu238: {
		id: 'pu238',
		displayName: 'plutonium-238',
		unit: 'gram',
		unitLabel: 'g',
		unitMassGrams: 1,
		densityGPerCm3: 19.8,
		priceField: 'pu238',
		dataQuality: 'illustrative',
		illustrativePricePerUnit: 5000,
		accentColor: '#fb923c',
		cubeSpritePath: '/sprites/og/pu238-cube.png',
	},
	cocaine: {
		id: 'cocaine',
		displayName: 'cocaine',
		unit: 'gram',
		unitLabel: 'g',
		unitMassGrams: 1,
		// No density — cocaine renders still-mode, no cube/volume readout.
		priceField: 'cocaine',
		dataQuality: 'illustrative',
		// UNODC wholesale tier midpoint, USD per gram (illustrative).
		illustrativePricePerUnit: 35,
		accentColor: '#f4f4f5',
	},
};

// Sprite-canvas geometry, measured directly from the shipped 1600×1600
// assets and mirrored from src/lib/volume.ts so the OG scene matches the
// page's framing rule. Fractions are independent of the rendered PNG
// resolution (we ship the PNGs at 800×800 via sips, same proportions).
export const SCENE = {
	SHIBA_HEIGHT_M: 0.4,
	VIEWPORT_MARGIN: 1.1,
	CUBE_VISIBLE_WIDTH_FRACTION: (1296 - 244) / 1600,
	CUBE_VISIBLE_HEIGHT_FRACTION: (1409 - 331) / 1600,
	CUBE_LEFT_MARGIN_FRACTION: 244 / 1600,
	CUBE_TOP_MARGIN_FRACTION: 331 / 1600,
	SHIBA_VISIBLE_WIDTH_FRACTION: (1008 - 486) / 1600,
	SHIBA_VISIBLE_HEIGHT_FRACTION: (1203 - 490) / 1600,
	SHIBA_LEFT_MARGIN_FRACTION: 486 / 1600,
	SHIBA_TOP_MARGIN_FRACTION: 490 / 1600,
	SHIBA_SPRITE_PATH: '/sprites/og/shiba.png',
} as const;

export interface DayPrices {
	btc: number;
	[field: string]: number;
}

export type PricesFile = Record<string, DayPrices>;

/**
 * Commodity-unit quantity that `btc` BTC buys on the given day.
 * Mirrors computeCommodityAmount in src/lib/prices.ts.
 */
export function computeAmount(
	btc: number,
	commodity: OgCommodity,
	day: DayPrices | undefined,
): number | null {
	if (!day) return null;
	const btcPrice = day.btc;
	if (!btcPrice) return null;

	let unitPrice: number | null = null;
	if (commodity.dataQuality === 'illustrative') {
		unitPrice = commodity.illustrativePricePerUnit ?? null;
	} else {
		const raw = day[commodity.priceField];
		if (raw !== undefined && raw !== null && raw !== 0) unitPrice = raw;
	}
	if (unitPrice === null) return null;

	return (btc * btcPrice) / unitPrice;
}

/** Mass in grams for a commodity amount. */
export function massGrams(amount: number, commodity: OgCommodity): number {
	return amount * (commodity.unitMassGrams ?? 0);
}

/** Intrinsic substance volume in cm³. */
export function volumeCm3(amount: number, commodity: OgCommodity): number | null {
	if (!commodity.unitMassGrams || !commodity.densityGPerCm3) return null;
	return (amount * commodity.unitMassGrams) / commodity.densityGPerCm3;
}

/** Cube edge length in cm for a given amount. */
export function cubeEdgeCm(amount: number, commodity: OgCommodity): number | null {
	const v = volumeCm3(amount, commodity);
	if (v === null || v <= 0) return null;
	return Math.cbrt(v);
}

// ── Formatting ─────────────────────────────────────────────────

const GRAMS_PER_OZ = 28.3495;
const GRAMS_PER_LB = 453.592;
const GRAMS_PER_TROY_OZ = 31.1035;
const CM_PER_INCH = 2.54;

function sigFigs(n: number, digits = 3): string {
	if (!isFinite(n) || n === 0) return '0';
	const abs = Math.abs(n);
	if (abs >= 1000) return Math.round(n).toLocaleString('en-US');
	if (abs >= 100) return n.toFixed(0);
	if (abs >= 10) return n.toFixed(1);
	if (abs >= 1) return n.toFixed(2);
	if (abs >= 0.01) return n.toFixed(3);
	return n.toPrecision(digits);
}

/** Imperial-primary mass formatter (lb/oz ladder for metals; consumer ladder for grams). */
export function formatMassImperial(grams: number, unit: OgCommodity['unit']): string {
	if (!isFinite(grams) || grams <= 0) return '0';
	if (unit === 'troy_oz') {
		// Metals: troy oz down to ~1 oz, then lb above
		if (grams < GRAMS_PER_OZ) return `${sigFigs(grams / GRAMS_PER_TROY_OZ)} troy oz`;
		const lbs = grams / GRAMS_PER_LB;
		if (lbs < 1) return `${sigFigs(grams / GRAMS_PER_OZ)} oz`;
		if (lbs < 2000) return `${sigFigs(lbs)} lb`;
		return `${sigFigs(lbs / 2000)} tons`;
	}
	// Consumer ladder (Pu-238, cocaine)
	if (grams < 1e-3) return `${sigFigs(grams * 1e6)} µg`;
	if (grams < 1) return `${sigFigs(grams * 1000)} mg`;
	if (grams < GRAMS_PER_LB) return `${sigFigs(grams / GRAMS_PER_OZ)} oz`;
	const lbs = grams / GRAMS_PER_LB;
	if (lbs < 2000) return `${sigFigs(lbs)} lb`;
	return `${sigFigs(lbs / 2000)} short tons`;
}

/** Metric mass formatter — secondary line. */
export function formatMassMetric(grams: number): string {
	if (!isFinite(grams) || grams <= 0) return '0 g';
	if (grams < 1e-3) return `${sigFigs(grams * 1e6)} µg`;
	if (grams < 1) return `${sigFigs(grams * 1000)} mg`;
	if (grams < 1000) return `${sigFigs(grams)} g`;
	if (grams < 1_000_000) return `${sigFigs(grams / 1000)} kg`;
	return `${sigFigs(grams / 1_000_000)} tonnes`;
}

/** Cube edge — imperial primary, metric secondary. Returns "X in (Y cm)". */
export function formatCubeEdge(edgeCm: number): string {
	const inches = edgeCm / CM_PER_INCH;
	if (edgeCm < 1) {
		return `${sigFigs(edgeCm * 10)} mm (${sigFigs(inches)} in)`;
	}
	if (edgeCm < 100) {
		return `${sigFigs(inches)} in (${sigFigs(edgeCm)} cm)`;
	}
	const feet = inches / 12;
	return `${sigFigs(feet)} ft (${sigFigs(edgeCm / 100)} m)`;
}

/** Commodity amount in its native unit: "23.5 troy oz". */
export function formatAmount(amount: number, commodity: OgCommodity): string {
	return `${sigFigs(amount)} ${commodity.unitLabel}`;
}

/**
 * Headline readout — picks the unit that reads best at the current scale.
 * - Metals (unit=troy_oz): keep troy oz (the bullion unit users expect).
 * - Grams-unit commodities (Pu-238, cocaine): switch to kg / tonnes when
 *   the amount makes "29000 g" look silly. The point of the readout is
 *   to land — bullion vocabulary doesn't fit cocaine, gram vocabulary
 *   doesn't fit kilo-scale buys.
 */
export function formatHeadlineAmount(amount: number, commodity: OgCommodity): string {
	if (commodity.unit === 'troy_oz') return formatAmount(amount, commodity);
	if (commodity.unit === 'gram') {
		const g = amount;
		if (g >= 1_000_000) return `${sigFigs(g / 1_000_000)} tonnes`;
		if (g >= 1000) return `${sigFigs(g / 1000)} kg`;
		if (g < 1) return `${sigFigs(g * 1000)} mg`;
		return `${sigFigs(g)} g`;
	}
	return formatAmount(amount, commodity);
}

/** BTC amount: tight formatter that handles 1 sat through 21M BTC. */
export function formatBtc(btc: number): string {
	if (!isFinite(btc) || btc <= 0) return '0 BTC';
	if (btc >= 1000) return `${Math.round(btc).toLocaleString('en-US')} BTC`;
	if (btc >= 1) return `${sigFigs(btc)} BTC`;
	if (btc >= 0.001) return `${sigFigs(btc)} BTC`;
	// Below 0.001 BTC → satoshis
	const sats = Math.round(btc * 1e8);
	if (sats === 1) return '1 sat';
	if (sats < 1e8) return `${sats.toLocaleString('en-US')} sats`;
	return `${sigFigs(btc)} BTC`;
}

/** USD value formatter — short scale with $ prefix. */
export function formatUsd(usd: number): string {
	if (!isFinite(usd)) return '$0';
	const abs = Math.abs(usd);
	if (abs < 1) return `$${usd.toFixed(4)}`;
	if (abs < 1000) return `$${usd.toFixed(2)}`;
	if (abs < 1_000_000) return `$${Math.round(usd).toLocaleString('en-US')}`;
	if (abs < 1e9) return `$${(usd / 1e6).toFixed(2)}M`;
	if (abs < 1e12) return `$${(usd / 1e9).toFixed(2)}B`;
	return `$${(usd / 1e12).toFixed(2)}T`;
}
