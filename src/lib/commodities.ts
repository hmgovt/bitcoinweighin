/**
 * MVP commodity catalogue for Bitcoin Weigh-In.
 *
 * Ordering: gold → silver → copper → oil_brent → natgas → uranium_fuel_pellet
 * Optional: platinum (between copper & oil), coffee (between platinum & oil)
 */

export interface TileConfig {
	/** Sprite paths for 0/25/50/75/100% fill states */
	fillStates: string[];
	/** Max grid columns per viewport */
	maxGridCols: { mobile: number; desktop: number };
	/** Past this many tiles, switch to comparison card */
	capAtTiles: number;
}

export interface RenderStage {
	id: string;
	maxValue: number | null; // unit amount; null = final stage
	spritePath: string;
	spriteWidthPx: number;
	realWorldWidthMetres: number;
	referenceAmount: number; // the unit amount depicted in the sprite
	caption?: string;
	/** "scale" = existing cube-root scaling; "tile" = integer grid + fractional trailing */
	renderMode?: 'scale' | 'tile';
	/** Camera angle — "three_quarter" for small/medium, "isometric" for institutional */
	projection?: 'three_quarter' | 'isometric';
	/** Config for tile-mode stages */
	tileConfig?: TileConfig;
	/** Template for count readout, e.g. "{n} kilo bars". Omit if count is meaningless. */
	countTemplate?: string;
	/** If true, suppress the standalone £1 coin reference (coin baked into sprite) */
	suppressCoinRef?: boolean;
}

export interface RenderProgression {
	stages: RenderStage[];
	heroScene?: 'gold' | 'oil';
}

export interface FactTemplate {
	template: string;
	divisor_kg?: number;
	divisor_litres?: number;
}

export interface Commodity {
	id: string;
	displayName: string;
	/**
	 * Rendering vocabulary.
	 * - "cube": single cube sprite at intrinsic volume against the shared scale-reference library. Dense fungible metals.
	 * - "progression": per-stage sprites with cross-fade transitions. The current default for everything else.
	 * - "vessel" / "bulk": reserved for future per-vocabulary renderers. Currently throw "not implemented" in the dispatcher.
	 */
	renderStyle: 'cube' | 'progression' | 'vessel' | 'bulk';
	unit: 'troy_oz' | 'lb' | 'barrel' | 'mmbtu' | 'gram' | 'kg' | 'pellet';
	unitMassGrams?: number;
	densityGPerCm3?: number;
	bulkDensityKgPerM3?: number;
	/**
	 * Stage definitions — required for "progression"-style commodities.
	 * Cube-mode commodities set this undefined; the renderer ignores it and reads
	 * `densityGPerCm3` + `unitMassGrams` directly. Reserved for revival under a
	 * future "show me bars instead" toggle.
	 */
	render?: RenderProgression;
	/**
	 * Cube sprite path — required when `renderStyle === "cube"`.
	 * The sprite is identical at every amount; only its CSS size changes.
	 */
	cubeSpritePath?: string;
	cubeShadowPath?: string;
	facts: FactTemplate[];
	affiliate?: { url: string; label: string; disclosure: string };
	sourceId: string;
	sourceName: string;
	dataQuality: 'live' | 'indicative' | 'historical' | 'illustrative';
	/** Field name in prices.json */
	priceField: string;
}

// ---------------------------------------------------------------------------
// Render stage helpers — placeholder sprites for Phase 1
// ---------------------------------------------------------------------------

function placeholderStages(
	commodityId: string,
	stages: Array<
		Omit<RenderStage, 'spritePath' | 'spriteWidthPx'> & {
			spritePath?: string;
			spriteWidthPx?: number;
		}
	>
): RenderStage[] {
	return stages.map((s) => ({
		spritePath: `/sprites/${commodityId}/${s.id}@2x.webp`,
		spriteWidthPx: 1600,
		...s,
	}));
}

