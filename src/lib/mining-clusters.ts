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
 * At 500 GH/s average per device: 30 PH/s ÷ 0.5 TH/s ≈ 60,000 devices.
 */
export const SOLO_HASHRATE_PH_S = 40; // conservative midpoint estimate
export const SOLO_DEVICE_COUNT = 60_000; // Bitaxe + home ASICs
export const SOLO_AVG_WEIGHT_KG = 0.18; // Bitaxe ≈ 0.12 kg; S9 ≈ 4 kg; blended

/**
 * Seeded pseudo-random solo miner dots for globe rendering.
 * Concentrated in regions with high residential electricity + Bitcoin culture:
 * North America, Western Europe, Oceania, Japan, South Korea.
 */
export interface SoloDot {
	lat: number;
	lng: number;
}

function seededRandom(seed: number): () => number {
	let s = seed;
	return () => {
		s = (s * 1664525 + 1013904223) & 0xffffffff;
		return (s >>> 0) / 0xffffffff;
	};
}

function generateSoloDots(): SoloDot[] {
	const rng = seededRandom(0xb17c01);
	const dots: SoloDot[] = [];

	// Region definitions: [lat_centre, lng_centre, lat_spread, lng_spread, count]
	const regions: [number, number, number, number, number][] = [
		// USA (high Bitaxe concentration)
		[38, -96, 12, 30, 120],
		// Western Europe
		[51, 10, 8, 22, 80],
		// UK / Ireland
		[53, -3, 4, 8, 30],
		// Scandinavia
		[62, 14, 5, 12, 25],
		// Australia
		[-27, 134, 8, 18, 40],
		// Japan
		[37, 138, 4, 8, 35],
		// South Korea
		[37, 127, 2, 4, 20],
		// Canada
		[52, -95, 8, 30, 40],
		// South America
		[-15, -55, 18, 30, 25],
		// Eastern Europe / Baltics
		[52, 22, 6, 18, 20],
	];

	const rngActual = seededRandom(181701);
	for (const [latC, lngC, latS, lngS, count] of regions) {
		for (let i = 0; i < count; i++) {
			const u1 = rngActual();
			const u2 = rngActual();
			// Box-Muller for Gaussian distribution around centre
			const z0 = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
			const z1 = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.sin(2 * Math.PI * u2);
			dots.push({
				lat: Math.max(-85, Math.min(85, latC + z0 * latS * 0.5)),
				lng: lngC + z1 * lngS * 0.5,
			});
		}
	}

	return dots;
}

export const SOLO_DOTS: SoloDot[] = generateSoloDots();

/** Colour for each mining type — used by globe and legend. */
export const CLUSTER_COLORS: Record<MiningType, string> = {
	industrial: '#f59e0b', // amber-500
	flare:      '#ef4444', // red-500
	hydro:      '#38bdf8', // sky-400
	geothermal: '#a78bfa', // violet-400
	nuclear:    '#4ade80', // green-400
};
