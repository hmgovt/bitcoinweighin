/**
 * Thu 26 Nov 2026: three posts, written to scripts/social/WRITING.md.
 * The US government's seized bitcoin in gold against Fort Knox, Satoshi's
 * coins in oil counted in days of the whole world's oil use, and Strategy's
 * coins in silver weighed against the Eiffel Tower's iron. No video: this week
 * already has three (Mon, Tue, Wed). Live figures. See lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, OZ, type Item } from './lib.ts';

const OUT = 'output/slates/2026-11-26';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// The US government's coins in gold against Fort Knox: 147.3 million troy
// ounces (US Mint).
const KNOX_MOZ = 147.3;
const govt = presetBtc('us-govt')!;
const govtMoz = (govt * P[close].xau_per_btc) / 1e6;
const govtPct = (govtMoz / KNOX_MOZ) * 100;

// Satoshi's coins in Brent against world oil demand: about 103.9 million
// barrels a day in 2025 (IEA Oil Market Report, December 2025).
const WORLD_BPD = 103.9e6;
const satoshi = presetBtc('satoshi')!;
const satBbl = satoshi * P[close].brent_per_btc;
const satDays = satBbl / WORLD_BPD;

// Strategy's coins in silver against the Eiffel Tower's iron frame: 7,300
// tonnes (Société d'Exploitation de la Tour Eiffel).
const EIFFEL_T = 7300;
const strategy = presetBtc('strategy')!;
const stT = (strategy * P[close].xag_per_btc * OZ) / 1e6;

const SLATE: Item[] = [
	{ id: 'govt-gold-fort-knox', at: '2026-11-26T13:30:00Z', media: () => jpg(get('gold_p-us-govt'), 'govt-gold'),
		text: `Fort Knox holds 147.3 million ounces of America’s gold.\n\nThe US government also holds ${f0(govt)} bitcoin, most of it seized in criminal cases. Swapped for gold at ${closeWord}’s close: ${govtMoz.toFixed(1)} million ounces.\n\nThat’s ${govtPct.toFixed(1)}% of Fort Knox. Digital vault, or rounding error?`,
		reply: `Fort Knox: 147,341,858 fine troy ounces (US Mint). Gold $${f0(P[close].xau_usd)} an ounce. Weigh any holder in gold:\n` + L('preset=us-govt&commodity=gold') },
	{ id: 'satoshi-oil-world-days', at: '2026-11-26T17:00:00Z', media: () => jpg(get('oil_p-satoshi'), 'satoshi-oil'),
		text: `Satoshi’s ${f0(satoshi)} bitcoin have never moved.\n\nSwapped for Brent crude at ${closeWord}’s close: ${f0(satBbl / 1e6)} million barrels.\n\nThe world uses about 104 million barrels a day. Satoshi’s coins would cover all of it for ${satDays.toFixed(1)} days. A lot, or not much?`,
		reply: `World oil demand: about 103.9 million barrels a day in 2025 (IEA). Brent $${P[close].brent_usd.toFixed(2)} a barrel. Weigh any holder in oil:\n` + L('preset=satoshi&commodity=oil') },
	{ id: 'strategy-silver-eiffel', at: '2026-11-26T21:30:00Z', media: () => jpg(get('silver_p-strategy'), 'strategy-silver'),
		text: `Strategy holds ${f0(strategy)} bitcoin, the biggest company stack.\n\nSwapped for silver at ${closeWord}’s close: ${f0(Math.round(stT / 100) * 100)} tonnes of metal.\n\nThe Eiffel Tower’s iron frame weighs 7,300 tonnes. Strategy’s silver weighs as much as ${(stT / EIFFEL_T).toFixed(1)} of them. Which would you rather own?`,
		reply: `Eiffel Tower: 7,300 tonnes of iron, 10,100 in all (the Tower’s operator). Silver $${P[close].xag_usd.toFixed(2)} an ounce. Weigh any holder in silver:\n` + L('preset=strategy&commodity=silver') },
];

await run(SLATE, OUT, `Thu 26 Nov · close ${close} ($${f0(px)}), previous ${prev}`);