/** Build tile fill-state paths for stub sprites */
function stubTileConfig(
	commodityId: string,
	stageId: string,
	opts: { maxGridCols?: { mobile: number; desktop: number }; capAtTiles: number }
): TileConfig {
	const fills = ['0', '25', '50', '75', '100'];
	return {
		fillStates: fills.map(
			(f) => `/sprites/${commodityId}/_stubs/${stageId}_fill_${f}.svg`
		),
		maxGridCols: opts.maxGridCols ?? { mobile: 5, desktop: 10 },
		capAtTiles: opts.capAtTiles,
	};
}

// ---------------------------------------------------------------------------
// Core 6 MVP commodities
// ---------------------------------------------------------------------------

const gold: Commodity = {
	id: 'gold',
	displayName: 'Gold',
	renderStyle: 'progression',
	unit: 'troy_oz',
	unitMassGrams: 31.1035,
	densityGPerCm3: 19.3,
	sourceId: 'gold',
	sourceName: 'stooq (XAUUSD)',
	dataQuality: 'live',
	priceField: 'xau',
	render: {
		stages: placeholderStages('gold', [
			// 1. dust (≤0.1 g ≈ 0.003 oz) — gold flakes rendered ON the £1 coin
			{
				id: 'dust',
				maxValue: 0.003,
				realWorldWidthMetres: 0.024, // coin diameter — sprite includes the coin
				referenceAmount: 0.001,
				suppressCoinRef: true,
				caption: 'Gold dust on a £1 coin',
				spritePath: '/sprites/gold/_stubs/dust.svg',
			},
			// 2. nugget_cluster (0.1–3 g ≈ 0.003–0.1 oz) — irregular grains on neutral surface
			{
				id: 'nugget_cluster',
				maxValue: 0.1,
				realWorldWidthMetres: 0.02,
				referenceAmount: 0.05,
				caption: 'Gold nugget cluster',
				spritePath: '/sprites/gold/_stubs/nugget_cluster.svg',
			},
			// 3. coin (1 oz Britannia, 31 g) — single gold coin
			{
				id: 'coin',
				maxValue: 1.5,
				realWorldWidthMetres: 0.032, // Britannia diameter 32.69 mm
				referenceAmount: 1,
				countTemplate: '{n} Britannias',
				spritePath: '/sprites/gold/_stubs/coin.svg',
			},
			// 4. tube (20 Britannias, 620 g ≈ 20 oz) — stacked coin tube
			{
				id: 'tube',
				maxValue: 8,
				realWorldWidthMetres: 0.045, // tube width/diameter
				referenceAmount: 5,
				countTemplate: '{n} Britannias in tube',
				spritePath: '/sprites/gold/_stubs/tube.svg',
			},
			// 5. small_bar (100 g LBMA ≈ 3.215 oz) — rendered as bar, scales through this range
			{
				id: 'small_bar',
				maxValue: 50,
				realWorldWidthMetres: 0.055,
				referenceAmount: 20,
				countTemplate: '{n} × 100 g bars',
				spritePath: '/sprites/gold/_stubs/small_bar.svg',
			},
			// 6. kilo_bar (1 kg ≈ 32.15 oz)
			{
				id: 'kilo_bar',
				maxValue: 200,
				realWorldWidthMetres: 0.117, // 117 × 53 × 9 mm
				referenceAmount: 32.15,
				countTemplate: '{n} kilo bars',
				spritePath: '/sprites/gold/_stubs/kilo_bar.svg',
			},
			// 7. good_delivery_single (400 oz / 12.44 kg)
			{
				id: 'good_delivery_single',
				maxValue: 1500,
				realWorldWidthMetres: 0.25, // ~250 × 80 × 45 mm
				referenceAmount: 400,
				countTemplate: '{n} Good Delivery bars',
				spritePath: '/sprites/gold/_stubs/good_delivery_single.svg',
			},
			// 8. bar_pyramid (3–~30 bars, NY Fed vault style) — ISOMETRIC
			{
				id: 'bar_pyramid',
				maxValue: 12000,
				realWorldWidthMetres: 0.5,
				referenceAmount: 2000,
				projection: 'isometric',
				countTemplate: '{n} Good Delivery bars',
				spritePath: '/sprites/gold/_stubs/bar_pyramid.svg',
			},
			// 9. pallet (~30–~240 bars, ~1–3 t) — isometric, tile mode entry
			{
				id: 'pallet',
				maxValue: 300000,
				realWorldWidthMetres: 1.2,
				referenceAmount: 9600, // ~24 bars per pallet
				renderMode: 'tile',
				projection: 'isometric',
				tileConfig: stubTileConfig('gold', 'pallet', { capAtTiles: 80 }),
				countTemplate: '{bars} bars across {pallets} pallets',
				spritePath: '/sprites/gold/_stubs/pallet.svg',
			},
			// 10. vault_multi_pallet (3–~300 t) — tiled grid of full pallets
			{
				id: 'vault_multi_pallet',
				maxValue: null,
				realWorldWidthMetres: 1.2, // same pallet sprite, tiled
				referenceAmount: 96000, // ~10 pallets
				renderMode: 'tile',
				projection: 'isometric',
				tileConfig: stubTileConfig('gold', 'vault_multi_pallet', {
					maxGridCols: { mobile: 4, desktop: 8 },
					capAtTiles: 60,
				}),
				countTemplate: '{bars} bars across {pallets} pallets',
				spritePath: '/sprites/gold/_stubs/vault_multi_pallet.svg',
			},
		]),
		heroScene: 'gold',
	},
	facts: [
		{ template: 'about {n} standard wedding rings (~4 g each)', divisor_kg: 0.004 },
		{ template: '{n} Good Delivery bars (400 oz each)', divisor_kg: 12.4 },
	],
};

