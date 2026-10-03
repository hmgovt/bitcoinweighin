/**
 * Sat 3 Oct 2026 — "The strange ones". Launch week, day 4.
 * Weekend readers scroll for oddities: cocaine's markup, a glowing plutonium
 * cube, the chart gold fans post at us, and the Manhattan line. The new close
 * lands around 07:40–08:00 UTC, so the posts before 08:45 UTC are evergreen
 * (no closing-price figures) and are scheduled the evening before.
 * See lib.ts for how to run it.
 */
import { L, OZ, f0, images, loadPrices, nice, presetBtc, run, sig3, weekday, type Item } from './lib.ts';
import prices from '../../../src/lib/illustrative-prices.json';

const OUT = 'output/slates/2026-10-03';
const { P, close, prev, card } = await loadPrices();
const { get, jpg, pair, grid } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// ── Figures ──
const g = P[close].xau_per_btc, gDelta = g - P[prev].xau_per_btc;
const wi = { silver: card('silver', 1), manhattan: card('manhattan', 1), cocaine: card('cocaine', 1), pu238: card('pu238', 1) };
const tiers = (prices as unknown as { cocaine: { tiers: Record<'producer' | 'wholesale' | 'retail', { pricePerKg: number }> } }).cocaine.tiers;
const kg = (t: 'producer' | 'wholesale' | 'retail') => px / tiers[t].pricePerKg;
const kgText = (x: number) => (x >= 10 ? f0(x) : x.toFixed(1));
const markup = Math.round(tiers.retail.pricePerKg / tiers.producer.pricePerKg);
const otdCash = '2016-10-03', otdGold = '2022-10-03';
const PEAK = '2024-12-17';
const goldSincePeak = (P[close].xau_usd / P[PEAK].xau_usd - 1) * 100;
const btcSincePeak = (px / P[PEAK].btc_usd - 1) * 100;
const pct = (x: number) => `${x >= 0 ? 'up' : 'down'} ${Math.round(Math.abs(x))}%`;
const LINE = 1.74e12 / 21e6; // all 21M buy every developable lot in Manhattan (Barr, Smith & Kulkarni 2014)
const spacex = card('manhattan', presetBtc('spacex')!, 'spacex');
const fair = 21e6 / 8.2e9; // BTC per person, 8.2 billion people
const [fg, fc, fk, fm] = ['gold', 'cash', 'cocaine', 'manhattan'].map((c) => card(c, fair));

