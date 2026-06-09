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

export const prerender = true;

export const entries: EntryGenerator = () => {
	return LAUNCH_COMMODITIES.map((c) => ({ commodity: c.id }));
};

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

	return {
		commodityId: commodity.id,
		displayName: commodity.displayName,
		dataQuality: commodity.dataQuality,
		title: content.title,
		h1: content.h1,
		metaDescription: content.metaDescription,
		intro,
		context,
		faqs,
		relatedPages: content.relatedPages ?? [],
		ratio,
		btcUsd,
		date,
	};
};
