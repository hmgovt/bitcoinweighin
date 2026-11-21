/**
 * Thu 19 Nov 2026: three posts, written to scripts/social/WRITING.md.
 * BlackRock's bitcoin ETF in gold against Taiwan's central-bank gold (tribal),
 * Satoshi's coins in $1 bills dropped down a hole through the Earth, and every
 * bitcoin there will ever be in silver, counted in years of the world's mine
 * output. No video: this week already has three (Mon, Tue, Wed). Live figures.
 * See lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, OZ, type Item } from './lib.ts';

const OUT = 'output/slates/2026-11-19';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// BlackRock's ETF coins in gold against Taiwan's official gold: 423.9 t (World Gold Council, Q4 2025).
const TAIWAN_T = 423.9;
const ibit = presetBtc('blackrock-ibit')!;
const ibitT = (ibit * P[close].xau_per_btc * OZ) / 1e6;
const ratio = ibitT / TAIWAN_T;
const versus = Math.abs(ratio - 1) < 0.05 ? 'Almost exactly the same pile.'
	: ratio > 1 ? `${((ratio - 1) * 100).toFixed(0)}% more than Taiwan’s.` : `${(ratio * 100).toFixed(0)}% of Taiwan’s.`;

// Satoshi's coins in $1 bills (0.10922 mm a note) against the Earth's mean radius, 6,371 km (NASA).
const EARTH_R_KM = 6371;
const satoshi = presetBtc('satoshi')!;
const satKm = (satoshi * px * 0.10922) / 1e6;

// Every bitcoin there will ever be in silver against 2024 world mine output: 819.7 Moz (World Silver Survey 2025).
const MINE_MOZ = 819.7;
const ALL = 21_000_000;
const allMoz = (ALL * P[close].xag_per_btc) / 1e6;

const SLATE: Item[] = [
	{ id: 'ibit-gold-vs-taiwan', at: '2026-11-19T13:30:00Z', media: () => jpg(get('gold_p-blackrock-ibit'), 'ibit-gold'),
		text: `Taiwan’s central bank holds about 424 tonnes of gold.\n\nBlackRock’s bitcoin ETF holds ${f0(ibit)} coins. Swapped for gold at ${closeWord}’s close: ${f0(ibitT)} tonnes.\n\n${versus} One fund, one island’s vault. Which would you rather own?`,
		reply: 'Taiwan’s official gold: 423.9 t (World Gold Council, Q4 2025). Weigh any holder in gold:\n' + L('preset=blackrock-ibit&commodity=gold') },
	{ id: 'satoshi-cash-earth-core', at: '2026-11-19T17:00:00Z', media: () => jpg(get('cash_p-satoshi'), 'satoshi-cash'),
		text: `Satoshi’s ${f0(satoshi)} bitcoin, changed into $1 bills at ${closeWord}’s close and stacked in one column: ${f0(satKm)} km.\n\nDrop that stack down a hole through the planet.\n\nDoes it reach the centre of the Earth? Guess first.`,
		reply: `${satKm >= EARTH_R_KM ? `Yes, and ${f0(satKm - EARTH_R_KM)} km beyond` : `No: ${f0(EARTH_R_KM - satKm)} km short`}. The Earth’s mean radius is 6,371 km (NASA); each note is 0.11 mm thick. Stack any amount:\n` + L('preset=satoshi&commodity=cash') },
	{ id: 'all-btc-silver-mine-years', at: '2026-11-19T21:30:00Z', media: () => jpg(get('silver_p-market-cap'), 'all-silver'),
		text: `Every bitcoin there will ever be, all 21 million, swapped for silver at ${closeWord}’s close: ${(allMoz / 1000).toFixed(1)} billion ounces.\n\nThe world’s mines dug up ${f0(MINE_MOZ)} million ounces in 2024.\n\nThat’s ${f0(allMoz / MINE_MOZ)} years of every silver mine on Earth. Digital scarcity, or the real thing?`,
		reply: `2024 mine output: 819.7 Moz (World Silver Survey 2025, Silver Institute). Silver at $${P[close].xag_usd.toFixed(2)} an ounce. Weigh any stack:\n` + L('preset=market-cap&commodity=silver') },
];

await run(SLATE, OUT, `Thu 19 Nov · close ${close} ($${f0(px)}), previous ${prev}`);
