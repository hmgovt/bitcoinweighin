/**
 * Sun 22 Nov 2026: two posts and the week's X Article, written to
 * scripts/social/WRITING.md. Every bitcoin there will ever be in gold against
 * all the gold ever mined, one bitcoin in US gasoline driven towards the Moon,
 * and the Article: "How high would bitcoin stack in $1 bills?", from the Cash
 * stage, the Moon ride and the dataset. No video: this week already has three
 * (Mon, Tue, Wed). Live figures. See lib.ts for how to run it.
 */
import { L, SITE, f0, images, loadPrices, nice, presetBtc, run, weekday, OZ, type Item } from './lib.ts';
import { BILL_THICKNESS_MM, DISTANCE_TO_MOON_KM } from '../../../src/lib/billStack.ts';

const OUT = 'output/slates/2026-11-22';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;
const usd = (n: number) => `$${f0(n)}`;
const ALL = 21_000_000;

// All 21M in gold against all the gold ever mined: 224,200 t at the end of Q3 2026
// (World Gold Council, above-ground stocks).
const GOLD_EVER_T = 224_200;
const allT = (ALL * P[close].xau_per_btc * OZ) / 1e6;

// One bitcoin in US regular gasoline (EIA weekly retail, in the dataset), driven at
// 27.2 mpg, the record real-world average for new vehicles (EPA Automotive Trends,
// model year 2024), against the Moon's average distance, 238,855 miles (384,400 km).
const MPG = 27.2;
const MOON_MI = 238_855;
const gal = P[close].gasoline_per_btc!;
const miles = gal * MPG;

// The Article: $1 bills at 0.10922 mm a note (Bureau of Engraving and Printing).
const NOTE_M = BILL_THICKNESS_MM / 1000;
const km = (btc: number, price: number) => (btc * price * NOTE_M) / 1000;
const days = Object.keys(P).filter((d) => d <= close && P[d].btc_usd).sort();
const first = days[0];
const peak = days.reduce((a, b) => (P[b].btc_usd > P[a].btc_usd ? b : a));
const firstPast = (m: number) => days.find((d) => km(ALL, P[d].btc_usd) * 1000 >= m)!;
const karman = firstPast(100_000);
const iss = firstPast(408_000);
const geo = firstPast(35_786_000);
const moonPx = (DISTANCE_TO_MOON_KM * 1000) / NOTE_M / ALL;
const allKm = km(ALL, px);
const H = (k: string) => presetBtc(k)!;
const where = (k: number) =>
	k >= 408 ? `past the International Space Station (about 408 km)` : k >= 100 ? `past the edge of space at 100 km` : k >= 11 ? `above airliners at cruising height, short of space` : `below the airliners`;

const ARTICLE = [
	`Every bitcoin there will ever be, all 21 million, changed into $1 bills at ${closeWord}’s close, with a coin at ${usd(px)}, makes a stack ${f0(Math.round(allKm / 100) * 100)} km high: ${((allKm / DISTANCE_TO_MOON_KM) * 100).toFixed(0)}% of the way to the Moon.`,
	`Here is how we work that out, who gets how far, and how the stack has grown since 2013.`,
	`Why $1 bills`,
	`Bitcoin is priced in dollars, so a stack of $1 bills turns a price straight into a height: a coin at ${usd(px)} is ${f0(px)} notes. Every US note, from $1 to $100, is the same size: 6.14 by 2.61 inches and 0.0043 inches thick (0.10922 mm), by the Bureau of Engraving and Printing’s own figures. Each weighs about a gram.`,
	`So the height is simple: the number of notes times 0.10922 mm. We stack them flat, in one column, and ignore the squash a real pile would suffer under its own weight.`,
	`One coin`,
	`At ${closeWord}’s close, one bitcoin is a column ${(km(1, px) * 1000).toFixed(1)} metres tall and weighs about ${f0(px / 1000)} kg.`,
	`On ${nice(first)}, the first day in our dataset, a coin cost ${usd(P[first].btc_usd)}: a stack ${(km(1, P[first].btc_usd) * 1e6).toFixed(1)} mm high, thinner than a phone. At the record close, ${usd(P[peak].btc_usd)} on ${nice(peak)}, it stood ${(km(1, P[peak].btc_usd) * 1000).toFixed(1)} m.`,
	`Who gets how far`,
	`At ${closeWord}’s close:`,
	`The 10,000 pizza bitcoin of 2010: ${f0(km(H('pizza-day'), px))} km, ${where(km(H('pizza-day'), px))}.`,
	`SpaceX’s ${f0(H('spacex'))} bitcoin: ${f0(km(H('spacex'), px))} km, ${where(km(H('spacex'), px))}.`,
	`The US government’s ${f0(H('us-govt'))} bitcoin: ${f0(km(H('us-govt'), px))} km.`,
	`BlackRock’s bitcoin ETF, ${f0(H('blackrock-ibit'))} coins: ${f0(km(H('blackrock-ibit'), px))} km.`,
	`Strategy, the biggest company stack, ${f0(H('strategy'))} coins: ${f0(km(H('strategy'), px))} km.`,
	`Satoshi’s untouched ${f0(H('satoshi'))} coins: ${f0(km(H('satoshi'), px))} km, further than the 6,371 km from the Earth’s surface to its centre.`,
	`The whole supply, through the years`,
	`Price all 21 million coins on each day since 2013 and the stack has climbed fast. It first passed the edge of space on ${nice(karman)}, with a coin at ${usd(P[karman].btc_usd)}. It passed the International Space Station on ${nice(iss)}, and geostationary orbit, ${f0(35_786)} km up, on ${nice(geo)}.`,
	`At the record close it reached ${f0(Math.round(km(ALL, P[peak].btc_usd) / 100) * 100)} km, ${((km(ALL, P[peak].btc_usd) / DISTANCE_TO_MOON_KM) * 100).toFixed(0)}% of the way to the Moon. To touch the Moon, ${f0(DISTANCE_TO_MOON_KM)} km away on average, a coin would need to be worth about ${usd(Math.round(moonPx / 100) * 100)}. It never has been.`,
	`What it isn’t`,
	`Not all 21 million coins exist yet: about ${(P[close].btc_supply! / 1e6).toFixed(1)} million have been mined, and the last will come around 2140. Nobody could change that much bitcoin into cash at one price, and nobody could stack it. The column is a way of seeing a sum of money at the scale of real heights, not a plan.`,
	`Try it`,
	`Pick any holder, any amount or any day since 2013, then ride to the top of the stack: ${SITE}/?commodity=cash`,
	`Every source and assumption is on our methodology page: ${SITE}/methodology`,
].join('\n\n');

