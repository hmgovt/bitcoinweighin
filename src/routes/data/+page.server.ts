/**
 * /data — build-time data loading for the dataset credibility page.
 *
 * Runs only at prerender time. Reads the canonical artifacts from
 * static/data/v{version}/, slices first-5 and last-5 rows for the preview,
 * pre-renders the CHANGELOG markdown to HTML so the client ships zero
 * markdown parser, and returns a tightly scoped payload (no full dataset
 * in the page bundle).
 */

import { readFileSync } from 'fs';
import { statSync } from 'fs';
import { join } from 'path';
import type { PageServerLoad } from './$types';

export const prerender = true;

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
	[field: string]: number | undefined;
}

interface SchemaColumn {
	name: string;
	type: string;
	unit: string;
	source: string;
	notes: string;
}

interface ProvenanceEntry {
	commodity: string;
	ticker: string;
	field: string;
	originalSource: string;
	sourceUrl: string;
	dataQuality: string;
	updateCadence: string;
	licenseOfUnderlyingSource: string;
	notes: string;
}

function fmtBytes(n: number): string {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

// Minimal markdown → HTML for the changelog. Supports h1/h2/h3, paragraphs,
// unordered lists, inline code, links, and bold. Anything more elaborate than
// a typical CHANGELOG.md is rendered as plain text in a <p>.
function mdToHtml(md: string): string {
	const lines = md.split('\n');
	const out: string[] = [];
	let inList = false;

	const escape = (s: string) =>
		s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	const inline = (s: string) =>
		escape(s)
			.replace(/`([^`]+)`/g, '<code>$1</code>')
			.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
			.replace(
				/\[([^\]]+)\]\(([^)]+)\)/g,
				'<a href="$2" class="underline hover:no-underline">$1</a>'
			);

	const closeList = () => {
		if (inList) {
			out.push('</ul>');
			inList = false;
		}
	};

	for (const raw of lines) {
		const line = raw.trimEnd();
		if (line === '') {
			closeList();
			continue;
		}
		const h = /^(#{1,3})\s+(.*)$/.exec(line);
		if (h) {
			closeList();
			const level = h[1].length;
			const text = inline(h[2]);
			const id = h[2]
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '');
			out.push(`<h${level} id="${id}">${text}</h${level}>`);
			continue;
		}
		const li = /^\s*-\s+(.*)$/.exec(line);
		if (li) {
			if (!inList) {
				out.push('<ul>');
				inList = true;
			}
			out.push(`<li>${inline(li[1])}</li>`);
			continue;
		}
		closeList();
		out.push(`<p>${inline(line)}</p>`);
	}
	closeList();
	return out.join('\n');
}

export const load: PageServerLoad = async () => {
	const ROOT = process.cwd();
	const config: DatasetConfig = JSON.parse(
		readFileSync(join(ROOT, 'dataset-config.json'), 'utf-8')
	);
	const versionDir = join(ROOT, 'static', 'data', `v${config.version}`);

	const meta = JSON.parse(readFileSync(join(versionDir, 'meta.json'), 'utf-8'));
	const schemaJson = JSON.parse(readFileSync(join(versionDir, 'schema.json'), 'utf-8'));
	const provenance: { commodities: ProvenanceEntry[] } = JSON.parse(
		readFileSync(join(ROOT, 'src', 'lib', 'data-provenance.json'), 'utf-8')
	);
	const changelogMd = readFileSync(join(ROOT, 'static', 'data', 'CHANGELOG.md'), 'utf-8');

	// Slice first/last 5 rows for the preview. The full prices.json is read
	// here at build time only and never enters the page bundle.
	const prices: Record<string, PricesEntry> = JSON.parse(
		readFileSync(join(versionDir, 'prices.json'), 'utf-8')
	);
	const dates = Object.keys(prices).sort();
	const previewColumns = (schemaJson.columns as SchemaColumn[]).map((c) => c.name);
	const sliceRows = (subset: string[]) =>
		subset.map((d) => {
			const row: Record<string, string> = { date: d };
			for (const col of previewColumns) {
				if (col === 'date') continue;
				const v = (prices[d] as Record<string, unknown>)[col];
				row[col] = v === null || v === undefined ? '' : String(v);
			}
			return row;
		});
	const first5 = sliceRows(dates.slice(0, 5));
	const last5 = sliceRows(dates.slice(-5));

	// Downloads: read sizes from disk, checksums from meta.json.
	const formats: Array<{
		format: string;
		filename: string;
		size: string;
		sha256: string;
		downloadHref: string;
	}> = [
		{ format: 'CSV', filename: 'prices.csv', size: '', sha256: '', downloadHref: '' },
		{ format: 'JSON', filename: 'prices.json', size: '', sha256: '', downloadHref: '' },
		{ format: 'NDJSON', filename: 'prices.ndjson', size: '', sha256: '', downloadHref: '' },
		{ format: 'Parquet', filename: 'prices.parquet', size: '', sha256: '', downloadHref: '' },
	];
	for (const f of formats) {
		f.size = fmtBytes(statSync(join(versionDir, f.filename)).size);
		f.sha256 = meta.checksums[f.filename] || '';
		f.downloadHref = `/data/v${config.version}/${f.filename}`;
	}

	const changelogHtml = mdToHtml(changelogMd);

	return {
		config,
		meta,
		schema: schemaJson,
		provenance: provenance.commodities,
		first5,
		last5,
		formats,
		changelogHtml,
		buildStatusUrl: '/health.json',
	};
};
