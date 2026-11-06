/**
 * Sat 31 Oct 2026: three posts, written to scripts/social/WRITING.md. The
 * whitepaper's 18th birthday (31 Oct 2008) against every coin mined since,
 * Halloween's "ghost" stack (Satoshi's untouched coins) in silver, and the first
 * block reward of 50 coins in $1 bills against the Empire State Building (guess
 * first). Live figures. See lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, OZ, type Item } from './lib.ts';

const OUT = 'output/slates/2026-10-31';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// Every coin mined so far, in gold.
const mined = (P[close] as unknown as { btc_supply: number }).btc_supply;
const minedGoldT = (mined * P[close].xau_per_btc * OZ) / 1e6;

// Satoshi's coins in silver against a year of the world's mines (about 26,000 t in 2025, USGS).
const sat = presetBtc('satoshi')!;
const satSilverT = (sat * P[close].xag_per_btc * OZ) / 1e6;
const WORLD_T = 26_000;

// The first block reward, 50 coins, in $1 bills (0.10922 mm a note) against the Empire State
// Building: 381 m to the roof, 443 m to the tip.
const fiftyM = (50 * px * 0.10922) / 1000;
const esb = fiftyM >= 443 ? 'taller than the Empire State Building, antenna and all (443 m)' : fiftyM >= 381 ? 'past the Empire State Building’s roof (381 m), just short of its tip (443 m)' : 'short of the Empire State Building’s roof (381 m)';

const SLATE: Item[] = [
	{ id: 'whitepaper-18', at: '2026-10-31T13:30:00Z', media: () => jpg(get('gold_b-1'), 'one-coin-gold'),
		text: `18 years ago today, someone calling themselves Satoshi Nakamoto published a nine-page paper.\n\nEvery bitcoin mined since, ${f0(mined)} of them, would buy ${f0(Math.round(minedGoldT / 100) * 100)} tonnes of gold at ${closeWord}’s close.\n\nBest nine pages ever written?`,
		reply: `One coin buys ${f0(P[close].xau_per_btc * OZ)} g of gold. Weigh any amount, on any day since 2013:\n` + L('btc=1&commodity=gold') },
	{ id: 'halloween-ghost-silver', at: '2026-10-31T17:00:00Z', media: () => jpg(get('silver_p-satoshi'), 'satoshi-silver'),
		text: `Bitcoin’s ghost story: ${f0(sat)} coins, untouched for over 15 years, and nobody knows who holds the keys.\n\nSwapped for silver at ${closeWord}’s close: ${f0(Math.round(satSilverT / 1000) * 1000)} tonnes.\n\nThat’s ${(satSilverT / WORLD_T).toFixed(1)} years of every silver mine on Earth. Spooky enough?`,
		reply: 'Mine output: about 26,000 t in 2025 (USGS). Weigh Satoshi’s coins in anything:\n' + L('preset=satoshi&commodity=silver') },
	{ id: 'first-block-reward-esb', at: '2026-10-31T21:30:00Z', media: () => jpg(get('cash_b-1'), 'one-coin-cash'),
		text: `The very first bitcoin block, mined in January 2009, created 50 coins.\n\nChange those 50 coins into $1 bills at ${closeWord}’s close and stack them.\n\nTaller than the Empire State Building? Guess first.`,
		reply: `${f0(fiftyM)} m: ${esb}. One coin alone is ${((px * 0.10922) / 1000).toFixed(1)} m. Stack any amount:\n` + L('btc=1&commodity=cash') },
];

await run(SLATE, OUT, `Sat 31 Oct · close ${close} ($${f0(px)}), previous ${prev}`);
