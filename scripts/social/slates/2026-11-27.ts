/**
 * Fri 27 Nov 2026 (Black Friday): three posts, written to
 * scripts/social/WRITING.md. The 10,000 pizza coins in $1 bills stacked
 * towards space, Strategy's coins in gold against all of Britain's gold, and
 * every bitcoin there will ever be in oil against America's proved crude
 * reserves. No video: this week already has three (Mon, Tue, Wed). Live
 * figures. See lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, OZ, type Item } from './lib.ts';
import { BILL_THICKNESS_MM } from '../../../src/lib/billStack.ts';

const OUT = 'output/slates/2026-11-27';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// The pizza coins in $1 bills, stacked: against the Kármán line, the usual
// edge of space at 100 km (FAI).
const KARMAN_KM = 100;
const pizza = presetBtc('pizza-day')!;
const pizzaNotes = pizza * px;
const pizzaKm = (pizzaNotes * BILL_THICKNESS_MM) / 1e6;

// Strategy's coins in gold against the UK's official gold: 310.3 tonnes
// (World Gold Council).
const UK_T = 310.3;
const strategy = presetBtc('strategy')!;
const stT = (strategy * P[close].xau_per_btc * OZ) / 1e6;

// All 21M in Brent against US crude oil proved reserves: 46.0 billion barrels
// at year-end 2024 (EIA).
const US_RES_BN = 46.0;
const ALL = 21_000_000;
const allBn = (ALL * P[close].brent_per_btc) / 1e9;

const SLATE: Item[] = [
	{ id: 'pizza-cash-black-friday', at: '2026-11-27T13:30:00Z', media: () => jpg(get('cash_p-pizza-day'), 'pizza-cash'),
		text: `It’s Black Friday. Maybe the worst deal ever: 10,000 bitcoin for two pizzas, in 2010.\n\nAt ${closeWord}’s close those coins are ${f0(pizzaNotes / 1e6)} million $1 bills.\n\nStacked in one column, they reach ${f0(pizzaKm)} km high, ${f0((pizzaKm / KARMAN_KM) * 100)}% of the way to space. Still hungry?`,
		reply: `Each note is 0.11 mm thick; space starts at the Kármán line, 100 km up. Bitcoin $${f0(px)} (daily close, our dataset). Stack any amount:\n` + L('preset=pizza-day&commodity=cash') },
	{ id: 'strategy-gold-vs-uk', at: '2026-11-27T17:00:00Z', media: () => jpg(get('gold_p-strategy'), 'strategy-gold'),
		text: `The United Kingdom holds ${UK_T} tonnes of gold.\n\nStrategy, one American company, holds ${f0(strategy)} bitcoin. Swapped for gold at ${closeWord}’s close: ${f0(stT)} tonnes.\n\nThat’s ${(stT / UK_T).toFixed(1)} times Britain’s gold. Which reserve would you rather hold?`,
		reply: `UK official gold: 310.3 tonnes (World Gold Council). Gold $${f0(P[close].xau_usd)} an ounce. Weigh any holder in gold:\n` + L('preset=strategy&commodity=gold') },
	{ id: 'all-btc-oil-us-reserves', at: '2026-11-27T21:30:00Z', media: () => jpg(get('oil_p-market-cap'), 'all-btc-oil'),
		text: `There will only ever be 21 million bitcoin. We swapped every one.\n\nInto Brent crude at ${closeWord}’s close: ${allBn.toFixed(1)} billion barrels.\n\nAmerica’s proved crude reserves, the oil it’s sure it can pump, are 46 billion barrels. The lot buys ${f0((allBn / US_RES_BN) * 100)}% of those reserves. Bargain, or bubble?`,
		reply: `US crude oil and lease condensate proved reserves: 46.0 billion barrels at year-end 2024 (EIA). Brent $${P[close].brent_usd.toFixed(2)} a barrel. Weigh any stack in oil:\n` + L('preset=market-cap&commodity=oil') },
];

await run(SLATE, OUT, `Fri 27 Nov · close ${close} ($${f0(px)}), previous ${prev}`);