const SLATE: Item[] = [
	{ id: 'all-btc-gold-vs-all-gold', at: '2026-11-22T13:30:00Z', media: () => jpg(get('gold_p-market-cap'), 'all-gold'),
		text: `All the gold ever mined, in every vault, ring and bar on Earth: about ${f0(GOLD_EVER_T)} tonnes.\n\nEvery bitcoin there will ever be, swapped for gold at ${closeWord}’s close: ${f0(Math.round(allT / 100) * 100)} tonnes.\n\nThat’s ${((allT / GOLD_EVER_T) * 100).toFixed(1)}% of it. Gold’s pile is ${f0(GOLD_EVER_T / allT)} times bigger. Room to grow, or a ceiling?`,
		reply: `Above-ground gold: 224,200 t at the end of Q3 2026 (World Gold Council). Gold ${usd(P[close].xau_usd)} an ounce. Weigh every bitcoin in gold:\n` + L('preset=market-cap&commodity=gold') },
	{ id: 'one-coin-gasoline-moon', at: '2026-11-22T17:00:00Z', media: () => jpg(get('oil_b-1'), 'one-coin-oil'),
		text: `One bitcoin, spent on US gasoline at ${closeWord}’s close: ${f0(Math.round(gal / 10) * 10)} gallons.\n\nPour it into an average new car, ${MPG} miles to the gallon, and drive: ${f0(Math.round(miles / 1000) * 1000)} miles.\n\nThe Moon is ${f0(MOON_MI)} miles away. ${miles >= 2 * MOON_MI ? 'There and back, with fuel to spare' : miles >= MOON_MI ? `You get there, and ${(((miles - MOON_MI) / MOON_MI) * 100).toFixed(0)}% of the way home` : `You get ${((miles / MOON_MI) * 100).toFixed(0)}% of the way there`}. Road trip?`,
		reply: `Gasoline $${P[close].gasoline_usd!.toFixed(2)} a gallon, US regular, weekly (EIA). ${MPG} mpg: new vehicles, real-world, model year 2024 (EPA). Pictured: the same coin in Brent crude. Weigh any stack in fuel:\n` + L('btc=1&commodity=oil') },
	{ id: 'article-cash-stack', at: '2026-11-22T21:30:00Z', media: () => jpg(get('cash_p-market-cap'), 'all-cash'),
		article: { title: 'How high would bitcoin stack in $1 bills?' },
		text: ARTICLE,
		reply: `Every bitcoin in $1 bills: a stack ${f0(Math.round(allKm / 100) * 100)} km high, ${((allKm / DISTANCE_TO_MOON_KM) * 100).toFixed(0)}% of the way to the Moon. How we work it out, and who gets how far:\n` + L('preset=market-cap&commodity=cash') },
];

await run(SLATE, OUT, `Sun 22 Nov · close ${close} ($${f0(px)}), previous ${prev}`);
