/**
 * Daily fetch: appends yesterday's close for all commodities + BTC to prices.ndjson.
 * Designed to be run by GitHub Actions cron at 02:00 UTC.
 *
 * Usage: FRED_API_KEY=xxx npx tsx scripts/fetch-daily.ts
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import {
	SOURCES,
	yesterday,
	formatDateISO,
	btcCirculatingSupply,
} from './sources.js';
import { fetchStooq, fetchFRED } from './fetchers.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const NDJSON_PATH = join(ROOT, 'data', 'prices.ndjson');
const HEALTH_PATH = join(ROOT, 'public', 'health.json');

async function main() {
	const targetDate = yesterday();
	const dateStr = formatDateISO(targetDate);

	console.log(`=== Daily fetch for ${dateStr} ===\n`);

	// Check if date already exists
	if (existsSync(NDJSON_PATH)) {
		const existing = readFileSync(NDJSON_PATH, 'utf-8');
		const lastLine = existing.trim().split('\n').pop();
		if (lastLine) {
			const lastRow = JSON.parse(lastLine);
			if (lastRow.date === dateStr) {
				console.log(`Date ${dateStr} already exists in NDJSON. Skipping.`);
				return;
			}
		}
	}

	const row: Record<string, any> = { date: dateStr, btc_supply: btcCirculatingSupply(dateStr) };
	const health: Record<string, { status: string; error?: string }> = {};

	for (const source of SOURCES) {
		console.log(`Fetching ${source.id}...`);
		try {
			let data: Map<string, number>;
			if (source.type === 'stooq') {
				data = await fetchStooq(source, targetDate, targetDate);
			} else {
				data = await fetchFRED(source, targetDate, targetDate);
			}

			const val = data.get(dateStr);
			if (val !== undefined) {
				row[source.field] = val;
				health[source.id] = { status: 'ok' };
			} else {
				// Weekend/holiday — forward-fill from last known
				const lines = readFileSync(NDJSON_PATH, 'utf-8').trim().split('\n');
				const lastRow = JSON.parse(lines[lines.length - 1]);
				if (lastRow[source.field] !== undefined) {
					row[source.field] = lastRow[source.field];
					health[source.id] = { status: 'forward-filled' };
				}
			}
		} catch (err: any) {
			console.error(`  ${source.id} failed: ${err.message}`);
			// Forward-fill from last known
			if (existsSync(NDJSON_PATH)) {
				const lines = readFileSync(NDJSON_PATH, 'utf-8').trim().split('\n');
				const lastRow = JSON.parse(lines[lines.length - 1]);
				if (lastRow[source.field] !== undefined) {
					row[source.field] = lastRow[source.field];
					health[source.id] = { status: 'fallback', error: err.message };
				}
			}
		}

		await new Promise((r) => setTimeout(r, 1500));
	}

	// Abort if no BTC price
	if (row.btc === undefined) {
		console.error('No BTC price available. Aborting.');
		process.exit(1);
	}

	// Append to NDJSON
	appendFileSync(NDJSON_PATH, JSON.stringify(row) + '\n');
	console.log(`\nAppended row for ${dateStr}`);

	// Update health.json
	writeFileSync(
		HEALTH_PATH,
		JSON.stringify(
			{
				lastRun: new Date().toISOString(),
				type: 'daily',
				date: dateStr,
				sources: health,
			},
			null,
			2
		)
	);
	console.log('Updated health.json');
}

main().catch((err) => {
	console.error('Daily fetch failed:', err);
	process.exit(1);
});
