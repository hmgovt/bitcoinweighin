/**
 * Fri 6 Nov 2026: three posts, written to scripts/social/WRITING.md. The US
 * government's coins in gold against its own Fort Knox (tribal), BlackRock's
 * coins in $1 bills weighed in Eiffel Towers (guess first), and Satoshi's coins
 * in Brent counted in days of the world's oil. No video: this week
 * already has three (Mon, Wed, Thu). Live figures. See lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, OZ, type Item } from './lib.ts';
import { WORLD_BARRELS_PER_DAY } from '../../../src/lib/oil.ts';

const OUT = 'output/slates/2026-11-06';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// The US government's coins in gold against Fort Knox: 147,341,858 troy oz (US Treasury).
const KNOX_OZ = 147_341_858;
const govt = presetBtc('us-govt')!;
const govtOz = govt * P[close].xau_per_btc;
const knoxPct = (govtOz / KNOX_OZ) * 100;

// BlackRock's coins in $1 notes (about 1 g each, BEP) against the Eiffel Tower: 10,100 t (SETE).
const EIFFEL_T = 10_100;
const ibit = presetBtc('blackrock-ibit')!;
const notesT = (ibit * px) / 1e6;
const eiffels = notesT / EIFFEL_T;

// Satoshi's coins in Brent against the world's oil use: about 104 million barrels a day (IEA, 2025).
const satoshi = presetBtc('satoshi')!;
const satBbl = satoshi * P[close].brent_per_btc;
const worldDays = satBbl / WORLD_BARRELS_PER_DAY;

const SLATE: Item[] = [
	{ id: 'govt-gold-fort-knox', at: '2026-11-06T13:30:00Z', media: () => jpg(get('gold_p-us-govt'), 'govt-gold'),
		text: `The US government holds ${f0(govt)} bitcoin, and the gold in Fort Knox.\n\nSwap the bitcoin for gold at ${closeWord}’s close: ${(govtOz / 1e6).toFixed(1)} million ounces.\n\nThat’s ${knoxPct.toFixed(1)}% of Fort Knox. Keep the coins, or buy the gold?`,
		reply: 'Fort Knox: 147,341,858 troy oz (US Treasury). Weigh any holder in gold:\n' + L('preset=us-govt&commodity=gold') },
	{ id: 'ibit-cash-eiffel', at: '2026-11-06T17:00:00Z', media: () => jpg(get('cash_p-blackrock-ibit'), 'ibit-cash'),
		text: `BlackRock’s bitcoin ETF holds ${f0(ibit)} coins.\n\nCash them out in $1 bills at ${closeWord}’s close and put the paper on a scale.\n\nHow many Eiffel Towers does it weigh? Guess first.`,
		reply: `About ${eiffels.toFixed(1)}: ${f0(Math.round(notesT / 100) * 100)} tonnes of notes at about 1 g each (BEP), against the tower’s 10,100 t. Stack any amount:\n` + L('preset=blackrock-ibit&commodity=cash') },
	{ id: 'satoshi-oil-world-days', at: '2026-11-06T21:30:00Z', media: () => jpg(get('oil_p-satoshi'), 'satoshi-oil'),
		text: `Satoshi’s ${f0(satoshi)} bitcoin, swapped for Brent crude at ${closeWord}’s close: ${f0(Math.round(satBbl / 1e6))} million barrels.\n\nThe whole world would burn through it in about ${worldDays.toFixed(0)} days.\n\nThe biggest fortune in bitcoin, or not much oil?`,
		reply: `At $${P[close].brent_usd.toFixed(2)} a barrel, against world use of about 104 million barrels a day (IEA, 2025). Weigh any stack in oil:\n` + L('preset=satoshi&commodity=oil') },
];

await run(SLATE, OUT, `Fri 6 Nov · close ${close} ($${f0(px)}), previous ${prev}`);
