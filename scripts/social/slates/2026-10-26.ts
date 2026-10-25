/**
 * Mon 26 Oct 2026: three posts, written to scripts/social/WRITING.md. One coin in
 * $1 bills by weight (guess first), all bitcoin mined so far against all gold
 * ever mined (tribal), and one coin of plutonium-238 by the heat it gives off
 * (guess first). Live figures. See lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, run, weekday, OZ, type Item } from './lib.ts';
import { OG_COMMODITIES, computeAmount } from '../../../functions/_lib.ts';

const OUT = 'output/slates/2026-10-26';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// One coin in $1 bills: a note weighs about 1 g (US Bureau of Engraving and Printing).
const kgPaper = px / 1000;

// Every bitcoin mined so far against all gold ever mined: 216,265 t at the end of 2024 (World Gold Council).
const mined = (P[close] as unknown as { btc_supply: number }).btc_supply;
const GOLD_T = 216_265;
const goldUsd = (GOLD_T * 1e6 / OZ) * P[close].xau_usd;
const btcUsd = mined * px;
const share = btcUsd / goldUsd;

// One coin of Pu-238 (illustrative price), at 0.57 W of decay heat per gram; half-life 87.7 years.
const puG = (computeAmount(1, OG_COMMODITIES.pu238, { btc: px, xau: P[close].xau_usd, xag: P[close].xag_usd }) ?? 0) * (OG_COMMODITIES.pu238.unitMassGrams ?? 1);
const watts = puG * 0.57;

const SLATE: Item[] = [
	{ id: 'one-coin-paper-weight', at: '2026-10-26T13:30:00Z', media: () => jpg(get('cash_b-1'), 'one-coin-cash'),
		text: `One bitcoin, changed into $1 bills and packed in a bag.\n\nCould you carry it home on your own?\n\nGuess the weight first.`,
		reply: `${f0(kgPaper)} kg at ${closeWord}’s close: a dollar bill weighs about a gram, and there are ${f0(px)} of them. Stack any amount:\n` + L('btc=1&commodity=cash') },
	{ id: 'bitcoin-vs-all-gold', at: '2026-10-26T17:00:00Z', media: () => jpg(get('gold_p-market-cap'), 'all-coins-gold'),
		text: `All the gold mined up to the end of 2024: about ${f0(Math.round(GOLD_T / 1000))},000 tonnes, worth $${(goldUsd / 1e12).toFixed(1)} trillion at ${closeWord}’s close.\n\nAll the bitcoin ever mined: $${(btcUsd / 1e12).toFixed(2)} trillion.\n\nBitcoin is ${(share * 100).toFixed(1)}% the size of gold. “Digital gold,” or not even close?`,
		reply: 'Gold above ground: 216,265 t at the end of 2024 (World Gold Council). Weigh any stack in gold:\n' + L('preset=market-cap&commodity=gold') },
	{ id: 'one-coin-plutonium-watts', at: '2026-10-26T21:30:00Z', media: () => jpg(get('pu238_b-1'), 'one-coin-pu238'),
		text: `One bitcoin buys about ${Math.round(puG)} grams of plutonium-238.\n\nIt’s warm. It heats itself, with no fuel and no switch, for decades.\n\nHow many watts does that little lump give off? Guess first.`,
		reply: `About ${watts.toFixed(0)} W: 0.57 W a gram, halving every 87.7 years. That’s why it powers deep-space probes. The price is illustrative (DOE and NASA estimates). Weigh any amount:\n` + L('btc=1&commodity=pu238') },
];

await run(SLATE, OUT, `Mon 26 Oct · close ${close} ($${f0(px)}), previous ${prev}`);
