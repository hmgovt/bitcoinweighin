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
import { fetchStooq, fetchFRED, type FetchResult } from './fetchers.js';
import {
	fetchMassiveQuote,
	MASSIVE_CROSS_VALIDATED,
	CROSS_VALIDATION_THRESHOLD_PCT,
} from './fetchers-massive.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const NDJSON_PATH = join(ROOT, 'data', 'prices.ndjson');
const HEALTH_PATH = join(ROOT, 'static', 'health.json');

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
	const health: Record<string, { status: string; httpStatus?: number; rowCount?: number; url?: string; error?: string }> = {};

	for (const source of SOURCES) {
		console.log(`Fetching ${source.id}...`);
		try {
			let result: FetchResult;
			if (source.type === 'stooq') {
				result = await fetchStooq(source, targetDate, targetDate);
			} else {
				result = await fetchFRED(source, targetDate, targetDate);
			}

			const val = result.data.get(dateStr);
			if (val !== undefined) {
				row[source.field] = val;
				health[source.id] = { status: 'ok', httpStatus: result.httpStatus, rowCount: result.rowCount, url: result.url };
			} else {
				// Weekend/holiday — forward-fill from last known
				const lines = readFileSync(NDJSON_PATH, 'utf-8').trim().split('\n');
				const lastRow = JSON.parse(lines[lines.length - 1]);
				if (lastRow[source.field] !== undefined) {
					row[source.field] = lastRow[source.field];
					health[source.id] = { status: 'forward-filled', httpStatus: result.httpStatus, rowCount: result.rowCount, url: result.url };
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

	// === Massive secondary-source cross-validation ===
	// Quality signal only — fails soft, never blocks the build. If
	// MASSIVE_API_KEY is not set, the fetcher returns null and we log
	// "skipped" rather than emitting a flag.
	console.log('\nCross-validating against Massive...');
	const crossValidation: {
		status: 'ok' | 'skipped' | 'partial';
		threshold_pct: number;
		attempted: string[];
		skipped: Array<{ field: string; reason: string }>;
		flags: Array<{
			date: string;
			field: string;
			stooq_value: number;
			massive_value: number;
			percent_diff: number;
		}>;
	} = {
		status: 'ok',
		threshold_pct: CROSS_VALIDATION_THRESHOLD_PCT,
		attempted: [],
		skipped: [],
		flags: [],
	};

	let anyAttempted = false;
	for (const { symbol, datasetField } of MASSIVE_CROSS_VALIDATED) {
		const stooqValue = row[datasetField];
		if (typeof stooqValue !== 'number') {
			crossValidation.skipped.push({ field: datasetField, reason: 'no stooq value to compare' });
			continue;
		}
		const result = await fetchMassiveQuote(symbol, dateStr);
		if (result.value === null) {
			crossValidation.skipped.push({
				field: datasetField,
				reason: result.error || 'no value returned',
			});
			continue;
		}
		anyAttempted = true;
		crossValidation.attempted.push(datasetField);
		const pct = Math.abs((result.value - stooqValue) / stooqValue) * 100;
		console.log(
			`  ${datasetField}: stooq=${stooqValue}  massive=${result.value}  diff=${pct.toFixed(3)}%`
		);
		if (pct > CROSS_VALIDATION_THRESHOLD_PCT) {
			crossValidation.flags.push({
				date: dateStr,
				field: datasetField,
				stooq_value: stooqValue,
				massive_value: result.value,
				percent_diff: +pct.toFixed(4),
			});
		}
		await new Promise((r) => setTimeout(r, 500));
	}
	if (!anyAttempted) {
		crossValidation.status = 'skipped';
	} else if (crossValidation.skipped.length > 0) {
		crossValidation.status = 'partial';
	}

	// Update health.json — preserve any cross_validation_flags accumulated
	// across prior runs so historical disagreements remain auditable.
	let priorFlags: typeof crossValidation.flags = [];
	if (existsSync(HEALTH_PATH)) {
		try {
			const prior = JSON.parse(readFileSync(HEALTH_PATH, 'utf-8'));
			if (Array.isArray(prior.cross_validation_flags)) {
				priorFlags = prior.cross_validation_flags;
			}
		} catch {
			// ignore malformed prior health.json
		}
	}
	const cross_validation_flags = [...priorFlags, ...crossValidation.flags];

	writeFileSync(
		HEALTH_PATH,
		JSON.stringify(
			{
				lastRun: new Date().toISOString(),
				type: 'daily',
				date: dateStr,
				sources: health,
				cross_validation: crossValidation,
				cross_validation_flags,
			},
			null,
			2
		)
	);
	console.log('Updated health.json');

	// Weekday guard: if every source returned 0 rows on a weekday, exit non-zero
	// so GitHub Actions shows a red ✗ and sends a notification.
	const dayOfWeek = targetDate.getUTCDay(); // 0=Sun, 6=Sat
	const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
	const allZeroRows = Object.values(health).every(
		(h) => h.rowCount === 0 || h.rowCount === undefined
	);
	if (isWeekday && allZeroRows) {
		console.error(
			`\nERROR: All sources returned 0 rows on a weekday (${dateStr}). ` +
			`This likely indicates an auth or upstream issue. Check health.json for details.`
		);
		process.exit(1);
	}
}

main().catch((err) => {
	console.error('Daily fetch failed:', err);
	process.exit(1);
});
