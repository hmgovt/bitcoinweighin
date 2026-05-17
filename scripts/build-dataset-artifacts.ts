/**
 * Builds the canonical dataset artifacts for the current dataset version.
 * Runs after build-prices-json in the daily cron.
 *
 * Outputs:
 *   static/data/v{X.Y}/prices.csv         - daily rows, raw + derived
 *   static/data/v{X.Y}/prices.json        - same data, JSON keyed by date
 *   static/data/v{X.Y}/prices.ndjson      - newline-delimited JSON
 *   static/data/v{X.Y}/prices.parquet     - Parquet binary (parquetjs-lite)
 *   static/data/v{X.Y}/schema.json        - column definitions
 *   static/data/v{X.Y}/meta.json          - version, last-updated, sources, checksums
 *   static/data/v{X.Y}/CITATION.cff       - Citation File Format
 *   static/data/v{X.Y}/CHANGELOG.md       - cumulative across versions
 *   static/data/v{X.Y}/LICENSE.txt        - CC-BY-4.0 full text
 *   static/data/v{X.Y}/SHA256SUMS         - one line per file
 *
 * Latest aliases (copies, not symlinks):
 *   static/data/{prices.csv,prices.json,prices.ndjson,prices.parquet,schema.json,meta.json}
 *
 * Usage: npx tsx scripts/build-dataset-artifacts.ts
 */

import {
	readFileSync,
	writeFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	copyFileSync,
	statSync,
} from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
// @ts-expect-error parquetjs-lite ships no types
import parquet from 'parquetjs-lite';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');

const PRICES_PATH = join(ROOT, 'static', 'prices.json');
const META_PATH = join(ROOT, 'static', 'meta.json');
const CONFIG_PATH = join(ROOT, 'dataset-config.json');
const PROVENANCE_PATH = join(ROOT, 'src', 'lib', 'data-provenance.json');
const CC_BY_PATH = join(ROOT, 'scripts', 'templates', 'CC-BY-4.0.txt');

interface DatasetConfig {
	version: string;
	doi: string | null;
	zenodo_record: string | null;
	title: string;
	abstract: string;
	authors: Array<{ name: string; type?: string; email?: string }>;
	homepage: string;
	repository: string;
	license: string;
}

interface PricesEntry {
	btc?: number;
	btc_supply?: number;
	xau?: number;
	xag?: number;
	xpt?: number;
	hg?: number;
	wheat?: number;
	coffee?: number;
	brent?: number;
}

interface Row {
	date: string;
	btc_usd: number | null;
	btc_supply: number | null;
	xau_usd: number | null;
	xag_usd: number | null;
	xpt_usd: number | null;
	copper_usd: number | null;
	brent_usd: number | null;
	wheat_usd: number | null;
	coffee_usd: number | null;
	xau_per_btc: number | null;
	xag_per_btc: number | null;
	xpt_per_btc: number | null;
	copper_per_btc: number | null;
	brent_per_btc: number | null;
	wheat_per_btc: number | null;
	coffee_per_btc: number | null;
	forward_filled: string;
}

const COLUMN_ORDER: Array<keyof Row> = [
	'date',
	'btc_usd',
	'btc_supply',
	'xau_usd',
	'xag_usd',
	'xpt_usd',
	'copper_usd',
	'brent_usd',
	'wheat_usd',
	'coffee_usd',
	'xau_per_btc',
	'xag_per_btc',
	'xpt_per_btc',
	'copper_per_btc',
	'brent_per_btc',
	'wheat_per_btc',
	'coffee_per_btc',
	'forward_filled',
];

function ratio(numerator: number | null, denominator: number | null): number | null {
	if (numerator === null || denominator === null || denominator === 0) return null;
	return +(numerator / denominator).toFixed(8);
}

