/**
 * Sun 29 Nov 2026: two posts and the week's X Article, written to
 * scripts/social/WRITING.md. Satoshi's coins on Manhattan land counted in
 * World Trade Center sites, BlackRock's bitcoin ETF in silver against a year of
 * the world's silver mining, and the Article: "One bitcoin, weighed in oil
 * since 2013", from the Oil stage, /methodology and the dataset. No video: this
 * week already has three (Mon, Tue, Wed). Live figures. See lib.ts for how to
 * run it.
 */
import { L, SITE, f0, images, loadPrices, nice, presetBtc, run, weekday, OZ, type Item } from './lib.ts';
import { landM2, DEVELOPABLE_M2, frontierStreet } from '../../../src/lib/manhattan.ts';

const OUT = 'output/slates/2026-11-29';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;
const usd = (n: number) => `$${f0(n)}`;
const ACRE = 4046.8564;

// Satoshi's coins on Manhattan land against the World Trade Center site: about
// 16 acres (Port Authority of New York and New Jersey).
const WTC_ACRES = 16;
const satoshi = presetBtc('satoshi')!;
const satM2 = landM2(satoshi, px);
const satAcres = satM2 / ACRE;

// BlackRock's ETF coins in silver against world silver mine output: 819.7
// million ounces in 2024 (World Silver Survey 2025, Silver Institute).
const MINE_MOZ = 819.7;
const ibit = presetBtc('blackrock-ibit')!;
const ibitMoz = (ibit * P[close].xag_per_btc) / 1e6;

// The Article: one coin in Brent barrels (DCOILBRENTEU via FRED, in the dataset).
const days = Object.keys(P).filter((d) => d <= close && P[d].btc_usd && P[d].brent_per_btc).sort();
const first = days[0];
const bbl = (d: string) => P[d].brent_per_btc;
const peak = days.reduce((a, b) => (bbl(b) > bbl(a) ? b : a));
const usdPeak = days.reduce((a, b) => (P[b].btc_usd > P[a].btc_usd ? b : a));
const lowOil = days.reduce((a, b) => (P[b].brent_usd < P[a].brent_usd ? b : a));
const yearEnd = (y: number) => days.filter((d) => d.startsWith(String(y))).pop()!;
const firstPast = (n: number) => days.find((d) => bbl(d) >= n)!;
const b1 = firstPast(1), b100 = firstPast(100), b1000 = firstPast(1000);
const LITRES = 158.987;
const now = bbl(close);
const ye25 = yearEnd(2025);
const H = (k: string) => presetBtc(k)!;
const VLCC_BBL = 2e6;
const WORLD_BPD = 103.9e6;
const US_RES_BN = 46.0;
const sameDay = peak === usdPeak;

