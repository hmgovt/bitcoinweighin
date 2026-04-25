/**
 * Data fetchers for each source type.
 */

import { formatDateCompact, type SourceConfig } from './sources.js';

export interface FetchResult {
	data: Map<string, number>;
	httpStatus: number;
	rowCount: number;
	url: string; // with secrets redacted
}

const RETRY_DELAYS = [1000, 3000, 5000];

async function fetchWithRetry(url: string, label: string): Promise<Response> {
	for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
		try {
			const res = await fetch(url);
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
 * Fetch from stooq CSV endpoint.
 * Returns FetchResult with data, HTTP status, row count, and redacted URL.
 */
export async function fetchStooq(
	source: SourceConfig,
	startDate: Date,
	endDate: Date
): Promise<FetchResult> {
	const d1 = formatDateCompact(startDate);
	const d2 = formatDateCompact(endDate);
	const apiKey = process.env.STOOQ_API_KEY || '';
	const url = `https://stooq.com/q/d/l/?s=${source.symbol}&d1=${d1}&d2=${d2}&i=d&apikey=${apiKey}`;

	console.log(`  Fetching stooq ${source.symbol} (${d1}-${d2})...`);
	const res = await fetchWithRetry(url, `stooq:${source.symbol}`);
	const text = await res.text();

	const data = new Map<string, number>();
	const lines = text.trim().split('\n');

	// Header: Date,Open,High,Low,Close,Volume (or similar)
	for (let i = 1; i < lines.length; i++) {
		const cols = lines[i].split(',');
		if (cols.length < 5) continue;

		const dateStr = cols[0].trim();
		const close = parseFloat(cols[4]);
		if (isNaN(close)) continue;

		// stooq dates are YYYY-MM-DD
		data.set(dateStr, close);
	}

	console.log(`  → ${data.size} rows for ${source.symbol}`);
	return { data, httpStatus: res.status, rowCount: data.size, url: redactUrl(url) };
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
	return { data, httpStatus: res.status, rowCount: data.size, url: redactUrl(url) };
}

