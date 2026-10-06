/**
 * Wed 7 Oct 2026: three posts, written to scripts/social/WRITING.md. The
 * "numbers on a screen" jibe answered in paper (cash), a guess-first post on
 * BlackRock's ETF as one gold cube (the answer in the image), and Satoshi's
 * unmoved coins on Manhattan land. See lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, sig3, run, weekday, type Item } from './lib.ts';

const OUT = 'output/slates/2026-10-07';
const { P, close, prev, card } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// 1 BTC in $1 bills: the stack and its weight (a note weighs about 1 g).
const cash = card('cash', 1);
const stackM = cash.subs[0].replace('A stack ', '').replace(' tall.', '');

// BlackRock's ETF as one gold cube; the answer, with a hoop for scale when it's close.
const ibit = presetBtc('blackrock-ibit')!;
const ibitGold = card('gold', ibit, 'blackrock-ibit');
const edgeM = Math.cbrt((ibit * P[close].xau_per_btc * 31.1035) / 19.3) / 100;
const HOOP_M = 3.05;
const hoop = Math.abs(edgeM / HOOP_M - 1) < 0.08 ? `, about the height of a basketball hoop (${HOOP_M} m)` : '';

// Satoshi's coins on Manhattan land, lot by lot from the southern tip.
const sat = presetBtc('satoshi')!;
const satLand = card('manhattan', sat, 'satoshi');
const reach = satLand.subs[0].replace(/\.$/, '').replace('→', 'to').replace(/^The /, 'the ');

const SLATE: Item[] = [
	{ id: 'numbers-on-a-screen', at: '2026-10-07T13:30:00Z', media: () => jpg(get('cash_b-1'), 'numbers-on-a-screen'),
		text: `Bitcoin is “just numbers on a screen.”\n\nHere’s one in paper: ${f0(px)} $1 bills at ${closeWord}’s close. A stack ${stackM} tall, weighing ${sig3(px / 1000)} kg.\n\nThe screen is lighter.`,
		reply: 'Stack any amount yourself:\n' + L('btc=1&commodity=cash') },
	{ id: 'ibit-gold-guess', at: '2026-10-07T17:00:00Z', media: () => jpg(get('gold_p-blackrock-ibit'), 'ibit-gold-guess'),
		text: `BlackRock’s bitcoin ETF holds ${f0(ibit)} BTC.\n\nSwap it all for gold and cast a single cube. How wide is it?\n\nGuess before you look.`,
		reply: `${sig3(edgeM)} m across and ${ibitGold.big} tonnes${hoop}. Weigh any holder:\n` + L('preset=blackrock-ibit&commodity=gold') },
	{ id: 'satoshi-manhattan', at: '2026-10-07T21:30:00Z', media: () => jpg(get('manhattan_p-satoshi'), 'satoshi-manhattan'),
		text: `Satoshi’s ${f0(sat)} bitcoin have never moved.\n\nSpent on Manhattan land at ${closeWord}’s close, they’d buy ${satLand.big}${satLand.unit} of the island: ${reach}.\n\nStill unspent.`,
		reply: 'Fill the island lot by lot:\n' + L('preset=satoshi&commodity=manhattan') },
];

await run(SLATE, OUT, `Wed 7 Oct · close ${close} ($${f0(px)}), previous ${prev}`);
