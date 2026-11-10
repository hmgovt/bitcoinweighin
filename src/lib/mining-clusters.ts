/**
 * Bitcoin mining cluster data.
 *
 * Sources: Cambridge CBECI, public mining company disclosures, EIA flare
 * reports, satellite imaging studies, and contemporaneous press coverage.
 * Percentages are estimates of global hashrate share; they will not sum to
 * exactly 100% — the residual is small/unknown/offshore operations.
 *
 * Types:
 *   industrial   — large grid-connected ASIC warehouse farms
 *   flare        — stranded/flared natural gas capture (wellhead or pipeline)
 *   hydro        — behind-the-meter hydroelectric surplus
 *   geothermal   — geothermal generation surplus (Iceland)
 *   nuclear      — proximity to nuclear baseload (US)
 */

export type MiningType = 'industrial' | 'flare' | 'hydro' | 'geothermal' | 'nuclear';

export interface MiningCluster {
	id: string;
	name: string;
	lat: number;
	lng: number;
	/** Estimated share of global hashrate, 0–100 */
	hashratePct: number;
	type: MiningType;
	country: string;
	note?: string;
}

export const MINING_CLUSTERS: MiningCluster[] = [
	// ── USA ────────────────────────────────────────────────────────────────
	// Rockdale TX: Riot Platforms Whinstone — one of the world's largest
	{ id: 'tx-rockdale', name: 'Rockdale, TX', lat: 30.65, lng: -97.01, hashratePct: 5.5, type: 'industrial', country: 'US', note: 'Riot Platforms Whinstone' },
	// ERCOT grid / broader Texas Hill Country industrial build-out
	{ id: 'tx-ercot', name: 'West Texas Grid', lat: 31.9, lng: -99.1, hashratePct: 5, type: 'industrial', country: 'US' },
	// Permian Basin flare capture — Crusoe Energy, ExxonMobil, others
	{ id: 'tx-permian', name: 'Permian Basin', lat: 31.8, lng: -102.4, hashratePct: 4, type: 'flare', country: 'US', note: 'Gas flare capture' },
	// Bakken shale North Dakota — significant flare capture mining
	{ id: 'nd-bakken', name: 'Bakken, ND', lat: 47.8, lng: -103.1, hashratePct: 2, type: 'flare', country: 'US', note: 'Bakken flare capture' },
	// Georgia — Core Scientific legacy facilities
	{ id: 'ga-us', name: 'Georgia', lat: 33.4, lng: -84.4, hashratePct: 4, type: 'industrial', country: 'US' },
	// Kentucky — historical coal belt cheap power
	{ id: 'ky-us', name: 'Kentucky', lat: 37.5, lng: -85.5, hashratePct: 3, type: 'industrial', country: 'US' },
	// Upstate New York — Niagara hydro, Greenidge Generation
	{ id: 'ny-us', name: 'Upstate New York', lat: 43.1, lng: -76.2, hashratePct: 2, type: 'hydro', country: 'US', note: 'Niagara hydro / Seneca Lake' },
	// Wyoming / Montana — cheap wind and gas
	{ id: 'wy-us', name: 'Wyoming / Montana', lat: 44.5, lng: -107.2, hashratePct: 2, type: 'industrial', country: 'US' },
	// Nuclear: Illinois Constellation Energy deal (EDF)
	{ id: 'il-us', name: 'Illinois', lat: 41.9, lng: -88.6, hashratePct: 1.5, type: 'nuclear', country: 'US', note: 'Constellation nuclear co-location' },

	// ── Canada ─────────────────────────────────────────────────────────────
	// Quebec — Bitfarms, Hydro-Québec surplus
	{ id: 'ca-qc', name: 'Québec', lat: 46.8, lng: -71.2, hashratePct: 3.5, type: 'hydro', country: 'CA', note: 'Hydro-Québec surplus' },
	// Alberta — natural gas, stranded wellhead
	{ id: 'ca-ab', name: 'Alberta', lat: 53.5, lng: -113.5, hashratePct: 2.5, type: 'flare', country: 'CA', note: 'Wellhead gas capture' },
	// British Columbia — hydro surplus
	{ id: 'ca-bc', name: 'British Columbia', lat: 53.7, lng: -127.6, hashratePct: 1, type: 'hydro', country: 'CA' },

	// ── Kazakhstan ─────────────────────────────────────────────────────────
	// Ekibastuz — massive coal-powered industrial cluster
	{ id: 'kz-ekib', name: 'Ekibastuz', lat: 51.7, lng: 75.4, hashratePct: 7, type: 'industrial', country: 'KZ', note: 'Coal-powered; major exodus from China 2021' },
	// Nur-Sultan / Astana area
	{ id: 'kz-astana', name: 'Astana region', lat: 51.2, lng: 71.4, hashratePct: 4, type: 'industrial', country: 'KZ' },
	// Karaganda region
	{ id: 'kz-kara', name: 'Karaganda', lat: 49.8, lng: 73.1, hashratePct: 3, type: 'industrial', country: 'KZ' },

	// ── Russia ─────────────────────────────────────────────────────────────
	// Irkutsk region — heavily subsidised residential electricity, massive gray-market home mining
	{ id: 'ru-irkutsk', name: 'Irkutsk region', lat: 52.3, lng: 104.3, hashratePct: 4, type: 'hydro', country: 'RU', note: 'Subsidised hydro; large informal mining' },
	// Bratsk — Bratsk hydroelectric dam
	{ id: 'ru-bratsk', name: 'Bratsk', lat: 56.1, lng: 101.6, hashratePct: 2.5, type: 'hydro', country: 'RU', note: 'Bratsk Dam' },
	// Norilsk / Siberian industrial
	{ id: 'ru-norilsk', name: 'Norilsk / Ob basin', lat: 64.4, lng: 87.1, hashratePct: 1.5, type: 'industrial', country: 'RU' },
	// Western Siberia flare capture — Yamal, KHMAO
	{ id: 'ru-yamal', name: 'Western Siberia flares', lat: 61.5, lng: 68.9, hashratePct: 1.5, type: 'flare', country: 'RU', note: 'Yamal / KHMAO gas flare capture' },

	// ── Europe ─────────────────────────────────────────────────────────────
	// Iceland — geothermal (Genesis Mining, Hive legacy)
	{ id: 'is', name: 'Iceland', lat: 64.1, lng: -21.9, hashratePct: 1.5, type: 'geothermal', country: 'IS', note: 'Geothermal surplus' },
	// Norway — hydro surplus
	{ id: 'no', name: 'Norway', lat: 62.3, lng: 9.5, hashratePct: 1, type: 'hydro', country: 'NO', note: 'Hydro surplus' },
	// Sweden — Northvolt / Nordic hydro
	{ id: 'se', name: 'Sweden', lat: 62.0, lng: 15.0, hashratePct: 0.8, type: 'hydro', country: 'SE' },
	// Germany — industrial scale
	{ id: 'de', name: 'Germany', lat: 51.2, lng: 10.4, hashratePct: 1.5, type: 'industrial', country: 'DE' },
	// Ireland — data-centre density, wind surplus
	{ id: 'ie', name: 'Ireland', lat: 53.3, lng: -8.2, hashratePct: 0.8, type: 'industrial', country: 'IE' },

	// ── Middle East ────────────────────────────────────────────────────────
	// UAE — government-backed large facilities
	{ id: 'ae', name: 'Abu Dhabi / Dubai', lat: 24.2, lng: 54.4, hashratePct: 2.5, type: 'industrial', country: 'AE', note: 'State-backed' },
	// Oman — gas surplus
	{ id: 'om', name: 'Oman', lat: 23.6, lng: 58.6, hashratePct: 0.5, type: 'flare', country: 'OM' },

	// ── Africa ─────────────────────────────────────────────────────────────
	// Ethiopia — GERD (Grand Ethiopian Renaissance Dam) surplus
	{ id: 'et', name: 'Ethiopia (GERD)', lat: 11.2, lng: 38.7, hashratePct: 2, type: 'hydro', country: 'ET', note: 'Grand Ethiopian Renaissance Dam' },

	// ── Asia-Pacific ────────────────────────────────────────────────────────
	// Malaysia — Sarawak hydro, cheap grid power
	{ id: 'my-sarawak', name: 'Sarawak, Malaysia', lat: 2.5, lng: 113.7, hashratePct: 2, type: 'hydro', country: 'MY', note: 'Sarawak hydro surplus' },
	// Peninsular Malaysia
	{ id: 'my-kl', name: 'Peninsular Malaysia', lat: 3.1, lng: 101.7, hashratePct: 1, type: 'industrial', country: 'MY' },

	// ── South America ──────────────────────────────────────────────────────
	// Paraguay — Itaipu Dam; world's 2nd largest hydro plant, large surplus
	{ id: 'py', name: 'Paraguay (Itaipu)', lat: -25.5, lng: -54.6, hashratePct: 2, type: 'hydro', country: 'PY', note: 'Itaipu Dam surplus' },
	// Argentina Patagonia — wind / hydro
	{ id: 'ar-patagon', name: 'Patagonia', lat: -44.2, lng: -67.0, hashratePct: 0.8, type: 'hydro', country: 'AR', note: 'Wind + hydro surplus' },
	// Brazil — some Amazon hydro
	{ id: 'br', name: 'Brazil', lat: -8.0, lng: -53.0, hashratePct: 0.5, type: 'hydro', country: 'BR' },
];

