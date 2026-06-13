/**
 * Data fetchers for each source type.
 *
 * Sources (2026-06-13): BTC → CoinGecko keyless; gold/silver → Yahoo Finance
 * keyless v8 chart; Brent → FRED. Stooq was dropped after it began blocking
 * automated access (JS bot wall + "Access denied" on the data endpoint).
 */

import { type SourceConfig } from './sources.js';

export interface FetchResult {
	data: Map<string, number>;
	httpStatus: number;
	rowCount: number;
	url: string; // with secrets redacted
}

const RETRY_DELAYS = [1000, 3000, 5000];

const USER_AGENT =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
	'(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function fetchWithRetry(url: string, label: string): Promise<Response> {
	for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
		try {
			const res = await fetch(url, {
				headers: { 'User-Agent': USER_AGENT, Accept: 'application/json,text/plain,*/*' },
			});
			if (res.ok) return res;
			if (res.status === 429 && attempt < RETRY_DELAYS.length) {
				console.warn(`  Rate limited on ${label}, retrying in ${RETRY_DELAYS[attempt]}ms...`);
				await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
				continue;
			}
			throw new Error(`HTTP ${res.status} for ${label}`);
		} catch (err) {
			if (attempt < RETRY_DELAYS.length) {
				console.warn(`  Fetch error for ${label}, retrying: ${err}`);
				await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
				continue;
			}
			throw err;
		}
	}
	throw new Error(`Exhausted retries for ${label}`);
}

function redactUrl(url: string): string {
	return url.replace(/apikey=[^&]*/g, 'apikey=***').replace(/api_key=[^&]*/g, 'api_key=***');
}

/**
 * Fetch BTC (or any coin) from the CoinGecko keyless public API.
 *
 * No auth header; the shared pool is IP-throttled (429 → backoff, handled by
 * fetchWithRetry). days=2 stays inside the keyless range. We omit the `interval`
 * param (explicit daily interval is a paid feature) and collapse the returned
 * intraday points to the last price seen per UTC date ≈ that day's close, so the
 * result slots into the same date-keyed model as the other sources.
 */
export async function fetchCoinGecko(source: SourceConfig): Promise<FetchResult> {
	const url = `https://api.coingecko.com/api/v3/coins/${source.symbol}/market_chart?vs_currency=usd&days=2`;

	console.log(`  Fetching CoinGecko ${source.symbol} (market_chart days=2)...`);
	const res = await fetchWithRetry(url, `coingecko:${source.symbol}`);
	const json = (await res.json()) as { prices?: [number, number][] };

	const data = new Map<string, number>();
	for (const point of json.prices ?? []) {
		const [ts, price] = point;
		if (typeof price !== 'number' || !isFinite(price)) continue;
		const dateStr = new Date(ts).toISOString().slice(0, 10);
		data.set(dateStr, price); // last write wins → latest point of each UTC day
	}

	if (data.size === 0) {
		throw new Error(`coingecko:${source.symbol} returned no price points`);
	}

	console.log(`  → ${data.size} day(s) for ${source.symbol}`);
	return { data, httpStatus: res.status, rowCount: data.size, url };
}

/**
 * Fetch a daily close series from Yahoo Finance's keyless v8 chart API.
 *
 * No key required; a browser User-Agent (set in fetchWithRetry) avoids Yahoo's
 * default-client block. `range` defaults to a short window for the daily cron;
 * bootstrap passes "max" to pull full history. Symbols are configured in
 * sources.ts (e.g. "XAUUSD=X" for spot gold) so they can be swapped to futures
 * ("GC=F"/"SI=F") without code changes if Yahoo ever drops the FX pair.
 */
