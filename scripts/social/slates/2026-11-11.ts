/**
 * Wed 11 Nov 2026: three posts, written to scripts/social/WRITING.md.
 * El Salvador's bitcoin in gold against its central bank's own gold (tribal),
 * a NEW video: the 10,000 pizza coins stacked in $1 bills and ridden up, and
 * Strategy's coins in silver against a whole year of the world's silver
 * demand. Third video of the week (Mon, Tue, Wed). Live figures. See lib.ts
 * for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, type Item } from './lib.ts';

const OUT = 'output/slates/2026-11-11';
const { P, close, prev, card } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// El Salvador's bitcoin in gold against the central bank's gold: 67,403 troy oz after its
// January 2026 purchase (Banco Central de Reserva, reported 29 Jan 2026).
const BCR_OZ = 67_403;
const sv = presetBtc('el-salvador')!;
const svOz = sv * P[close].xau_per_btc;
const svTimes = svOz / BCR_OZ;

// The 10,000 pizza coins in $1 bills (0.10922 mm a note) against Everest, 8,849 m.
// Quoted at the video's own close (9 Nov), so the text and the clip agree.
const VID = '2026-11-09';
const EVEREST_KM = 8.849;
const pizza = presetBtc('pizza-day')!;
const pizzaKm = (pizza * P[VID].btc_usd * 0.10922) / 1e6;

// Strategy's coins in silver against world silver demand: 1.16 billion oz in 2024
// (Silver Institute, World Silver Survey 2025).
const DEMAND_OZ = 1.16e9;
const strategy = presetBtc('strategy')!;
const stratOz = strategy * P[close].xag_per_btc;
const demandPct = (stratOz / DEMAND_OZ) * 100;
const stratCard = card('silver', strategy, 'strategy');

const SLATE: Item[] = [
	{ id: 'el-salvador-btc-vs-gold', at: '2026-11-11T13:30:00Z', media: () => jpg(get('gold_p-el-salvador'), 'el-salvador-gold'),
		text: `El Salvador holds bitcoin and gold.\n\nIts central bank owns 67,403 ounces of gold. Its ${f0(sv)} bitcoin, swapped for gold at ${closeWord}’s close: ${f0(Math.round(svOz / 1000) * 1000)} ounces.\n\nThe coins are worth about ${svTimes.toFixed(1)} times the gold. Which would you keep?`,
		reply: 'Central bank gold: 67,403 troy oz after its January 2026 purchase (Banco Central de Reserva). Weigh any holder in gold:\n' + L('preset=el-salvador&commodity=gold') },
	{ id: 'pizza-ride', at: '2026-11-11T17:00:00Z', media: () => 'scripts/social/media/ride-pizza.mp4',
		text: `On 22 May 2010, 10,000 bitcoin bought two pizzas.\n\nWe changed the same coins into $1 bills at ${weekday(VID)}’s close, stacked them, and rode to the top.\n\n${f0(pizzaKm)} km up (${(pizzaKm / 1.609344).toFixed(1)} miles): about ${(pizzaKm / EVEREST_KM).toFixed(1)} times the height of Everest.`,
		reply: 'Every note true to scale, 0.11 mm thick; Everest is 8,849 m. Ride it yourself:\n' + L('preset=pizza-day&commodity=cash&ride=play') },
	{ id: 'strategy-silver-demand', at: '2026-11-11T21:30:00Z', media: () => jpg(get('silver_p-strategy'), 'strategy-silver'),
		text: `In 2024 the world used about 1.16 billion ounces of silver: solar panels, electronics, jewellery, coins.\n\nStrategy’s ${f0(strategy)} bitcoin, swapped for silver at ${closeWord}’s close: ${(stratOz / 1e9).toFixed(2)} billion ounces.\n\nThat’s ${demandPct >= 100 ? 'more than' : `${demandPct.toFixed(0)}% of`} a whole year of the world’s silver. One company.`,
		reply: `${stratCard.big}${stratCard.unit} of silver, against 2024 demand of 1.16 billion oz (Silver Institute, World Silver Survey 2025). Weigh any holder in silver:\n` + L('preset=strategy&commodity=silver') },
];

await run(SLATE, OUT, `Wed 11 Nov · close ${close} ($${f0(px)}), previous ${prev}`);
