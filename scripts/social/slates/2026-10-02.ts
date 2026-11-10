/**
 * Fri 2 Oct 2026 — "Silk Road, 13 years on". Launch week, day 3.
 * The FBI shut Silk Road down on 2 Oct 2013; later that month it seized
 * 144,000 BTC from its founder. Then cash, the Moon ride re-share, and the
 * series. See lib.ts for how to run it.
 */
import { DATA, L, OZ, f0, images, loadPrices, nice, presetBtc, run, sig3, weekday, type Item } from './lib.ts';

const OUT = 'output/slates/2026-10-02';
const { P, close, prev, card } = await loadPrices();
const { get, jpg, pair, grid } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;
const NOTE_M = 0.10922e-3;
const MOON_M = 384_400_000;
const moonPrice = MOON_M / NOTE_M / 21e6;

// ── Figures ──
const g = P[close].xau_per_btc, gDelta = g - P[prev].xau_per_btc;
const wi = { silver: card('silver', 1), manhattan: card('manhattan', 1), cocaine: card('cocaine', 1), pu238: card('pu238', 1) };
const SILK = 144_000, silkGoldG = SILK * g * OZ;
const silkThen = SILK * P['2013-10-25'].btc_usd;
const otdCash = '2015-10-02', otdGold = '2021-10-02';
const ibit = card('gold', presetBtc('blackrock-ibit')!, 'blackrock-ibit');
const sat = presetBtc('satoshi')!;
const satSilver = card('silver', sat, 'satoshi');
const sats = 1_000_000, satsBtc = sats / 1e8;
const [sg, sc, sk, sm] = ['gold', 'cash', 'cocaine', 'manhattan'].map((c) => card(c, satsBtc));
const hundreds = Math.round(px / 100);
const goodBars = (21e6 * g) / 400;

