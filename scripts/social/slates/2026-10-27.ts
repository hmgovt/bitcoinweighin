/**
 * Tue 27 Oct 2026: three posts, written to scripts/social/WRITING.md. The 2010
 * pizza coins against one Midtown block (bigger or smaller?), one coin in silver
 * in January 2013 against now, and the US government's coins in $1 bills by
 * weight against the Eiffel Tower (guess first). Live figures. See lib.ts.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, type Item } from './lib.ts';
import { landM2, LAND_YARDSTICKS } from '../../../src/lib/manhattan.ts';

const OUT = 'output/slates/2026-10-27';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// The pizza coins on Manhattan land against one Midtown block (200 × 800 ft).
const pizza = presetBtc('pizza-day')!;
const BLOCK_M2 = LAND_YARDSTICKS.find((y) => y.label === 'a Midtown block')!.m2;
const blocks = landM2(pizza, px) / BLOCK_M2;

// One coin in silver on the dataset's first day (2 January 2013) against the latest close.
const first = Object.keys(P).filter((d) => P[d].xag_per_btc).sort()[0];
const then = P[first].xag_per_btc, now = P[close].xag_per_btc;

// The US government's coins in $1 bills by weight (a note is about 1 g) against the Eiffel
// Tower: 10,100 t in all (toureiffel.paris).
const govt = presetBtc('us-govt')!;
const paperT = (govt * px) / 1e6;
const EIFFEL_T = 10_100;

const SLATE: Item[] = [
	{ id: 'pizza-midtown-block', at: '2026-10-27T13:30:00Z', media: () => jpg(get('manhattan_p-pizza-day'), 'pizza-manhattan'),
		text: `In 2010, Laszlo Hanyecz paid ${f0(pizza)} bitcoin for two pizzas.\n\nSpend those coins on Manhattan land at ${closeWord}’s close.\n\nBigger or smaller than one Midtown block? Guess first.`,
		reply: `${blocks >= 1 ? 'Bigger' : 'Smaller'}: ${blocks.toFixed(2)} blocks (a block is 200 by 800 feet). Land at its 2014 value, spread evenly, so it’s illustrative. Try any stack:\n` + L('preset=pizza-day&commodity=manhattan') },
	{ id: 'silver-2013-vs-now', at: '2026-10-27T17:00:00Z', media: () => jpg(get('silver_b-1'), 'one-coin-silver'),
		text: `In January 2013, one bitcoin bought ${then.toFixed(2)} oz of silver. Less than half an ounce.\n\nAt ${closeWord}’s close: ${f0(now)} oz. About ${f0(Math.round(now / then / 100) * 100)} times as much.\n\nSilver stackers: was there ever a better trade?`,
		reply: 'Slide the date back to 2013 yourself:\n' + L('btc=1&commodity=silver') },
	{ id: 'govt-paper-eiffel', at: '2026-10-27T21:30:00Z', media: () => jpg(get('cash_p-us-govt'), 'govt-cash'),
		text: `The US government holds ${f0(govt)} bitcoin.\n\nChange it all into $1 bills and put them on a scale.\n\nHeavier than the Eiffel Tower? Guess first.`,
		reply: `${paperT >= EIFFEL_T ? 'Yes' : 'No'}: ${f0(Math.round(paperT / 100) * 100)} tonnes of paper at ${closeWord}’s close, a gram a note. The tower is ${f0(EIFFEL_T)} t, so that’s ${(paperT / EIFFEL_T).toFixed(1)} Eiffel Towers. Stack any amount:\n` + L('preset=us-govt&commodity=cash') },
];

await run(SLATE, OUT, `Tue 27 Oct · close ${close} ($${f0(px)}), previous ${prev}`);
