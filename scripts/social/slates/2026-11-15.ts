/**
 * Sun 15 Nov 2026: two posts and the week's X Article, written to
 * scripts/social/WRITING.md. One bitcoin in gold now against a year earlier
 * (both fell; bitcoin fell faster), SpaceX's coins in silver weighed against
 * a fully fuelled Falcon 9, and the Article: "How much of Manhattan can
 * bitcoin buy?", from /methodology and the dataset. No video: this week
 * already has three (Mon, Tue, Wed). Live figures. See lib.ts for how to run it.
 */
import { L, SITE, f0, images, loadPrices, nice, presetBtc, run, weekday, OZ, type Item } from './lib.ts';
import { landM2, DEVELOPABLE_M2, frontierStreet, LAND_VALUE_USD } from '../../../src/lib/manhattan.ts';

const OUT = 'output/slates/2026-11-15';
const { P, close, prev, card } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;
const usd = (n: number) => `$${f0(n)}`;

// One bitcoin in gold at the close against the same date a year earlier (dataset).
const yearAgo = `${Number(close.slice(0, 4)) - 1}${close.slice(4)}`;
const ozNow = P[close].xau_per_btc;
const ozThen = P[yearAgo].xau_per_btc;
const ozDrop = (1 - ozNow / ozThen) * 100;

// SpaceX's coins in silver against a Falcon 9 at liftoff: 549,054 kg (SpaceX).
const FALCON9_T = 549.054;
const spacex = presetBtc('spacex')!;
const spacexT = (spacex * P[close].xag_per_btc * OZ) / 1e6;

// The Article: Manhattan's land (Barr, Smith & Kulkarni, 2014) against the dataset.
const ALL = 21_000_000;
const pct = (btc: number, price: number) => (landM2(btc, price) / DEVELOPABLE_M2) * 100;
const street = (btc: number) => frontierStreet(landM2(btc, px));
const breakEven = LAND_VALUE_USD / ALL;
const days = Object.keys(P).filter((d) => d <= close && P[d].btc_usd).sort();
const above = days.filter((d) => P[d].btc_usd >= breakEven);
const peak = days.reduce((a, b) => (P[b].btc_usd > P[a].btc_usd ? b : a));
const y14 = days.filter((d) => d.startsWith('2014'));
const avg14 = y14.reduce((s, d) => s + P[d].btc_usd, 0) / y14.length;
const holders = (['satoshi', 'strategy', 'blackrock-ibit', 'us-govt'] as const).map((k) => ({ k, btc: presetBtc(k)! }));
const NAMES: Record<string, string> = { satoshi: 'Satoshi’s untouched coins', strategy: 'Strategy', 'blackrock-ibit': 'BlackRock’s bitcoin ETF', 'us-govt': 'The US government' };
const svAcres = landM2(presetBtc('el-salvador')!, px) / 4046.8564;

