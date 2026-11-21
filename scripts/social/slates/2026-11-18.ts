/**
 * Wed 18 Nov 2026: three posts, written to scripts/social/WRITING.md.
 * The 10,000 pizza coins in gold counted in Olympic gold medals, a NEW video:
 * SpaceX's coins stacked in $1 bills and ridden up past the edge of space, and
 * one bitcoin on Manhattan land as a square you could stand on. Third video of
 * the week (Mon, Tue, Wed). Live figures. See lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, OZ, type Item } from './lib.ts';
import { landM2 } from '../../../src/lib/manhattan.ts';

const OUT = 'output/slates/2026-11-18';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// The pizza coins in gold against Olympic gold medals: 6 g of gold each (Paris 2024 organisers; IOC minimum).
const MEDAL_G = 6;
const pizza = presetBtc('pizza-day')!;
const pizzaG = pizza * P[close].xau_per_btc * OZ;

// SpaceX's coins in $1 bills (0.10922 mm a note) against the Kármán line, 100 km.
// Quoted at the video's own close (15 Nov), so the text and the clip agree.
const VID = '2026-11-15';
const KARMAN_KM = 100;
const spacex = presetBtc('spacex')!;
const sxKm = (spacex * P[VID].btc_usd * 0.10922) / 1e6;

// One coin of Manhattan land, as a square.
const m2 = landM2(1, px);
const side = Math.sqrt(m2);

const SLATE: Item[] = [
	{ id: 'pizza-gold-medals', at: '2026-11-18T13:30:00Z', media: () => jpg(get('gold_p-pizza-day'), 'pizza-gold'),
		text: `On 22 May 2010, 10,000 bitcoin bought two pizzas.\n\nSwapped for gold at ${closeWord}’s close: ${(pizzaG / 1e6).toFixed(1)} tonnes.\n\nAn Olympic gold medal carries 6 grams of gold. The pizza coins hold enough for about ${f0(Math.round(pizzaG / MEDAL_G / 1000) * 1000)} of them. Who won that trade?`,
		reply: `${f0(pizza * P[close].xau_per_btc)} troy oz at $${f0(P[close].xau_usd)} an ounce. Paris 2024’s gold medals used 6 g of gold each (organising committee). Weigh any stack:\n` + L('preset=pizza-day&commodity=gold') },
	{ id: 'spacex-ride', at: '2026-11-18T17:00:00Z', media: () => 'scripts/social/media/ride-spacex.mp4',
		text: `SpaceX holds ${f0(spacex)} bitcoin.\n\nWe changed them into $1 bills at ${weekday(VID)}’s close, stacked them in one column, and rode to the top.\n\nSpace starts at 100 km. Does a rocket company’s bitcoin get there?`,
		reply: `Yes: ${sxKm.toFixed(1)} km (${(sxKm / 1.609344).toFixed(1)} miles), about ${f0(sxKm - KARMAN_KM)} km past the Kármán line. Every note true to scale, 0.11 mm thick. Ride it yourself:\n` + L('preset=spacex&commodity=cash&ride=play') },
	{ id: 'one-coin-manhattan-square', at: '2026-11-18T21:30:00Z', media: () => jpg(get('manhattan_b-1'), 'one-coin-manhattan'),
		text: `One bitcoin, spent on Manhattan land at ${closeWord}’s close: ${m2.toFixed(1)} square metres (${f0(m2 * 10.7639)} sq ft).\n\nA square ${side.toFixed(1)} m on each side. Room to stand, not to lie down.\n\nCheap for a coin, or dear for a patch of ground?`,
		reply: 'Land at its 2014 value (Barr, Smith & Kulkarni), spread evenly, so it’s illustrative. See how far your stack gets:\n' + L('btc=1&commodity=manhattan') },
];

await run(SLATE, OUT, `Wed 18 Nov · close ${close} ($${f0(px)}), previous ${prev}`);
