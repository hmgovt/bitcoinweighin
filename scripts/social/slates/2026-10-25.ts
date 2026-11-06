/**
 * Sun 25 Oct 2026: three posts, written to scripts/social/WRITING.md. The US
 * government's bitcoin against its own gold (tribal), the three elements video
 * with a new question, and four famous stacks together against Strategy alone on
 * Manhattan. Live figures. See lib.ts for how to run it.
 *
 * UK clocks go back today: 13:30, 17:00 and 21:30 UTC are the same times in London.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, OZ, type Item } from './lib.ts';
import { landM2, DEVELOPABLE_M2, frontierStreet } from '../../../src/lib/manhattan.ts';

const OUT = 'output/slates/2026-10-25';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// The US government's bitcoin in gold against its official gold: 8,133.5 t (World Gold Council).
const govt = presetBtc('us-govt')!;
const govtGoldT = (govt * P[close].xau_per_btc * OZ) / 1e6;
const US_GOLD_T = 8133.5;

// Four famous stacks together against Strategy alone, on Manhattan land.
const four = ['el-salvador', 'spacex', 'us-govt', 'pizza-day'].reduce((s, k) => s + presetBtc(k)!, 0);
const strategy = presetBtc('strategy')!;
const pct = (btc: number) => ((landM2(btc, px) / DEVELOPABLE_M2) * 100).toFixed(1);

const SLATE: Item[] = [
	{ id: 'us-bitcoin-vs-gold', at: '2026-10-25T13:30:00Z', media: () => jpg(get('gold_p-us-govt'), 'govt-gold'),
		text: `The US government holds about 8,133 tonnes of gold. And ${f0(govt)} bitcoin.\n\nWeighed in gold at ${closeWord}’s close, the bitcoin comes to ${f0(govtGoldT)} tonnes.\n\nThat’s ${((govtGoldT / US_GOLD_T) * 100).toFixed(1)}% of the gold pile. Should Washington tip the scale, or leave it?`,
		reply: 'US gold: 8,133.5 t (World Gold Council). Weigh any government’s stack:\n' + L('preset=us-govt&commodity=gold') },
	{ id: 'three-elements-third', at: '2026-10-25T17:00:00Z', media: () => 'scripts/social/media/metals-new-element.mp4',
		text: `Same coin, three elements.\n\nGold is the one your grandparents trusted. Silver is the one that halved from its January peak. Plutonium-238 is the one that keeps Voyager talking.\n\nYou can only keep one. Which?`,
		reply: `One coin at ${closeWord}’s close: ${f0(P[close].xau_per_btc * OZ)} g of gold or ${((P[close].xag_per_btc * OZ) / 1000).toFixed(1)} kg of silver (the video is at the 6 Oct close; Pu-238 price illustrative). Weigh any amount:\n` + L('btc=1&commodity=gold') },
	{ id: 'four-stacks-vs-strategy', at: '2026-10-25T21:30:00Z', media: () => jpg(get('manhattan_p-strategy'), 'strategy-manhattan'),
		text: `El Salvador, SpaceX, the US government and the 2010 pizza coins. Put them together: ${f0(four)} bitcoin.\n\nOn Manhattan land at ${closeWord}’s close, that buys ${pct(four)}% of the island.\n\nStrategy alone buys ${pct(strategy)}%, to ${frontierStreet(landM2(strategy, px)) ?? 'the Battery'}. Is one company holding too much?`,
		reply: 'Land at its 2014 value ($1.74T), spread evenly, so it’s illustrative. Race any stacks:\n' + L('preset=strategy&commodity=manhattan') },
];

await run(SLATE, OUT, `Sun 25 Oct · close ${close} ($${f0(px)}), previous ${prev}`);