const silver: Commodity = {
	id: 'silver',
	displayName: 'Silver',
	renderStyle: 'progression',
	unit: 'troy_oz',
	unitMassGrams: 31.1035,
	densityGPerCm3: 10.49,
	sourceId: 'silver',
	sourceName: 'stooq (XAGUSD)',
	dataQuality: 'live',
	priceField: 'xag',
	render: {
		stages: placeholderStages('silver', [
			{ id: 'coin', maxValue: 25, realWorldWidthMetres: 0.039, referenceAmount: 1 },
			{ id: 'tube', maxValue: 200, realWorldWidthMetres: 0.045, referenceAmount: 20 },
			{ id: 'monster_box', maxValue: 1500, realWorldWidthMetres: 0.3, referenceAmount: 500 },
			{ id: 'shoebox_pile', maxValue: 10000, realWorldWidthMetres: 0.4, referenceAmount: 1125 },
			{ id: 'pallet', maxValue: null, realWorldWidthMetres: 1.2, referenceAmount: 10000 },
		]),
	},
	facts: [
		{ template: '{n} 1-oz American Silver Eagles', divisor_kg: 0.0311035 },
		{ template: '{n} US Mint "monster boxes" (500 oz each)', divisor_kg: 15.55 },
	],
};

const copper: Commodity = {
	id: 'copper',
	displayName: 'Copper',
	renderStyle: 'progression',
	unit: 'lb',
	unitMassGrams: 453.592,
	densityGPerCm3: 8.96,
	sourceId: 'copper',
	sourceName: 'stooq (HG.C)',
	dataQuality: 'live',
	priceField: 'hg',
	render: {
		stages: placeholderStages('copper', [
			{ id: 'penny', maxValue: 0.05, realWorldWidthMetres: 0.019, referenceAmount: 0.006 },
			{ id: 'wire_coil', maxValue: 5, realWorldWidthMetres: 0.15, referenceAmount: 1 },
			{ id: 'bar_1lb', maxValue: 50, realWorldWidthMetres: 0.1, referenceAmount: 1 },
			{ id: 'brick_stack', maxValue: 500, realWorldWidthMetres: 0.4, referenceAmount: 50 },
			{ id: 'pallet', maxValue: 5000, realWorldWidthMetres: 1.2, referenceAmount: 500 },
			{ id: 'ingot_pile', maxValue: null, realWorldWidthMetres: 2.5, referenceAmount: 5000 },
		]),
	},
	facts: [
		{ template: 'enough to wire approximately {n} average UK homes', divisor_kg: 200 },
		{ template: 'equivalent to {n} Tesla Model 3 battery packs\' worth of copper', divisor_kg: 80 },
	],
};

