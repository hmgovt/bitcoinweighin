/**
 * Tue 6 Oct 2026: three posts, the first day posted by hand from Discord.
 * 2026 so far weighed in gold (a round trip that both camps can argue over),
 * El Salvador's coins stacked in $1 bills, and gold against silver at 1 BTC:
 * the same money at 67 times the weight. See lib.ts for how to run it.
 */
import { L, OZ, f0, images, loadPrices, nice, presetBtc, sig3, run, weekday, type Item } from './lib.ts';

const OUT = 'output/slates/2026-10-06';
const { P, close, prev, card } = await loadPrices();
const { get, pair } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;
const pct = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}%`;

// The year so far: last year's final close against the latest, and the low in gold between.
const YE = '2025-12-31';
const ytd = (k: 'btc_usd' | 'xau_usd' | 'xag_usd') => P[close][k] / P[YE][k] - 1;
const low = Object.keys(P).filter((d) => d > YE && d <= close && P[d].xau_per_btc).sort((a, b) => P[a].xau_per_btc - P[b].xau_per_btc)[0];
const lowMonth = new Date(low + 'T12:00:00Z').toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });

// El Salvador's coins as a stack of $1 bills (0.10922 mm a note), against the edge of space.
const sv = presetBtc('el-salvador')!;
const svKm = (sv * px * 0.10922e-3) / 1000;
const svWhere = svKm >= 100 ? 'Past the edge of space (100 km).'
	: svKm >= 50 ? `Out of the stratosphere, ${Math.round(svKm)}% of the way to space.`
	: `${Math.round(svKm)}% of the way to space.`;

// 1 BTC in gold and in silver: same money, the gold/silver ratio in weight.
const gold = card('gold', 1), silver = card('silver', 1);
const goldG = P[close].xau_per_btc * OZ, silverKg = (P[close].xag_per_btc * OZ) / 1000;
const ratio = P[close].xau_usd / P[close].xag_usd;

const SLATE: Item[] = [
	{ id: 'year-in-gold', at: '2026-10-06T13:30:00Z', media: () => pair(`gold_b-1_${YE}`, 'gold_b-1', 'year-in-gold'),
		text: `2026 so far, in dollars: bitcoin ${pct(ytd('btc_usd'))}, gold ${pct(ytd('xau_usd'))}, silver ${pct(ytd('xag_usd'))}.\n\nWeighed in gold, 1 BTC went from ${P[YE].xau_per_btc.toFixed(1)} oz on ${nice(YE).replace(/ \d{4}$/, '')} to ${P[close].xau_per_btc.toFixed(1)} oz at ${closeWord}’s close. In ${lowMonth} it sank to ${P[low].xau_per_btc.toFixed(1)} oz.\n\nNine months, one round trip.`,
		reply: 'Slide the date yourself:\n' + L(`btc=1&commodity=gold&date=${YE}`) },
	{ id: 'el-salvador-stack', at: '2026-10-06T17:00:00Z', media: () => get('cash_p-el-salvador'),
		text: `El Salvador buys about one bitcoin a day.\n\nIts ${f0(sv)} BTC, stacked in $1 bills: ${sig3(svKm)} km tall. ${svWhere}`,
		reply: 'Ride El Salvador’s stack up (it starts by itself):\n' + L('preset=el-salvador&commodity=cash&ride=play') },
	{ id: 'gold-vs-silver', at: '2026-10-06T21:30:00Z', media: () => pair('gold_b-1', 'silver_b-1', 'gold-vs-silver'),
		text: `Same money, two metals.\n\n1 BTC in gold: ${P[close].xau_per_btc.toFixed(1)} oz, ${f0(goldG)} g. ${gold.subs[0].replace(/\.$/, '')}. It fits in a pocket.\n\n1 BTC in silver: ${f0(P[close].xag_per_btc)} oz, ${sig3(silverKg)} kg. ${silver.subs[0].replace(/\.$/, '')}. Bring a trolley.\n\nThat’s the gold/silver ratio: ${Math.round(ratio)} to 1.`,
		reply: 'Weigh it in either:\n' + L('btc=1&commodity=silver') },
];

await run(SLATE, OUT, `Tue 6 Oct · close ${close} ($${f0(px)}), previous ${prev}, year end ${YE}, gold low ${low}`);
