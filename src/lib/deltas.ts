/**
 * deltas.ts — day-over-day weight-delta reframe, shared core.
 *
 * Computes how many grams of a commodity 1 BTC buys on two consecutive
 * days, takes the delta, and renders it as an everyday object ("1 BTC
 * gained a golf ball of gold since yesterday's close"). Object ladders +
 * voice live in delta-objects.json; this module is the pure compute +
 * caption layer.
 *
 * Browser-safe: no Node imports. Consumed by:
 *   - src/lib/components/HeroStage.svelte (the homepage Daily Delta line)
 *   - scripts/bot/deltas.ts, run.ts, make-short.ts (the X bot, via tsx)
 *
 * Moved here from scripts/bot/deltas.ts 2026-07-09 (audit Milestone 2.1 /
 * delight brief §1.1) — was previously a Node-only module duplicated by
 * gramsPerBtc copies in run.ts and make-short.ts.
 */

export type CommodityId = 'gold' | 'silver' | 'cocaine' | 'pu238' | 'cash';

export interface Rung {
	g: number;
	name: string;
}

export type PricingRule =
	| { kind: 'live'; field: string; perTroyOz: boolean }
	| { kind: 'fixed'; usdPerGram: number; tier?: string };

export interface DeltaObjectsFile {
	troyOzGrams: number;
	pricing: Record<CommodityId, PricingRule>;
	nouns: Record<CommodityId, string>;
	verbs: { gain: string[]; loss: string[]; steady: string[] };
	ladders: Record<CommodityId, Rung[]>;
}

export type DayPrices = { btc: number; [field: string]: number };
export type PriceData = Record<string, DayPrices>;

export const COMMODITIES: CommodityId[] = ['pu238', 'gold', 'cocaine', 'silver', 'cash'];

/** Grams of `commodity` that 1 BTC buys at a given day's prices. */
export function gramsPerBtc(objs: DeltaObjectsFile, commodity: CommodityId, day: DayPrices): number {
	const rule = objs.pricing[commodity];
	if (rule.kind === 'fixed') {
		return day.btc / rule.usdPerGram;
	}
	// live: price is per troy oz of the metal in `field`
	const perUnit = day[rule.field];
	const usdPerGram = rule.perTroyOz ? perUnit / objs.troyOzGrams : perUnit;
	return day.btc / usdPerGram;
}

/** Pick the ladder rung whose weight is nearest the absolute delta. */
export function nearestObject(ladder: Rung[], absGrams: number): Rung {
	return ladder.reduce((best, r) =>
		Math.abs(r.g - absGrams) < Math.abs(best.g - absGrams) ? r : best,
	);
}

/** Deterministic verb pick so reruns for the same day are stable. */
export function pickVerb(pool: string[], seed: string): string {
	let h = 0;
	for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
	return pool[h % pool.length];
}

export function formatGrams(g: number): string {
	const abs = Math.abs(g);
	if (abs >= 1000) return `${(g / 1000).toFixed(abs >= 10000 ? 0 : 1)} kg`;
	if (abs >= 10) return `${Math.round(g)} g`;
	if (abs >= 1) return `${g.toFixed(1)} g`;
	return `${g.toFixed(2)} g`;
}

export interface DeltaResult {
	commodity: CommodityId;
	prevDate: string;
	date: string;
	deltaGrams: number;
	direction: 'gain' | 'loss' | 'steady';
	object: Rung;
	caption: string;
}

/**
 * @param opts.sincePhrase - Replaces "yesterday's close" in the gain/loss
 * caption. Default matches the bot's original wording exactly (used when
 * `prev`/`curr` really are consecutive calendar days). The homepage passes
 * "the previous close" when the user has scrubbed to an earlier date, since
 * "yesterday" would be false for a date in 2019.
 */
export function computeDelta(
	objs: DeltaObjectsFile,
	commodity: CommodityId,
	prev: { date: string; day: DayPrices },
	curr: { date: string; day: DayPrices },
	opts?: { sincePhrase?: string },
): DeltaResult {
	const sincePhrase = opts?.sincePhrase ?? "yesterday's close";
	const before = gramsPerBtc(objs, commodity, prev.day);
	const after = gramsPerBtc(objs, commodity, curr.day);
	const delta = after - before;

	const noun = objs.nouns[commodity];
	const obj = nearestObject(objs.ladders[commodity], Math.abs(delta));

	let direction: DeltaResult['direction'];
	let caption: string;
	const amount = formatGrams(delta);

	if (Math.abs(delta) < obj.g * 0.15) {
		// Move is tiny relative to the smallest meaningful object — call it flat.
		direction = 'steady';
		caption = `In ${noun}, 1 BTC held steady overnight — within a rounding error of ${sincePhrase}.`;
	} else {
		direction = delta > 0 ? 'gain' : 'loss';
		const verb = pickVerb(objs.verbs[direction], curr.date + commodity);
		// Lead with the commodity so object names containing "of"
		// (a slice of bread, a deck of cards) don't read as a double "of".
		caption = `In ${noun}, 1 BTC ${verb} ${obj.name} since ${sincePhrase} (${
			delta > 0 ? '+' : '−'
		}${amount.replace('-', '')}).`;
	}

	return { commodity, prevDate: prev.date, date: curr.date, deltaGrams: delta, direction, object: obj, caption };
}