/**
 * Approximate solo miner statistics.
 *
 * "Solo mining" here means: mining through a solo pool (primarily CKPool
 * Solo / Ocean) or directly, where the miner keeps the entire block reward.
 * The hardware is predominantly Bitaxe (open-source BM1366/BM1368 boards,
 * ~400–1200 GH/s each) plus home Antminers, S9s, and Nerdminers.
 *
 * CKPool Solo regularly reports 10–20 PH/s; accounting for unlisted pools
 * and direct miners the total is likely 30–50 PH/s.
 *
 * Newer Bitaxe Ultra/Gamma boards (BM1368/BM1370) hash at 600–1,200 GH/s.
 * At ~667 GH/s average per device: 40 PH/s ÷ 0.000667 TH/s ≈ 60,000 devices.
 */
export const SOLO_HASHRATE_PH_S = 40; // conservative midpoint estimate
export const SOLO_DEVICE_COUNT = 60_000; // Bitaxe + home ASICs
export const SOLO_AVG_WEIGHT_KG = 0.18; // Bitaxe ≈ 0.12 kg; S9 ≈ 4 kg; blended

/**
 * Where solo/home miners cluster, for the globe's dot field
 * (src/lib/mining-dots.ts scatters dots around these, on land).
 * Concentrated in regions with Bitcoin culture and home-hardware
 * availability: North America, Western Europe, Oceania, Japan, Korea.
 * `weight` is a relative share of the home fleet; `spread` is the
 * Gaussian sigma in degrees.
 */
