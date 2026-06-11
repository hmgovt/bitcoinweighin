/**
 * build-sitemap.ts — generates static/sitemap.xml from the actual route
 * set at build time. Replaces the hand-maintained file (SEO audit I4):
 * snapshot years derive from data coverage exactly as the prerenderer
 * does, so /snapshot/2027 appears in the sitemap the same day the route
 * starts existing. <lastmod> is the build date — truthful, since every
 * page re-bakes with fresh numbers on each daily deploy.
 *
 * Runs as the first step of `npm run build` (see package.json).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://bitcoinweighin.com';

// Years derived the same way src/lib/seo/snapshots.ts derives them.
const prices = JSON.parse(
	readFileSync(join(ROOT, 'static', 'prices.json'), 'utf-8')
) as Record<string, unknown>;
const years = [...new Set(Object.keys(prices).map((d) => d.slice(0, 4)))].sort();

// Launch commodities — keep in sync with mvpLaunch entries in
// src/lib/commodities.ts (imported lazily as a plain regex scan so this
// script has no dependency on the app's module graph).
const commoditiesSrc = readFileSync(join(ROOT, 'src', 'lib', 'commodities.ts'), 'utf-8');
// Pair each id with ITS OWN mvpLaunch: the tempered (?!id:) guard stops
// the match crossing into the next entry.
const launchIds: string[] = [];
for (const m of commoditiesSrc.matchAll(
	/id:\s*'([a-z0-9_]+)',(?:(?!id:)[\s\S])*?mvpLaunch:\s*true/g
)) {
	launchIds.push(m[1]);
}
if (launchIds.length < 4) {
	throw new Error(
		`build-sitemap: expected ≥4 mvpLaunch commodities, found ${launchIds.length} — regex drift?`
	);
}

const today = new Date().toISOString().slice(0, 10);

interface Entry {
	path: string;
	priority: string;
	changefreq: 'daily' | 'weekly' | 'monthly';
}

const entries: Entry[] = [
	{ path: '/', priority: '1.0', changefreq: 'daily' },
	{ path: '/data', priority: '0.9', changefreq: 'daily' },
	{ path: '/methodology', priority: '0.7', changefreq: 'weekly' },
	...launchIds.map((id) => ({
		path: `/btc/${id}`,
		priority: '0.8',
		changefreq: 'daily' as const,
	})),
	{ path: '/snapshot', priority: '0.6', changefreq: 'weekly' },
	...years.map((y) => ({
		path: `/snapshot/${y}`,
		priority: '0.5',
		changefreq: 'monthly' as const,
	})),
];

const xml =
	`<?xml version="1.0" encoding="UTF-8"?>\n` +
	`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
	entries
		.map(
			(e) =>
				`\t<url>\n` +
				`\t\t<loc>${ORIGIN}${e.path}</loc>\n` +
				`\t\t<lastmod>${today}</lastmod>\n` +
				`\t\t<changefreq>${e.changefreq}</changefreq>\n` +
				`\t\t<priority>${e.priority}</priority>\n` +
				`\t</url>`
		)
		.join('\n') +
	`\n</urlset>\n`;

writeFileSync(join(ROOT, 'static', 'sitemap.xml'), xml);
console.log(`sitemap.xml: ${entries.length} URLs, lastmod ${today}`);
