/**
 * /btc/[commodity] — commodity-specific SEO landing page.
 *
 * Prerendered at build time. Loads the latest day's prices from
 * static/prices-latest.json (the same single-day file the homepage
 * pre-inlines for fast LCP), computes the current "how much commodity
 * does 1 BTC buy" amount, and formats it for inline display.
 *
 * `entries` returns one path per launch commodity. `prerender = true`
 * means the adapter-static build emits one HTML file per commodity
 * with crawler-ready content.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { error } from '@sveltejs/kit';
import type { EntryGenerator, PageServerLoad } from './$types';
import { LAUNCH_COMMODITIES, getCommodity } from '$lib/commodities.js';
import { computeCommodityAmount, type DayPrices } from '$lib/prices.js';
import { COMMODITY_CONTENT } from '$lib/seo/commodity-content.js';
import { listYears } from '$lib/seo/snapshots.js';

export const prerender = true;

export const entries: EntryGenerator = () => {
	return LAUNCH_COMMODITIES.map((c) => ({ commodity: c.id }));
};

interface Milestone {
	date: string;
	commodity: string;
	label: string;
}

/**
 * Snapshot-year cross-links. These pages linked out to sibling commodities,
 * /data and /methodology, but never into the /snapshot* tree — leaving the
 * year pages reachable from /snapshot alone.
 *
 * Selection is derived, not editorial. Gold and silver point at the years
 * their milestones were first crossed, newest first, reusing the same
 * static/milestones.json that feeds the slider markers. Every commodity
 * also gets the first and latest years of coverage, so the pages with no
 * milestones of their own (pu238, cocaine, cash) still link out. Capped at
 * three so the block stays a contextual aside, not a link dump.
 */
function snapshotLinksFor(
	commodityId: string,
	root: string
): Array<{ href: string; label: string }> {
	const years = listYears();
	if (!years.length) return [];

	const milestones: Milestone[] = JSON.parse(
		readFileSync(join(root, 'static', 'milestones.json'), 'utf-8')
	);

	const candidates: Array<{ year: number; label: string }> = [
		...milestones
			.filter((m) => m.commodity === commodityId)
			.sort((a, b) => b.date.localeCompare(a.date))
			.slice(0, 2)
			.map((m) => ({ year: Number(m.date.slice(0, 4)), label: m.label })),
		{ year: years[0], label: 'the first year of coverage' },
		{ year: years[years.length - 1], label: 'the year so far' },
	];

	const seen = new Set<number>();
	const out: Array<{ href: string; label: string }> = [];
	for (const c of candidates) {
		if (seen.has(c.year) || !years.includes(c.year)) continue;
		seen.add(c.year);
		out.push({ href: `/snapshot/${c.year}`, label: `${c.year} — ${c.label}` });
		if (out.length === 3) break;
	}
	return out;
}

function formatNoteCountForRatio(amount: number): string {
	if (amount >= 1_000_000_000_000) return `${(amount / 1_000_000_000_000).toFixed(2)} trillion $1 bills`;
	if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)} billion $1 bills`;
	return `${(amount / 1_000_000).toFixed(2)} million $1 bills`;
}

function formatRatio(amount: number, commodityId: string): string {
	const c = getCommodity(commodityId);
	if (!c) return amount.toString();

	if (c.unit === 'troy_oz') {
		if (amount >= 1000) return `${Math.round(amount).toLocaleString('en-US')} troy oz`;
		if (amount >= 1) return `${amount.toFixed(2)} troy oz`;
		return `${amount.toPrecision(3)} troy oz`;
	}

	if (c.unit === 'gram' && c.unitMassGrams) {
		const g = amount * c.unitMassGrams;
		if (g >= 1_000_000) return `${(g / 1_000_000).toFixed(2)} tonnes`;
		if (g >= 1000) return `${(g / 1000).toFixed(2)} kg`;
		if (g >= 1) return `${g.toFixed(1)} g`;
		if (g >= 0.001) return `${(g * 1000).toFixed(0)} mg`;
		return `${(g * 1_000_000).toFixed(0)} µg`;
	}

	if (c.unit === 'note') {
		if (amount >= 1_000_000) return formatNoteCountForRatio(amount);
		return `${Math.round(amount).toLocaleString('en-US')} $1 bills`;
	}

	return `${amount.toFixed(2)} ${c.unit}`;
}

export const load: PageServerLoad = async ({ params }) => {
	const content = COMMODITY_CONTENT[params.commodity];
	const commodity = getCommodity(params.commodity);
	if (!content || !commodity || !commodity.mvpLaunch) {
		throw error(404, `No landing page for ${params.commodity}`);
	}

	const ROOT = process.cwd();
	const latest: Record<string, DayPrices> = JSON.parse(
		readFileSync(join(ROOT, 'static', 'prices-latest.json'), 'utf-8')
	);
	const date = Object.keys(latest)[0];
	const dayPrices = latest[date];
	const amount = computeCommodityAmount(1, commodity, dayPrices);

	const ratio = amount !== null ? formatRatio(amount, commodity.id) : 'a live amount';
	const btcUsd = dayPrices.btc;

	// Substitute the live ratio into the templated strings so the
	// rendered HTML and the FAQPage JSON-LD both carry today's number
	// — Google requires the visible answer and the structured-data
	// answer to match. Done at build time so re-runs of the daily
	// pipeline keep the figures fresh.
	const intro = content.intro.map((p) => p.replace(/\{ratio\}/g, ratio));
	const context = content.context.map((p) => p.replace(/\{ratio\}/g, ratio));
	const faqs = content.faqs.map((f) => ({
		question: f.question.replace(/\{ratio\}/g, ratio),
		answer: f.answer.replace(/\{ratio\}/g, ratio),
	}));

	// Pass the commodity through so the poster component can read
	// cubeSpritePath, density, unit etc. Restricting fields keeps the
	// payload small and stops the page bundle from accidentally
	// inheriting the full ALL_COMMODITIES list.
	const commodityPayload = {
		id: commodity.id,
		displayName: commodity.displayName,
		renderStyle: commodity.renderStyle,
		unit: commodity.unit,
		unitMassGrams: commodity.unitMassGrams,
		densityGPerCm3: commodity.densityGPerCm3,
		cubeSpritePath: commodity.cubeSpritePath,
		cubeShadowPath: commodity.cubeShadowPath,
		// Fields below are unused by the poster but required by the
		// Commodity type so we pass them through verbatim.
		mvpLaunch: commodity.mvpLaunch,
		sourceId: commodity.sourceId,
		sourceName: commodity.sourceName,
		dataQuality: commodity.dataQuality,
		priceField: commodity.priceField,
		facts: commodity.facts,
	};

	return {
		commodityId: commodity.id,
		commodity: commodityPayload,
		displayName: commodity.displayName,
		dataQuality: commodity.dataQuality,
		renderStyle: commodity.renderStyle,
		title: content.title,
		h1: content.h1,
		metaDescription: content.metaDescription,
		intro,
		context,
		faqs,
		relatedPages: content.relatedPages ?? [],
		snapshotPages: snapshotLinksFor(commodity.id, ROOT),
		ratio,
		btcUsd,
		amount,
		date,
	};
};
