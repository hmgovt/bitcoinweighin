/**
 * Pivots data/prices.ndjson into static/prices.json (keyed by ISO date)
 * and writes static/meta.json with provenance info. SvelteKit's
 * adapter-static ships everything under static/, so this is the
 * directory the deployed site actually serves from.
 *
 * Usage: npx tsx scripts/build-prices-json.ts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { SOURCES } from './sources.js';

import { fileURLToPath } from 'url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const NDJSON_PATH = join(ROOT, 'data', 'prices.ndjson');
const PRICES_PATH = join(ROOT, 'static', 'prices.json');
const META_PATH = join(ROOT, 'static', 'meta.json');

function main() {
	console.log('=== Building prices.json from NDJSON ===\n');

	if (!existsSync(NDJSON_PATH)) {
		console.error('data/prices.ndjson not found. Run bootstrap first.');
		process.exit(1);
	}

	const raw = readFileSync(NDJSON_PATH, 'utf-8');
	const lines = raw.trim().split('\n');
	console.log(`Read ${lines.length} rows from prices.ndjson`);

	// Build the pivoted structure: { "2013-01-01": { btc: 13.3, xau: 1664.75, ... }, ... }
	const prices: Record<string, Record<string, number>> = {};
	const forwardFilledDates: Set<string> = new Set();
	let firstDate = '';
	let lastDate = '';

	for (const line of lines) {
		if (!line.trim()) continue;
		const row = JSON.parse(line);
		const date = row.date;
		if (!firstDate) firstDate = date;
		lastDate = date;

		const entry: Record<string, number> = { btc: row.btc };
		if (row.btc_supply !== undefined) entry.btc_supply = row.btc_supply;

		for (const source of SOURCES) {
			if (row[source.field] !== undefined) {
				entry[source.field] = row[source.field];
			}
		}

		prices[date] = entry;
	}

	// Write prices.json
	if (!existsSync(join(ROOT, 'static'))) mkdirSync(join(ROOT, 'static'), { recursive: true });
	const jsonStr = JSON.stringify(prices);
	writeFileSync(PRICES_PATH, jsonStr);

	const sizeBytes = Buffer.byteLength(jsonStr, 'utf-8');
	const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
	console.log(`Wrote prices.json: ${sizeMB} MB (${Object.keys(prices).length} dates)`);

	// Write meta.json
	const meta = {
		lastUpdated: new Date().toISOString(),
		dateRange: { first: firstDate, last: lastDate },
		totalDates: Object.keys(prices).length,
		fileSizeBytes: sizeBytes,
		sources: SOURCES.map((s) => ({
			id: s.id,
			type: s.type,
			symbol: s.symbol,
			field: s.field,
		})),
		fields: ['btc', 'btc_supply', ...SOURCES.map((s) => s.field)],
	};

	writeFileSync(META_PATH, JSON.stringify(meta, null, 2));
	console.log('Wrote meta.json');

	// Check gzipped size estimate
	try {
		execSync(`gzip -k -f "${PRICES_PATH}"`);
		const gzSize = statSync(PRICES_PATH + '.gz').size;
		const gzMB = (gzSize / 1024 / 1024).toFixed(2);
		console.log(`Gzipped size: ${gzMB} MB`);

		if (gzSize > 5 * 1024 * 1024) {
			console.warn('WARNING: gzipped size exceeds 5 MB target!');
		} else {
			console.log('Under 5 MB gzipped target');
		}

		execSync(`rm "${PRICES_PATH}.gz"`);
	} catch {
		console.log('(Could not estimate gzip size)');
	}
}

main();
