/**
 * Sun 8 Nov 2026: two posts and the week's X Article, written to
 * scripts/social/WRITING.md. Satoshi's coins on Manhattan counted in Midtown
 * blocks, Strategy's coins in $1 bills stacked down past the centre of the
 * Earth, and the Article: "Every bitcoin, weighed in gold since 2013", from
 * the dataset and /methodology. No video: this week already has three (Mon,
 * Wed, Thu). Live figures; the Article's history is the dataset's own. See
 * lib.ts for how to run it.
 */
import { L, DATA, SITE, f0, images, loadPrices, presetBtc, run, weekday, OZ, type Item } from './lib.ts';
import { landM2, LAND_YARDSTICKS } from '../../../src/lib/manhattan.ts';

const OUT = 'output/slates/2026-11-08';
const { P, close, prev, card } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;
const nice = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// Satoshi's coins on Manhattan land (2014 value, spread evenly) against a Midtown block, 200 × 800 ft.
const satoshi = presetBtc('satoshi')!;
const BLOCK_M2 = LAND_YARDSTICKS.find((y) => y.label === 'a Midtown block')!.m2;
const satBlocks = landM2(satoshi, px) / BLOCK_M2;

// Strategy's coins in $1 bills (0.10922 mm a note) against the Earth's mean radius, 6,371 km.
const EARTH_R = 6371;
const strategy = presetBtc('strategy')!;
// The height as the card states it ("In $1 bills: a stack 7,022 km tall."), so post and image agree.
const stratKm = Number(card('cash', strategy, 'strategy').subs.join(' ').match(/([\d,.]+) km/)![1].replace(/,/g, ''));

// The Article: ounces of gold per bitcoin, from the dataset.
const days = Object.keys(P).filter((d) => d <= close && P[d].xau_per_btc).sort();
const oz = (d: string) => P[d].xau_per_btc;
const peakIn = (from: string, to: string) => days.filter((d) => d >= from && d <= to).reduce((a, b) => (oz(b) > oz(a) ? b : a));
const lowIn = (from: string, to: string) => days.filter((d) => d >= from && d <= to).reduce((a, b) => (oz(b) < oz(a) ? b : a));
const first = days[0];
const p13 = peakIn('2013-01-01', '2013-12-31'), l15 = lowIn('2014-01-01', '2015-12-31');
const firstOz = days.find((d) => oz(d) >= 1)!;
const p17 = peakIn('2017-01-01', '2017-12-31'), l18 = lowIn('2018-01-01', '2018-12-31');
const p21 = peakIn('2021-01-01', '2021-12-31'), l22 = lowIn('2022-01-01', '2022-12-31');
const ath = peakIn(first, close);
const lowSince = lowIn(ath, close);
const ozs = (n: number) => (n < 0.1 ? n.toFixed(4) : n < 10 ? n.toFixed(1) : n.toFixed(1));
const g = (n: number) => f0(n * OZ);
const usd = (d: string, k: 'btc_usd' | 'xau_usd') => `$${f0(P[d][k])}`;

const ARTICLE = [
	`On ${nice(first)}, one bitcoin bought ${ozs(oz(first))} troy ounces of gold: about a quarter of a gram.`,
	`At ${closeWord}’s close it bought ${ozs(oz(close))} ounces: ${g(oz(close))} grams.`,
	`Here is the whole journey, one daily close at a time, from our free dataset.`,
	`The first ounce`,
	`On ${nice(p13)} a coin came within a whisker of an ounce: ${oz(p13).toFixed(3)} oz. Then it fell, to ${oz(l15).toFixed(2)} oz on ${nice(l15)}. Bitcoin first bought a full ounce of gold on ${nice(firstOz)}, at ${usd(firstOz, 'btc_usd')} a coin against gold at ${usd(firstOz, 'xau_usd')}.`,
	`The peaks, and the falls after them`,
	`2017: ${ozs(oz(p17))} oz on ${nice(p17)}. A year later, on ${nice(l18)}, it was ${ozs(oz(l18))} oz, down by more than four-fifths.`,
	`2021: ${ozs(oz(p21))} oz on ${nice(p21)}. On ${nice(l22)} it was ${ozs(oz(l22))} oz.`,
	`The record: ${ozs(oz(ath))} oz on ${nice(ath)}, ${g(oz(ath))} grams, with bitcoin at ${usd(ath, 'btc_usd')} and gold at ${usd(ath, 'xau_usd')}.`,
	`Since then, gold has done the climbing. On ${nice(lowSince)} a coin bought just ${ozs(oz(lowSince))} oz. At ${closeWord}’s close, with bitcoin at ${usd(close, 'btc_usd')} and gold at ${usd(close, 'xau_usd')}, it buys ${ozs(oz(close))}.`,
	`So what is a bitcoin worth?`,
	`In dollars, the line is mostly a story about bitcoin. In gold, it’s two assets moving at once: a coin can lose ounces while its dollar price rises, if gold rises faster. Measured this way, the 2024 peak still stands, and the swings run both ways: every peak above was followed by a fall of half or more.`,
	`How we measure`,
	`Each day’s figure is the last price of that UTC day. Bitcoin comes from CoinGecko. Gold is priced through PAX Gold, a token redeemable for one fine troy ounce of LBMA gold, which tracks spot within a small premium. One bitcoin’s gold is simply its dollar price divided by gold’s. Every source, fill and correction is logged on our methodology page.`,
	`The whole series, every day since 2013, is free to download as CSV or JSON: ${DATA}`,
	`Pick any day and see that coin’s gold as a cube to scale: ${SITE}`,
].join('\n\n');

const SLATE: Item[] = [
	{ id: 'satoshi-midtown-blocks', at: '2026-11-08T13:30:00Z', media: () => jpg(get('manhattan_p-satoshi'), 'satoshi-manhattan'),
		text: `Satoshi’s ${f0(satoshi)} bitcoin haven’t moved in over 15 years.\n\nSpent on Manhattan land at ${closeWord}’s close, they’d buy about ${f0(satBlocks)} Midtown blocks.\n\nWould you rather own the coins or the blocks?`,
		reply: 'A Midtown block: 200 by 800 ft between avenues. Land at its 2014 value, spread evenly, so it’s illustrative. Fill the island with any stack:\n' + L('preset=satoshi&commodity=manhattan') },
	{ id: 'strategy-cash-earth', at: '2026-11-08T17:00:00Z', media: () => jpg(get('cash_p-strategy'), 'strategy-cash'),
		text: `Strategy’s ${f0(strategy)} bitcoin, cashed out in $1 bills at ${closeWord}’s close and stacked straight down into the ground: about ${f0(Math.round(stratKm / 100) * 100)} km.\n\nThe centre of the Earth is ${f0(EARTH_R)} km down.\n\n${stratKm >= EARTH_R ? 'One company’s coins would punch right past it.' : 'Close, but the stack stops short.'}`,
		reply: 'Each note 0.11 mm thick; the Earth’s mean radius is 6,371 km. Stack any amount:\n' + L('preset=strategy&commodity=cash') },
	{ id: 'article-gold-since-2013', at: '2026-11-08T21:30:00Z', media: () => jpg(get('gold_b-1'), 'one-coin-gold'),
		article: { title: 'Every bitcoin, weighed in gold since 2013' },
		text: ARTICLE,
		reply: `From a flake of gold to ${g(oz(close))} grams: every bitcoin, weighed in gold, every day since 2013. Weigh any day yourself:\n` + L('btc=1&commodity=gold') },
];

await run(SLATE, OUT, `Sun 8 Nov · close ${close} ($${f0(px)}), previous ${prev}`);
