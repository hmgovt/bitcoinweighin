/**
 * Tue 24 Nov 2026: three posts, written to scripts/social/WRITING.md.
 * The US government's seized bitcoin in oil, counted in days of America's
 * own oil use, a NEW video: every bitcoin there will ever be spent on
 * Manhattan land, and SpaceX's coins in gold against what a Falcon 9 can lift
 * to orbit. Second video of the week (Mon, Tue). Live figures. See lib.ts for
 * how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, OZ, type Item } from './lib.ts';
import { landM2, DEVELOPABLE_M2, frontierStreet } from '../../../src/lib/manhattan.ts';

const OUT = 'output/slates/2026-11-24';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);

// The US government's coins in Brent against US petroleum use: about 20.6 million
// barrels a day in 2025 (EIA).
const US_BPD = 20.6e6;
const govt = presetBtc('us-govt')!;
const govtBbl = govt * P[close].brent_per_btc;
const govtDays = govtBbl / US_BPD;

// All 21M on Manhattan land. Quoted at the video's own close, so the text and
// the clip agree.
const VID = '2026-11-22';
const ALL = 21_000_000;
const allM2 = landM2(ALL, P[VID].btc_usd);
const allPct = (allM2 / DEVELOPABLE_M2) * 100;
const allStreet = frontierStreet(allM2);

// SpaceX's coins in gold against Falcon 9's payload to low Earth orbit:
// 22,800 kg, fully expendable (SpaceX).
const F9_LEO_T = 22.8;
const spacex = presetBtc('spacex')!;
const sxT = (spacex * P[close].xau_per_btc * OZ) / 1e6;

const SLATE: Item[] = [
	{ id: 'govt-oil-us-days', at: '2026-11-24T13:30:00Z', media: () => jpg(get('oil_p-us-govt'), 'govt-oil'),
		text: `The US government holds ${f0(govt)} bitcoin, most of it seized in criminal cases.\n\nSwapped for Brent crude at ${closeWord}’s close: ${f0(govtBbl / 1e6)} million barrels.\n\nAmerica uses about 20.6 million barrels a day. Uncle Sam’s bitcoin would cover the country’s oil for ${govtDays.toFixed(1)} days. Sell, or hold?`,
		reply: `US petroleum use: about 20.6 million barrels a day in 2025 (EIA). Brent $${P[close].brent_usd.toFixed(2)} a barrel. Weigh any holder in oil:\n` + L('preset=us-govt&commodity=oil') },
	{ id: 'all-btc-manhattan-video', at: '2026-11-24T17:00:00Z', media: () => 'scripts/social/media/manhattan-market-cap.mp4',
		text: `Michael Saylor calls bitcoin “cyber Manhattan”.\n\nSo we spent every bitcoin there will ever be, all 21 million, on the real one at ${weekday(VID)}’s close, from the Battery north.\n\nIt gets ${allPct.toFixed(0)}% of the island, as far as ${allStreet}. Cheap island, or dear coin?`,
		reply: 'Land at its 2014 value (Barr, Smith & Kulkarni), spread evenly, so it’s illustrative. Saylor: CNBC, 16 Dec 2024. Fill the island with any stack:\n' + L('preset=market-cap&commodity=manhattan') },
	{ id: 'spacex-gold-falcon9-payload', at: '2026-11-24T21:30:00Z', media: () => jpg(get('gold_p-spacex'), 'spacex-gold'),
		text: `SpaceX holds ${f0(spacex)} bitcoin.\n\nSwapped for gold at ${closeWord}’s close: ${sxT.toFixed(1)} tonnes.\n\nA Falcon 9 can lift ${F9_LEO_T} tonnes to orbit. ${sxT <= F9_LEO_T ? `One launch would carry the lot, with room for ${f0(F9_LEO_T - sxT)} tonnes more` : `It would take ${Math.ceil(sxT / F9_LEO_T)} launches`}. The first gold reserve in space?`,
		reply: `Falcon 9: 22,800 kg to low Earth orbit with the booster expended (SpaceX). Gold $${f0(P[close].xau_usd)} an ounce. Weigh any holder in gold:\n` + L('preset=spacex&commodity=gold') },
];

await run(SLATE, OUT, `Tue 24 Nov · close ${close} ($${f0(P[close].btc_usd)}), previous ${prev}`);
