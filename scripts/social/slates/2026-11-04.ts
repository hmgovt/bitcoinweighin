/**
 * Wed 4 Nov 2026: three posts, written to scripts/social/WRITING.md. Strategy's
 * coins in gold against the UK's whole reserve (guess first, tribal), a NEW
 * video: Satoshi's coins stacked in $1 bills and ridden up, and SpaceX's coins
 * in silver counted in Falcon 9 launches (guess first). Live figures. See lib.ts
 * for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, OZ, type Item } from './lib.ts';

const OUT = 'output/slates/2026-11-04';
const { P, close, prev, card } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// Strategy's coins in gold against the UK's official reserve: 310.3 t (World Gold Council, end of 2025).
const UK_T = 310.3;
const strategy = presetBtc('strategy')!;
const stratT = (strategy * P[close].xau_per_btc * OZ) / 1e6;
const stratBig = card('gold', strategy, 'strategy').big; // the tonnes as the card shows them

// Satoshi's coins in $1 bills (0.10922 mm a note) against the space station's orbit (~408 km, as the ride shows it).
const satoshi = presetBtc('satoshi')!;
const satKm = (satoshi * px * 0.10922) / 1e6;
const ISS_KM = 408;
const moonPrice = 384_400_000 / 0.00010922 / satoshi;

// SpaceX's coins in silver against a Falcon 9: 22,800 kg to low Earth orbit, booster not recovered (SpaceX's figure).
const F9_T = 22.8;
const spacex = presetBtc('spacex')!;
const spacexT = (spacex * P[close].xag_per_btc * OZ) / 1e6;
const launches = Math.ceil(spacexT / F9_T);
const spacexBig = card('silver', spacex, 'spacex').big;

const SLATE: Item[] = [
	{ id: 'strategy-vs-uk-gold', at: '2026-11-04T13:30:00Z', media: () => jpg(get('gold_p-strategy'), 'strategy-gold'),
		text: `The UK holds ${UK_T} tonnes of gold.\n\nStrategy holds ${f0(strategy)} bitcoin.\n\nSwap every coin for gold at ${closeWord}’s close. Does one company out-gold Britain? Guess first.`,
		reply: `${stratT >= UK_T ? 'Yes' : 'No'}: ${stratBig} tonnes, ${(stratT / UK_T).toFixed(1)} times the UK’s reserve (World Gold Council, end of 2025). Weigh any stack in gold:\n` + L('preset=strategy&commodity=gold') },
	{ id: 'satoshi-ride', at: '2026-11-04T17:00:00Z', media: () => 'scripts/social/media/ride-satoshi.mp4',
		text: `Satoshi’s ${f0(satoshi)} bitcoin, changed into $1 bills and stacked one on top of the other.\n\nWe rode it up.\n\nAt ${closeWord}’s close it stands ${f0(Math.round(satKm / 10) * 10)} km tall, about ${Math.round(satKm / ISS_KM)} times higher than the space station flies.`,
		reply: `Every note true to scale, 0.11 mm thick. To reach the Moon, this stack needs $${(moonPrice / 1e6).toFixed(1)} million a coin. Ride it yourself:\n` + L('preset=satoshi&commodity=cash&ride=play') },
	{ id: 'spacex-silver-launches', at: '2026-11-04T21:30:00Z', media: () => jpg(get('silver_p-spacex'), 'spacex-silver'),
		text: `SpaceX holds ${f0(spacex)} bitcoin.\n\nSwap it all for silver at ${closeWord}’s close, then fly the metal to orbit on its own rockets.\n\nHow many Falcon 9 launches? Guess first.`,
		reply: `${launches}. That’s ${spacexBig} tonnes of silver; a Falcon 9 lifts ${F9_T} t to low orbit when the booster isn’t recovered (SpaceX’s figure). Weigh any stack in silver:\n` + L('preset=spacex&commodity=silver') },
];

await run(SLATE, OUT, `Wed 4 Nov · close ${close} ($${f0(px)}), previous ${prev}`);