function buildRows(prices: Record<string, PricesEntry>): Row[] {
	const dates = Object.keys(prices).sort();
	return dates.map((date) => {
		const p = prices[date];
		const btc_usd = p.btc ?? null;
		const xau_usd = p.xau ?? null;
		const xag_usd = p.xag ?? null;
		const xpt_usd = p.xpt ?? null;
		const copper_usd = p.hg ?? null;
		const brent_usd = p.brent ?? null;
		const wheat_usd = p.wheat ?? null;
		const coffee_usd = p.coffee ?? null;
		return {
			date,
			btc_usd,
			btc_supply: p.btc_supply ?? null,
			xau_usd,
			xag_usd,
			xpt_usd,
			copper_usd,
			brent_usd,
			wheat_usd,
			coffee_usd,
			xau_per_btc: ratio(btc_usd, xau_usd),
			xag_per_btc: ratio(btc_usd, xag_usd),
			xpt_per_btc: ratio(btc_usd, xpt_usd),
			copper_per_btc: ratio(btc_usd, copper_usd),
			brent_per_btc: ratio(btc_usd, brent_usd),
			wheat_per_btc: ratio(btc_usd, wheat_usd),
			coffee_per_btc: ratio(btc_usd, coffee_usd),
			forward_filled: '',
		};
	});
}

function writeCsv(rows: Row[], path: string) {
	const lines = [COLUMN_ORDER.join(',')];
	for (const row of rows) {
		const cells = COLUMN_ORDER.map((col) => {
			const v = row[col];
			if (v === null || v === undefined) return '';
			return String(v);
		});
		lines.push(cells.join(','));
	}
	writeFileSync(path, lines.join('\n') + '\n');
}

function writeJsonKeyed(rows: Row[], path: string) {
	const keyed: Record<string, Omit<Row, 'date'>> = {};
	for (const row of rows) {
		const { date, ...rest } = row;
		keyed[date] = rest;
	}
	writeFileSync(path, JSON.stringify(keyed));
}

function writeNdjson(rows: Row[], path: string) {
	const lines = rows.map((r) => JSON.stringify(r));
	writeFileSync(path, lines.join('\n') + '\n');
}

async function writeParquet(rows: Row[], path: string) {
	const schema = new parquet.ParquetSchema({
		date: { type: 'UTF8' },
		btc_usd: { type: 'DOUBLE', optional: true },
		btc_supply: { type: 'INT64', optional: true },
		xau_usd: { type: 'DOUBLE', optional: true },
		xag_usd: { type: 'DOUBLE', optional: true },
		xpt_usd: { type: 'DOUBLE', optional: true },
		copper_usd: { type: 'DOUBLE', optional: true },
		brent_usd: { type: 'DOUBLE', optional: true },
		wheat_usd: { type: 'DOUBLE', optional: true },
		coffee_usd: { type: 'DOUBLE', optional: true },
		xau_per_btc: { type: 'DOUBLE', optional: true },
		xag_per_btc: { type: 'DOUBLE', optional: true },
		xpt_per_btc: { type: 'DOUBLE', optional: true },
		copper_per_btc: { type: 'DOUBLE', optional: true },
		brent_per_btc: { type: 'DOUBLE', optional: true },
		wheat_per_btc: { type: 'DOUBLE', optional: true },
		coffee_per_btc: { type: 'DOUBLE', optional: true },
		forward_filled: { type: 'UTF8' },
	});
	const writer = await parquet.ParquetWriter.openFile(schema, path);
	for (const row of rows) {
		const r: Record<string, unknown> = {};
		for (const col of COLUMN_ORDER) {
			const v = row[col];
			if (v !== null && v !== undefined) r[col] = v;
		}
		await writer.appendRow(r);
	}
	await writer.close();
}

