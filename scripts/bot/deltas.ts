/**
 * deltas.ts — CLI demo for the day-over-day weight-delta reframe.
 *
 * The pure compute + caption logic lives in src/lib/deltas.ts (browser-safe,
 * shared with the homepage's Daily Delta line). This file is now just the
 * bot-side CLI entrypoint: it loads objects.json + prices.json from disk
 * and prints captions for the latest two dataset days.
 *
 *   npx tsx scripts/bot/deltas.ts            # demo on the latest two dataset days
 *   npx tsx scripts/bot/deltas.ts --commodity=silver
 */
import { promises as fs } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeDelta, COMMODITIES, type CommodityId, type DeltaObjectsFile, type PriceData } from '../../src/lib/deltas.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');
const OBJECTS_PATH = join(PROJECT_ROOT, 'src', 'lib', 'delta-objects.json');
const PRICES_PATH = join(PROJECT_ROOT, 'static', 'prices.json');

async function main() {
	const arg = process.argv
		.slice(2)
		.find((a) => a.startsWith('--commodity='))
		?.split('=')[1] as CommodityId | undefined;

	const objs = JSON.parse(await fs.readFile(OBJECTS_PATH, 'utf-8')) as DeltaObjectsFile;
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
