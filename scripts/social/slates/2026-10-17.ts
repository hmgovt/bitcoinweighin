/**
 * Sat 17 Oct 2026: three posts, written to scripts/social/WRITING.md. El
 * Salvador's coins on Manhattan in brownstone lots (guess first), the three
 * elements video again with a new question, and the US government's coins in $1
 * bills laid west from New York (guess first). Live figures. See lib.ts for how
 * to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, OZ, type Item } from './lib.ts';
import { landM2, LAND_YARDSTICKS } from '../../../src/lib/manhattan.ts';
import { OG_COMMODITIES, computeAmount } from '../../../functions/_lib.ts';

const OUT = 'output/slates/2026-10-17';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// El Salvador's coins on Manhattan land, in classic 20 × 100 ft brownstone lots.
const sv = presetBtc('el-salvador')!;
const LOT_M2 = LAND_YARDSTICKS.find((y) => y.label === 'a brownstone lot')!.m2;
const lots = Math.round(landM2(sv, px) / LOT_M2);

// One coin in the video's three elements, live (the video itself is at the 6 Oct close).
const goldG = P[close].xau_per_btc * OZ;
const silverKg = (P[close].xag_per_btc * OZ) / 1000;
const puG = (computeAmount(1, OG_COMMODITIES.pu238, { btc: px, xau: P[close].xau_usd, xag: P[close].xag_usd }) ?? 0) * (OG_COMMODITIES.pu238.unitMassGrams ?? 1);

// The US government's coins in $1 bills (0.10922 mm a note), on their side from New York toward
// Denver (2,619 km great-circle) and Salt Lake City (3,167 km).
const govt = presetBtc('us-govt')!;
const govtKm = (govt * px * 0.10922) / 1e6;
const DENVER_KM = 2619, SLC_KM = 3167;
const govtWhere = govtKm >= SLC_KM ? `past Salt Lake City (${f0(SLC_KM)} km)` : govtKm >= DENVER_KM ? `past Denver (${f0(DENVER_KM)} km), short of Salt Lake City` : `short of Denver (${f0(DENVER_KM)} km)`;

const SLATE: Item[] = [
	{ id: 'el-salvador-brownstones', at: '2026-10-17T13:30:00Z', media: () => jpg(get('manhattan_p-el-salvador'), 'el-salvador-manhattan'),
		text: `El Salvador holds ${f0(sv)} bitcoin.\n\nSpend it on Manhattan land, in classic 20-by-100-foot brownstone lots.\n\nHow many lots does a whole country’s bitcoin buy? Guess first.`,
		reply: `About ${f0(lots)} lots at ${closeWord}’s close. (2014 land value, spread evenly, illustrative.) Fill the island with any stack:\n` + L('preset=el-salvador&commodity=manhattan') },
	{ id: 'three-elements-again', at: '2026-10-17T17:00:00Z', media: () => 'scripts/social/media/metals-new-element.mp4',
		text: `Gold, silver or plutonium-238.\n\nThe same one bitcoin, three very different piles: one fits in a pocket, one needs a trolley, one is the fuel that powers NASA’s deep-space probes.\n\nWhich would you choose?`,
		reply: `At ${closeWord}’s close: ${f0(goldG)} g of gold, ${silverKg.toFixed(1)} kg of silver, ${puG.toFixed(0)} g of Pu-238 (illustrative price; the video is at the 6 Oct close). Weigh any amount:\n` + L('btc=1&commodity=pu238') },
	{ id: 'govt-bills-west', at: '2026-10-17T21:30:00Z', media: () => jpg(get('cash_p-us-govt'), 'govt-cash'),
		text: `The US government holds ${f0(govt)} bitcoin.\n\nChange it into $1 bills, tip the stack on its side and lay it west from New York.\n\nDoes it reach Denver? Guess first.`,
		reply: `${f0(govtKm)} km of bills at ${closeWord}’s close: ${govtWhere}, as the crow flies. Stack any amount:\n` + L('preset=us-govt&commodity=cash') },
];

await run(SLATE, OUT, `Sat 17 Oct · close ${close} ($${f0(px)}), previous ${prev}`);
