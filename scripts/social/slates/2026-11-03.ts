/**
 * Tue 3 Nov 2026: three posts, written to scripts/social/WRITING.md. Strategy's
 * coins in Brent crude counted in supertankers (guess first, the new oil stage),
 * the US government's coins in Manhattan brownstone lots, and BlackRock's ETF in
 * plutonium-238 counted in Voyagers, with the 10 Oct figure corrected. Live
 * figures. See lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, type Item } from './lib.ts';
import { landM2, LAND_YARDSTICKS } from '../../../src/lib/manhattan.ts';
import { OG_COMMODITIES, computeAmount } from '../../../functions/_lib.ts';
import { VLCC_BARRELS, WORLD_BARRELS_PER_DAY } from '../../../src/lib/oil.ts';

const OUT = 'output/slates/2026-11-03';
const { P, close, prev, card } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;
const day = { btc: px, xau: P[close].xau_usd, xag: P[close].xag_usd };

// Strategy's coins in Brent crude, in 2-million-barrel supertankers (VLCCs), and in days of world use.
const strategy = presetBtc('strategy')!;
const brent = (P[close] as unknown as { brent_usd: number }).brent_usd;
const barrels = (strategy * px) / brent;
const tankers = barrels / VLCC_BARRELS;
const worldDays = barrels / WORLD_BARRELS_PER_DAY;

// The US government's coins on Manhattan land, in classic 20 × 100 ft brownstone lots.
const govt = presetBtc('us-govt')!;
const LOT_M2 = LAND_YARDSTICKS.find((y) => y.label === 'a brownstone lot')!.m2;
const lots = landM2(govt, px) / LOT_M2;

// BlackRock's ETF in Pu-238 (illustrative price) against Voyager 1: three RTGs of ~4.5 kg each, ~13.5 kg.
const ibit = presetBtc('blackrock-ibit')!;
const puKg = (computeAmount(ibit, OG_COMMODITIES.pu238, day) ?? 0) * (OG_COMMODITIES.pu238.unitMassGrams ?? 1) / 1000;
const voyagers = puKg / 13.5;

const SLATE: Item[] = [
	{ id: 'strategy-supertankers', at: '2026-11-03T13:30:00Z', media: () => jpg(get('oil_p-strategy'), 'strategy-oil'),
		text: `Strategy holds ${f0(strategy)} bitcoin.\n\nSwap it all for Brent crude at ${closeWord}’s close and load it onto supertankers, 2 million barrels each.\n\nHow many ships? Guess first.`,
		reply: `${tankers.toFixed(0)} supertankers: ${(barrels / 1e6).toFixed(0)} million barrels at $${brent.toFixed(2)}. The world burns that in about ${worldDays.toFixed(1)} days. Weigh any stack in oil:\n` + L('preset=strategy&commodity=oil') },
	{ id: 'govt-brownstones', at: '2026-11-03T17:00:00Z', media: () => jpg(get('manhattan_p-us-govt'), 'govt-manhattan'),
		text: `The US government holds ${f0(govt)} bitcoin, mostly seized from criminals.\n\nSpent on Manhattan land at ${closeWord}’s close, it buys about ${f0(Math.round(lots / 10) * 10)} classic 20-by-100-foot brownstone lots.\n\nKeep the coins, or buy the street?`,
		reply: 'Land at its 2014 value ($1.74T), spread evenly, so it’s illustrative. Fill the island with any stack:\n' + L('preset=us-govt&commodity=manhattan') },
	{ id: 'ibit-voyagers-corrected', at: '2026-11-03T21:30:00Z', media: () => jpg(get('pu238_p-blackrock-ibit'), 'ibit-pu238'),
		text: `Voyager 1 carries three nuclear batteries, about 13.5 kg of plutonium-238 in all, and it’s still talking to us after 49 years.\n\nBlackRock’s ${f0(ibit)} bitcoin, in plutonium-238: enough for about ${f0(Math.round(voyagers / 10) * 10)} Voyagers.\n\nWhere would you send them?`,
		reply: 'Correction: on 10 Oct we said 4.5 kg, which is one of the three batteries. The price is illustrative (DOE and NASA estimates). Weigh any stack:\n' + L('preset=blackrock-ibit&commodity=pu238') },
];

await run(SLATE, OUT, `Tue 3 Nov · close ${close} ($${f0(px)}), previous ${prev}`);
