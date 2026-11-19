/**
 * Fri 20 Nov 2026: three posts, written to scripts/social/WRITING.md.
 * One bitcoin in silver from the dataset's first day through its peak to now,
 * the 10,000 pizza coins on Manhattan land counted in football pitches, and
 * one bitcoin in $1 bills stacked against a London double-decker. No video:
 * this week already has three (Mon, Tue, Wed). Live figures. See lib.ts for
 * how to run it.
 */
import { L, f0, images, loadPrices, nice, presetBtc, run, weekday, type Item } from './lib.ts';
import { landM2 } from '../../../src/lib/manhattan.ts';

const OUT = 'output/slates/2026-11-20';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// One coin in silver: the dataset's first day, its peak, and now.
const days = Object.keys(P).filter((d) => d <= close && P[d].xag_per_btc).sort();
const first = days[0];
const peak = days.reduce((a, b) => (P[b].xag_per_btc > P[a].xag_per_btc ? b : a));
const ozFirst = P[first].xag_per_btc;
const ozPeak = P[peak].xag_per_btc;
const ozNow = P[close].xag_per_btc;

// The pizza coins on Manhattan land, against a football pitch: 105 × 68 m (FIFA's recommended size).
const PITCH_M2 = 105 * 68;
const pizza = presetBtc('pizza-day')!;
const pizzaM2 = landM2(pizza, px);

// One coin in $1 bills (0.10922 mm and about 1 g a note) against a London double-decker, about 4.4 m.
const BUS_M = 4.4;
const stackM = (px * 0.10922) / 1000;

const SLATE: Item[] = [
	{ id: 'one-coin-silver-history', at: '2026-11-20T13:30:00Z', media: () => jpg(get('silver_b-1'), 'one-coin-silver'),
		text: `On ${nice(first)}, one bitcoin bought ${ozFirst.toFixed(2)} ounces of silver.\n\nAt the peak, on ${nice(peak)}, it bought ${f0(ozPeak)}.\n\nAt ${closeWord}’s close: ${f0(ozNow)}. Down ${((1 - ozNow / ozPeak) * 100).toFixed(0)}% from the top, up ${f0(ozNow / ozFirst)}-fold from the start. Which number matters?`,
		reply: `Silver $${P[close].xag_usd.toFixed(2)} an ounce, bitcoin $${f0(px)} (daily closes, our dataset). Weigh one coin in silver on any day since 2013:\n` + L('btc=1&commodity=silver') },
	{ id: 'pizza-manhattan-pitches', at: '2026-11-20T17:00:00Z', media: () => jpg(get('manhattan_p-pizza-day'), 'pizza-manhattan'),
		text: `In 2010, 10,000 bitcoin bought two pizzas.\n\nSpend the same coins on Manhattan land at ${closeWord}’s close: ${f0(Math.round(pizzaM2 / 10) * 10)} square metres at the Battery.\n\nThat’s about ${(pizzaM2 / PITCH_M2).toFixed(1)} football pitches. Two pizzas, or a slice of New York?`,
		reply: 'Land at its 2014 value (Barr, Smith & Kulkarni), spread evenly, illustrative. Pitch: 105 × 68 m (FIFA). Fill the island with any stack:\n' + L('preset=pizza-day&commodity=manhattan') },
	{ id: 'one-coin-cash-bus', at: '2026-11-20T21:30:00Z', media: () => jpg(get('cash_b-1'), 'one-coin-cash'),
		text: `One bitcoin, changed into $1 bills at ${closeWord}’s close: ${f0(px)} notes.\n\nStack them in one pile: ${stackM.toFixed(1)} metres high, and about ${f0(px / 1000)} kg.\n\nA London double-decker is about ${BUS_M} m tall. ${stackM >= BUS_M ? `The pile is ${(stackM / BUS_M).toFixed(1)} buses high` : `The pile reaches ${((stackM / BUS_M) * 100).toFixed(0)}% of the way up`}. Carry home one coin, or ${f0(px / 1000)} kg of paper?`,
		reply: 'Each note is 0.11 mm thick and weighs about 1 g. A New Routemaster stands about 4.4 m. Stack any amount:\n' + L('btc=1&commodity=cash') },
];

await run(SLATE, OUT, `Fri 20 Nov · close ${close} ($${f0(px)}), previous ${prev}`);
