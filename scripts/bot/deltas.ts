/**
 * deltas.ts — day-over-day weight-delta reframe for the X bot.
 *
 * Computes how many grams of a commodity 1 BTC buys on two consecutive
 * days, takes the delta, and renders it as an everyday object ("1 BTC
 * gained a golf ball of gold overnight"). Object ladders + voice live in
 * objects.json; this module is the pure compute + caption layer the
 * content engine calls.
 *
 *   npx tsx scripts/bot/deltas.ts            # demo on the latest two dataset days
 *   npx tsx scripts/bot/deltas.ts --commodity=silver
 */
import { promises as fs } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');
const OBJECTS_PATH = join(__dirname, 'objects.json');
const PRICES_PATH = join(PROJECT_ROOT, 'static', 'prices.json');

type CommodityId = 'gold' | 'silver' | 'cocaine' | 'pu238';

interface Rung {
	g: number;
	name: string;
}
interface ObjectsFile {
	troyOzGrams: number;
	pricing: Record<
		CommodityId,
		| { kind: 'live'; field: string; perTroyOz: boolean }
		| { kind: 'fixed'; usdPerGram: number; tier?: string }
	>;
	nouns: Record<CommodityId, string>;
	verbs: { gain: string[]; loss: string[]; steady: string[] };
	ladders: Record<CommodityId, Rung[]>;
}
type DayPrices = { btc: number; [field: string]: number };
type PriceData = Record<string, DayPrices>;

const COMMODITIES: CommodityId[] = ['pu238', 'gold', 'cocaine', 'silver'];

/** Grams of `commodity` that 1 BTC buys at a given day's prices. */
function gramsPerBtc(objs: ObjectsFile, commodity: CommodityId, day: DayPrices): number {
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
function nearestObject(ladder: Rung[], absGrams: number): Rung {
	return ladder.reduce((best, r) =>
		Math.abs(r.g - absGrams) < Math.abs(best.g - absGrams) ? r : best,
	);
}

/** Deterministic verb pick so reruns for the same day are stable. */
function pickVerb(pool: string[], seed: string): string {
	let h = 0;
	for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
	return pool[h % pool.length];
}

function formatGrams(g: number): string {
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

export function computeDelta(
	objs: ObjectsFile,
	commodity: CommodityId,
	prev: { date: string; day: DayPrices },
	curr: { date: string; day: DayPrices },
): DeltaResult {
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
		caption = `In ${noun}, 1 BTC held steady overnight — within a rounding error of yesterday's close.`;
	} else {
		direction = delta > 0 ? 'gain' : 'loss';
		const verb = pickVerb(objs.verbs[direction], curr.date + commodity);
		// Lead with the commodity so object names containing "of"
		// (a slice of bread, a deck of cards) don't read as a double "of".
		caption = `In ${noun}, 1 BTC ${verb} ${obj.name} since yesterday's close (${
			delta > 0 ? '+' : '−'
		}${amount.replace('-', '')}).`;
	}

	return { commodity, prevDate: prev.date, date: curr.date, deltaGrams: delta, direction, object: obj, caption };
}

async function main() {
	const arg = process.argv
		.slice(2)
		.find((a) => a.startsWith('--commodity='))
		?.split('=')[1] as CommodityId | undefined;

	const objs = JSON.parse(await fs.readFile(OBJECTS_PATH, 'utf-8')) as ObjectsFile;
	const prices = JSON.parse(await fs.readFile(PRICES_PATH, 'utf-8')) as PriceData;

	const dates = Object.keys(prices).sort();
	const [pd, cd] = [dates[dates.length - 2], dates[dates.length - 1]];
	const prev = { date: pd, day: prices[pd] };
	const curr = { date: cd, day: prices[cd] };

	console.log(`Δ ${pd} → ${cd}  (BTC $${prev.day.btc.toLocaleString()} → $${curr.day.btc.toLocaleString()})`);
	console.log('─'.repeat(64));

	const list = arg ? [arg] : COMMODITIES;
	for (const c of list) {
		const r = computeDelta(objs, c, prev, curr);
		console.log(r.caption);
	}
}

// Run only when invoked directly (not when imported by the content engine).
if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
