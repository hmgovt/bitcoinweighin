/**
 * Sat 10 Oct 2026: three posts, written to scripts/social/WRITING.md. Satoshi's
 * untouched coins as one silver cube (guess first), one bitcoin's patch of
 * Manhattan (guess first), and BlackRock's ETF in plutonium-238 against
 * Voyager 1's fuel. All live. See lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, sig3, run, weekday, type Item } from './lib.ts';
import { landM2 } from '../../../src/lib/manhattan.ts';
import { OG_COMMODITIES, computeAmount } from '../../../functions/_lib.ts';

const OUT = 'output/slates/2026-10-10';
const { P, close, prev, card } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// Satoshi's coins as one silver cube (silver: 10.49 g/cm³).
const sat = presetBtc('satoshi')!;
const satSilver = card('silver', sat, 'satoshi');
const satEdgeM = Math.cbrt((sat * P[close].xag_per_btc * 31.1035) / 10.49) / 100;

// One coin of Manhattan, in square feet, and as a square's side.
const sqft = landM2(1, px) * 10.7639104;

// BlackRock's ETF in plutonium-238, against Voyager 1's ~4.5 kg at launch (1977).
const ibit = presetBtc('blackrock-ibit')!;
const ibitPu = card('pu238', ibit, 'blackrock-ibit');
const ibitPuKg = (computeAmount(ibit, OG_COMMODITIES.pu238, { btc: px, xau: P[close].xau_usd, xag: P[close].xag_usd }) ?? 0) * (OG_COMMODITIES.pu238.unitMassGrams ?? 1) / 1000;
const voyagers = ibitPuKg / 4.5;

const SLATE: Item[] = [
	{ id: 'satoshi-silver', at: '2026-10-10T13:30:00Z', media: () => jpg(get('silver_p-satoshi'), 'satoshi-silver'),
		text: `Satoshi’s ${f0(sat)} bitcoin have never moved.\n\nSwapped for silver at ${closeWord}’s close and cast as one cube, how wide is it?\n\nGuess before you look.`,
		reply: `${sig3(satEdgeM)} m across: ${satSilver.big}${satSilver.unit.trim() === 't' ? ' tonnes' : satSilver.unit} of silver. Weigh any holder:\n` + L('preset=satoshi&commodity=silver') },
	{ id: 'one-coin-manhattan', at: '2026-10-10T17:00:00Z', media: () => jpg(get('manhattan_b-1'), 'one-coin-manhattan'),
		text: `One bitcoin, spent on Manhattan land at ${closeWord}’s close.\n\nHow many square feet do you get?\n\nGuess before you look.`,
		reply: `${sig3(sqft)} sq ft: a square about ${sig3(Math.sqrt(sqft))} ft on a side, at the Battery. (Land at its 2014 value, spread evenly: illustrative.) Try your stack:\n` + L('btc=1&commodity=manhattan') },
	{ id: 'ibit-plutonium', at: '2026-10-10T21:30:00Z', media: () => jpg(get('pu238_p-blackrock-ibit'), 'ibit-plutonium'),
		text: `Voyager 1 left Earth in 1977 with about 4.5 kg of plutonium-238. It’s still talking to us.\n\nBlackRock’s ${f0(ibit)} bitcoin would buy ${ibitPu.big}${ibitPu.unit.trim() === 't' ? ' tonnes' : ibitPu.unit} of it: enough for about ${f0(Math.round(voyagers / 100) * 100)} Voyagers.\n\nWhere would you send them?`,
		reply: 'The plutonium price is illustrative (DOE and NASA estimates): there’s no open market. Weigh any holder:\n' + L('preset=blackrock-ibit&commodity=pu238') },
];

await run(SLATE, OUT, `Sat 10 Oct · close ${close} ($${f0(px)}), previous ${prev}`);
