/**
 * Sat 21 Nov 2026: three posts, written to scripts/social/WRITING.md.
 * BlackRock's bitcoin ETF in oil against America's Strategic Petroleum
 * Reserve (tribal), El Salvador's bitcoin in gold against its own central
 * bank's gold, and Strategy's coins in $1 bills stacked, then tipped over the
 * Atlantic from London towards New York. No video: this week already has three
 * (Mon, Tue, Wed). Live figures. See lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, type Item } from './lib.ts';

const OUT = 'output/slates/2026-11-21';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// BlackRock's ETF coins in Brent against the US Strategic Petroleum Reserve:
// 279.5 million barrels in the week to 6 Nov 2026 (EIA weekly petroleum data).
const SPR_MBBL = 279.5;
const ibit = presetBtc('blackrock-ibit')!;
const ibitMbbl = (ibit * P[close].brent_per_btc) / 1e6;

// El Salvador's coins in gold against its central bank's gold: 67,403 oz after
// the January 2026 purchase (Banco Central de Reserva, as reported).
const BCR_OZ = 67_403;
const sv = presetBtc('el-salvador')!;
const svOz = sv * P[close].xau_per_btc;

// Strategy's coins in $1 bills (0.10922 mm and about 1 g a note) against
// London to New York, about 5,570 km great-circle.
const LON_NY_KM = 5570;
const strategy = presetBtc('strategy')!;
const notes = strategy * px;
const stKm = (notes * 0.10922) / 1e6;
const r10 = (n: number) => f0(Math.round(n / 10) * 10);

const SLATE: Item[] = [
	{ id: 'ibit-oil-vs-spr', at: '2026-11-21T13:30:00Z', media: () => jpg(get('oil_p-blackrock-ibit'), 'ibit-oil'),
		text: `America’s emergency oil stockpile, the Strategic Petroleum Reserve, holds about ${f0(SPR_MBBL)} million barrels.\n\nBlackRock’s bitcoin ETF holds ${f0(ibit)} coins. Swapped for Brent at ${closeWord}’s close: ${f0(ibitMbbl)} million barrels.\n\nThat’s ${(ibitMbbl / SPR_MBBL).toFixed(1)} times the reserve. Which would you want in a crisis?`,
		reply: `SPR: 279.5 million barrels, week to 6 Nov 2026 (EIA). Brent $${P[close].brent_usd.toFixed(2)} a barrel. Weigh any holder in oil:\n` + L('preset=blackrock-ibit&commodity=oil') },
	{ id: 'el-salvador-gold-vs-bcr', at: '2026-11-21T17:00:00Z', media: () => jpg(get('gold_p-el-salvador'), 'el-salvador-gold'),
		text: `El Salvador’s central bank has been buying gold. At last report it held ${f0(BCR_OZ)} ounces.\n\nThe country’s ${f0(sv)} bitcoin, swapped for gold at ${closeWord}’s close: ${f0(svOz)} ounces.\n\nThat’s ${Math.abs(svOz / BCR_OZ - 2) < 0.05 ? `twice` : `about ${(svOz / BCR_OZ).toFixed(1)} times`} the gold in the vault. Which reserve is pulling its weight?`,
		reply: `Central bank gold: 67,403 oz after its January 2026 purchase (Banco Central de Reserva). Gold $${f0(P[close].xau_usd)} an ounce. Weigh any holder in gold:\n` + L('preset=el-salvador&commodity=gold') },
	{ id: 'strategy-cash-atlantic', at: '2026-11-21T21:30:00Z', media: () => jpg(get('cash_p-strategy'), 'strategy-cash'),
		text: `Strategy holds ${f0(strategy)} bitcoin, the biggest company stack. Changed into $1 bills at ${closeWord}’s close: ${(notes / 1e9).toFixed(1)} billion notes.\n\nStack them in one column: ${r10(stKm)} km.\n\nTip it over at London and it ${stKm >= LON_NY_KM ? `lands past New York, ${r10(stKm - LON_NY_KM)} km inland` : `falls ${r10(LON_NY_KM - stKm)} km short of New York`}. A bridge of paper money?`,
		reply: `London to New York is about 5,570 km as the crow flies. Each note is 0.11 mm thick; the pile weighs about ${f0(notes / 1e6 / 1000)} thousand tonnes. Stack any holder:\n` + L('preset=strategy&commodity=cash') },
];

await run(SLATE, OUT, `Sat 21 Nov · close ${close} ($${f0(px)}), previous ${prev}`);