const oil_brent: Commodity = {
	id: 'oil_brent',
	displayName: 'Brent crude',
	renderStyle: 'progression',
	unit: 'barrel',
	densityGPerCm3: 0.835,
	sourceId: 'oil_brent',
	sourceName: 'FRED (DCOILBRENTEU)',
	dataQuality: 'live',
	priceField: 'brent',
	render: {
		stages: placeholderStages('oil_brent', [
			{ id: 'jerrycan', maxValue: 0.5, realWorldWidthMetres: 0.2, referenceAmount: 0.119 },
			{ id: 'drum', maxValue: 10, realWorldWidthMetres: 0.6, referenceAmount: 1 },
			{ id: 'drum_cluster', maxValue: 100, realWorldWidthMetres: 1.5, referenceAmount: 10 },
			{ id: 'road_tanker', maxValue: 2000, realWorldWidthMetres: 12, referenceAmount: 200 },
			{ id: 'tank_farm', maxValue: 50000, realWorldWidthMetres: 30, referenceAmount: 5000 },
			{ id: 'pool', maxValue: null, realWorldWidthMetres: 50, referenceAmount: 15000 },
		]),
		heroScene: 'oil',
	},
	facts: [
		{ template: 'roughly {n} full tanks for a mid-size car (~50 L)', divisor_litres: 50 },
		{ template: 'fuel for {n} transatlantic flights (~150,000 L each)', divisor_litres: 150000 },
	],
};

const natgas: Commodity = {
	id: 'natgas',
	displayName: 'Natural gas',
	renderStyle: 'progression',
	unit: 'mmbtu',
	densityGPerCm3: 0.000717,
	sourceId: 'natgas',
	sourceName: 'FRED (DHHNGSP)',
	dataQuality: 'live',
	priceField: 'natgas',
	render: {
		stages: placeholderStages('natgas', [
			{ id: 'cube_small', maxValue: 10, realWorldWidthMetres: 3, referenceAmount: 1 },
			{ id: 'cube_medium', maxValue: 100, realWorldWidthMetres: 7, referenceAmount: 10 },
			{ id: 'cube_large', maxValue: 1000, realWorldWidthMetres: 15, referenceAmount: 100 },
			{ id: 'cube_xlarge', maxValue: null, realWorldWidthMetres: 30, referenceAmount: 1000 },
		]),
	},
	facts: [
		{ template: 'enough to heat {n} average UK homes for a year (~12,000 kWh)', divisor_litres: 33900000 },
		{ template: '≈ {n} Olympic swimming pools of gas at atmospheric pressure', divisor_litres: 2500000 },
	],
};

