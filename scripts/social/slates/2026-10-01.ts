/**
 * Thu 1 Oct 2026 — "Uptober, since 2013". Launch week, day 2.
 * See lib.ts for how to run it. The data-page screenshot (data-page.png) was
 * taken by hand from a local build; the Uptober chart is rendered here.
 */
import { execFileSync } from 'node:child_process';
import { DATA, L, OZ, f0, images, loadPrices, nice, presetBtc, run, sig3, weekday, type Item } from './lib.ts';

const OUT = 'output/slates/2026-10-01';
const { P, close, prev, card } = await loadPrices();
const { get, jpg, pair, grid } = images(OUT);
const closeWord = weekday(close);
const uptober = () => {
	execFileSync('curl', ['-sfS', '--max-time', '60', '-o', `${OUT}/data-prices.json`, 'https://bitcoinweighin.com/data/prices.json']);
	execFileSync('npx', ['tsx', 'scripts/social/charts/uptober.ts', `${OUT}/data-prices.json`, `${OUT}/uptober.png`]);
	return `${OUT}/uptober.png`;
};

// ── Figures ──
const g = P[close].xau_per_btc, gPrev = P[prev].xau_per_btc;
const gDelta = g - gPrev;
const wi = {
	gold: card('gold', 1), silver: card('silver', 1), cash: card('cash', 1),
	manhattan: card('manhattan', 1), cocaine: card('cocaine', 1), pu238: card('pu238', 1),
};
const g2013 = P['2013-01-02'].xau_per_btc * OZ; // grams
const notes2013 = P['2013-01-02'].btc_usd;
const otdCash = '2014-10-01', otdGold = '2020-10-01';
const govt = card('cash', presetBtc('us-govt')!, 'us-govt');
const pizzaPu = card('pu238', 10000, 'pizza-day');
const sats = 100_000, satsBtc = sats / 1e8;
const sg = card('gold', satsBtc), sc = card('cash', satsBtc), sk = card('cocaine', satsBtc), sm = card('manhattan', satsBtc);