const SLATE: Item[] = [
	// Evergreen, scheduled the evening before.
	{ id: 'ev-perseverance', at: '2026-10-03T07:00:00Z',
		text: 'NASA’s Perseverance rover runs on the heat of 4.8 kg of plutonium dioxide.\n\nWe weigh bitcoin against plutonium-238 too, drawn at true scale.',
		reply: 'See what 1 BTC buys in Pu-238:\n' + L('btc=1&commodity=pu238') },
	{ id: 'ev-sats', at: '2026-10-03T08:00:00Z',
		text: 'There will only ever be 21 million bitcoin, and each one splits into 100 million sats.\n\nWe weigh any of it, from one sat to the whole supply.',
		reply: 'All 21 million, in gold:\n' + L('preset=market-cap&commodity=gold') },

	// On the new close.
	{ id: 'wi-gold', at: '2026-10-03T08:45:00Z', media: () => jpg(get('gold_b-1'), 'wi-gold'),
		text: `Today’s Weigh-In: 1 BTC = ${g.toFixed(1)} oz of gold.\n\n${card('gold', 1).subs[0]}\n\n${Math.abs(gDelta) < 0.05 ? 'Level with the day before.' : `${Math.abs(gDelta).toFixed(2)} oz ${gDelta > 0 ? 'more' : 'less'} than the day before.`}`,
		reply: 'Weigh any amount, any day since 2013:\n' + L('btc=1&commodity=gold') },
	{ id: 'otd-cash', at: '2026-10-03T09:30:00Z', media: () => pair(`cash_b-1_${otdCash}`, 'cash_b-1', 'otd-cash'),
		text: `${nice(otdCash)}: 1 BTC was $${f0(P[otdCash].btc_usd)}. In $1 bills, a stack ${card('cash', 1, undefined, otdCash).subs[0].replace('A stack ', '').replace(' tall.', '')} tall.\n\nToday: ${card('cash', 1).subs[0].replace('A stack ', '').replace(' tall.', '')}.`,
		reply: 'Slide the date yourself:\n' + L(`btc=1&commodity=cash&date=${otdCash}`) },
	{ id: 'wi-silver', at: '2026-10-03T11:00:00Z', media: () => jpg(get('silver_b-1'), 'wi-silver'),
		text: `Today’s Weigh-In: 1 BTC = ${f0(P[close].xag_per_btc)} oz of silver.\n\n${sig3((P[close].xag_per_btc * OZ) / 1000)} kg. ${wi.silver.subs[0]}`,
		reply: 'Weigh it yourself:\n' + L('btc=1&commodity=silver') },
	{ id: 'hero-markup', at: '2026-10-03T13:00:00Z', media: () => jpg(get('cocaine_b-1'), 'markup'),
		text: `What 1 BTC buys in cocaine depends on where you stand.\n\nWhere it’s made: ${kgText(kg('producer'))} kg.\nUS wholesale: ${kgText(kg('wholesale'))} kg.\nOn the street: ${kgText(kg('retail'))} kg.\n\nSame coin, a ${markup}× markup. (UNODC/DEA prices, illustrative.)`,
		reply: 'Switch price tiers on the cocaine tab:\n' + L('btc=1&commodity=cocaine') },
	{ id: 'spot-spacex', at: '2026-10-03T13:45:00Z', media: () => jpg(get('manhattan_p-spacex'), 'spot-spacex'),
		text: `SpaceX holds ${f0(presetBtc('spacex')!)} BTC.\n\nIn Manhattan land: ${spacex.big}${spacex.unit}${spacex.unit.includes('%') ? ' of the island' : ''}. ${spacex.subs[0]}`,
		reply: 'Watch SpaceX’s coins fill the island:\n' + L('preset=spacex&commodity=manhattan') },
	{ id: 'wi-cash', at: '2026-10-03T15:00:00Z', media: () => jpg(get('cash_b-1'), 'wi-cash'),
		text: `Today’s Weigh-In: 1 BTC = ${f0(px)} $1 bills.\n\n${card('cash', 1).subs[0]} ${card('cash', 1).subs[1]}`,
		reply: 'Stack any amount:\n' + L('btc=1&commodity=cash') },
	{ id: 'hero-plutonium', at: '2026-10-03T16:00:00Z', media: () => jpg(get('pu238_b-1'), 'plutonium'),
		text: `1 BTC buys about ${wi.pu238.big}${wi.pu238.unit} of plutonium-238: ${wi.pu238.subs[0].replace('A cube', 'a cube').replace(/\.$/, '')} that glows red with its own heat.\n\nDon’t drop it. (Illustrative price.)`,
		reply: 'Hear the Geiger counter on the site:\n' + L('btc=1&commodity=pu238') },
	{ id: 'fair-share', at: '2026-10-03T17:00:00Z', media: () => grid(['gold', 'cash', 'cocaine', 'manhattan'].map((c) => `commodity=${c}&btc=${fair}`), 'fair-share', close),
		text: `Split all 21 million bitcoin evenly across 8.2 billion people and each gets ${f0(fair * 1e8)} sats ($${f0(fair * px)}).\n\nGold: ${fg.big}${fg.unit}\nCash: ${fc.big} $1 bills\nCocaine (US wholesale): ${fk.big}${fk.unit}\nManhattan: ${fm.big}${fm.unit}`,
		reply: 'Weigh your share:\n' + L(`btc=${fair}&commodity=gold`) },
	{ id: 'wi-manhattan', at: '2026-10-03T18:15:00Z', media: () => jpg(get('manhattan_b-1'), 'wi-manhattan'),
		text: `Today’s Weigh-In: at ${closeWord}’s close of $${f0(px)}, 1 BTC = ${wi.manhattan.big}${wi.manhattan.unit} of Manhattan land.\n\nA doormat or three, at the Battery.`,
		reply: 'How far up the island does your stack get?\n' + L('btc=1&commodity=manhattan') },
	{ id: 'hero-downs', at: '2026-10-03T19:00:00Z', media: () => pair(`gold_b-1_${PEAK}`, 'gold_b-1', 'downs'),
		text: `The chart gold fans love.\n\n${nice(PEAK)}: 1 BTC bought ${P[PEAK].xau_per_btc.toFixed(1)} oz of gold.\n${closeWord}: ${g.toFixed(1)} oz.\n\nSince then gold is ${pct(goldSincePeak)} and bitcoin is ${pct(btcSincePeak)}. We weigh both ways.`,
		reply: 'Every day since 2013:\n' + L(`btc=1&commodity=gold&date=${PEAK}`) },
	{ id: 'ask', at: '2026-10-03T20:30:00Z',
		text: 'What should our next tab be?\n\nTungsten, Brent crude, hours of work at the median wage, or something better?', reply: '' },
	{ id: 'hero-line', at: '2026-10-03T22:00:00Z', media: () => jpg(get('manhattan_p-market-cap'), 'line'),
		text: `$${f0(LINE)}.\n\nAbove that price, all 21 million bitcoin could buy every lot in Manhattan. Below it, they can’t.\n\n${closeWord}’s close: $${f0(px)}. ${px >= LINE ? 'Above the line.' : 'Below the line.'}`,
		reply: 'See every lot fill up:\n' + L('preset=market-cap&commodity=manhattan') },
	{ id: 'otd-gold', at: '2026-10-04T00:30:00Z', media: () => pair(`gold_b-1_${otdGold}`, 'gold_b-1', 'otd-gold'),
		text: `${nice(otdGold)}: 1 BTC bought ${sig3(P[otdGold].xau_per_btc)} oz of gold.\n\nToday: ${g.toFixed(1)} oz.`,
		reply: 'Every day since 2013:\n' + L(`btc=1&commodity=gold&date=${otdGold}`) },
	{ id: 'wi-cocaine', at: '2026-10-04T01:30:00Z', media: () => jpg(get('cocaine_b-1'), 'wi-cocaine'),
		text: `Today’s Weigh-In: at ${closeWord}’s close of $${f0(px)}, 1 BTC = ${wi.cocaine.big}${wi.cocaine.unit} of cocaine at US wholesale (UNODC/DEA prices, illustrative).\n\nAbout ${Math.round(px / tiers.wholesale.pricePerKg)} taped one-kilo bricks.`,
		reply: 'Switch price tiers on the cocaine tab:\n' + L('btc=1&commodity=cocaine') },
];

await run(SLATE, OUT, `Sat 3 Oct · close ${close} ($${f0(px)}), previous ${prev}`);
