/**
 * Sun 4 Oct 2026: three posts. World Space Week starts today (4–10 Oct,
 * the anniversary of Sputnik's launch on 4 Oct 1957). This week's best
 * performers were the Moon ride and Manhattan, so: the Moon ride for Space
 * Week, Satoshi's coins in gold, and Strategy's coins on Manhattan.
 * See lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, type Item } from './lib.ts';

const OUT = 'output/slates/2026-10-04';
const { P, close, prev, card } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;
const NOTE_M = 0.10922e-3, MOON_M = 384_400_000;
const moonPrice = MOON_M / NOTE_M / 21e6;
const moonPct = ((px * 21e6 * NOTE_M) / MOON_M) * 100;

const sat = presetBtc('satoshi')!;
const satGold = card('gold', sat, 'satoshi');
const knox = satGold.subs.find((s) => s.includes('Fort Knox'))?.replace(/\.$/, '');
const strategy = presetBtc('strategy')!;
const strat = card('manhattan', strategy, 'strategy');

const SLATE: Item[] = [
	{ id: 'space-week-moon', at: '2026-10-04T13:30:00Z', media: () => 'scripts/social/media/ride-market-cap.mp4',
		text: `World Space Week starts today, 69 years after Sputnik.\n\nBitcoin’s own moonshot: all 21 million coins in $1 bills, stacked. At ${closeWord}’s close they get ${moonPct.toFixed(1)}% of the way. At $${f0(moonPrice)} a coin, they land.`,
		reply: 'Ride the stack yourself (it starts by itself):\n' + L('preset=market-cap&commodity=cash&ride=play') },
	{ id: 'satoshi-gold', at: '2026-10-04T17:00:00Z', media: () => jpg(get('gold_p-satoshi'), 'satoshi-gold'),
		text: `Satoshi’s ${f0(sat)} untouched bitcoin would buy ${satGold.big}${satGold.unit === ' t' ? ' tonnes' : satGold.unit} of gold.\n\n${satGold.subs[0]}${knox ? ` ${knox}.` : ''}`,
		reply: 'Weigh Satoshi’s coins in anything:\n' + L('preset=satoshi&commodity=gold') },
	{ id: 'strategy-manhattan', at: '2026-10-04T21:30:00Z', media: () => jpg(get('manhattan_p-strategy'), 'strategy-manhattan'),
		text: `Saylor calls bitcoin “cyber Manhattan.”\n\nSo we spent Strategy’s ${f0(strategy)} BTC on the real one, lot by lot from the southern tip: ${strat.big}${strat.unit} of the island, ${strat.subs[0].replace(/\.$/, '').replace('→', 'to').replace(/^The /, 'the ')}.`,
		reply: 'Watch the lots fill up:\n' + L('preset=strategy&commodity=manhattan') },
];

await run(SLATE, OUT, `Sun 4 Oct · close ${close} ($${f0(px)}), previous ${prev}`);
