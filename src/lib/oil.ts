/**
 * The oil tab: how much crude, diesel or gasoline a sum of bitcoin buys,
 * drawn on a ladder of real containers — a car's fuel tank, a yard of
 * 55-gallon drums, a supertanker's hold, and finally a whole oil field.
 * Pure maths only; the scene is src/lib/scene/OilStage.svelte.
 *
 * Prices (all in prices.json, all from FRED):
 *   crude    — Brent spot, USD per barrel (DCOILBRENTEU, daily)
 *   diesel   — US retail No. 2 diesel, USD per US gallon (GASDESW, weekly)
 *   gasoline — US retail regular gasoline, USD per US gallon (GASREGW, weekly)
 * Crude is a wholesale spot price; the two fuels are pump prices, taxes in.
 */

export type Fuel = 'crude' | 'diesel' | 'gasoline';

/** One oil barrel (42 US gallons), litres. */
export const LITRES_PER_BARREL = 158.987294928;
/** One US gallon, litres. */
export const LITRES_PER_GALLON = 3.785411784;

export interface FuelSpec {
	id: Fuel;
	label: string;
	/** Field in prices.json. */
	priceField: 'brent' | 'diesel' | 'gasoline';
	/** The unit the price is quoted in. */
	priceUnit: 'barrel' | 'gallon';
	/** Typical density, kg/L — Brent ~38° API; EN 590 / US No. 2 diesel; regular gasoline. */
	densityKgPerL: number;
	/** How the price is described in copy. */
	priceLabel: string;
	source: string;
}

export const FUELS: Record<Fuel, FuelSpec> = {
	crude: {
		id: 'crude',
		label: 'Crude',
		priceField: 'brent',
		priceUnit: 'barrel',
		densityKgPerL: 0.835,
		priceLabel: 'Brent crude, spot',
		source: 'FRED DCOILBRENTEU',
	},
	diesel: {
		id: 'diesel',
		label: 'Diesel',
		priceField: 'diesel',
		priceUnit: 'gallon',
		densityKgPerL: 0.84,
		priceLabel: 'US retail diesel, weekly average',
		source: 'FRED GASDESW (EIA)',
	},
	gasoline: {
		id: 'gasoline',
		label: 'Gasoline',
		priceField: 'gasoline',
		priceUnit: 'gallon',
		densityKgPerL: 0.745,
		priceLabel: 'US retail regular gasoline, weekly average',
		source: 'FRED GASREGW (EIA)',
	},
};

export const FUEL_ORDER: Fuel[] = ['crude', 'diesel', 'gasoline'];

/** USD per litre of `fuel` from a day's prices, or null when the day has none. */
export function usdPerLitre(fuel: Fuel, day: Record<string, number> | undefined | null): number | null {
	const spec = FUELS[fuel];
	const p = day?.[spec.priceField];
	if (!(typeof p === 'number' && p > 0)) return null;
	return p / (spec.priceUnit === 'barrel' ? LITRES_PER_BARREL : LITRES_PER_GALLON);
}

/** Litres of `fuel` that `btc` buys at `btcUsd`, given USD per litre. */
export function litresFor(btc: number, btcUsd: number, perLitre: number | null): number {
	if (!perLitre || !(btc > 0) || !(btcUsd > 0)) return 0;
	return (btc * btcUsd) / perLitre;
}

// ── The ladder ──────────────────────────────────────────────────────

/** A mid-size car's fuel tank, litres (a Camry's is 60, a Golf's 50). */
export const CAR_TANK_L = 55;
/** A 55-US-gallon steel drum, litres — the drum, not the 42-gallon barrel unit. */
export const DRUM_L = 55 * LITRES_PER_GALLON;
/** A VLCC supertanker's cargo: about 2 million barrels (EIA: 1.9–2.2 million). */
export const VLCC_BARRELS = 2_000_000;
export const VLCC_L = VLCC_BARRELS * LITRES_PER_BARREL;
/**
 * Prudhoe Bay, Alaska — North America's largest oil field: about 13.2
 * billion barrels produced from 1977 to the end of 2024 (BP Prudhoe Bay
 * Royalty Trust, 10-K for FY2024).
 */
export const PRUDHOE_BARRELS = 13.2e9;
export const PRUDHOE_L = PRUDHOE_BARRELS * LITRES_PER_BARREL;
/** The world's oil use, barrels a day — IEA, 2025 (~104 million b/d). */
export const WORLD_BARRELS_PER_DAY = 104e6;

/** Most cars drawn on the tank stage; past this, drums. */
export const MAX_CARS = 4;
/** Most drums drawn; past this, the supertanker. */
export const MAX_DRUMS = 20_000;
/** Most tankers drawn; past this, the field. */
export const MAX_TANKERS = 10;
/** The field's grid: FIELD_SIDE² pump jacks standing for Prudhoe Bay's output. */
export const FIELD_SIDE = 40;
export const FIELD_JACKS = FIELD_SIDE * FIELD_SIDE;
/** Litres each pump jack stands for (~8.25 million barrels). */
export const JACK_L = PRUDHOE_L / FIELD_JACKS;

export type OilStageKind = 'tank' | 'drums' | 'tanker' | 'field';

