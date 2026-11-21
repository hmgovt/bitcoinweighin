/**
 * Thu 22 Oct 2026: three posts, written to scripts/social/WRITING.md. Counting one
 * coin in $1 bills, one note a second (guess first), the 2010 pizza coins in
 * silver against a fully loaded 747-8, and one coin in gold a year ago today
 * against now (tribal, both sides). Live figures. See lib.ts for how to run it.
 */
import { execFileSync } from 'node:child_process';
import { L, SITE, f0, images, loadPrices, presetBtc, run, weekday, OZ, type Item } from './lib.ts';

const OUT = 'output/slates/2026-10-22';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// One coin in $1 bills, counted one note a second without a break.
const notes = Math.round(px);
const hrs = Math.floor(notes / 3600), mins = Math.round((notes % 3600) / 60);

// The pizza coins in silver against a Boeing 747-8 at maximum take-off weight (447,700 kg, Boeing).
const pizza = presetBtc('pizza-day')!;
const pizzaT = (pizza * P[close].xag_per_btc * OZ) / 1e6;
const JUMBO_T = 447.7;
const jumbo = pizzaT / JUMBO_T;
const jumboLine = jumbo >= 1.05 ? `${jumbo.toFixed(1)} fully loaded 747-8s` : jumbo >= 0.95 ? 'about one fully loaded 747-8 jumbo jet' : `${Math.round(jumbo * 100)}% of a fully loaded 747-8`;

// One coin in gold, the same date a year ago against the latest close.
const ago = Object.keys(P).filter((d) => d <= `${Number(close.slice(0, 4)) - 1}${close.slice(4)}` && P[d].xau_per_btc).sort().pop()!;
const chg = (k: 'btc_usd' | 'xau_usd') => Math.round((P[close][k] / P[ago][k] - 1) * 100);
const sign = (n: number) => (n > 0 ? `+${n}%` : n < 0 ? `−${-n}%` : 'flat');
const usd = (n: number) => `$${f0(n)}`;

/** A year ago's card, rendered here (the site doesn't pre-render it), above today's. */
const thenAndNow = (): string => {
	const then = `${OUT}/gold-year-ago.png`;
	execFileSync('curl', ['-sfS', '--max-time', '60', '-o', `${OUT}/card-prices.json`, `${SITE}/prices.json`]);
	execFileSync('npx', ['tsx', 'scripts/og/render-card.ts', `${then}|btc=1&commodity=gold&date=${ago}`], { env: { ...process.env, PRICES: `${OUT}/card-prices.json` } });
	const file = `${OUT}/gold-year-ago-now.jpg`;
	execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', then, '-i', get('gold_b-1'), '-filter_complex', '[0][1]vstack=inputs=2', '-q:v', '2', file]);
	return file;
};

const SLATE: Item[] = [
	{ id: 'count-one-coin', at: '2026-10-22T13:30:00Z', media: () => jpg(get('cash_b-1'), 'one-coin-cash'),
		text: `Change one bitcoin into $1 bills and count them out loud, one a second, no breaks.\n\nHow long until you’re done?\n\nGuess first.`,
		reply: `${hrs} hours ${mins} minutes: ${f0(notes)} notes at ${closeWord}’s close. Then stack them: ${((px * 0.10922) / 1000).toFixed(1)} m tall. Stack any amount:\n` + L('btc=1&commodity=cash') },
	{ id: 'pizza-silver-jumbo', at: '2026-10-22T17:00:00Z', media: () => jpg(get('silver_p-pizza-day'), 'pizza-silver'),
		text: `In 2010, ${f0(pizza)} bitcoin bought two pizzas.\n\nSwap them for silver at ${closeWord}’s close: ${f0(pizzaT)} tonnes.\n\nThat’s ${jumboLine} at take-off.\n\nStill hungry?`,
		reply: '747-8 maximum take-off weight: 447.7 t (Boeing). Weigh the pizza coins in anything:\n' + L('preset=pizza-day&commodity=silver') },
	{ id: 'gold-year-ago-today', at: '2026-10-22T21:30:00Z', media: thenAndNow,
		text: `One year, to ${closeWord}’s close:\n\nGold: ${usd(P[ago].xau_usd)} → ${usd(P[close].xau_usd)} (${sign(chg('xau_usd'))})\nBitcoin: ${usd(P[ago].btc_usd)} → ${usd(px)} (${sign(chg('btc_usd'))})\n\nSo one bitcoin went from ${P[ago].xau_per_btc.toFixed(1)} oz of gold to ${P[close].xau_per_btc.toFixed(1)} oz.\n\nGold bugs, this lap is yours. Who takes the next one?`,
		reply: 'Slide the date to any day since 2013:\n' + L('btc=1&commodity=gold') },
];

await run(SLATE, OUT, `Thu 22 Oct · close ${close} ($${f0(px)}), previous ${prev}`);
