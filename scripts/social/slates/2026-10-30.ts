/**
 * Fri 30 Oct 2026: three posts, written to scripts/social/WRITING.md. How much
 * bitcoin buys a tonne of silver (guess first), El Salvador's coins in $1 bills
 * against a marathon (guess first), and one coin of Manhattan against a parking
 * space (guess first). Live figures. See lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, OZ, type Item } from './lib.ts';
import { landM2, LAND_YARDSTICKS } from '../../../src/lib/manhattan.ts';

const OUT = 'output/slates/2026-10-30';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// A tonne of silver (32,151 troy oz) in bitcoin.
const tonneBtc = (1e6 / OZ) / P[close].xag_per_btc;

// El Salvador's coins in $1 bills (0.10922 mm a note) against a marathon (42.195 km).
const sv = presetBtc('el-salvador')!;
const svKm = (sv * px * 0.10922) / 1e6;
const MARATHON_KM = 42.195;

// One coin of Manhattan land against a parking space (12.5 m², the site's yardstick).
const m2 = landM2(1, px);
const SPACE_M2 = LAND_YARDSTICKS.find((y) => y.label === 'a parking space')!.m2;

const SLATE: Item[] = [
	{ id: 'tonne-of-silver', at: '2026-10-30T13:30:00Z', media: () => jpg(get('silver_b-1'), 'one-coin-silver'),
		text: `A whole tonne of silver. A pallet of bars you’d need a forklift for.\n\nHow many bitcoin buy it at ${closeWord}’s close?\n\nMore than 50, or fewer? Guess first.`,
		reply: `${tonneBtc.toFixed(1)} bitcoin. One coin buys ${f0(P[close].xag_per_btc)} oz, about ${((P[close].xag_per_btc * OZ) / 1000).toFixed(0)} kg. Weigh any amount in silver:\n` + L('btc=1&commodity=silver') },
	{ id: 'el-salvador-marathon', at: '2026-10-30T17:00:00Z', media: () => jpg(get('cash_p-el-salvador'), 'el-salvador-cash'),
		text: `El Salvador holds ${f0(sv)} bitcoin.\n\nChange it into $1 bills and lay the stack on its side.\n\nIs it longer than a marathon? Guess first.`,
		reply: `${svKm >= MARATHON_KM ? 'Yes' : 'No'}: ${svKm.toFixed(0)} km at ${closeWord}’s close, ${(svKm / MARATHON_KM).toFixed(1)} marathons. Stack any country’s coins:\n` + L('preset=el-salvador&commodity=cash') },
	{ id: 'one-coin-parking-space', at: '2026-10-30T21:30:00Z', media: () => jpg(get('manhattan_b-1'), 'one-coin-manhattan'),
		text: `One bitcoin, spent on Manhattan land.\n\nDoes it buy enough ground to park one car on?\n\nGuess first.`,
		reply: `${m2 >= SPACE_M2 ? 'Yes' : 'No'}: ${m2.toFixed(1)} m² at ${closeWord}’s close, ${Math.round((m2 / SPACE_M2) * 100)}% of a parking space. (2014 land value, spread evenly, illustrative.) Try any stack:\n` + L('btc=1&commodity=manhattan') },
];

await run(SLATE, OUT, `Fri 30 Oct · close ${close} ($${f0(px)}), previous ${prev}`);
