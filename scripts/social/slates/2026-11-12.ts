/**
 * Thu 12 Nov 2026: three posts, written to scripts/social/WRITING.md.
 * SpaceX's coins in 400-ounce gold bars, all 21 million coins on Manhattan
 * land (can every bitcoin buy the island?), and Satoshi's coins in silver
 * counted in years of the solar industry's demand. No video: this week
 * already has three (Mon, Tue, Wed). Live figures. See lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, type Item } from './lib.ts';
import { landM2, DEVELOPABLE_M2, frontierStreet } from '../../../src/lib/manhattan.ts';

const OUT = 'output/slates/2026-11-12';
const { P, close, prev, card } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// SpaceX's coins in gold, counted in London Good Delivery bars: about 400 troy oz each (LBMA).
const BAR_OZ = 400;
const spacex = presetBtc('spacex')!;
const spacexOz = spacex * P[close].xau_per_btc;
const bars = spacexOz / BAR_OZ;
const spacexCard = card('gold', spacex, 'spacex');

// All 21 million coins on Manhattan land, filled from the Battery north.
const all = 21_000_000;
const allM2 = landM2(all, px);
const allPct = (allM2 / DEVELOPABLE_M2) * 100;
const allStreet = frontierStreet(allM2);

// Satoshi's coins in silver against the solar industry's use: 197.6 million oz in 2024
// (Silver Institute, World Silver Survey 2025).
const PV_MOZ = 197.6;
const satoshi = presetBtc('satoshi')!;
const satMoz = (satoshi * P[close].xag_per_btc) / 1e6;
const pvYears = satMoz / PV_MOZ;

const SLATE: Item[] = [
	{ id: 'spacex-gold-bars', at: '2026-11-12T13:30:00Z', media: () => jpg(get('gold_p-spacex'), 'spacex-gold'),
		text: `SpaceX holds ${f0(spacex)} bitcoin.\n\nSwapped for gold at ${closeWord}’s close: ${spacexCard.big} tonnes. In the 400-ounce bars central banks stack, that’s about ${f0(Math.round(bars / 10) * 10)} bars.\n\nA rocket company’s spare change, or a proper vault?`,
		reply: 'A London Good Delivery bar holds about 400 troy oz (LBMA). Weigh any holder in gold:\n' + L('preset=spacex&commodity=gold') },
	{ id: 'all-btc-manhattan', at: '2026-11-12T17:00:00Z', media: () => jpg(get('manhattan_p-market-cap'), 'all-manhattan'),
		text: `Every bitcoin that will ever exist, all 21 million, spent on Manhattan land at ${closeWord}’s close.\n\n${allPct >= 100 ? 'They buy the whole island.' : `They buy ${allPct.toFixed(0)}% of it${allStreet ? `, from the Battery up to ${allStreet}` : ''}.`}\n\n${allPct >= 100 ? 'Is that a lot of bitcoin, or cheap land?' : 'All the bitcoin in the world can’t buy one island. Expensive island, or cheap bitcoin?'}`,
		reply: 'Land at its 2014 value ($1.74T, Barr, Smith & Kulkarni), spread evenly, so it’s illustrative. Fill the island with any stack:\n' + L('preset=market-cap&commodity=manhattan') },
	{ id: 'satoshi-silver-solar', at: '2026-11-12T21:30:00Z', media: () => jpg(get('silver_p-satoshi'), 'satoshi-silver'),
		text: `The world’s solar panel makers used about 198 million ounces of silver in 2024.\n\nSatoshi’s ${f0(satoshi)} bitcoin, swapped for silver at ${closeWord}’s close: ${(satMoz / 1000).toFixed(2)} billion ounces.\n\nEnough silver for about ${pvYears.toFixed(0)} years of the world’s solar panels, from coins nobody has moved in over 15 years.`,
		reply: 'Solar (photovoltaic) demand: 197.6 million oz in 2024 (Silver Institute, World Silver Survey 2025). Weigh any stack in silver:\n' + L('preset=satoshi&commodity=silver') },
];

await run(SLATE, OUT, `Thu 12 Nov · close ${close} ($${f0(px)}), previous ${prev}`);