const ARTICLE = [
	`Every bitcoin there will ever be, all 21 million, spent on Manhattan land at ${closeWord}’s close, with a coin at ${usd(px)}, buys ${pct(ALL, px).toFixed(0)}% of the island’s ground: from the Battery up to ${street(ALL)}.`,
	`Here is how we get that number, and what it does and doesn’t mean.`,
	`Land, not apartments`,
	`We price the ground itself, not the buildings on it. An apartment’s price per square foot is for floor space stacked many storeys up; an area on a map is ground.`,
	`The price tag`,
	`The most thorough estimate of the island’s land value is by Jason Barr, Fred Smith and Sayali Kulkarni: “What’s Manhattan worth? A land values index from 1950 to 2014” (Regional Science and Urban Economics, 2018). From some 3,600 sales of vacant lots, they valued all of Manhattan’s developable land at about $1.74 trillion in 2014, with a range of $1.54 to $1.95 trillion.`,
	`It is a 2014 figure. There is no rigorous later total, so we use it as it stands and mark the comparison as illustrative.`,
	`The map`,
	`The map is New York City’s own open data: every tax lot from the Department of Finance, land use and the shoreline from City Planning, and building footprints with measured roof heights. Tax lots run out over the rivers in places, so each one is clipped to the shoreline. Parks and open space are left out, as the study did. That leaves 32.4 square kilometres of developable land, about 55% of the borough.`,
	`The $1.74 trillion is spread evenly over that land. So the share of the island a sum buys is simply its value over $1.74 trillion.`,
	`How it fills`,
	`Your land fills lot by lot from the Battery, the island’s southern tip, northwards, whole lots at a time with their buildings. The street in the readout is the northernmost one whose land to the south you’ve covered.`,
	`Who gets how far`,
	...holders.map(({ k, btc }) => `${NAMES[k]}, ${f0(btc)} bitcoin: ${pct(btc, px).toFixed(1)}% of the island, ${street(btc) ? `to ${street(btc)}` : 'short of Wall Street'}.`),
	`El Salvador’s ${f0(presetBtc('el-salvador')!)} bitcoin: ${svAcres.toFixed(1)} acres at the Battery.`,
	`When bitcoin could buy it all`,
	`All 21 million coins cover the whole island once one is worth about ${usd(Math.round(breakEven / 100) * 100)}. In our dataset that has happened on ${f0(above.length)} days, the first on ${nice(above[0])} and the latest on ${nice(above.at(-1)!)}. At the record close, ${usd(P[peak].btc_usd)} on ${nice(peak)}, they’d have bought the island ${(pct(ALL, P[peak].btc_usd) / 100).toFixed(1)} times over.`,
	`In 2014, the year of the valuation, a bitcoin averaged about ${usd(avg14)}. All 21 million would have bought ${pct(ALL, avg14).toFixed(1)}% of the island.`,
	`What it isn’t`,
	`Nobody could actually do this. Selling that much bitcoin would move its price, and buying that much land would move the island’s. The comparison is a way of seeing a sum of money at the scale of a real place, not a trade.`,
	`Try it`,
	`Pick any holder, any amount or any day since 2013 and watch it fill the island: ${SITE}/?commodity=manhattan`,
	`Every source and assumption is on our methodology page: ${SITE}/methodology`,
].join('\n\n');

const SLATE: Item[] = [
	{ id: 'one-coin-gold-year', at: '2026-11-15T13:30:00Z', media: () => jpg(get('gold_b-1'), 'one-coin-gold'),
		text: `On ${nice(yearAgo)}, one bitcoin bought ${ozThen.toFixed(1)} ounces of gold.\n\nAt ${closeWord}’s close it bought ${ozNow.toFixed(1)}.\n\nGold fell too, from ${usd(P[yearAgo].xau_usd)} to ${usd(P[close].xau_usd)} an ounce. Bitcoin fell faster: ${ozDrop.toFixed(0)}% fewer ounces in a year. Buy the dip, or buy the gold?`,
		reply: `Bitcoin ${usd(P[yearAgo].btc_usd)} then, ${usd(px)} now (daily closes, our dataset). Weigh one coin in gold on any day:\n` + L('btc=1&commodity=gold') },
	{ id: 'spacex-silver-falcon9', at: '2026-11-15T17:00:00Z', media: () => jpg(get('silver_p-spacex'), 'spacex-silver'),
		text: `SpaceX holds ${f0(spacex)} bitcoin.\n\nSwapped for silver at ${closeWord}’s close: ${f0(spacexT)} tonnes.\n\nA fully fuelled Falcon 9 weighs ${f0(FALCON9_T)} tonnes on the pad. The silver is ${spacexT >= FALCON9_T ? `about ${(spacexT / FALCON9_T).toFixed(1)} times heavier` : `${((spacexT / FALCON9_T) * 100).toFixed(0)}% of that`}. One company’s spare bitcoin outweighs its own rocket.`,
		reply: 'Falcon 9 at liftoff: 549,054 kg (SpaceX). Weigh any holder in silver:\n' + L('preset=spacex&commodity=silver') },
	{ id: 'article-manhattan', at: '2026-11-15T21:30:00Z', media: () => jpg(get('manhattan_p-market-cap'), 'all-manhattan'),
		article: { title: 'How much of Manhattan can bitcoin buy?' },
		text: ARTICLE,
		reply: `Every bitcoin, spent on Manhattan land: ${pct(ALL, px).toFixed(0)}% of the island, up to ${street(ALL)}. How we work it out, and who gets how far:\n` + L('preset=market-cap&commodity=manhattan') },
];

await run(SLATE, OUT, `Sun 15 Nov · close ${close} ($${f0(px)}), previous ${prev}`);
