/**
 * Thu 15 Oct 2026: three posts, written to scripts/social/WRITING.md. The 2010
 * pizza coins in 400-oz gold bars (guess first), the long "cyber Manhattan" cut
 * again with a new question, and bitcoin, gold and silver against their highs
 * of the past year (tribal, text only). Live figures. See lib.ts for how to run it.
 */
import { DATA, L, f0, images, loadPrices, presetBtc, run, weekday, OZ, type Item } from './lib.ts';
import { LAND_VALUE_USD } from '../../../src/lib/manhattan.ts';

const OUT = 'output/slates/2026-10-15';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;
const month = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

// The pizza coins in gold, counted in 400-oz Good Delivery bars (the kind central banks hold).
const pizza = presetBtc('pizza-day')!;
const pizzaOz = pizza * P[close].xau_per_btc;
const bars = Math.round(pizzaOz / 400);
const pizzaT = (pizzaOz * OZ) / 1e6;

// Every coin mined so far against Manhattan's land, live (the video is at the 6 Oct close).
const mined = (P[close] as unknown as { btc_supply: number }).btc_supply;
const minedPct = Math.round(((mined * px) / LAND_VALUE_USD) * 100);

// Each asset's highest close in the year to the latest close, and how far below it it is now.
const yearAgo = new Date(Date.parse(close + 'T00:00:00Z') - 365 * 864e5).toISOString().slice(0, 10);
const fromHigh = (k: 'btc_usd' | 'xau_usd' | 'xag_usd') => {
	const days = Object.keys(P).filter((d) => d >= yearAgo && d <= close && P[d][k]);
	const peak = days.reduce((a, b) => (P[b][k] > P[a][k] ? b : a));
	return { peak, high: P[peak][k], down: Math.round((1 - P[close][k] / P[peak][k]) * 100) };
};
const btc = fromHigh('btc_usd'), gold = fromHigh('xau_usd'), silver = fromHigh('xag_usd');
const usd = (n: number) => (n >= 1000 ? `$${f0(n)}` : `$${n.toFixed(2)}`);

const SLATE: Item[] = [
	{ id: 'pizza-gold-bars', at: '2026-10-15T13:30:00Z', media: () => jpg(get('gold_p-pizza-day'), 'pizza-gold'),
		text: `In 2010, Laszlo Hanyecz paid ${f0(pizza)} bitcoin for two pizzas.\n\nSwap those coins for gold today, in the 400-oz bars central banks keep in their vaults.\n\nHow many bars? Guess first.`,
		reply: `${f0(bars)} bars: ${pizzaT.toFixed(1)} tonnes of gold at ${closeWord}’s close. Weigh the pizza coins yourself:\n` + L('preset=pizza-day&commodity=gold') },
	{ id: 'cyber-manhattan-again', at: '2026-10-15T17:00:00Z', media: () => 'scripts/social/media/manhattan-long.mp4',
		text: `Saylor says bitcoin is “cyber Manhattan.”\n\nSo we took the real island and let the biggest stacks buy it, lot by lot, from the Battery north.\n\nBlackRock’s ETF or Strategy: whose coins get further? Call it, then watch.`,
		reply: `The video is at the 6 Oct close. At ${closeWord}’s, every coin mined so far buys ${minedPct}% of the island (2014 land value, illustrative). Try any stack:\n` + L('btc=1&commodity=manhattan') },
	{ id: 'down-from-the-high', at: '2026-10-15T21:30:00Z',
		text: `Down from their highs of the past year, at ${closeWord}’s close:\n\nSilver: −${silver.down}% (${usd(silver.high)}, ${month(silver.peak)})\nBitcoin: −${btc.down}% (${usd(btc.high)}, ${month(btc.peak)})\nGold: −${gold.down}% (${usd(gold.high)}, ${month(gold.peak)})\n\nEveryone’s underwater. Which gets back to its high first?`,
		reply: 'Every daily close, free to download:\n' + DATA },
];

await run(SLATE, OUT, `Thu 15 Oct · close ${close} ($${f0(px)}), previous ${prev}`);
