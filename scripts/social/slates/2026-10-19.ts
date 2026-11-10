/**
 * Mon 19 Oct 2026: three posts, written to scripts/social/WRITING.md. El
 * Salvador's bitcoin against its own central bank's gold (tribal: Bukele buys
 * both), Satoshi against Strategy on Manhattan (whose coins buy more, by how many
 * blocks), and one coin in $100 bills against $1 bills (same money, different
 * size). Live figures. See lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, type Item } from './lib.ts';
import { landM2, LAND_YARDSTICKS } from '../../../src/lib/manhattan.ts';

const OUT = 'output/slates/2026-10-19';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// El Salvador's bitcoin in gold against the central bank's own gold: 67,403 troy oz after its
// January 2026 purchase (Banco Central de Reserva).
const sv = presetBtc('el-salvador')!;
const svOz = sv * P[close].xau_per_btc;
const BCR_OZ = 67_403;

// Satoshi against Strategy on Manhattan land, the gap in Midtown blocks (200 × 800 ft).
const sat = presetBtc('satoshi')!, strategy = presetBtc('strategy')!;
const BLOCK_M2 = LAND_YARDSTICKS.find((y) => y.label === 'a Midtown block')!.m2;
const blocks = (landM2(sat, px) - landM2(strategy, px)) / BLOCK_M2;

// One coin in notes: $100 and $1 bills are both 0.10922 mm thick.
const notes100 = Math.round(px / 100);
const cm100 = (notes100 * 0.10922) / 10;
const m1 = (px * 0.10922) / 1000;

const SLATE: Item[] = [
	{ id: 'el-salvador-gold-vs-btc', at: '2026-10-19T13:30:00Z', media: () => jpg(get('gold_p-el-salvador'), 'el-salvador-gold'),
		text: `El Salvador buys gold too.\n\nIts central bank reported ${f0(BCR_OZ)} oz of gold after buying more in January.\n\nIts ${f0(sv)} bitcoin, at ${closeWord}’s close, would buy ${f0(Math.round(svOz / 1000) * 1000)} oz: ${(svOz / BCR_OZ).toFixed(1)} times the gold in the vault.\n\nWhich would you rather the country held more of?`,
		reply: 'Gold: Banco Central de Reserva, after its January 2026 purchase. Weigh any country’s stack:\n' + L('preset=el-salvador&commodity=gold') },
	{ id: 'satoshi-vs-strategy-manhattan', at: '2026-10-19T17:00:00Z', media: () => jpg(get('manhattan_p-satoshi'), 'satoshi-manhattan'),
		text: `Satoshi: ${f0(sat)} bitcoin, never moved.\nStrategy: ${f0(strategy)}, and still buying.\n\nSpend both on Manhattan land at ${closeWord}’s close.\n\nSatoshi still wins, by ${Math.round(blocks)} Midtown blocks. How long until Saylor catches up?`,
		reply: 'Land at its 2014 value ($1.74T), spread evenly, so it’s illustrative. Race any two stacks:\n' + L('preset=satoshi&commodity=manhattan') },
	{ id: 'one-coin-hundreds-vs-ones', at: '2026-10-19T21:30:00Z', media: () => jpg(get('cash_b-1'), 'one-coin-cash'),
		text: `One bitcoin, in cash.\n\nIn $100 bills: ${f0(notes100)} notes, a stack ${cm100.toFixed(1)} cm tall. It fits in a jacket pocket.\n\nIn $1 bills: ${f0(px)} notes, ${m1.toFixed(1)} m tall. Taller than a three-storey house.\n\nSame money. Which would you rather carry through an airport?`,
		reply: 'Every note true to scale, 0.11 mm thick. Stack any amount:\n' + L('btc=1&commodity=cash') },
];

await run(SLATE, OUT, `Mon 19 Oct · close ${close} ($${f0(px)}), previous ${prev}`);