const uranium_fuel_pellet: Commodity = {
	id: 'uranium_fuel_pellet',
	displayName: 'Nuclear fuel pellet (LEU UO₂)',
	renderStyle: 'progression',
	unit: 'pellet',
	unitMassGrams: 7,
	densityGPerCm3: 10.97,
	sourceId: 'uranium_fuel_pellet',
	sourceName: 'Composite estimate (WNA, IAEA/OECD-NEA Red Book)',
	dataQuality: 'illustrative',
	priceField: 'uranium_fuel_pellet',
	render: {
		stages: placeholderStages('uranium_fuel_pellet', [
			{ id: 'single_pellet', maxValue: 10, realWorldWidthMetres: 0.013, referenceAmount: 1 },
			{ id: 'handful', maxValue: 200, realWorldWidthMetres: 0.08, referenceAmount: 50 },
			{ id: 'fuel_rod_worth', maxValue: 2000, realWorldWidthMetres: 0.4, referenceAmount: 350 },
			{ id: 'shoebox_pile', maxValue: 20000, realWorldWidthMetres: 0.35, referenceAmount: 4500 },
			{ id: 'pallet', maxValue: null, realWorldWidthMetres: 1.2, referenceAmount: 50000 },
		]),
	},
	facts: [
		{
			template:
				'enough nuclear fuel to power {n} average UK homes for a year (~3,300 kWh per home)',
			divisor_kg: 0.007,
		},
	],
};

// ---------------------------------------------------------------------------
// Optional MVP commodities
// ---------------------------------------------------------------------------

const platinum: Commodity = {
	id: 'platinum',
	displayName: 'Platinum',
	renderStyle: 'progression',
	unit: 'troy_oz',
	unitMassGrams: 31.1035,
	densityGPerCm3: 21.45,
	sourceId: 'platinum',
	sourceName: 'stooq (XPTUSD)',
	dataQuality: 'live',
	priceField: 'xpt',
	render: {
		stages: placeholderStages('platinum', [
			{ id: 'grain', maxValue: 0.5, realWorldWidthMetres: 0.005, referenceAmount: 0.003215 },
			{ id: 'coin', maxValue: 5, realWorldWidthMetres: 0.032, referenceAmount: 1 },
			{ id: 'small_bar', maxValue: 40, realWorldWidthMetres: 0.055, referenceAmount: 3.215 },
			{ id: 'kilo_bar', maxValue: null, realWorldWidthMetres: 0.08, referenceAmount: 32.15 },
		]),
	},
	facts: [
		{ template: '{n} 1-oz Platinum Eagles', divisor_kg: 0.0311035 },
	],
};

const coffee: Commodity = {
	id: 'coffee',
	displayName: 'Arabica coffee',
	renderStyle: 'progression',
	unit: 'lb',
	unitMassGrams: 453.592,
	bulkDensityKgPerM3: 380,
	sourceId: 'coffee',
	sourceName: 'stooq (KC.C)',
	dataQuality: 'live',
	priceField: 'coffee',
	render: {
		stages: placeholderStages('coffee', [
			{ id: 'cup', maxValue: 0.1, realWorldWidthMetres: 0.06, referenceAmount: 0.04 },
			{ id: 'bag_1kg', maxValue: 5, realWorldWidthMetres: 0.15, referenceAmount: 2.2 },
			{ id: 'jute_sack_60kg', maxValue: 100, realWorldWidthMetres: 0.6, referenceAmount: 132 },
			{ id: 'warehouse_stack', maxValue: null, realWorldWidthMetres: 3, referenceAmount: 2000 },
		]),
	},
	facts: [
		{ template: 'about {n} espresso shots (~18 g each)', divisor_kg: 0.018 },
		{ template: '{n} standard 60-kg jute sacks', divisor_kg: 60 },
	],
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/** Core 6 MVP commodities in display order */
export const CORE_COMMODITIES: Commodity[] = [
	gold,
	silver,
	copper,
	oil_brent,
	natgas,
	uranium_fuel_pellet,
];

/** Optional MVP commodities */
export const OPTIONAL_COMMODITIES: Commodity[] = [platinum, coffee];

/** All MVP commodities in display order (core, then optional) */
export const ALL_MVP_COMMODITIES: Commodity[] = [...CORE_COMMODITIES, ...OPTIONAL_COMMODITIES];

/** Lookup commodity by id */
export function getCommodity(id: string): Commodity | undefined {
	return ALL_MVP_COMMODITIES.find((c) => c.id === id);
}
