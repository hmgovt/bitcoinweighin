/**
 * Mon 2 Nov 2026: three posts, written to scripts/social/WRITING.md. How fast gold
 * mines dig up a bitcoin's worth of gold against how fast bitcoin miners make a
 * coin (tribal), the Moon ride video with a new opening, and the gold/silver ratio
 * since January (tribal). Live figures. See lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, run, weekday, OZ, type Item } from './lib.ts';

const OUT = 'output/slates/2026-11-02';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// Gold mines dug 3,672 t in 2025 (World Gold Council); one coin's worth of gold, in seconds of output.
const MINE_T = 3672;
const gramsPerSec = (MINE_T * 1e6) / (365.25 * 86400);
const coinGold = P[close].xau_per_btc * OZ;
const goldSecs = coinGold / gramsPerSec;
// Bitcoin issues 3.125 coins a block, about 144 blocks a day: one new coin every ~3.2 minutes.
const btcMins = (86400 / (144 * 3.125)) / 60;

// The gold/silver ratio at its low of the past year against now.
const yearAgo = new Date(Date.parse(close + 'T00:00:00Z') - 365 * 864e5).toISOString().slice(0, 10);
const ratio = (d: string) => P[d].xau_usd / P[d].xag_usd;
const low = Object.keys(P).filter((d) => d >= yearAgo && d <= close && P[d].xag_usd).reduce((a, b) => (ratio(b) < ratio(a) ? b : a));
const nice = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });

// All 21 million coins in $1 bills against the Moon.
const moonPct = ((21e6 * px * 0.10922e-6) / 384_400) * 100;

const SLATE: Item[] = [
	{ id: 'mining-race', at: '2026-11-02T13:30:00Z', media: () => jpg(get('gold_b-1'), 'one-coin-gold'),
		text: `The world’s gold mines dig up one bitcoin’s worth of gold (${f0(coinGold)} g) every ${goldSecs.toFixed(0)} seconds.\n\nBitcoin’s miners make one new coin every ${btcMins.toFixed(1)} minutes, and that pace halves again in 2028.\n\nWhich is the scarcer money?`,
		reply: 'Gold: 3,672 t mined in 2025 (World Gold Council). Bitcoin: 3.125 coins a block, about 144 blocks a day. Weigh any amount:\n' + L('btc=1&commodity=gold') },
	{ id: 'moon-ride-fourth', at: '2026-11-02T17:00:00Z', media: () => 'scripts/social/media/ride-market-cap.mp4',
		text: `How high does $${(21e6 * px / 1e12).toFixed(1)} trillion stack?\n\nEvery bitcoin there will ever be, in $1 bills, one on top of the other. We rode it up.\n\nAt ${closeWord}’s close: ${moonPct.toFixed(1)}% of the way to the Moon.`,
		reply: 'Every note true to scale, 0.11 mm thick. Ride it yourself (it starts by itself):\n' + L('preset=market-cap&commodity=cash&ride=play') },
	{ id: 'gold-silver-ratio', at: '2026-11-02T21:30:00Z', media: () => jpg(get('silver_b-1'), 'one-coin-silver'),
		text: `On ${nice(low)}, an ounce of gold cost ${ratio(low).toFixed(0)} ounces of silver.\n\nAt ${closeWord}’s close: ${ratio(close).toFixed(0)}.\n\nIs silver cheap again, or cheap for a reason?`,
		reply: `One bitcoin buys ${f0(P[close].xag_per_btc)} oz of silver or ${P[close].xau_per_btc.toFixed(1)} oz of gold. Weigh it in either:\n` + L('btc=1&commodity=silver') },
];

await run(SLATE, OUT, `Mon 2 Nov · close ${close} ($${f0(px)}), previous ${prev}`);
