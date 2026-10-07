/**
 * Daily fetch: appends close prices for all commodities + BTC to prices.ndjson.
 * Catches up on any dates missed since the last successful run, so a transient
 * upstream outage never creates a permanent gap in the dataset. Then re-picks
 * the last few weeks of FRED rows, since FRED publishes Brent about a week late
 * (see revise.ts).
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
import { fetchFRED, fetchCoinGecko, fetchGoldApi, type FetchResult } from './fetchers.js';
import { latestOnOrBefore, reviseRows, setFilled, type NdjsonRow, type Revision } from './revise.js';
import {
	fetchMassiveQuote,
	MASSIVE_CROSS_VALIDATED,
	CROSS_VALIDATION_THRESHOLD_PCT,
} from './fetchers-massive.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const NDJSON_PATH = join(ROOT, 'data', 'prices.ndjson');
const HEALTH_PATH = join(ROOT, 'static', 'health.json');

/** Days of rows whose FRED values are re-picked on every run: the lag is about a week, sometimes two. */
const REVISE_DAYS = 21;

type HealthMap = Record<
	string,
	{
		status: string;
		httpStatus?: number;
		rowCount?: number;
		url?: string;
		error?: string;
		matchedDate?: string;
	}
>;

/**
 * Fetch all sources for a single date and return the assembled row, health map,
 * and whether every source returned zero rows (indicator of an upstream issue).
 * Forward-fills from the current last line of prices.ndjson when a source has
 * no data for the requested date. Any field not taken from that date's own bar
 * is listed in the row's forward_filled.
 */
async function fetchSourcesForDate(
	dateStr: string
): Promise<{ row: NdjsonRow; health: HealthMap; allZeroRows: boolean }> {
	const targetDate = parseDate(dateStr);
	const row: NdjsonRow = { date: dateStr, btc_supply: btcCirculatingSupply(dateStr) };
	const health: HealthMap = {};

	for (const source of SOURCES) {
		console.log(`Fetching ${source.id}...`);
		try {
			let result: FetchResult;
			if (source.type === 'coingecko') {
				result = await fetchCoinGecko(source);
			} else if (source.type === 'goldapi') {
				result = await fetchGoldApi(source, dateStr);
			} else {
				// Widen the FRED window so publication lag / non-trading days on the
				// exact target date fall back to the latest prior bar in the series.
				const fredStart = parseDate(dateStr);
				fredStart.setDate(fredStart.getDate() - 10);
				result = await fetchFRED(source, fredStart, targetDate);
			}

			const { value, matchedDate } = latestOnOrBefore(result.data, dateStr);
			if (value !== undefined) {
				row[source.field] = value;
				setFilled(row, source.field, matchedDate !== dateStr);
				health[source.id] = {
					// A bar carried back from an earlier trading day is still real
					// market data, not a stale repeat — distinguish it from 'ok'.
					status: matchedDate === dateStr ? 'ok' : 'carry-back',
					httpStatus: result.httpStatus,
					rowCount: result.rowCount,
					url: result.url,
					...(matchedDate !== dateStr ? { matchedDate } : {}),
				};
			} else {
				// Source returned data but nothing on or before this date — fall back
				// to the last committed row.
				if (existsSync(NDJSON_PATH)) {
					const lines = readFileSync(NDJSON_PATH, 'utf-8').trim().split('\n');
					const lastRow = JSON.parse(lines[lines.length - 1]);
					if (lastRow[source.field] !== undefined) {
						row[source.field] = lastRow[source.field];
						setFilled(row, source.field, true);
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
					setFilled(row, source.field, true);
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

/**
 * Re-pick every FRED field in the last REVISE_DAYS rows from a fresh fetch, so
 * a row written while FRED was behind gets the real close once FRED publishes
 * it, and rewrite those rows in prices.ndjson. Fails soft: a FRED outage leaves
 * the rows as they were.
 */
async function reviseRecent(primaryDateStr: string): Promise<Revision[]> {
	if (!existsSync(NDJSON_PATH)) return [];
	const lines = readFileSync(NDJSON_PATH, 'utf-8').trim().split('\n');
	const sinceDate = parseDate(primaryDateStr);
	sinceDate.setDate(sinceDate.getDate() - REVISE_DAYS);
	const since = formatDateISO(sinceDate);
	let start = lines.length;
	while (start > 0 && (JSON.parse(lines[start - 1]) as NdjsonRow).date >= since) start--;
	if (start === lines.length) return [];
	const rows = lines.slice(start).map((l) => JSON.parse(l) as NdjsonRow);

	const changes: Revision[] = [];
	for (const source of SOURCES.filter((s) => s.type === 'fred')) {
		console.log(`Revising ${source.id} since ${since}...`);
		const fredStart = parseDate(since);
		fredStart.setDate(fredStart.getDate() - 10);
		try {
			const result = await fetchFRED(source, fredStart, parseDate(primaryDateStr));
			changes.push(...reviseRows(rows, source.field, result.data, since));
		} catch (err: unknown) {
			console.error(`  ${source.id} revision skipped: ${err instanceof Error ? err.message : String(err)}`);
		}
	}
	for (const c of changes) console.log(`  ${c.field} ${c.date}: ${c.from} → ${c.to}`);
	writeFileSync(NDJSON_PATH, [...lines.slice(0, start), ...rows.map((r) => JSON.stringify(r))].join('\n') + '\n');
	return changes;
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
				console.log(`Already up to date (${primaryDateStr}). Revising recent rows only.\n`);
				await reviseRecent(primaryDateStr);
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

	console.log('');
	const revisions = await reviseRecent(primaryDateStr);

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
				revisions: revisions.length ? revisions : undefined,
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
