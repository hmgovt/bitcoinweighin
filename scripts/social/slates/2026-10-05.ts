/**
 * Mon 5 Oct 2026: three posts, "Holders Monday" in the launch calendar.
 * The first Weekly Weigh-In (a recurring Monday format), the US government's
 * coins in gold, and the race between BlackRock's ETF and Strategy, weighed
 * in Manhattan land. See lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, type Item } from './lib.ts';

const OUT = 'output/slates/2026-10-05';
const { P, close, prev, card } = await loadPrices();
const { get, jpg, pair, grid } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// Week on week: the close seven days before, or the nearest earlier one.
const weekAgo = new Date(Date.parse(close + 'T00:00:00Z') - 7 * 86400_000).toISOString().slice(0, 10);
const prevWeek = Object.keys(P).filter((d) => d <= weekAgo && P[d].btc_usd).sort().pop()!;
const wow = (px / P[prevWeek].btc_usd - 1) * 100;
const cash = card('cash', 1), land = card('manhattan', 1);

const govt = presetBtc('us-govt')!;
const govtGold = card('gold', govt, 'us-govt');
const ibit = presetBtc('blackrock-ibit')!, strategy = presetBtc('strategy')!;
const gap = Math.abs(strategy - ibit);
const leader = strategy >= ibit ? 'Strategy' : 'BlackRock’s ETF';
const trailer = strategy >= ibit ? 'BlackRock’s bitcoin ETF' : 'Strategy';
const gapLand = card('manhattan', gap);

const SLATE: Item[] = [
	{ id: 'weekly-weigh-in', at: '2026-10-05T13:30:00Z',
		media: () => grid(['gold', 'silver', 'cash', 'manhattan'].map((c) => `commodity=${c}&btc=1`), 'weekly', close),
		text: `The Weekly Weigh-In. 1 BTC at ${closeWord}’s close of $${f0(px)}:\n\nGold: ${P[close].xau_per_btc.toFixed(1)} oz\nSilver: ${f0(P[close].xag_per_btc)} oz\n$1 bills: a stack ${cash.subs[0].replace('A stack ', '').replace(' tall.', '')} tall\nManhattan: ${land.big}${land.unit}\n\nWeek on week: ${wow >= 0 ? '+' : '−'}${Math.abs(wow).toFixed(1)}% in dollars.`,
		reply: 'Weigh any amount, any day since 2013:\n' + L('btc=1&commodity=gold') },
	{ id: 'govt-gold', at: '2026-10-05T17:00:00Z', media: () => jpg(get('gold_p-us-govt'), 'govt-gold'),
		text: `The US government holds ${f0(govt)} BTC.\n\nIn gold, that’s ${govtGold.big}${govtGold.unit === ' t' ? ' tonnes' : govtGold.unit}: ${govtGold.subs.join(' ').replace('A cube', 'a cube')}`,
		reply: 'Weigh the government’s coins in anything:\n' + L('preset=us-govt&commodity=gold') },
	{ id: 'etf-vs-strategy', at: '2026-10-05T21:30:00Z', media: () => pair('manhattan_p-blackrock-ibit', 'manhattan_p-strategy', 'etf-vs-strategy'),
		text: `${trailer} is ${f0(gap)} BTC behind ${leader}.\n\nSpent on Manhattan land at ${closeWord}’s close, that gap is ${gapLand.big}${gapLand.unit} of the island.`,
		reply: 'Load either holder and watch the lots fill:\n' + L('preset=blackrock-ibit&commodity=manhattan') },
];

await run(SLATE, OUT, `Mon 5 Oct · close ${close} ($${f0(px)}), previous ${prev}, week before ${prevWeek}`);