export async function fetchYahoo(source: SourceConfig, range = '5d'): Promise<FetchResult> {
	const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
		source.symbol
	)}?interval=1d&range=${range}`;

	console.log(`  Fetching Yahoo ${source.symbol} (range=${range})...`);
	const res = await fetchWithRetry(url, `yahoo:${source.symbol}`);
	const json = (await res.json()) as {
		chart?: {
			result?: Array<{
				timestamp?: number[];
				indicators?: { quote?: Array<{ close?: (number | null)[] }> };
			}>;
			error?: { description?: string } | null;
		};
	};

	const result = json.chart?.result?.[0];
	if (!result) {
		const msg = json.chart?.error?.description ?? 'no chart result';
		throw new Error(`yahoo:${source.symbol}: ${msg}`);
	}

	const timestamps = result.timestamp ?? [];
	const closes = result.indicators?.quote?.[0]?.close ?? [];

	const data = new Map<string, number>();
	for (let i = 0; i < timestamps.length; i++) {
		const close = closes[i];
		if (typeof close !== 'number' || !isFinite(close)) continue;
		// Yahoo timestamps are epoch seconds.
		const dateStr = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
		data.set(dateStr, close);
	}

	if (data.size === 0) {
		throw new Error(`yahoo:${source.symbol} returned no usable closes`);
	}

	console.log(`  → ${data.size} rows for ${source.symbol}`);
	return { data, httpStatus: res.status, rowCount: data.size, url };
}

// GoldAPI.io spot quote (used for silver). One value per call; cached per
// symbol so a multi-day catch-up run doesn't burn the free-tier quota.
const goldApiCache = new Map<string, number>();

/**
 * Fetch a precious-metal spot price (USD/troy oz) from GoldAPI.io.
 *
 * Requires GOLDAPI_KEY. Returns the latest spot keyed to `dateISO` (the cron
 * targets the previous day and silver barely moves in the ~2h since its close,
 * so latest-spot is an acceptable stand-in and avoids the historical endpoint's
 * tighter quota). `source.symbol` is the metal code, e.g. "XAG".
 */
export async function fetchGoldApi(source: SourceConfig, dateISO: string): Promise<FetchResult> {
	const apiKey = process.env.GOLDAPI_KEY;
	if (!apiKey) {
		throw new Error('GOLDAPI_KEY environment variable is required');
	}

	const url = `https://www.goldapi.io/api/${source.symbol}/USD`;
	let price = goldApiCache.get(source.symbol);

	if (price === undefined) {
		console.log(`  Fetching GoldAPI ${source.symbol}/USD (spot)...`);
		const res = await fetch(url, {
			headers: { 'x-access-token': apiKey, Accept: 'application/json' },
		});
		if (!res.ok) {
			throw new Error(`HTTP ${res.status} for goldapi:${source.symbol}`);
		}
		const json = (await res.json()) as { price?: number };
		if (typeof json.price !== 'number' || !isFinite(json.price)) {
			throw new Error(`goldapi:${source.symbol} returned no usable price`);
		}
		price = json.price;
		goldApiCache.set(source.symbol, price);
		console.log(`  → ${source.symbol} spot ${price} USD/oz`);
	}

	const data = new Map<string, number>([[dateISO, price]]);
	return { data, httpStatus: 200, rowCount: 1, url };
}

/**
 * Fetch from FRED API.
 * Requires FRED_API_KEY env var.
 */
export async function fetchFRED(
	source: SourceConfig,
	startDate: Date,
	endDate: Date
): Promise<FetchResult> {
	const apiKey = process.env.FRED_API_KEY;
	if (!apiKey) {
		throw new Error('FRED_API_KEY environment variable is required');
	}

	const start = startDate.toISOString().slice(0, 10);
	const end = endDate.toISOString().slice(0, 10);
	const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${source.symbol}&observation_start=${start}&observation_end=${end}&api_key=${apiKey}&file_type=json`;

	console.log(`  Fetching FRED ${source.symbol} (${start} to ${end})...`);
	const res = await fetchWithRetry(url, `fred:${source.symbol}`);
	const json = await res.json();

	const data = new Map<string, number>();
	for (const obs of json.observations || []) {
		const val = parseFloat(obs.value);
		if (isNaN(val) || obs.value === '.') continue;
		data.set(obs.date, val);
	}

	console.log(`  → ${data.size} rows for ${source.symbol}`);
	return { data, httpStatus: res.status, rowCount: data.size, url };
}