const SLATE: Item[] = [
	{ id: 'wi-gold', at: '2026-10-02T08:45:00Z', media: () => jpg(get('gold_b-1'), 'wi-gold'),
		text: `Today’s Weigh-In: 1 BTC = ${g.toFixed(1)} oz of gold.\n\n${card('gold', 1).subs[0]}\n\n${Math.abs(gDelta) < 0.05 ? 'Level with the day before.' : `${Math.abs(gDelta).toFixed(2)} oz ${gDelta > 0 ? 'more' : 'less'} than the day before.`}`,
		reply: 'Weigh any amount, any day since 2013:\n' + L('btc=1&commodity=gold') },
	{ id: 'ev-pizza', at: '2026-10-02T08:00:00Z',
		text: 'On 22 May 2010, 10,000 BTC bought two pizzas.\n\nWe weigh what they’d buy now, every day: gold, cash, plutonium, cocaine, and Manhattan.',
		reply: 'The pizza coins, on Manhattan:\n' + L('preset=pizza-day&commodity=manhattan') },
	{ id: 'otd-cash', at: '2026-10-02T09:00:00Z', media: () => pair(`cash_b-1_${otdCash}`, 'cash_b-1', 'otd-cash'),
		text: `${nice(otdCash)}: 1 BTC was $${f0(P[otdCash].btc_usd)}. In $1 bills, a stack ${card('cash', 1, undefined, otdCash).subs[0].replace('A stack ', '').replace(' tall.', '')} tall.\n\nToday: ${card('cash', 1).subs[0].replace('A stack ', '').replace(' tall.', '')}.`,
		reply: 'Slide the date yourself:\n' + L(`btc=1&commodity=cash&date=${otdCash}`) },
	{ id: 'ev-satoshi-stack', at: '2026-10-02T10:00:00Z',
		text: `Satoshi’s coins have never moved.\n\nStacked as $1 bills at ${closeWord}’s close, they’d reach ${f0((sat * px * NOTE_M) / 1000)} km up. The International Space Station orbits at about 400.`,
		reply: 'Ride up Satoshi’s stack (it starts by itself):\n' + L('preset=satoshi&commodity=cash&ride=play') },
	{ id: 'wi-silver', at: '2026-10-02T11:00:00Z', media: () => jpg(get('silver_b-1'), 'wi-silver'),
		text: `Today’s Weigh-In: 1 BTC = ${f0(P[close].xag_per_btc)} oz of silver.\n\n${sig3((P[close].xag_per_btc * OZ) / 1000)} kg. ${wi.silver.subs[0]}`,
		reply: 'Weigh it yourself:\n' + L('btc=1&commodity=silver') },
	{ id: 'hero-silkroad', at: '2026-10-02T12:30:00Z', media: () => jpg(get('gold_b-144000'), 'silkroad'),
		text: `13 years ago today, the FBI shut down Silk Road. That month it seized 144,000 BTC from its founder, then worth about $${Math.round(silkThen / 1e6)} million.\n\nAt ${closeWord}’s close: $${(SILK * px / 1e9).toFixed(1)} billion. In gold, a ${f0(silkGoldG / 1e6)}-tonne cube ${(Math.cbrt(silkGoldG / 19.32) / 100).toFixed(2)} m on each side.`,
		reply: 'Weigh the seized coins yourself:\n' + L('btc=144000&commodity=gold') },
	{ id: 'spot-ibit', at: '2026-10-02T13:15:00Z', media: () => jpg(get('gold_p-blackrock-ibit'), 'spot-ibit'),
		text: `BlackRock’s bitcoin ETF holds ${f0(presetBtc('blackrock-ibit')!)} BTC.\n\nIn gold: ${ibit.big}${ibit.unit}. ${ibit.subs.join(' ')}`,
		reply: 'Load any big holder:\n' + L('preset=blackrock-ibit&commodity=gold') },
	{ id: 'ev-good-delivery', at: '2026-10-02T14:30:00Z',
		text: `A London Good Delivery gold bar holds about 400 troy ounces: 12.4 kg.\n\nAll 21 million bitcoin would buy about ${(goodBars / 1e6).toFixed(2)} million of them today.`,
		reply: 'Weigh all 21 million in gold:\n' + L('preset=market-cap&commodity=gold') },
	{ id: 'hero-cash-brick', at: '2026-10-02T15:00:00Z', media: () => jpg(get('cash_b-1'), 'cash-brick'),
		text: `1 BTC in cash.\n\nIn $1 bills: ${f0(px)} notes, a stack ${card('cash', 1).subs[0].replace('A stack ', '').replace(' tall.', '')} tall.\nIn $100 bills: ${f0(hundreds)} notes, a brick ${(hundreds * NOTE_M * 100).toFixed(1)} cm tall that weighs less than a bag of sugar.`,
		reply: 'Stack any amount:\n' + L('btc=1&commodity=cash') },
	{ id: 'sats', at: '2026-10-02T16:15:00Z', media: () => grid(['gold', 'cash', 'cocaine', 'manhattan'].map((c) => `commodity=${c}&btc=${satsBtc}`), 'sats', close),
		text: `What ${f0(sats)} sats ($${f0(satsBtc * px)}) buys:\n\nGold: ${sg.big}${sg.unit}\nCash: ${sc.big} $1 bills\nCocaine (US wholesale): ${sk.big}${sk.unit}\nManhattan: ${sm.big}${sm.unit}`,
		reply: 'Try your own stack of sats:\n' + L(`btc=${satsBtc}&commodity=gold`) },
	{ id: 'hero-moonride', at: '2026-10-02T17:30:00Z', media: () => 'output/clips/ride-market-cap-music.mp4',
		text: `All 21 million bitcoin in $1 bills, stacked on the ground.\n\nWe took the elevator.\n\nAt ${closeWord}’s close it gets ${((px / moonPrice) * 100).toFixed(1)}% of the way to the Moon. At $${f0(moonPrice)} a coin, it arrives.`,
		reply: 'Ride it yourself, it starts by itself:\n' + L('preset=market-cap&commodity=cash&ride=play') },
	{ id: 'spot-satoshi', at: '2026-10-02T18:30:00Z', media: () => jpg(get('silver_p-satoshi'), 'spot-satoshi'),
		text: `Satoshi’s coins, untouched since 2010: ${f0(sat)} BTC.\n\nIn silver: ${satSilver.big}${satSilver.unit}. ${satSilver.subs[0]}`,
		reply: 'Weigh Satoshi’s coins in anything:\n' + L('preset=satoshi&commodity=silver') },
	{ id: 'wi-manhattan', at: '2026-10-02T19:15:00Z', media: () => jpg(get('manhattan_b-1'), 'wi-manhattan'),
		text: `Today’s Weigh-In: 1 BTC = ${wi.manhattan.big}${wi.manhattan.unit} of Manhattan land.\n\nA doormat or three, at the Battery.`,
		reply: 'How far up the island does your stack get?\n' + L('btc=1&commodity=manhattan') },
	{ id: 'ask', at: '2026-10-02T21:45:00Z',
		text: 'If you could pin just one of our visuals, which would it be?\n\nThe Moon ride, the Manhattan map, or the glowing plutonium cube?', reply: '' },
	{ id: 'otd-gold', at: '2026-10-03T00:30:00Z', media: () => pair(`gold_b-1_${otdGold}`, 'gold_b-1', 'otd-gold'),
		text: `${nice(otdGold)}: 1 BTC bought ${sig3(P[otdGold].xau_per_btc)} oz of gold.\n\nToday: ${g.toFixed(1)} oz.`,
		reply: 'Every day since 2013:\n' + L(`btc=1&commodity=gold&date=${otdGold}`) },
	{ id: 'wi-cocaine', at: '2026-10-03T01:30:00Z', media: () => jpg(get('cocaine_b-1'), 'wi-cocaine'),
		text: `Today’s Weigh-In: 1 BTC = ${wi.cocaine.big}${wi.cocaine.unit} of cocaine at US wholesale (UNODC/DEA prices, illustrative).\n\nAbout ${Math.round(px / 30000)} taped one-kilo bricks.`,
		reply: 'Switch price tiers on the cocaine tab:\n' + L('btc=1&commodity=cocaine') },
	{ id: 'wi-pu238', at: '2026-10-03T02:30:00Z', media: () => jpg(get('pu238_b-1'), 'wi-pu238'),
		text: `Today’s Weigh-In: 1 BTC = ${wi.pu238.big}${wi.pu238.unit} of plutonium-238 (illustrative price).\n\n${wi.pu238.subs[0].replace('A cube', 'A glowing cube')}`,
		reply: 'Hear the Geiger counter:\n' + L('btc=1&commodity=pu238') },
];

await run(SLATE, OUT, `Fri 2 Oct · close ${close} ($${f0(px)}), previous ${prev} · data ${DATA ? 'ok' : ''}`);