const ARTICLE = [
	`At ${closeWord}’s close, one bitcoin buys ${f0(now)} barrels of Brent crude. That’s about ${f0((now * LITRES) / 1000)} thousand litres, enough to fill ${f0((now * LITRES) / 55)} family-car fuel tanks.`,
	`Thirteen years ago it bought less than a fifth of one barrel. Here is how we measure it, how far it has come, and what the biggest holders could buy.`,
	`Why oil`,
	`Gold is the old yardstick for money. Oil is the one the world actually runs on: about ${(WORLD_BPD / 1e6).toFixed(1)} million barrels a day in 2025, by the International Energy Agency’s count. Pricing bitcoin in barrels asks a blunt question: how much real energy does a coin command?`,
	`How we measure it`,
	`We use the Brent spot price, the benchmark for most of the world’s crude, as published daily by the US Energy Information Administration and redistributed by the St. Louis Fed (series DCOILBRENTEU). One barrel is 42 US gallons, ${LITRES.toFixed(1)} litres. We divide each day’s bitcoin close by that day’s Brent price. When Brent hasn’t been published yet, we carry the last price forward and say so on our health page.`,
	`Crude is a wholesale price, before refining, shipping and tax. A dollar buys roughly three times as much crude as it does gasoline at the pump, so these are big numbers on purpose.`,
	`One coin, year by year`,
	`On ${nice(first)}, the first day in our dataset, a coin cost ${usd(P[first].btc_usd)} and Brent ${usd(P[first].brent_usd)}: ${bbl(first).toFixed(2)} of a barrel, about ${f0(bbl(first) * LITRES)} litres.`,
	`It first bought a whole barrel on ${nice(b1)}. It passed 100 barrels on ${nice(b100)}, and 1,000 on ${nice(b1000)}.`,
	`At the end of each year: ${[2014, 2016, 2018, 2020, 2022, 2024].map((y) => `${y}, ${f0(bbl(yearEnd(y)))}`).join('; ')}.`,
	`The strangest day was ${nice(lowOil)}, early in the pandemic, when Brent spot fell to ${usd(P[lowOil].brent_usd)} a barrel. With bitcoin at ${usd(P[lowOil].btc_usd)}, one coin briefly bought ${f0(bbl(lowOil))} barrels, a record that stood until ${nice(days.find((d) => d > lowOil && bbl(d) > bbl(lowOil))!)}.`,
	`The peak, and since`,
	`The record so far is ${f0(bbl(peak))} barrels, on ${nice(peak)}${sameDay ? `, the same day bitcoin set its record dollar close of ${usd(P[usdPeak].btc_usd)}` : ''}. At the end of 2025 a coin bought ${f0(bbl(ye25))}. At ${closeWord}’s close, with bitcoin at ${usd(px)} and Brent at $${P[close].brent_usd.toFixed(2)}, it buys ${f0(now)}: ${f0((1 - now / bbl(peak)) * 100)}% below the peak, and ${f0((1 - now / bbl(ye25)) * 100)}% down since the end of 2025.`,
	`Who could buy what`,
	`At ${closeWord}’s close:`,
	`The 10,000 pizza bitcoin of 2010: ${((H('pizza-day') * now) / 1e6).toFixed(1)} million barrels, about ${((H('pizza-day') * now) / VLCC_BBL).toFixed(1)} supertanker loads at roughly 2 million barrels each (EIA).`,
	`The US government’s ${f0(H('us-govt'))} bitcoin: ${f0((H('us-govt') * now) / 1e6)} million barrels.`,
	`Strategy’s ${f0(H('strategy'))} bitcoin: ${f0((H('strategy') * now) / 1e6)} million barrels.`,
	`Satoshi’s ${f0(H('satoshi'))} untouched coins: ${f0((satoshi * now) / 1e6)} million barrels, ${((satoshi * now) / WORLD_BPD).toFixed(1)} days of the whole world’s oil use.`,
	`All 21 million bitcoin: ${((21e6 * now) / 1e9).toFixed(1)} billion barrels, ${f0(((21e6 * now) / 1e9 / US_RES_BN) * 100)}% of America’s proved crude reserves of ${US_RES_BN.toFixed(1)} billion barrels at the end of 2024 (EIA).`,
	`What it isn’t`,
	`Nobody could swap that much bitcoin for oil at one price: a sale that size would move both markets. Brent is one grade of crude, and the spot price is not what a refinery or a driver pays. The barrels are a way of seeing a sum of money at the scale of real energy, not a trade.`,
	`Try it`,
	`Pick any holder, any amount or any day since 2013, and see it as barrels, drums or tankers of crude, or as gallons of diesel and gasoline: ${SITE}/?commodity=oil`,
	`Every source and assumption is on our methodology page: ${SITE}/methodology`,
].join('\n\n');

const SLATE: Item[] = [
	{ id: 'satoshi-manhattan-wtc', at: '2026-11-29T13:30:00Z', media: () => jpg(get('manhattan_p-satoshi'), 'satoshi-manhattan'),
		text: `Satoshi’s ${f0(satoshi)} bitcoin have never moved.\n\nSpent on Manhattan land at ${closeWord}’s close, from the Battery north: ${f0(satAcres)} acres, as far as ${frontierStreet(satM2) ?? 'the Battery'}.\n\nThe World Trade Center site is 16 acres. Satoshi’s coins buy about ${f0(satAcres / WTC_ACRES)} of them. Big, or smaller than you thought?`,
		reply: `${((satM2 / DEVELOPABLE_M2) * 100).toFixed(1)}% of the island. World Trade Center site: about 16 acres (Port Authority). Land at its 2014 value (Barr, Smith & Kulkarni), illustrative. Fill the island:\n` + L('preset=satoshi&commodity=manhattan') },
	{ id: 'ibit-silver-mine-output', at: '2026-11-29T17:00:00Z', media: () => jpg(get('silver_p-blackrock-ibit'), 'ibit-silver'),
		text: `Every silver mine on Earth together dug up ${f0(MINE_MOZ)} million ounces in 2024.\n\nBlackRock’s bitcoin ETF holds ${f0(ibit)} coins. Swapped for silver at ${closeWord}’s close: ${(ibitMoz / 1000).toFixed(1)} billion ounces.\n\nThat’s ${(ibitMoz / MINE_MOZ).toFixed(1)} years of the world’s silver mining, in one fund. Which is scarcer?`,
		reply: `2024 world mine output: 819.7 million ounces (World Silver Survey 2025, Silver Institute). Silver $${P[close].xag_usd.toFixed(2)} an ounce. Weigh any holder in silver:\n` + L('preset=blackrock-ibit&commodity=silver') },
	{ id: 'article-oil-since-2013', at: '2026-11-29T21:30:00Z', media: () => jpg(get('oil_b-1'), 'one-coin-oil'),
		article: { title: 'One bitcoin, weighed in oil since 2013' },
		text: ARTICLE,
		reply: `One bitcoin buys ${f0(now)} barrels of Brent crude. In 2013 it bought under a fifth of one. How we measure it, the record day, and what the biggest holders could buy:\n` + L('btc=1&commodity=oil') },
];

await run(SLATE, OUT, `Sun 29 Nov · close ${close} ($${f0(px)}), previous ${prev}`);
