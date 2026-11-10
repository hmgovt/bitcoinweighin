/**
 * Wed 21 Oct 2026: three posts, written to scripts/social/WRITING.md. All 21
 * million coins in gold against Fort Knox (guess first), the Moon ride video with
 * a new question, and SpaceX's coins on Manhattan in Midtown blocks (guess
 * first). Live figures. See lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, type Item } from './lib.ts';
import { landM2, LAND_YARDSTICKS } from '../../../src/lib/manhattan.ts';

const OUT = 'output/slates/2026-10-21';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// All 21 million coins in gold against Fort Knox: 147,341,858 troy oz (US Treasury).
const capOz = 21e6 * P[close].xau_per_btc;
const KNOX_OZ = 147_341_858;
const knoxes = capOz / KNOX_OZ;

// All 21 million coins in $1 bills (0.10922 mm a note) against the Moon (384,400 km).
const moonPct = ((21e6 * px * 0.10922e-6) / 384_400) * 100;

// SpaceX's coins on Manhattan land, in Midtown blocks (200 × 800 ft).
const spacex = presetBtc('spacex')!;
const BLOCK_M2 = LAND_YARDSTICKS.find((y) => y.label === 'a Midtown block')!.m2;
const blocks = landM2(spacex, px) / BLOCK_M2;

const SLATE: Item[] = [
	{ id: 'all-coins-fort-knox', at: '2026-10-21T13:30:00Z', media: () => jpg(get('gold_p-market-cap'), 'all-coins-gold'),
		text: `Fort Knox holds about 147 million ounces of gold.\n\nSwap every bitcoin there will ever be, all 21 million, for gold at ${closeWord}’s close.\n\nHow many Fort Knoxes would you fill? Guess first.`,
		reply: `${knoxes.toFixed(1)}: ${f0(Math.round(capOz / 1e6))} million oz. (Fort Knox: 147,341,858 oz, US Treasury.) Weigh any stack in gold:\n` + L('preset=market-cap&commodity=gold') },
	{ id: 'moon-ride-third', at: '2026-10-21T17:00:00Z', media: () => 'scripts/social/media/ride-market-cap.mp4',
		text: `We stacked all 21 million bitcoin in $1 bills and rode the stack up.\n\nPast the planes. Past the Space Station. Then a long way of nothing.\n\nAt ${closeWord}’s close it gets ${moonPct.toFixed(1)}% of the way to the Moon. Where would you get off?`,
		reply: 'Every note true to scale, 0.11 mm thick. Ride it yourself (it starts by itself):\n' + L('preset=market-cap&commodity=cash&ride=play') },
	{ id: 'spacex-midtown-blocks', at: '2026-10-21T21:30:00Z', media: () => jpg(get('manhattan_p-spacex'), 'spacex-manhattan'),
		text: `SpaceX holds ${f0(spacex)} bitcoin.\n\nSpent on Manhattan land at ${closeWord}’s close, how many Midtown blocks does it buy?\n\nGuess first.`,
		reply: `About ${blocks.toFixed(1)} blocks (200 by 800 feet each). Land at its 2014 value, spread evenly, so it’s illustrative. Fill the island with any stack:\n` + L('preset=spacex&commodity=manhattan') },
];

await run(SLATE, OUT, `Wed 21 Oct · close ${close} ($${f0(px)}), previous ${prev}`);
