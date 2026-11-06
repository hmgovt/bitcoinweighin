/**
 * Sun 18 Oct 2026: three posts, written to scripts/social/WRITING.md. One coin in
 * gold at each of the last three halvings against today (over or under), a year
 * of the world's silver against BlackRock's ETF (do the math), and all 21 million
 * coins against Manhattan (guess first). Live figures. See lib.ts for how to run it.
 */
import { execFileSync } from 'node:child_process';
import { L, SITE, f0, images, loadPrices, presetBtc, run, weekday, type Item } from './lib.ts';
import { LAND_VALUE_USD } from '../../../src/lib/manhattan.ts';

const OUT = 'output/slates/2026-10-18';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// The last three halvings (blocks 420,000, 630,000 and 840,000), one coin in gold on each day.
const HALVINGS = ['2016-07-09', '2020-05-11', '2024-04-20'];
const oz = (d: string) => P[d].xau_per_btc;
const last = HALVINGS[HALVINGS.length - 1];

// A year of the world's silver mines: about 26,000 t in 2025 (USGS, Mineral Commodity Summaries 2026).
const WORLD_T = 26_000;
const worldOz = (WORLD_T * 1e6) / 31.1035;
const worldBtc = worldOz / P[close].xag_per_btc;
const ibit = presetBtc('blackrock-ibit')!;

// All 21 million coins against Manhattan's land (2014 value).
const capShare = (21e6 * px) / LAND_VALUE_USD;
const wholeAt = Math.ceil(LAND_VALUE_USD / 21e6);

/** The last halving's card, rendered here (the site doesn't pre-render it), above today's. */
const thenAndNow = (): string => {
	const then = `${OUT}/gold-halving.png`;
	execFileSync('curl', ['-sfS', '--max-time', '60', '-o', `${OUT}/card-prices.json`, `${SITE}/prices.json`]);
	execFileSync('npx', ['tsx', 'scripts/og/render-card.ts', `${then}|btc=1&commodity=gold&date=${last}`], { env: { ...process.env, PRICES: `${OUT}/card-prices.json` } });
	const file = `${OUT}/gold-halving-now.jpg`;
	execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', then, '-i', get('gold_b-1'), '-filter_complex', '[0][1]vstack=inputs=2', '-q:v', '2', file]);
	return file;
};

const SLATE: Item[] = [
	{ id: 'halvings-in-gold', at: '2026-10-18T13:30:00Z', media: thenAndNow,
		text: `One bitcoin, weighed in gold, on each of the last three halving days:\n\n${HALVINGS.map((d) => `${d.slice(0, 4)}: ${oz(d) < 1 ? oz(d).toFixed(2) : oz(d).toFixed(1)} oz`).join('\n')}\n\nAt ${closeWord}’s close: ${oz(close).toFixed(1)} oz.\n\nThe next halving is due around spring 2028. Over or under ${oz(last).toFixed(1)} oz by then?`,
		reply: 'Slide the date to any halving yourself:\n' + L('btc=1&commodity=gold') },
	{ id: 'ibit-world-silver', at: '2026-10-18T17:00:00Z', media: () => jpg(get('silver_p-blackrock-ibit'), 'ibit-silver'),
		text: `Every silver mine on Earth dug about ${f0(WORLD_T)} tonnes in 2025.\n\nAt ${closeWord}’s close, that whole year of silver costs about ${f0(Math.round(worldBtc / 1000) * 1000)} bitcoin.\n\nBlackRock’s bitcoin ETF holds ${f0(ibit)}. ${ibit > worldBtc ? 'It could buy the lot and have change.' : 'Not quite enough.'}\n\nCheap silver, or dear bitcoin?`,
		reply: 'Mine output: USGS, Mineral Commodity Summaries 2026. Weigh any stack in silver:\n' + L('preset=blackrock-ibit&commodity=silver') },
	{ id: 'all-coins-manhattan', at: '2026-10-18T21:30:00Z', media: () => jpg(get('manhattan_p-market-cap'), 'all-coins-manhattan'),
		text: `Every bitcoin there will ever be: 21 million coins.\n\nSpent on Manhattan land at ${closeWord}’s close, do they buy the whole island?\n\nGuess first.`,
		reply: (capShare >= 1
			? `Yes, with ${Math.round((capShare - 1) * 100)}% to spare. `
			: `Not quite: ${(capShare * 100).toFixed(1)}%. At $${f0(wholeAt)} a coin, they would. `) + '(2014 land value, illustrative.) Fill it with any stack:\n' + L('preset=market-cap&commodity=manhattan') },
];

await run(SLATE, OUT, `Sun 18 Oct · close ${close} ($${f0(px)}), previous ${prev}`);