export interface OilScene {
	kind: OilStageKind;
	/** Containers drawn: cars, drums, tankers or lit pump jacks (whole + part). */
	count: number;
	/** Fill of the last container, 0–1 (1 when it is full). */
	lastFill: number;
	/** Exact number of containers' worth, fractional. */
	exact: number;
}

/** Which rung of the ladder `litres` sits on, and how many of its containers it fills. */
export function oilScene(litres: number): OilScene {
	const L = Math.max(0, litres);
	const split = (per: number) => {
		const exact = L / per;
		const count = Math.max(1, Math.ceil(exact - 1e-9));
		const lastFill = exact <= 0 ? 0 : exact - (count - 1);
		return { count, lastFill: Math.min(1, lastFill), exact };
	};
	if (L <= MAX_CARS * CAR_TANK_L) return { kind: 'tank', ...split(CAR_TANK_L) };
	if (L <= MAX_DRUMS * DRUM_L) return { kind: 'drums', ...split(DRUM_L) };
	if (L <= MAX_TANKERS * VLCC_L) return { kind: 'tanker', ...split(VLCC_L) };
	const f = split(JACK_L);
	return { kind: 'field', ...f, count: Math.min(f.count, FIELD_JACKS) };
}

/** The containers per rung, litres each (the field's pump jacks: JACK_L). */
const PER: Record<OilStageKind, number> = { tank: CAR_TANK_L, drums: DRUM_L, tanker: VLCC_L, field: JACK_L };

/**
 * `litres` drawn on a chosen rung, whatever the amount: an empty tanker
 * filling, say (the video clips). Always at least one container.
 */
export function sceneOn(kind: OilStageKind, litres: number): OilScene {
	const exact = Math.max(0, litres) / PER[kind];
	const count = Math.max(1, Math.ceil(exact - 1e-9));
	return { kind, count, lastFill: Math.min(1, Math.max(0, exact - (count - 1))), exact };
}

/** How long the whole world takes to burn through `litres` of oil, seconds. */
export function worldSeconds(litres: number): number {
	return (litres / LITRES_PER_BARREL / WORLD_BARRELS_PER_DAY) * 86400;
}

/** "4.2 seconds", "17 minutes", "3.1 hours", "12 days". */
export function formatSpan(s: number): string {
	const n = (v: number, unit: string) => {
		const t = v >= 10 ? Math.round(v).toLocaleString('en-US') : v.toFixed(1).replace(/\.0$/, '');
		return `${t} ${unit}${t === '1' ? '' : 's'}`;
	};
	if (s < 1) return n(s * 1000, 'millisecond');
	if (s < 120) return n(s, 'second');
	if (s < 7200) return n(s / 60, 'minute');
	if (s < 172800) return n(s / 3600, 'hour');
	if (s < 2 * 365.25 * 86400) return n(s / 86400, 'day');
	return n(s / (365.25 * 86400), 'year');
}

/** Volume for display: litres/m³ or US gallons, scaled. */
export function formatVolume(litres: number, system: 'metric' | 'imperial'): string {
	const big = (v: number, unit: string) => {
		if (v >= 1e12) return `${(v / 1e12).toFixed(2)} trillion ${unit}`;
		if (v >= 1e9) return `${(v / 1e9).toFixed(2)} billion ${unit}`;
		if (v >= 1e6) return `${(v / 1e6).toFixed(2)} million ${unit}`;
		if (v >= 100) return `${Math.round(v).toLocaleString('en-US')} ${unit}`;
		if (v >= 1) return `${v.toFixed(1)} ${unit}`;
		return `${v.toPrecision(2)} ${unit}`;
	};
	if (system === 'imperial') return big(litres / LITRES_PER_GALLON, 'gal');
	if (litres < 1) return `${Math.round(litres * 1000).toLocaleString('en-US')} mL`;
	return big(litres, 'L');
}

/** Barrels, scaled: "655 barrels", "2.41 million barrels". */
export function formatBarrels(barrels: number): string {
	if (barrels >= 1e9) return `${(barrels / 1e9).toFixed(2)} billion barrels`;
	if (barrels >= 1e6) return `${(barrels / 1e6).toFixed(2)} million barrels`;
	if (barrels >= 100) return `${Math.round(barrels).toLocaleString('en-US')} barrels`;
	if (barrels >= 1) return `${barrels.toFixed(1)} barrels`;
	return `${barrels.toPrecision(2)} barrels`;
}

/** Fraction of a tank in words: "a quarter", "three quarters", "about a third"… */
export function tankWords(fill: number): string {
	const f = Math.max(0, Math.min(1, fill));
	if (f >= 0.97) return 'a full tank';
	if (f < 0.03) return 'a splash in the tank';
	const marks: [number, string][] = [
		[1 / 8, 'an eighth of a tank'],
		[1 / 4, 'a quarter of a tank'],
		[1 / 3, 'a third of a tank'],
		[1 / 2, 'half a tank'],
		[2 / 3, 'two thirds of a tank'],
		[3 / 4, 'three quarters of a tank'],
		[7 / 8, 'seven eighths of a tank'],
	];
	let best = marks[0];
	for (const m of marks) if (Math.abs(m[0] - f) < Math.abs(best[0] - f)) best = m;
	return `about ${best[1]}`;
}
