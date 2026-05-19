/**
 * MVP commodity catalogue for Bitcoin Weigh-In.
 *
 * Page render loop iterates `mvpLaunch === true` commodities sorted ascending
 * by `pageOrder`. Locked launch order (2026-05-04 four-commodity pivot):
 *   1. gold
 *   2. silver
 *   3. pu238
 *   4. cocaine
 *
 * Other commodities (copper, oil_brent, uranium_fuel_pellet, platinum, coffee)
 * remain in this file flagged `mvpLaunch: false`. They re-enter post-launch.
 */

export type RenderStyle =
	| 'cube' // gold, silver, Pu-238
	| 'still_with_readout' // cocaine
	| 'progression' // legacy, unused at MVP
	| 'vessel' // legacy, unused at MVP
	| 'bulk'; // legacy, unused at MVP

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
	 * Whether this commodity is part of the launch render loop. The page
	 * iterates only `mvpLaunch === true`, sorted ascending by `pageOrder`.
	 * Inactive entries remain in this file with their schema preserved for
	 * post-launch re-enable.
	 */
	mvpLaunch: boolean;
	/** Render order on the launch page (1-indexed). Required when mvpLaunch === true. */
	pageOrder?: number;
	/**
	 * Rendering vocabulary.
	 * - "cube": single cube sprite at intrinsic volume against the universal Shiba (gold, silver, Pu-238).
	 * - "still_with_readout": forensic still + dynamic readout (cocaine).
	 * - "progression" / "vessel" / "bulk": legacy, unused at MVP — preserved for post-launch revival.
	 */
	renderStyle: RenderStyle;
	/** Pu-238 only: cube renderer applies blackbody-glow overlay when true. */
	glowScales?: boolean;
	/** Pu-238 only: cube renderer applies opt-in Geiger crackle audio when true (default off, flip via ?audio=on). */
	geigerCrackle?: boolean;
	/** Pu-238 only: ~17 Ci/g; drives Geiger click rate in Stage 6. */
	specificActivityCiPerGram?: number;
	/** Mandatory persistent caption (Pu-238 uses this — non-fissile, not weapons material). */
	brandVoiceClarification?: string;
	/** Key into quantity-anchors.json for proximity fact-card firing. */
	quantityAnchorsKey?: string;
	unit: 'troy_oz' | 'lb' | 'barrel' | 'gram' | 'kg' | 'pellet';
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
	/** Field name in prices.json (live) or key into illustrative-prices.json (illustrative). */
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
	mvpLaunch: true,
	pageOrder: 1,
	renderStyle: 'cube',
	quantityAnchorsKey: 'gold',
	unit: 'troy_oz',
	unitMassGrams: 31.1035,
	densityGPerCm3: 19.3,
	cubeSpritePath: '/sprites/gold/cube@2x.webp',
	cubeShadowPath: '/sprites/gold/cube-shadow@2x.webp',
	sourceId: 'gold',
	sourceName: 'stooq (XAUUSD)',
	dataQuality: 'live',
	priceField: 'xau',
	// 10-stage progression definition removed under cube-mode pivot (2026-04-25).
	// Tile-mode rendering remains in the schema (RenderStage.renderMode/tileConfig)
	// for potential future use by other commodities, but is unused by gold.
	// Stub sprites live in static/sprites/gold/_stubs/ — preserved on disk for
	// the potential future "show me bars instead" toggle.
	facts: [
		{ template: 'about {n} standard wedding rings (~4 g each)', divisor_kg: 0.004 },
		{ template: '{n} Good Delivery bars (400 oz each)', divisor_kg: 12.4 },
	],
};

const silver: Commodity = {
	id: 'silver',
	displayName: 'Silver',
	mvpLaunch: true,
	pageOrder: 2,
	renderStyle: 'cube',
	quantityAnchorsKey: 'silver',
	unit: 'troy_oz',
	unitMassGrams: 31.1035,
	densityGPerCm3: 10.49,
	cubeSpritePath: '/sprites/silver/cube@2x.webp',
	cubeShadowPath: '/sprites/silver/cube-shadow@2x.webp',
	sourceId: 'silver',
	sourceName: 'stooq (XAGUSD)',
	dataQuality: 'live',
	priceField: 'xag',
	facts: [
		{ template: '{n} 1-oz American Silver Eagles', divisor_kg: 0.0311035 },
		{ template: '{n} US Mint "monster boxes" (500 oz each)', divisor_kg: 15.55 },
	],
};

