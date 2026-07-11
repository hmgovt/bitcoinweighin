/**
 * build-milestones.ts — scans the price archive for the first date 1 BTC
 * crossed each gold/silver ratio threshold (1 ozt, 10 ozt, 100 ozt, 1 kg
 * for gold; 1 kg, 10 kg, 100 kg, 1 t for silver) and emits
 * static/milestones.json (delight brief §1.4c).
 *
 * Dataset-derived, not hand-maintained: `scanMilestones` is the pure scan
 * logic, exported so tests/milestones.test.ts can assert that a fresh scan
 * of the committed static/prices.json produces EXACTLY the committed
 * static/milestones.json — regen drift fails CI instead of shipping
 * silently (same shape as tests/drift.test.ts).
 *
 * Runs as part of `npm run build`, before `vite build`, alongside
 * build-sitemap.ts (see package.json).
 *
 * Usage: npx tsx scripts/build-milestones.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export interface PriceRow {
	btc?: number;
	xau?: number;
	xag?: number;
	[key: string]: number | undefined;
}

export type PricesFile = Record<string, PriceRow>;

export interface Milestone {
	date: string;
	commodity: 'gold' | 'silver';
	label: string;
	ozt: number;
}

/** Grams per troy ounce — same constant as src/lib/delta-objects.json. */
export const TROY_OZ_GRAMS = 31.1035;
/** Troy ounces per kilogram, derived from TROY_OZ_GRAMS (brief §1.4c: ~32.1507). */
export const OZT_PER_KG = 1000 / TROY_OZ_GRAMS;

interface Threshold {
	ozt: number;
	label: string;
}

// Thresholds ascend in `ozt` within each commodity — scanCommodity relies on
// this order, walking the archive once and advancing to the next threshold
// only after the current one is crossed. NOTE: 1 kg of gold (~32.15 ozt)
// numerically sits BETWEEN 10 ozt and 100 ozt, not after 100 ozt as the
// brief's prose listing (§1.4c: "1 ozt, 10 ozt, 100 ozt, 1 kg") might
// suggest — the array below is sorted by actual ozt value, not brief order.
const GOLD_THRESHOLDS: Threshold[] = [
	{ ozt: 1, label: '1 BTC = 1 ozt of gold' },
	{ ozt: 10, label: '1 BTC = 10 ozt of gold' },
	{ ozt: OZT_PER_KG, label: '1 BTC = 1 kg of gold' },
	{ ozt: 100, label: '1 BTC = 100 ozt of gold' },
];
const SILVER_THRESHOLDS: Threshold[] = [
	{ ozt: OZT_PER_KG, label: '1 BTC = 1 kg of silver' },
	{ ozt: 10 * OZT_PER_KG, label: '1 BTC = 10 kg of silver' },
	{ ozt: 100 * OZT_PER_KG, label: '1 BTC = 100 kg of silver' },
	{ ozt: 1000 * OZT_PER_KG, label: '1 BTC = 1 t of silver' },
];

/**
 * Scan one commodity's price field for the first day the BTC/metal ratio
 * (in troy oz) crosses each threshold, in ascending order. "Crossed" is a
 * simple first-crossing: the first day whose end-of-day ratio is >= the
 * threshold. There is no check for whether the ratio later dips back below
 * it — once a threshold is recorded the scan only looks for the next one,
 * so a later re-crossing of an already-passed threshold is never reported.
 * Days missing either price field are skipped defensively (weekends/gaps
 * before forward-fill, or a field that simply isn't in the row).
 */
function scanCommodity(
	dates: string[],
	prices: PricesFile,
	field: 'xau' | 'xag',
	thresholds: Threshold[],
	commodity: 'gold' | 'silver'
): Milestone[] {
	const found: Milestone[] = [];
	let next = 0;
	for (const date of dates) {
		if (next >= thresholds.length) break;
		const day = prices[date];
		if (!day) continue;
		const btc = day.btc;
		const perOzt = day[field];
		if (typeof btc !== 'number' || typeof perOzt !== 'number') continue;
		if (!(btc > 0) || !(perOzt > 0)) continue;
		const ratioOzt = btc / perOzt; // 1 BTC's value expressed in troy oz of the metal
		while (next < thresholds.length && ratioOzt >= thresholds[next].ozt) {
			const t = thresholds[next];
			found.push({ date, commodity, label: t.label, ozt: t.ozt });
			next++;
		}
	}
	return found;
}

/**
 * Pure scanner: takes the prices object, returns the milestone list, gold
 * first then silver, each in chronological order. No file I/O — this is
 * what tests/milestones.test.ts calls directly to check the committed
 * static/milestones.json for regen drift. A threshold never crossed in the
 * dataset is silently omitted (per brief).
 */
export function scanMilestones(prices: PricesFile): Milestone[] {
	const dates = Object.keys(prices).sort();
	return [
		...scanCommodity(dates, prices, 'xau', GOLD_THRESHOLDS, 'gold'),
		...scanCommodity(dates, prices, 'xag', SILVER_THRESHOLDS, 'silver'),
	];
}

// ── Runner ───────────────────────────────────────────────────────────────
// Only executes when this file is the tsx entry point, not when imported
// (e.g. by tests/milestones.test.ts) purely for scanMilestones — otherwise
// every test run would rewrite static/milestones.json as a side effect.
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
	const prices = JSON.parse(
		readFileSync(join(ROOT, 'static', 'prices.json'), 'utf-8')
	) as PricesFile;
	const milestones = scanMilestones(prices);
	writeFileSync(
		join(ROOT, 'static', 'milestones.json'),
		JSON.stringify(milestones, null, '\t') + '\n'
	);
	console.log(`milestones.json: ${milestones.length} milestones`);
	for (const m of milestones) console.log(`  ${m.date}  ${m.label}`);
}
