/**
 * Thu 5 Nov 2026: three posts, written to scripts/social/WRITING.md. BlackRock's
 * coins on Manhattan (guess the street), a NEW video: the Pizza Day coins dropped
 * in gold, silver and plutonium-238, and one bitcoin in Brent at its peak
 * against now (tribal). Live figures. See lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, type Item } from './lib.ts';
import { landM2, DEVELOPABLE_M2, frontierStreet } from '../../../src/lib/manhattan.ts';

const OUT = 'output/slates/2026-11-05';
const { P, close, prev, card } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;
const nice = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// BlackRock's ETF coins on Manhattan land, filled from the Battery north.
const ibit = presetBtc('blackrock-ibit')!;
const ibitM2 = landM2(ibit, px);
const ibitStreet = frontierStreet(ibitM2) ?? 'the Battery';
const ibitPct = (ibitM2 / DEVELOPABLE_M2) * 100;

// The 10,000 pizza coins (22 May 2010) in three metals, as the cards show them.
const pizza = presetBtc('pizza-day')!;
// Quoted at the video's own close (3 Nov), so the text and the clip agree.
const VID = '2026-11-03';
const pz = (c: string) => { const m = card(c, pizza, 'pizza-day', VID); return `${m.big}${m.unit} ${m.mid}`; };

// One bitcoin in Brent: the most barrels it has ever bought (dataset since 2013) against now.
const peak = Object.keys(P).filter((d) => d <= close && P[d].brent_per_btc).reduce((a, b) => (P[b].brent_per_btc > P[a].brent_per_btc ? b : a));
const peakBbl = P[peak].brent_per_btc, nowBbl = P[close].brent_per_btc;

const SLATE: Item[] = [
	{ id: 'ibit-manhattan-street', at: '2026-11-05T13:30:00Z', media: () => jpg(get('manhattan_p-blackrock-ibit'), 'ibit-manhattan'),
		text: `BlackRock’s bitcoin ETF holds ${f0(ibit)} coins.\n\nCash them out at ${closeWord}’s close and buy Manhattan land, from the Battery north, block by block.\n\nWhich street do they reach? Guess first.`,
		reply: `${ibitStreet}: ${ibitPct.toFixed(1)}% of the island. (Land at its 2014 value, spread evenly, so it’s illustrative.) Fill it with any stack:\n` + L('preset=blackrock-ibit&commodity=manhattan') },
	{ id: 'pizza-metals', at: '2026-11-05T17:00:00Z', media: () => 'scripts/social/media/metals-pizza.mp4',
		text: `On 22 May 2010, 10,000 bitcoin bought two pizzas.\n\nWe weighed the same coins at ${weekday(VID)}’s close: ${pz('gold')}, ${pz('silver')}, or ${pz('pu238')}.\n\nWould you have eaten them?`,
		reply: 'Plutonium-238’s price is illustrative (DOE and NASA estimates): there’s no open market. Weigh the pizza coins in anything:\n' + L('preset=pizza-day&commodity=gold') },
	{ id: 'oil-peak-vs-now', at: '2026-11-05T21:30:00Z', media: () => jpg(get('oil_b-1'), 'one-coin-oil'),
		text: `On ${nice(peak)}, one bitcoin bought ${f0(peakBbl)} barrels of Brent crude, the most since our data starts in 2013.\n\nAt ${closeWord}’s close: ${f0(nowBbl)}.\n\nDid bitcoin get cheap, or oil get dear?`,
		reply: `Both moved: bitcoin from $${f0(P[peak].btc_usd)} to $${f0(px)}, Brent from $${P[peak].brent_usd.toFixed(2)} to $${P[close].brent_usd.toFixed(2)} a barrel. Weigh any amount in oil:\n` + L('btc=1&commodity=oil') },
];

await run(SLATE, OUT, `Thu 5 Nov · close ${close} ($${f0(px)}), previous ${prev}`);
