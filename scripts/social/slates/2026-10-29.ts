/**
 * Thu 29 Oct 2026: three posts, written to scripts/social/WRITING.md. Satoshi and
 * Strategy together against Central Park's land (guess first), one coin of gold
 * counted in Olympic gold medals, and how many satoshis buy a $1 bill (guess
 * first). Live figures. See lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, OZ, type Item } from './lib.ts';
import { USD_PER_M2, LAND_YARDSTICKS } from '../../../src/lib/manhattan.ts';

const OUT = 'output/slates/2026-10-29';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// Central Park (3.41 km²) at Manhattan's average land value, in bitcoin.
const PARK_M2 = LAND_YARDSTICKS.find((y) => y.label === 'Central Park')!.m2;
const parkBtc = (PARK_M2 * USD_PER_M2) / px;
const sat = presetBtc('satoshi')!, strategy = presetBtc('strategy')!;
const both = sat + strategy;

// One coin of gold against Olympic gold medals, which carry about 6 g of gold each (IOC minimum).
const goldG = P[close].xau_per_btc * OZ;
const medals = goldG / 6;

// Satoshis (100 million to a coin) per US dollar.
const satsPerDollar = 1e8 / px;

const SLATE: Item[] = [
	{ id: 'central-park-satoshi-strategy', at: '2026-10-29T13:30:00Z', media: () => jpg(get('manhattan_p-satoshi'), 'satoshi-manhattan'),
		text: `Satoshi holds ${f0(sat)} bitcoin. Strategy holds ${f0(strategy)}.\n\nPut them together and try to buy the land under Central Park, at Manhattan’s average land price.\n\nEnough? Guess first.`,
		reply: `${both >= parkBtc ? 'Yes' : 'No'}: the park takes about ${f0(Math.round(parkBtc / 1000) * 1000)} bitcoin at ${closeWord}’s close; together they hold ${f0(both)}. (2014 land value, illustrative.) Try any stack:\n` + L('preset=satoshi&commodity=manhattan') },
	{ id: 'one-coin-olympic-medals', at: '2026-10-29T17:00:00Z', media: () => jpg(get('gold_b-1'), 'one-coin-gold'),
		text: `An Olympic gold medal is mostly silver. It carries about 6 grams of gold.\n\nOne bitcoin buys ${f0(goldG)} grams of gold at ${closeWord}’s close.\n\nThat’s the gold in about ${f0(Math.floor(medals))} Olympic gold medals. Which would you rather win?`,
		reply: 'The IOC requires at least 6 g of gold on a gold medal; Paris 2024’s weighed 529 g in all. Weigh any amount in gold:\n' + L('btc=1&commodity=gold') },
	{ id: 'sats-per-dollar', at: '2026-10-29T21:30:00Z', media: () => jpg(get('cash_b-1'), 'one-coin-cash'),
		text: `A bitcoin splits into 100 million satoshis.\n\nHow many satoshis does one $1 bill buy?\n\nGuess first.`,
		reply: `About ${f0(satsPerDollar)} at ${closeWord}’s close. Turned the other way: one bitcoin is ${f0(px)} of those bills, a stack ${((px * 0.10922) / 1000).toFixed(1)} m tall. Stack any amount:\n` + L('btc=1&commodity=cash') },
];

await run(SLATE, OUT, `Thu 29 Oct · close ${close} ($${f0(px)}), previous ${prev}`);
