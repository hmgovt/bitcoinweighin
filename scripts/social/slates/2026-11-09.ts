/**
 * Mon 9 Nov 2026: three posts, written to scripts/social/WRITING.md. Satoshi's
 * coins in gold against the US government's whole reserve (tribal), a NEW
 * video: the US government's seized coins stacked in $1 bills and ridden up,
 * and all 21 million coins in silver counted in years of the world's mines.
 * Live figures. See lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, OZ, type Item } from './lib.ts';

const OUT = 'output/slates/2026-11-09';
const { P, close, prev, card } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// Satoshi's coins in gold against US official gold: 8,133.5 t (World Gold Council).
const US_GOLD_T = 8133.5;
const satoshi = presetBtc('satoshi')!;
const satT = (satoshi * P[close].xau_per_btc * OZ) / 1e6;
const satPct = (satT / US_GOLD_T) * 100;

// The US government's coins in $1 bills (0.10922 mm a note) against the space station (~408 km).
const ISS_KM = 408;
const govt = presetBtc('us-govt')!;
// Quoted at the video's own close (7 Nov), so the text and the clip agree.
const VID = '2026-11-07';
const govtKm = (govt * P[VID].btc_usd * 0.10922) / 1e6;

// All 21 million coins in silver against world mine output: 819.7 million oz in 2024 (Silver Institute).
const MINE_MOZ = 819.7;
const all = 21_000_000;
const allMoz = (all * P[close].xag_per_btc) / 1e6;
const years = allMoz / MINE_MOZ;
const allBig = card('silver', all, 'market-cap');

const SLATE: Item[] = [
	{ id: 'satoshi-vs-us-gold', at: '2026-11-09T13:30:00Z', media: () => jpg(get('gold_p-satoshi'), 'satoshi-gold'),
		text: `The US holds 8,133 tonnes of gold, the biggest official reserve on Earth.\n\nSatoshi’s ${f0(satoshi)} bitcoin, swapped for gold at ${closeWord}’s close: ${card('gold', satoshi, 'satoshi').big} tonnes.\n\nCoins nobody has moved in over 15 years: ${satPct.toFixed(1)}% of America’s gold. A lot, or not much?`,
		reply: 'US gold: 8,133.5 t (World Gold Council). Weigh any stack in gold:\n' + L('preset=satoshi&commodity=gold') },
	{ id: 'govt-ride', at: '2026-11-09T17:00:00Z', media: () => 'scripts/social/media/ride-us-govt.mp4',
		text: `The US government holds ${f0(govt)} bitcoin, mostly seized from criminals.\n\nWe changed it into $1 bills, stacked them one on top of the other, and rode it up.\n\nAt ${weekday(VID)}’s close: ${f0(Math.round(govtKm / 10) * 10)} km, about ${Math.round(govtKm / ISS_KM)} times higher than the space station.`,
		reply: 'Every note true to scale, 0.11 mm thick. Ride it yourself:\n' + L('preset=us-govt&commodity=cash&ride=play') },
	{ id: 'all-btc-silver-years', at: '2026-11-09T21:30:00Z', media: () => jpg(get('silver_p-market-cap'), 'all-silver'),
		text: `The world’s mines dug up about ${MINE_MOZ} million ounces of silver in 2024.\n\nAll 21 million bitcoin, swapped for silver at ${closeWord}’s close: ${allBig.big}${allBig.unit} ${allBig.mid}.\n\nThat’s about ${years.toFixed(0)} years of every silver mine on Earth. Which is scarcer?`,
		reply: 'Mine output: 819.7 million oz in 2024 (Silver Institute, World Silver Survey 2025). Weigh any stack in silver:\n' + L('preset=market-cap&commodity=silver') },
];

await run(SLATE, OUT, `Mon 9 Nov · close ${close} ($${f0(px)}), previous ${prev}`);
