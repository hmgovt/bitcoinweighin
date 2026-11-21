/**
 * Fri 9 Oct 2026: three posts, written to scripts/social/WRITING.md. The new
 * mining video (inside a miner, down to one hash core), Strategy's stack in
 * gold against Fort Knox, and a guess-first post on the 2010 pizza coins in
 * $1 bills against the edge of space. See lib.ts for how to run it.
 *
 * The video carries its own figures (block 970,330); the other two are live.
 */
import { L, SITE, f0, images, loadPrices, presetBtc, sig3, run, weekday, type Item } from './lib.ts';

const OUT = 'output/slates/2026-10-09';
const { P, close, prev, card } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;
const UTM = 'utm_source=x&utm_medium=first_reply&utm_campaign=launch';

// Strategy's stack in gold, against Fort Knox (about 147.3 million troy oz).
const strategy = presetBtc('strategy')!;
const stratGold = card('gold', strategy, 'strategy');
const stratT = (strategy * P[close].xau_per_btc * 31.1035) / 1e6;
const knoxPct = (stratT / 4581.4) * 100;

// The 10,000 pizza coins in $1 bills (0.10922 mm a note) against the Kármán
// line, the conventional edge of space at 100 km.
const pizzaKm = (10_000 * px * 0.10922) / 1e6;
const KARMAN_KM = 100;

const SLATE: Item[] = [
	{ id: 'mining-dive', at: '2026-10-09T13:30:00Z', media: () => 'scripts/social/media/mining-dive.mp4',
		text: `This chip guesses a trillion times a second.\n\nAlmost every guess fails.\n\nOne that didn’t found bitcoin block 970,330. We took a miner apart to show you where it came from.`,
		reply: `Take the chip apart yourself, then watch a real block get found, one SHA-256 round at a time:\n${SITE}/mining?${UTM}` },
	{ id: 'strategy-fort-knox', at: '2026-10-09T17:00:00Z', media: () => jpg(get('gold_p-strategy'), 'strategy-fort-knox'),
		text: `Strategy holds ${f0(strategy)} bitcoin.\n\nSwapped for gold at ${closeWord}’s close: ${stratGold.big} tonnes. That’s ${Math.round(knoxPct)}% of Fort Knox.\n\nGold bugs, is that a lot or a little?`,
		reply: 'Fort Knox holds about 147.3 million troy ounces (US Mint). Weigh any holder in gold:\n' + L('preset=strategy&commodity=gold') },
	{ id: 'pizza-space', at: '2026-10-09T21:30:00Z', media: () => jpg(get('cash_p-pizza-day'), 'pizza-space'),
		text: `In 2010, Laszlo Hanyecz paid 10,000 bitcoin for two pizzas.\n\nStacked in $1 bills at ${closeWord}’s close, would those coins reach space?\n\nGuess before you look.`,
		reply: (pizzaKm >= KARMAN_KM
			? `${sig3(pizzaKm)} km tall: past the edge of space (the Kármán line, ${KARMAN_KM} km).`
			: `${sig3(pizzaKm)} km tall: ${sig3(KARMAN_KM - pizzaKm)} km short of the edge of space (the Kármán line, ${KARMAN_KM} km).`) + ' Stack any amount:\n' + L('preset=pizza-day&commodity=cash') },
];

await run(SLATE, OUT, `Fri 9 Oct · close ${close} ($${f0(px)}), previous ${prev}`);