const pu238: Commodity = {
	id: 'pu238',
	displayName: 'Plutonium-238',
	mvpLaunch: true,
	pageOrder: 3,
	renderStyle: 'cube',
	glowScales: true,
	geigerCrackle: true,
	specificActivityCiPerGram: 17,
	brandVoiceClarification:
		'The radioisotope that powers spacecraft. Non-fissile, not weapons material.',
	unit: 'gram',
	unitMassGrams: 1,
	densityGPerCm3: 19.8,
	cubeSpritePath: '/sprites/pu238/cube@2x.webp',
	cubeShadowPath: '/sprites/pu238/cube-shadow@2x.webp',
	sourceId: 'pu238',
	sourceName: 'DOE / NASA Planetary Science (composite estimate)',
	dataQuality: 'illustrative',
	priceField: 'pu238',
	facts: [],
};

const cocaine: Commodity = {
	id: 'cocaine',
	displayName: 'Cocaine',
	mvpLaunch: true,
	pageOrder: 4,
	renderStyle: 'still_with_readout',
	unit: 'gram',
	unitMassGrams: 1,
	sourceId: 'cocaine',
	sourceName: 'UNODC / DEA / EMCDDA (composite illustrative)',
	dataQuality: 'illustrative',
	priceField: 'cocaine',
	facts: [],
};

const copper: Commodity = {
	id: 'copper',
	displayName: 'Copper',
	mvpLaunch: false,
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
		{ template: 'enough to wire approximately {n} average US homes', divisor_kg: 200 },
		{ template: 'equivalent to {n} Tesla Model 3 battery packs\' worth of copper', divisor_kg: 80 },
	],
};

const oil_brent: Commodity = {
	id: 'oil_brent',
	displayName: 'Brent crude',
	mvpLaunch: false,
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

const uranium_fuel_pellet: Commodity = {
	id: 'uranium_fuel_pellet',
	displayName: 'Nuclear fuel pellet (LEU UO₂)',
	mvpLaunch: false,
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
				'enough nuclear fuel to power {n} average US homes for a year (~10,500 kWh per home)',
			divisor_kg: 0.0223,
		},
	],
};

// ---------------------------------------------------------------------------
// Optional MVP commodities
// ---------------------------------------------------------------------------

const platinum: Commodity = {
	id: 'platinum',
	displayName: 'Platinum',
	mvpLaunch: false,
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
	mvpLaunch: false,
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

/** All commodities in this file — launch + deferred. Used for id lookup. */
export const ALL_COMMODITIES: Commodity[] = [
	gold,
	silver,
	pu238,
	cocaine,
	copper,
	oil_brent,
	uranium_fuel_pellet,
	platinum,
	coffee,
];

/**
 * Launch commodities, sorted by `pageOrder`. Single source of truth for the
 * page render loop: 1=gold, 2=silver, 3=pu238, 4=cocaine.
 */
export const LAUNCH_COMMODITIES: Commodity[] = ALL_COMMODITIES.filter(
	(c) => c.mvpLaunch
).sort((a, b) => (a.pageOrder ?? 0) - (b.pageOrder ?? 0));

/**
 * Back-compat alias for `LAUNCH_COMMODITIES`. Kept so existing consumers
 * (e.g. `src/routes/+page.svelte`) keep compiling without touching component
 * code in this stage. Migrate consumers to `LAUNCH_COMMODITIES` in Stage 3+.
 *
 * @deprecated Use `LAUNCH_COMMODITIES` instead.
 */
export const CORE_COMMODITIES: Commodity[] = LAUNCH_COMMODITIES;

/** Lookup commodity by id (across both launch and deferred sets). */
export function getCommodity(id: string): Commodity | undefined {
	return ALL_COMMODITIES.find((c) => c.id === id);
}