const SCHEMA_COLUMNS = [
	{
		name: 'date',
		type: 'string',
		unit: 'ISO 8601 (YYYY-MM-DD)',
		source: 'internal',
		notes: 'Trading day. Every calendar date from coverage start to last update has a row.',
	},
	{
		name: 'btc_usd',
		type: 'number',
		unit: 'USD per BTC',
		source: 'Stooq btcusd daily close',
		notes: 'Continuous BTC-USD spot aggregate. Required field; rows without a btc_usd value are not emitted.',
	},
	{
		name: 'btc_supply',
		type: 'integer',
		unit: 'BTC',
		source: 'Derived (Bitcoin halving schedule)',
		notes: 'Deterministic function of days-since-genesis (2009-01-03) at 144 blocks/day target, halving every 210,000 blocks. No API dependency.',
	},
	{
		name: 'xau_usd',
		type: 'number',
		unit: 'USD per troy ounce',
		source: 'Stooq xauusd daily close',
		notes: 'Spot gold, London close.',
	},
	{
		name: 'xag_usd',
		type: 'number',
		unit: 'USD per troy ounce',
		source: 'Stooq xagusd daily close',
		notes: 'Spot silver, London close.',
	},
	{
		name: 'xpt_usd',
		type: 'number',
		unit: 'USD per troy ounce',
		source: 'Stooq xptusd daily close',
		notes: 'Spot platinum, London close.',
	},
	{
		name: 'copper_usd',
		type: 'number',
		unit: 'USD per pound',
		source: 'Stooq hg.c daily close',
		notes: 'COMEX copper continuous front-month.',
	},
	{
		name: 'brent_usd',
		type: 'number',
		unit: 'USD per barrel',
		source: 'FRED DCOILBRENTEU daily',
		notes: 'Europe Brent spot FOB, sourced from EIA via FRED. Typically lags one business day.',
	},
	{
		name: 'wheat_usd',
		type: 'number',
		unit: 'USD per bushel',
		source: 'Stooq zw.c daily close',
		notes: 'CBOT wheat continuous front-month.',
	},
	{
		name: 'coffee_usd',
		type: 'number',
		unit: 'USD per pound',
		source: 'Stooq kc.c daily close',
		notes: 'ICE Arabica coffee continuous front-month. Stooq quotes in cents/lb; this column is normalised to dollars/lb at build time.',
	},
	{
		name: 'xau_per_btc',
		type: 'number',
		unit: 'troy ounces of gold per BTC',
		source: 'Derived (btc_usd / xau_usd)',
		notes: 'How many troy ounces of gold 1 BTC could purchase at the day\'s close.',
	},
	{
		name: 'xag_per_btc',
		type: 'number',
		unit: 'troy ounces of silver per BTC',
		source: 'Derived (btc_usd / xag_usd)',
		notes: 'How many troy ounces of silver 1 BTC could purchase at the day\'s close.',
	},
	{
		name: 'xpt_per_btc',
		type: 'number',
		unit: 'troy ounces of platinum per BTC',
		source: 'Derived (btc_usd / xpt_usd)',
		notes: 'How many troy ounces of platinum 1 BTC could purchase at the day\'s close.',
	},
	{
		name: 'copper_per_btc',
		type: 'number',
		unit: 'pounds of copper per BTC',
		source: 'Derived (btc_usd / copper_usd)',
		notes: 'How many pounds of copper 1 BTC could purchase at the day\'s close.',
	},
	{
		name: 'brent_per_btc',
		type: 'number',
		unit: 'barrels of Brent crude per BTC',
		source: 'Derived (btc_usd / brent_usd)',
		notes: 'How many barrels of Brent crude 1 BTC could purchase at the day\'s close.',
	},
	{
		name: 'wheat_per_btc',
		type: 'number',
		unit: 'bushels of wheat per BTC',
		source: 'Derived (btc_usd / wheat_usd)',
		notes: 'How many bushels of CBOT wheat 1 BTC could purchase at the day\'s close.',
	},
	{
		name: 'coffee_per_btc',
		type: 'number',
		unit: 'pounds of Arabica coffee per BTC',
		source: 'Derived (btc_usd / coffee_usd)',
		notes: 'How many pounds of ICE Arabica coffee 1 BTC could purchase at the day\'s close.',
	},
	{
		name: 'forward_filled',
		type: 'string',
		unit: 'pipe-delimited column names',
		source: 'internal',
		notes: 'Empty string when no fields were forward-filled, or a pipe-delimited list of field names (e.g. "xpt_usd|brent_usd") when some were. Per-row tracking begins 2026-05-17; historical rows carry an empty string regardless of their true fill state.',
	},
];

