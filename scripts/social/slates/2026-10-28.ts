/**
 * Wed 28 Oct 2026: three posts, written to scripts/social/WRITING.md. How much
 * bitcoin buys a 1-kilo gold bar (guess first), the inside-a-miner video with a
 * new opening, and one coin against a 1,000-ounce silver bar (guess first). Live
 * figures. See lib.ts for how to run it.
 */
import { L, SITE, f0, images, loadPrices, run, weekday, OZ, type Item } from './lib.ts';

const OUT = 'output/slates/2026-10-28';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;
const UTM = 'utm_source=x&utm_medium=first_reply&utm_campaign=launch';

// A 1 kg gold bar (32.15 troy oz) in bitcoin.
const goldBarBtc = (1000 / OZ) / P[close].xau_per_btc;
// A 1,000-oz silver bar (the usual exchange bar, about 31 kg) against one coin.
const silverBars = P[close].xag_per_btc / 1000;

const SLATE: Item[] = [
	{ id: 'kilo-gold-bar', at: '2026-10-28T13:30:00Z', media: () => jpg(get('gold_b-1'), 'one-coin-gold'),
		text: `A 1-kilo gold bar: the size of a smartphone, the bar private buyers stack.\n\nHow much bitcoin buys one at ${closeWord}’s close?\n\nMore than one coin, or less? Guess first.`,
		reply: `${goldBarBtc.toFixed(2)} bitcoin. One coin buys ${f0(P[close].xau_per_btc * OZ)} g. Weigh any amount in gold:\n` + L('btc=1&commodity=gold') },
	{ id: 'mining-dive-fourth', at: '2026-10-28T17:00:00Z', media: () => 'scripts/social/media/mining-dive.mp4',
		text: `Somewhere right now, a chip like this is making a trillion guesses a second.\n\nWhen one guess comes up right, a new block of bitcoin is born.\n\nThis is the inside of one of those machines, down to the chip.`,
		reply: `Take the chip apart yourself and watch a real block get found:\n${SITE}/mining?${UTM}` },
	{ id: 'silver-1000oz-bar', at: '2026-10-28T21:30:00Z', media: () => jpg(get('silver_b-1'), 'one-coin-silver'),
		text: `The standard exchange silver bar weighs 1,000 ounces: about 31 kg, roughly the size of a shoebox.\n\nDoes one bitcoin buy a whole one?\n\nGuess first.`,
		reply: `${silverBars >= 1 ? `Yes: ${silverBars.toFixed(2)} of them` : `No: ${Math.round(silverBars * 100)}% of one`}, ${f0(P[close].xag_per_btc)} oz at ${closeWord}’s close. Weigh any amount in silver:\n` + L('btc=1&commodity=silver') },
];

await run(SLATE, OUT, `Wed 28 Oct · close ${close} ($${f0(px)}), previous ${prev}`);
