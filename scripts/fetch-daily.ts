/**
 * Daily fetch: appends close prices for all commodities + BTC to prices.ndjson.
 * Catches up on any dates missed since the last successful run, so a transient
 * upstream outage never creates a permanent gap in the dataset.
 *
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
	dateRange,
	parseDate,
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

type HealthMap = Record<
	string,
	{ status: string; httpStatus?: number; rowCount?: number; url?: string; error?: string }
>;

/**
 * Fetch all sources for a single date and return the assembled row, health map,
 * and whether every source returned zero rows (indicator of an upstream issue).
 * Forward-fills from the current last line of prices.ndjson when a source has
 * no data for the requested date.
 */
async function fetchSourcesForDate(
	dateStr: string
): Promise<{ row: Record<string, unknown>; health: HealthMap; allZeroRows: boolean }> {
	const targetDate = parseDate(dateStr);
	const row: Record<string, unknown> = { date: dateStr, btc_supply: btcCirculatingSupply(dateStr) };
	const health: HealthMap = {};

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
				health[source.id] = {
					status: 'ok',
					httpStatus: result.httpStatus,
					rowCount: result.rowCount,
					url: result.url,
				};
			} else {
				// Weekend/holiday/lag — forward-fill from last known row
				if (existsSync(NDJSON_PATH)) {
					const lines = readFileSync(NDJSON_PATH, 'utf-8').trim().split('\n');
					const lastRow = JSON.parse(lines[lines.length - 1]);
					if (lastRow[source.field] !== undefined) {
						row[source.field] = lastRow[source.field];
						health[source.id] = {
							status: 'forward-filled',
							httpStatus: result.httpStatus,
							rowCount: result.rowCount,
							url: result.url,
						};
					}
				}
			}
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			console.error(`  ${source.id} failed: ${message}`);
			if (existsSync(NDJSON_PATH)) {
				const lines = readFileSync(NDJSON_PATH, 'utf-8').trim().split('\n');
				const lastRow = JSON.parse(lines[lines.length - 1]);
				if (lastRow[source.field] !== undefined) {
					row[source.field] = lastRow[source.field];
					health[source.id] = { status: 'fallback', error: message };
				}
			}
		}

		await new Promise((r) => setTimeout(r, 1500));
	}

	const allZeroRows = Object.values(health).every(
		(h) => h.rowCount === 0 || h.rowCount === undefined
	);

	return { row, health, allZeroRows };
}

async function main() {
	const primaryDate = yesterday();
	const primaryDateStr = formatDateISO(primaryDate);

	console.log(`=== Daily fetch (target: ${primaryDateStr}) ===\n`);

	// Determine the last date already in prices.ndjson
	let lastDateStr: string | null = null;
	if (existsSync(NDJSON_PATH)) {
		const lines = readFileSync(NDJSON_PATH, 'utf-8').trim().split('\n');
		if (lines.length > 0 && lines[lines.length - 1].trim()) {
			const lastRow = JSON.parse(lines[lines.length - 1]);
			lastDateStr = lastRow.date as string;
			if (lastDateStr === primaryDateStr) {
				console.log(`Already up to date (${primaryDateStr}). Skipping.`);
				return;
			}
		}
	}

	// Build the full list of dates to process: every day from the day after the
	// last committed row up to and including yesterday. This catches up any dates
	// that were missed due to transient upstream outages.
	let datesToProcess: string[];
	if (lastDateStr) {
		const nextDay = parseDate(lastDateStr);
		nextDay.setDate(nextDay.getDate() + 1);
		datesToProcess = dateRange(formatDateISO(nextDay), primaryDateStr);
	} else {
		datesToProcess = [primaryDateStr];
	}

	const catchUpCount = datesToProcess.length - 1;
	if (catchUpCount > 0) {
		console.log(
			`Catching up ${catchUpCount} missing date(s): ${datesToProcess.slice(0, -1).join(', ')}\n`
		);
	}

	let primaryHealth: HealthMap = {};
	let primaryAllZeroRows = false;

	for (const dateStr of datesToProcess) {
		const isCatchUp = dateStr !== primaryDateStr;
		console.log(`\n--- ${dateStr}${isCatchUp ? ' (catch-up)' : ''} ---`);

		const { row, health, allZeroRows } = await fetchSourcesForDate(dateStr);

		if (isCatchUp) {
			// For historical catch-up dates we forward-fill and continue — we cannot
			// improve on whatever Stooq published (or didn't publish) that day.
			const d = parseDate(dateStr);
			const isWeekday = d.getDay() >= 1 && d.getDay() <= 5;
			if (isWeekday && allZeroRows) {
				console.warn(
					`⚠ Catch-up ${dateStr}: all sources returned 0 rows — forward-filling ` +
						`(likely a transient upstream outage on that date)`
				);
			}

			if (row.btc === undefined) {
				console.warn(`⚠ No BTC price for catch-up date ${dateStr} — skipping row`);
				continue;
			}
		} else {
			// Primary date
			primaryHealth = health;
			primaryAllZeroRows = allZeroRows;

			if (row.btc === undefined) {
				console.error('No BTC price available for primary date. Aborting.');
				process.exit(1);
			}
		}

		appendFileSync(NDJSON_PATH, JSON.stringify(row) + '\n');
		console.log(`Appended row for ${dateStr}`);
	}

	// === Massive secondary-source cross-validation (primary date only) ===
	// Quality signal only — fails soft, never blocks the build.
	console.log('\nCross-validating against Massive...');

	// Re-read the primary row from NDJSON (it was appended above)
	const primaryRowLines = readFileSync(NDJSON_PATH, 'utf-8').trim().split('\n');
	const primaryRow = JSON.parse(primaryRowLines[primaryRowLines.length - 1]);

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
		const stooqValue = primaryRow[datasetField];
		if (typeof stooqValue !== 'number') {
			crossValidation.skipped.push({ field: datasetField, reason: 'no stooq value to compare' });
			continue;
		}
		const result = await fetchMassiveQuote(symbol, primaryDateStr);
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
				date: primaryDateStr,
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

	// Update health.json — preserve cross_validation_flags accumulated across prior runs.
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
				date: primaryDateStr,
				catchUpDates: catchUpCount > 0 ? datesToProcess.slice(0, -1) : undefined,
				sources: primaryHealth,
				cross_validation: crossValidation,
				cross_validation_flags,
			},
			null,
			2
		)
	);
	console.log('Updated health.json');

	// Weekday guard: if every source returned 0 rows on the primary weekday date,
	// flag it as an upstream issue. Data has already been appended (forward-filled)
	// so the commit step will still preserve it — this exit code is purely to
	// surface the alert in GitHub Actions.
	const dayOfWeek = primaryDate.getDay();
	const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
	if (isWeekday && primaryAllZeroRows) {
		console.error(
			`\nERROR: All sources returned 0 rows on a weekday (${primaryDateStr}). ` +
				`This likely indicates an auth or upstream issue. Check health.json for details.`
		);
		process.exit(1);
	}
}

main().catch((err) => {
	console.error('Daily fetch failed:', err);
	process.exit(1);
});