function buildSchemaJson(config: DatasetConfig) {
	return {
		$schema: 'https://json-schema.org/draft/2020-12/schema',
		title: config.title,
		version: config.version,
		description: config.abstract,
		license: config.license,
		columns: SCHEMA_COLUMNS,
	};
}

function buildCitationCff(config: DatasetConfig, dateReleased: string): string {
	const lines: string[] = [
		'cff-version: 1.2.0',
		'message: "If you use this dataset, please cite it as below."',
		'type: dataset',
		`title: "${config.title}"`,
		'authors:',
	];
	for (const a of config.authors) {
		lines.push(`  - name: "${a.name}"`);
		if (a.type) lines.push(`    type: ${a.type}`);
		if (a.email) lines.push(`    email: ${a.email}`);
	}
	lines.push(`version: "${config.version}"`);
	lines.push(`date-released: "${dateReleased}"`);
	lines.push(`url: "${config.homepage}"`);
	lines.push(`repository-code: "${config.repository}"`);
	lines.push(`license: ${config.license}`);
	if (config.doi) lines.push(`doi: ${config.doi}`);
	else lines.push('# doi: set after Zenodo release; see docs/zenodo-release.md');
	lines.push(`abstract: "${config.abstract.replace(/"/g, '\\"')}"`);
	return lines.join('\n') + '\n';
}

function ensureChangelog(path: string, version: string, dateReleased: string) {
	if (existsSync(path)) return;
	const initial = `# Changelog

All notable changes to the Bitcoin Weigh-In dataset are documented here.
This dataset follows semantic versioning for breaking column changes
(major: removed or renamed columns; minor: added columns or sources;
patch: bug fixes that do not change schema).

## v${version} - ${dateReleased}

Initial public release.

- Raw daily USD closes for BTC, gold (XAU), silver (XAG), platinum (XPT),
  copper (HG continuous), wheat (ZW continuous), coffee (KC continuous),
  and Brent crude (FRED DCOILBRENTEU).
- Derived per-BTC columns: xau_per_btc, xag_per_btc, xpt_per_btc,
  copper_per_btc, brent_per_btc, wheat_per_btc, coffee_per_btc.
- Deterministic BTC circulating supply computed from the halving schedule
  (no API dependency).
- Coverage: 2013-01-01 to present, daily.
- Forward-fill: per-row provenance is not reconstructable from existing
  data; the \`forward_filled\` column is present but populated as empty
  string for all v1.0 rows. Prospective tracking will begin in v1.1.
`;
	writeFileSync(path, initial);
}

function sha256(filepath: string): string {
	return createHash('sha256').update(readFileSync(filepath)).digest('hex');
}

