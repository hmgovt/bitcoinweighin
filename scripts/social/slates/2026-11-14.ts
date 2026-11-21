/**
 * Sat 14 Nov 2026: three posts, written to scripts/social/WRITING.md.
 * Strategy's coins in gold against all of Britain's gold (tribal), the 10,000
 * pizza coins in silver, counted per pizza, and El Salvador's whole bitcoin
 * treasury on Manhattan land against Central Park. No video: this week
 * already has three (Mon, Tue, Wed). Live figures. See lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, OZ, type Item } from './lib.ts';
import { landM2 } from '../../../src/lib/manhattan.ts';

const OUT = 'output/slates/2026-11-14';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// Strategy's coins in gold against UK official gold: 310.3 t (World Gold Council).
const UK_GOLD_T = 310.3;
const strategy = presetBtc('strategy')!;
const stratT = (strategy * P[close].xau_per_btc * OZ) / 1e6;
const ukTimes = stratT / UK_GOLD_T;

// The 10,000 pizza coins in silver, per pizza (two pizzas, 22 May 2010).
const pizza = presetBtc('pizza-day')!;
const pizzaT = (pizza * P[close].xag_per_btc * OZ) / 1e6;

// El Salvador's coins on Manhattan land, against Central Park: 843 acres (NYC Parks).
const ACRE_M2 = 4046.8564;
const PARK_ACRES = 843;
const sv = presetBtc('el-salvador')!;
const svAcres = landM2(sv, px) / ACRE_M2;

const SLATE: Item[] = [
	{ id: 'strategy-vs-uk-gold', at: '2026-11-14T13:30:00Z', media: () => jpg(get('gold_p-strategy'), 'strategy-gold'),
		text: `The UK holds about 310 tonnes of gold, kept at the Bank of England.\n\nStrategy’s ${f0(strategy)} bitcoin, swapped for gold at ${closeWord}’s close: ${f0(stratT)} tonnes.\n\n${ukTimes >= 1 ? `About ${ukTimes.toFixed(1)} times Britain’s gold.` : `${(ukTimes * 100).toFixed(0)}% of Britain’s gold.`} One American company. Who’s the reserve now?`,
		reply: 'UK official gold: 310.3 t (World Gold Council). Weigh any holder in gold:\n' + L('preset=strategy&commodity=gold') },
	{ id: 'pizza-silver-per-pizza', at: '2026-11-14T17:00:00Z', media: () => jpg(get('silver_p-pizza-day'), 'pizza-silver'),
		text: `On 22 May 2010, 10,000 bitcoin bought two pizzas.\n\nThe same coins, swapped for silver at ${closeWord}’s close: ${f0(pizzaT)} tonnes.\n\nThat’s ${f0(pizzaT / 2)} tonnes of silver per pizza. Best or worst meal ever bought?`,
		reply: `${f0(pizza * P[close].xag_per_btc)} troy oz at $${P[close].xag_usd.toFixed(2)} an ounce. Weigh the pizza coins, or any stack:\n` + L('preset=pizza-day&commodity=silver') },
	{ id: 'el-salvador-manhattan-acres', at: '2026-11-14T21:30:00Z', media: () => jpg(get('manhattan_p-el-salvador'), 'el-salvador-manhattan'),
		text: `El Salvador made bitcoin legal tender in 2021 and still buys coins. It holds ${f0(sv)}.\n\nThe whole national stack, spent on Manhattan land at ${closeWord}’s close: ${svAcres.toFixed(1)} acres.\n\nCentral Park alone is ${PARK_ACRES} acres. A country’s treasury, or a city block?`,
		reply: 'Land at its 2014 value (Barr, Smith & Kulkarni), spread evenly, so it’s illustrative. Central Park: 843 acres (NYC Parks). Fill the island with any stack:\n' + L('preset=el-salvador&commodity=manhattan') },
];

await run(SLATE, OUT, `Sat 14 Nov · close ${close} ($${f0(px)}), previous ${prev}`);
