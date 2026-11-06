/**
 * Sat 24 Oct 2026: three posts, written to scripts/social/WRITING.md. One coin in
 * silver as a stack of 1-oz Silver Eagles (guess first), every coin in $100 bills
 * instead of $1s, and Strategy's
 * coins on Manhattan (guess the street). Live figures. See lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, type Item } from './lib.ts';
import { landM2, DEVELOPABLE_M2, frontierStreet } from '../../../src/lib/manhattan.ts';

const OUT = 'output/slates/2026-10-24';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// One coin in silver at spot, as 1-oz American Silver Eagles (2.98 mm thick), in one column.
const eagles = Math.round(P[close].xag_per_btc);
const eaglesM = (eagles * 2.98) / 1000;

// All 21 million coins in $100 bills (0.10922 mm a note) against the Space Station (~400 km up).
const hundredsKm = (21e6 * px / 100 * 0.10922) / 1e6;
const issTimes = hundredsKm / 400;
const onesKm = hundredsKm * 100;

// Strategy's coins on Manhattan land.
const strategy = presetBtc('strategy')!;
const m2 = landM2(strategy, px);
const street = frontierStreet(m2) ?? 'the Battery';

const SLATE: Item[] = [
	{ id: 'one-coin-silver-eagles', at: '2026-10-24T13:30:00Z', media: () => jpg(get('silver_b-1'), 'one-coin-silver'),
		text: `One bitcoin, swapped for 1-ounce Silver Eagle coins at spot.\n\nStack them in a single column.\n\nTaller than you? Taller than a house? Guess first.`,
		reply: `${f0(eagles)} coins, ${eaglesM.toFixed(1)} m tall (2.98 mm each) at ${closeWord}’s close. Dealer premiums would shave a few off. Weigh any amount in silver:\n` + L('btc=1&commodity=silver') },
	{ id: 'all-coins-in-hundreds', at: '2026-10-24T17:00:00Z', media: () => jpg(get('cash_p-market-cap'), 'all-coins-cash'),
		text: `Every bitcoin there will ever be, stacked in $1 bills, reaches ${f0(Math.round(onesKm / 1000) * 1000)} km: about halfway to the Moon.\n\nSwitch to $100 bills and the stack is still ${f0(hundredsKm)} km tall.\n\nThat’s ${issTimes.toFixed(1)} times higher than the Space Station. In hundreds.`,
		reply: 'Every note true to scale, 0.11 mm thick. Ride the $1 stack yourself:\n' + L('preset=market-cap&commodity=cash&ride=play') },
	{ id: 'strategy-street', at: '2026-10-24T21:30:00Z', media: () => jpg(get('manhattan_p-strategy'), 'strategy-manhattan'),
		text: `Strategy holds ${f0(strategy)} bitcoin.\n\nSpend it on Manhattan land at ${closeWord}’s close, lot by lot from the Battery north.\n\nWhich street does Saylor reach? Guess first.`,
		reply: `${street}: ${((m2 / DEVELOPABLE_M2) * 100).toFixed(1)}% of the island. (2014 land value, spread evenly, illustrative.) Fill it with any stack:\n` + L('preset=strategy&commodity=manhattan') },
];

await run(SLATE, OUT, `Sat 24 Oct · close ${close} ($${f0(px)}), previous ${prev}`);
