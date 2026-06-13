/**
 * Bootstrap script: fetches full commodity + BTC price history from 2013-01-01 to yesterday.
 * Writes data/prices.ndjson (one JSON line per date).
 *
 * Usage: FRED_API_KEY=xxx npx tsx scripts/bootstrap.ts
 */

import 'dotenv/config';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import {
	SOURCES,
	START_DATE,
	yesterday,
	formatDateISO,
	dateRange,
	parseDate,
	forwardFill,
	interpolateSmallGaps,
	btcCirculatingSupply,
} from './sources.js';
import { fetchFRED, fetchCoinGecko, fetchGoldApi, type FetchResult } from './fetchers.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'data');
const NDJSON_PATH = join(DATA_DIR, 'prices.ndjson');

async function main() {
	console.log('=== Bitcoin Weigh-In: Bootstrap ===\n');

	const startDate = parseDate(START_DATE);
	const endDate = yesterday();
	const endISO = formatDateISO(endDate);
	const dates = dateRange(START_DATE, endISO);

	console.log(`Date range: ${START_DATE} to ${endISO} (${dates.length} days)\n`);

	// Fetch all sources (BTC is now a stooq source like everything else)
	const allData: Record<string, Map<string, number>> = {};
	const health: Record<string, { status: string; rows: number; error?: string }> = {};

	for (const source of SOURCES) {
		console.log(`Fetching ${source.id} (${source.type}:${source.symbol})...`);
		try {
			let result: FetchResult;
			if (source.type === 'fred') {
				result = await fetchFRED(source, startDate, endDate);
			} else if (source.type === 'goldapi') {
				// NOTE: GoldAPI returns spot only — no deep history on the free tier.
				// A full silver re-bootstrap isn't possible here; rely on the committed
				// prices.ndjson for historical silver.
				result = await fetchGoldApi(source, endISO);
			} else if (source.type === 'coingecko') {
				// NOTE: keyless CoinGecko serves only recent history (long ranges are
				// paid), so a full BTC re-bootstrap back to 2013 isn't possible here —
				// rely on the committed prices.ndjson or a paid key for deep history.
				result = await fetchCoinGecko(source);
			} else {
				throw new Error(`Unknown source type: ${source.type}`);
			}

			// Interpolate small gaps (≤3 days) before forward-fill
			const interpolated = interpolateSmallGaps(result.data, dates);
			if (interpolated.length > 0) {
				console.log(`  Interpolated ${interpolated.length} gap days`);
			}

			allData[source.field] = result.data;
			health[source.id] = { status: 'ok', rows: result.data.size };

			// Rate limit between sources
			await new Promise((r) => setTimeout(r, 1500));
		} catch (err: any) {
			console.error(`  FAILED: ${err.message}`);
			health[source.id] = { status: 'error', rows: 0, error: err.message };
			allData[source.field] = new Map();

			// BTC is required — abort if it fails
			if (source.field === 'btc') {
				console.error('BTC data is required. Aborting.');
				process.exit(1);
			}
		}
	}

	// Forward-fill all series
	console.log('\nForward-filling gaps...');
	for (const [field, data] of Object.entries(allData)) {
		const { filled, filledDates } = forwardFill(data, dates);
		allData[field] = filled;
		if (filledDates.length > 0) {
			console.log(`  ${field}: forward-filled ${filledDates.length} dates`);
		}
	}

	// Write NDJSON
	console.log('\nWriting prices.ndjson...');
	if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

	const lines: string[] = [];
	let skipped = 0;

	for (const date of dates) {
		const btcPrice = allData['btc'].get(date);
		if (btcPrice === undefined) {
			skipped++;
			continue;
		}

		const row: Record<string, any> = {
			date,
			btc: btcPrice,
			btc_supply: btcCirculatingSupply(date),
		};

		for (const source of SOURCES) {
			if (source.field === 'btc') continue; // already added above
			const val = allData[source.field].get(date);
			if (val !== undefined) {
				row[source.field] = val;
			}
		}

		lines.push(JSON.stringify(row));
	}

	writeFileSync(NDJSON_PATH, lines.join('\n') + '\n');
	console.log(`Wrote ${lines.length} rows (skipped ${skipped} dates without BTC data)`);

	// Write health.json
	const healthPath = join(ROOT, 'static', 'health.json');
	if (!existsSync(join(ROOT, 'static'))) mkdirSync(join(ROOT, 'static'), { recursive: true });
	writeFileSync(
		healthPath,
		JSON.stringify(
			{
				lastRun: new Date().toISOString(),
				type: 'bootstrap',
				sources: health,
			},
			null,
			2
		)
	);
	console.log('Wrote static/health.json');

	// Summary
	console.log('\n=== Bootstrap Summary ===');
	for (const [key, h] of Object.entries(health)) {
		console.log(`  ${key}: ${h.status} (${h.rows} rows)${h.error ? ` — ${h.error}` : ''}`);
	}
	console.log(`\nTotal NDJSON rows: ${lines.length}`);
	console.log('Next step: run `npm run build-prices` to generate public/prices.json');
}

main().catch((err) => {
	console.error('Bootstrap failed:', err);
	process.exit(1);
});