async function main() {
	console.log('=== Building dataset artifacts ===\n');

	if (!existsSync(PRICES_PATH)) {
		console.error('static/prices.json not found. Run build-prices first.');
		process.exit(1);
	}
	if (!existsSync(CC_BY_PATH)) {
		console.error('scripts/templates/CC-BY-4.0.txt not found.');
		process.exit(1);
	}

	const config: DatasetConfig = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
	const prices: Record<string, PricesEntry> = JSON.parse(readFileSync(PRICES_PATH, 'utf-8'));
	const upstreamMeta = JSON.parse(readFileSync(META_PATH, 'utf-8'));
	const provenance = JSON.parse(readFileSync(PROVENANCE_PATH, 'utf-8'));

	const version = config.version;
	const versionDir = join(ROOT, 'static', 'data', `v${version}`);
	const latestDir = join(ROOT, 'static', 'data');
	const changelogPath = join(ROOT, 'static', 'data', 'CHANGELOG.md');

	mkdirSync(versionDir, { recursive: true });
	mkdirSync(latestDir, { recursive: true });

	const rows = buildRows(prices);
	const firstDate = rows[0].date;
	const lastDate = rows[rows.length - 1].date;
	const dateReleased = new Date().toISOString().slice(0, 10);

	console.log(`Version v${version} | ${rows.length} rows | ${firstDate} to ${lastDate}\n`);

	const csvPath = join(versionDir, 'prices.csv');
	const jsonPath = join(versionDir, 'prices.json');
	const ndjsonPath = join(versionDir, 'prices.ndjson');
	const parquetPath = join(versionDir, 'prices.parquet');
	const schemaPath = join(versionDir, 'schema.json');
	const metaPath = join(versionDir, 'meta.json');
	const cffPath = join(versionDir, 'CITATION.cff');
	const changelogVersionedPath = join(versionDir, 'CHANGELOG.md');
	const licensePath = join(versionDir, 'LICENSE.txt');
	const sumsPath = join(versionDir, 'SHA256SUMS');

	writeCsv(rows, csvPath);
	console.log(`  CSV:     ${(statSync(csvPath).size / 1024).toFixed(1)} KB`);

	writeJsonKeyed(rows, jsonPath);
	console.log(`  JSON:    ${(statSync(jsonPath).size / 1024).toFixed(1)} KB`);

	writeNdjson(rows, ndjsonPath);
	console.log(`  NDJSON:  ${(statSync(ndjsonPath).size / 1024).toFixed(1)} KB`);

	await writeParquet(rows, parquetPath);
	console.log(`  Parquet: ${(statSync(parquetPath).size / 1024).toFixed(1)} KB`);

	writeFileSync(schemaPath, JSON.stringify(buildSchemaJson(config), null, 2));
	writeFileSync(cffPath, buildCitationCff(config, dateReleased));
	ensureChangelog(changelogPath, version, dateReleased);
	copyFileSync(changelogPath, changelogVersionedPath);
	copyFileSync(CC_BY_PATH, licensePath);

	// Meta + checksums. Compute checksums over every file in the dir except
	// meta.json (which contains the checksums) and SHA256SUMS (which derives
	// from them). Write meta.json first, then SHA256SUMS includes meta too.
	const allFiles = readdirSync(versionDir).sort();
	const filesForChecksums = allFiles.filter((f) => f !== 'meta.json' && f !== 'SHA256SUMS');
	const checksums: Record<string, string> = {};
	for (const f of filesForChecksums) {
		checksums[f] = sha256(join(versionDir, f));
	}

	const meta = {
		version,
		last_updated: new Date().toISOString(),
		coverage: { first_date: firstDate, last_date: lastDate },
		row_count: rows.length,
		title: config.title,
		abstract: config.abstract,
		homepage: config.homepage,
		license: config.license,
		doi: config.doi,
		zenodo_record: config.zenodo_record,
		sources: upstreamMeta.sources,
		provenance: provenance.commodities,
		forward_fill_provenance: {
			note: 'Per-row forward-fill provenance is not tracked in v1.0; the forward_filled column is empty for all rows. Prospective tracking begins in v1.1.',
			daily_run_health: '/health.json',
		},
		checksums,
	};
	writeFileSync(metaPath, JSON.stringify(meta, null, 2));

	// Build SHA256SUMS over the full versioned directory, including meta.json
	const sumLines: string[] = [];
	for (const f of [...filesForChecksums, 'meta.json'].sort()) {
		sumLines.push(`${sha256(join(versionDir, f))}  ${f}`);
	}
	writeFileSync(sumsPath, sumLines.join('\n') + '\n');

	// Latest aliases (six files per the spec)
	const aliases = ['prices.csv', 'prices.json', 'prices.ndjson', 'prices.parquet', 'schema.json', 'meta.json'];
	for (const f of aliases) {
		copyFileSync(join(versionDir, f), join(latestDir, f));
	}
	console.log(`  Latest aliases: ${aliases.length} files copied to static/data/`);

	// /api/prices.json static alias (Cloudflare Pages serves it as /api/prices.json
	// with CORS headers from static/_headers)
	const apiDir = join(ROOT, 'static', 'api');
	mkdirSync(apiDir, { recursive: true });
	copyFileSync(jsonPath, join(apiDir, 'prices.json'));
	console.log(`  /api/prices.json alias: ${(statSync(join(apiDir, 'prices.json')).size / 1024).toFixed(1)} KB`);

	console.log(`\nDone. Artifacts in: static/data/v${version}/`);
}

main().catch((err) => {
	console.error('Build failed:', err);
	process.exit(1);
});