const SLATE: Item[] = [
	{ id: 'wi-gold', at: '2026-10-01T12:05:00Z', media: () => jpg(get('gold_b-1'), 'wi-gold'),
		text: `Today’s Weigh-In: 1 BTC = ${g.toFixed(1)} oz of gold.\n\n${wi.gold.subs[0]}\n\n${Math.abs(gDelta) < 0.05 ? 'Level with the day before.' : `${Math.abs(gDelta).toFixed(2)} oz ${gDelta > 0 ? 'more' : 'less'} than the day before.`}`,
		reply: 'Weigh any amount, any day since 2013:\n' + L('btc=1&commodity=gold') },
	{ id: 'ev-first-price', at: '2026-10-01T22:00:00Z',
		text: `The first bitcoin price in our dataset: $13.28, on 2 January 2013.\n\nIn $1 bills, a stack 1.5 mm tall.`,
		reply: 'Start there and press play:\n' + L('btc=1&commodity=cash&date=2013-01-02') },
	{ id: 'otd-cash', at: '2026-10-01T14:00:00Z', media: () => pair(`cash_b-1_${otdCash}`, 'cash_b-1', 'otd-cash'),
		text: `${nice(otdCash)}: 1 BTC was $${f0(P[otdCash].btc_usd)}. In $1 bills, a stack ${card('cash', 1, undefined, otdCash).subs[0].replace('A stack ', '').replace(' tall.', '')} tall.\n\nToday: ${wi.cash.subs[0].replace('A stack ', '').replace(' tall.', '')}.`,
		reply: 'Slide the date yourself:\n' + L(`btc=1&commodity=cash&date=${otdCash}`) },
	{ id: 'ev-moon', at: '2026-10-01T16:45:00Z',
		text: 'At $167,595 a coin, all 21 million bitcoin stacked as $1 bills would reach the Moon.\n\nEvery bill is 0.109 mm thick. We did the maths.',
		reply: 'Ride the stack (it starts by itself):\n' + L('preset=market-cap&commodity=cash&ride=play') },
	{ id: 'wi-silver', at: '2026-10-01T14:30:00Z', media: () => jpg(get('silver_b-1'), 'wi-silver'),
		text: `Today’s Weigh-In: 1 BTC = ${f0(P[close].xag_per_btc)} oz of silver.\n\n${sig3((P[close].xag_per_btc * OZ) / 1000)} kg. ${wi.silver.subs[0]}`,
		reply: 'Weigh it yourself:\n' + L('btc=1&commodity=silver') },
	{ id: 'hero-uptober', at: '2026-10-01T12:30:00Z', media: () => jpg(uptober(), 'uptober'),
		text: 'Uptober, checked against 13 years of our data.\n\nOctober since 2013: up in 10 of 13 years.\nBest: +50.6% (2017).\nWorst: −11.9% (2014).\nLast year: −4.1%.',
		reply: 'Every daily close since 2013, free to download:\n' + DATA },
	{ id: 'spot-govt', at: '2026-10-01T13:15:00Z', media: () => jpg(get('cash_p-us-govt'), 'spot-govt'),
		text: `The US government holds ${f0(presetBtc('us-govt')!)} BTC.\n\nStacked in $1 bills: ${govt.subs[0].replace('In $1 bills: a stack ', '').replace(' tall.', '')} tall. ${govt.big}${govt.unit} ${govt.mid}.`,
		reply: 'Load any big holder:\n' + L('preset=us-govt&commodity=cash') },
	{ id: 'hero-gold-2013', at: '2026-10-01T15:00:00Z', media: () => pair('gold_b-1_2013-01-02', 'gold_b-1', 'gold-2013'),
		text: `1 BTC in gold.\n\n2 January 2013: ${sig3(g2013)} g. A few flakes.\n${closeWord}: ${f0(g * OZ)} g. A cube you can close your hand around.`,
		reply: 'Start in 2013 and press play:\n' + L('btc=1&commodity=gold&date=2013-01-02') },
	{ id: 'wi-cash', at: '2026-10-01T15:45:00Z', media: () => jpg(get('cash_b-1'), 'wi-cash'),
		text: `Today’s Weigh-In: 1 BTC = ${f0(P[close].btc_usd)} $1 bills.\n\n${wi.cash.subs[0]} ${wi.cash.subs[1]}`,
		reply: 'Stack any amount:\n' + L('btc=1&commodity=cash') },
	{ id: 'sats', at: '2026-10-01T16:15:00Z', media: () => grid(['gold', 'cash', 'cocaine', 'manhattan'].map((c) => `commodity=${c}&btc=${satsBtc}`), 'sats', close),
		text: `What ${f0(sats)} sats ($${f0(satsBtc * P[close].btc_usd)}) buys:\n\nGold: ${sg.big}${sg.unit}\nCash: ${sc.big} $1 bills\nCocaine (US wholesale): ${sk.big}${sk.unit}\nManhattan: ${sm.big}${sm.unit}`,
		reply: 'Try your own stack of sats:\n' + L(`btc=${satsBtc}&commodity=gold`) },
	{ id: 'hero-cash-2013', at: '2026-10-01T17:30:00Z', media: () => pair('cash_b-1_2013-01-02', 'cash_b-1', 'cash-2013'),
		text: `13 years of bitcoin, in $1 bills.\n\nOne coin: ${f0(notes2013)} notes in January 2013.\n${f0(P[close].btc_usd)} notes today. ${wi.cash.subs[0]}`,
		reply: 'Scrub through any date yourself:\n' + L('btc=1&commodity=cash&date=2013-01-02') },
	{ id: 'spot-pizza', at: '2026-10-01T18:30:00Z', media: () => jpg(get('pu238_p-pizza-day'), 'spot-pizza'),
		text: `In 2010, two pizzas cost 10,000 BTC.\n\nIn plutonium-238, at our illustrative price, that’s ${pizzaPu.big}${pizzaPu.unit}. ${pizzaPu.subs[0]} It glows.`,
		reply: 'Weigh the pizza coins in anything:\n' + L('preset=pizza-day&commodity=pu238') },
	{ id: 'wi-manhattan', at: '2026-10-01T19:15:00Z', media: () => jpg(get('manhattan_b-1'), 'wi-manhattan'),
		text: `Today’s Weigh-In: 1 BTC = ${wi.manhattan.big}${wi.manhattan.unit} of Manhattan land.\n\nA doormat or three, at the Battery.`,
		reply: 'How far up the island does your stack get?\n' + L('btc=1&commodity=manhattan') },
	{ id: 'hero-data', at: '2026-10-01T20:30:00Z', media: () => jpg(`${OUT}/data-page.png`, 'data-page'),
		text: 'Every number we post comes from an open dataset: bitcoin priced daily in gold, silver and Brent crude since 2013.\n\nCSV, Parquet or JSON. Free to use under CC-BY-4.0.',
		reply: 'Download it here:\n' + DATA },
	{ id: 'ask', at: '2026-10-01T21:45:00Z',
		text: 'What’s the strangest thing you’d weigh a bitcoin against?\n\nBest answer gets built.', reply: '' },
	{ id: 'ev-dollar', at: '2026-10-01T22:30:00Z',
		text: 'Every $1 bill is 0.109 mm thick and weighs about a gram.\n\nThat’s all it takes to stack bitcoin, from a coin to the Moon.',
		reply: 'Stack any amount:\n' + L('btc=1&commodity=cash') },
	{ id: 'hero-oil', at: '2026-10-01T23:30:00Z',
		text: `In January 2013, 1 BTC bought about one jerrycan of Brent crude: ${sig3(P['2013-01-02'].brent_per_btc)} barrels, ${f0(P['2013-01-02'].brent_per_btc * 159)} litres.\n\nAt ${closeWord}’s close it bought ${f0(P[close].brent_per_btc)} barrels.`,
		reply: 'The oil series is in the free dataset:\n' + DATA },
	{ id: 'otd-gold', at: '2026-10-02T00:30:00Z', media: () => pair(`gold_b-1_${otdGold}`, 'gold_b-1', 'otd-gold'),
		text: `${nice(otdGold)}: 1 BTC bought ${sig3(P[otdGold].xau_per_btc)} oz of gold.\n\nToday: ${g.toFixed(1)} oz.`,
		reply: 'Every day since 2013:\n' + L(`btc=1&commodity=gold&date=${otdGold}`) },
	{ id: 'wi-cocaine', at: '2026-10-02T01:30:00Z', media: () => jpg(get('cocaine_b-1'), 'wi-cocaine'),
		text: `Today’s Weigh-In: 1 BTC = ${wi.cocaine.big}${wi.cocaine.unit} of cocaine at US wholesale (UNODC/DEA prices, illustrative).\n\nAbout ${Math.round((P[close].btc_usd / 30000))} taped one-kilo bricks.`,
		reply: 'Switch price tiers on the cocaine tab:\n' + L('btc=1&commodity=cocaine') },
	{ id: 'wi-pu238', at: '2026-10-02T02:30:00Z', media: () => jpg(get('pu238_b-1'), 'wi-pu238'),
		text: `Today’s Weigh-In: 1 BTC = ${wi.pu238.big}${wi.pu238.unit} of plutonium-238 (illustrative price).\n\n${wi.pu238.subs[0].replace('A cube', 'A glowing cube')}`,
		reply: 'Hear the Geiger counter:\n' + L('btc=1&commodity=pu238') },
];


await run(SLATE, OUT, `Thu 1 Oct · close ${close} ($${f0(P[close].btc_usd)}), previous ${prev}`);
