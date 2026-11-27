/**
 * Sat 28 Nov 2026: three posts, written to scripts/social/WRITING.md.
 * Satoshi's coins in gold against all of Switzerland's gold, SpaceX's coins in
 * $1 bills stacked against its own Starship, and every bitcoin there will ever
 * be in silver against all the silver ever mined. No video: this week already
 * has three (Mon, Tue, Wed). Live figures. See lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, OZ, type Item } from './lib.ts';
import { BILL_THICKNESS_MM } from '../../../src/lib/billStack.ts';

const OUT = 'output/slates/2026-11-28';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// Satoshi's coins in gold against the Swiss National Bank's gold: 1,040
// tonnes, unchanged since 2008 (SNB).
const SNB_T = 1040;
const satoshi = presetBtc('satoshi')!;
const satT = (satoshi * P[close].xau_per_btc * OZ) / 1e6;

// SpaceX's coins in $1 bills, stacked, against a full Starship stack: about
// 124 m tall (SpaceX).
const STARSHIP_M = 124;
const spacex = presetBtc('spacex')!;
const sxNotes = spacex * px;
const sxKm = (sxNotes * BILL_THICKNESS_MM) / 1e6;
const sxShips = (sxKm * 1000) / STARSHIP_M;

// All 21M in silver against all the silver ever mined: estimates run from
// about 1.74 to 1.92 million tonnes (Silver Institute, USGS, as reported), so
// the text only says "about half" while the share stays between 40% and 60%.
const ALL = 21_000_000;
const allT = (ALL * P[close].xag_per_btc * OZ) / 1e6;
const lo = allT / 1.92e6, hi = allT / 1.74e6;
const share = lo >= 0.4 && hi <= 0.6 ? 'about half' : `${f0(lo * 100)}–${f0(hi * 100)}%`;

const SLATE: Item[] = [
	{ id: 'satoshi-gold-vs-swiss', at: '2026-11-28T13:30:00Z', media: () => jpg(get('gold_p-satoshi'), 'satoshi-gold'),
		text: `Switzerland’s central bank holds 1,040 tonnes of gold, and hasn’t sold an ounce since 2008.\n\nSatoshi’s ${f0(satoshi)} bitcoin have never moved. Swapped for gold at ${closeWord}’s close: ${f0(satT)} tonnes.\n\nThat’s ${f0((satT / SNB_T) * 100)}% of the Swiss reserve, held by someone nobody can name. Who’s the safer hoarder?`,
		reply: `Swiss National Bank gold: 1,040 tonnes, unchanged since 2008 (SNB). Gold $${f0(P[close].xau_usd)} an ounce. Weigh any holder in gold:\n` + L('preset=satoshi&commodity=gold') },
	{ id: 'spacex-cash-starships', at: '2026-11-28T17:00:00Z', media: () => jpg(get('cash_p-spacex'), 'spacex-cash'),
		text: `SpaceX holds ${f0(spacex)} bitcoin.\n\nChanged into $1 bills at ${closeWord}’s close: ${(sxNotes / 1e9).toFixed(2)} billion notes.\n\nStacked in one column: ${f0(sxKm)} km high. A Starship stands about 124 metres. SpaceX’s bitcoin, in dollar bills, is as tall as ${Math.abs(sxShips - 1000) < 30 ? 'about 1,000' : f0(Math.round(sxShips / 10) * 10)} of its own rockets. To orbit?`,
		reply: `Starship, booster and ship stacked: about 124 m (SpaceX). Each note is 0.11 mm thick. Bitcoin $${f0(px)} (daily close, our dataset). Stack any holder:\n` + L('preset=spacex&commodity=cash') },
	{ id: 'all-btc-silver-all-mined', at: '2026-11-28T21:30:00Z', media: () => jpg(get('silver_p-market-cap'), 'all-btc-silver'),
		text: `All the silver humans have ever mined adds up to roughly 1.8 million tonnes.\n\nEvery bitcoin there will ever be, all 21 million, swapped for silver at ${closeWord}’s close: ${f0(Math.round(allT / 1000) * 1000)} tonnes.\n\nThat’s ${share} of all the silver ever dug up. Too much, or not enough?`,
		reply: `All silver ever mined: estimates run from about 1.74 to 1.92 million tonnes (Silver Institute, USGS). Silver $${P[close].xag_usd.toFixed(2)} an ounce. Weigh any stack in silver:\n` + L('preset=market-cap&commodity=silver') },
];

await run(SLATE, OUT, `Sat 28 Nov · close ${close} ($${f0(px)}), previous ${prev}`);
