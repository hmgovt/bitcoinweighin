/**
 * Mon 23 Nov 2026: three posts, written to scripts/social/WRITING.md.
 * One bitcoin's fall from its record measured in dollars and in gold, a NEW
 * video: BlackRock's bitcoin ETF spent on Manhattan land from the Battery
 * north, and Satoshi's coins in silver weighed against the Titanic. First
 * video of the week. Live figures. See lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, nice, presetBtc, run, weekday, OZ, type Item } from './lib.ts';
import { landM2, DEVELOPABLE_M2, frontierStreet } from '../../../src/lib/manhattan.ts';

const OUT = 'output/slates/2026-11-23';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// One coin's fall from its record, in dollars and in ounces of gold (dataset).
const days = Object.keys(P).filter((d) => d <= close && P[d].btc_usd && P[d].xau_per_btc).sort();
const topUsd = days.reduce((a, b) => (P[b].btc_usd > P[a].btc_usd ? b : a));
const topOz = days.reduce((a, b) => (P[b].xau_per_btc > P[a].xau_per_btc ? b : a));
const downUsd = (1 - px / P[topUsd].btc_usd) * 100;
const downOz = (1 - P[close].xau_per_btc / P[topOz].xau_per_btc) * 100;

// BlackRock's ETF coins on Manhattan land. Quoted at the video's own close, so
// the text and the clip agree. Central Park: 843 acres (Central Park Conservancy).
const VID = '2026-11-21';
const ibit = presetBtc('blackrock-ibit')!;
const ibitM2 = landM2(ibit, P[VID].btc_usd);
const ibitAcres = ibitM2 / 4046.8564;
const ibitStreet = frontierStreet(ibitM2);

// Satoshi's coins in silver against the Titanic: 52,310 long tons displaced,
// about 53,150 tonnes (Woods Hole Oceanographic Institution).
const TITANIC_T = 53_150;
const satoshi = presetBtc('satoshi')!;
const satT = (satoshi * P[close].xag_per_btc * OZ) / 1e6;
const satShare = satT / TITANIC_T;

const SLATE: Item[] = [
	{ id: 'one-coin-gold-drawdown', at: '2026-11-23T13:30:00Z', media: () => jpg(get('gold_b-1'), 'one-coin-gold'),
		text: `Priced in dollars, one bitcoin is ${downUsd.toFixed(0)}% below its record close of $${f0(P[topUsd].btc_usd)} on ${nice(topUsd)}.\n\nPriced in gold, it’s ${downOz.toFixed(0)}% below its peak of ${P[topOz].xau_per_btc.toFixed(1)} ounces on ${nice(topOz)}. At ${closeWord}’s close: ${P[close].xau_per_btc.toFixed(1)}.\n\n${downOz > downUsd ? 'Measured in gold, the fall is deeper.' : 'Measured in gold, the fall is shallower.'} Which yardstick tells the truth?`,
		reply: `Gold $${f0(P[close].xau_usd)} an ounce, bitcoin $${f0(px)} (daily closes, our dataset). Weigh one coin in gold on any day since 2013:\n` + L('btc=1&commodity=gold') },
	{ id: 'ibit-manhattan-video', at: '2026-11-23T17:00:00Z', media: () => 'scripts/social/media/manhattan-blackrock-ibit.mp4',
		text: `BlackRock’s bitcoin ETF holds ${f0(ibit)} coins.\n\nWe spent them on Manhattan land at ${weekday(VID)}’s close, from the Battery north, lot by lot.\n\nThe world’s biggest bitcoin fund gets as far as ${ibitStreet}: ${f0(ibitAcres)} acres. Central Park alone is 843.`,
		reply: `${((ibitM2 / DEVELOPABLE_M2) * 100).toFixed(1)}% of the island. Land at its 2014 value (Barr, Smith & Kulkarni), spread evenly, so it’s illustrative. Fill the island with any stack:\n` + L('preset=blackrock-ibit&commodity=manhattan') },
	{ id: 'satoshi-silver-titanic', at: '2026-11-23T21:30:00Z', media: () => jpg(get('silver_p-satoshi'), 'satoshi-silver'),
		text: `Satoshi’s ${f0(satoshi)} bitcoin have never moved.\n\nSwapped for silver at ${closeWord}’s close: ${f0(Math.round(satT / 100) * 100)} tonnes of metal.\n\nThe Titanic weighed about ${f0(TITANIC_T)} tonnes. ${Math.abs(satShare - 1) < 0.05 ? 'Satoshi’s silver weighs the same as the ship.' : satShare > 1 ? `Satoshi’s silver outweighs it ${satShare.toFixed(1)} times.` : `Satoshi’s silver is ${(satShare * 100).toFixed(0)}% of the ship.`} Which would you rather salvage?`,
		reply: `Titanic: 52,310 long tons displaced, about 53,150 tonnes (Woods Hole Oceanographic Institution). Silver $${P[close].xag_usd.toFixed(2)} an ounce. Weigh any holder in silver:\n` + L('preset=satoshi&commodity=silver') },
];

await run(SLATE, OUT, `Mon 23 Nov · close ${close} ($${f0(px)}), previous ${prev}`);