export interface SoloRegion {
	name: string;
	lat: number;
	lng: number;
	spread: number;
	weight: number;
}

export const SOLO_REGIONS: SoloRegion[] = [
	{ name: 'US Northeast', lat: 40.5, lng: -76, spread: 3, weight: 50 },
	{ name: 'US Southeast', lat: 33.5, lng: -84, spread: 3.5, weight: 35 },
	{ name: 'US Midwest', lat: 41.5, lng: -88, spread: 4, weight: 35 },
	{ name: 'Texas', lat: 31, lng: -97, spread: 3, weight: 30 },
	{ name: 'US West Coast', lat: 37, lng: -121, spread: 3.5, weight: 40 },
	{ name: 'US Mountain', lat: 40, lng: -108, spread: 4, weight: 14 },
	{ name: 'Canada', lat: 45.5, lng: -77, spread: 4, weight: 22 },
	{ name: 'Western Canada', lat: 51, lng: -116, spread: 3.5, weight: 10 },
	{ name: 'UK / Ireland', lat: 52.8, lng: -2, spread: 2, weight: 26 },
	{ name: 'Benelux / Germany', lat: 51, lng: 8, spread: 2.5, weight: 40 },
	{ name: 'France', lat: 47, lng: 2.5, spread: 2.5, weight: 18 },
	{ name: 'Iberia', lat: 40, lng: -4, spread: 2.5, weight: 14 },
	{ name: 'Italy', lat: 43.5, lng: 11.5, spread: 2.2, weight: 12 },
	{ name: 'Central Europe', lat: 48.5, lng: 16.5, spread: 2.5, weight: 18 },
	{ name: 'Scandinavia', lat: 60, lng: 15, spread: 3, weight: 14 },
	{ name: 'Poland / Baltics', lat: 53, lng: 22, spread: 3, weight: 14 },
	{ name: 'Eastern Europe', lat: 48, lng: 29, spread: 3.5, weight: 10 },
	{ name: 'Japan', lat: 36, lng: 138.5, spread: 2.2, weight: 24 },
	{ name: 'South Korea', lat: 36.5, lng: 127.5, spread: 1.2, weight: 12 },
	{ name: 'Australia east', lat: -32, lng: 150, spread: 3, weight: 20 },
	{ name: 'Australia south/west', lat: -34, lng: 125, spread: 9, weight: 8 },
	{ name: 'New Zealand', lat: -40, lng: 174, spread: 2, weight: 5 },
	{ name: 'Brazil', lat: -22, lng: -46, spread: 4, weight: 12 },
	{ name: 'Argentina', lat: -34, lng: -60, spread: 3, weight: 8 },
	{ name: 'Mexico', lat: 20, lng: -100, spread: 3, weight: 7 },
	{ name: 'South Africa', lat: -27, lng: 27, spread: 3, weight: 6 },
	{ name: 'El Salvador', lat: 13.7, lng: -89, spread: 0.6, weight: 3 },
];

/** Colour for each mining type — used by globe and legend. */
export const CLUSTER_COLORS: Record<MiningType, string> = {
	industrial: '#f59e0b', // amber-500
	flare:      '#ef4444', // red-500
	hydro:      '#2dd4bf', // teal-400 (sky is the solo-miner colour)
	geothermal: '#a78bfa', // violet-400
	nuclear:    '#4ade80', // green-400
};
