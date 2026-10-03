/**
 * facts.ts — the fact sheet a reply draft may draw on: today's figures from
 * the live site, the holders' stacks, checked reference facts, and figures
 * worked out from numbers in the post itself (a price, a dollar amount).
 *
 * Every number in a draft must trace back to this sheet or the post
 * (validate.ts checks), so a draft can be clever but never make things up.
 */
import { readFile } from 'node:fs/promises';
import { L, OZ, f0, loadPrices, presetBtc, sig3 } from '../social/slates/lib.ts';

export interface FactSheet { lines: string[]; links: Record<string, string> }

const NOTE_M = 0.10922e-3, MOON_KM = 384_400, PEAK = '2024-12-17';
const GOLD_DENSITY = 19.3;
const cubeCm = (oz: number) => Math.cbrt((oz * OZ) / GOLD_DENSITY);
const tonnes = (oz: number) => (oz * OZ) / 1e6;
const usd = (n: number) => n >= 1e12 ? `$${sig3(n / 1e12)} trillion` : n >= 1e9 ? `$${sig3(n / 1e9)} billion` : n >= 1e6 ? `$${sig3(n / 1e6)} million` : `$${f0(n)}`;

let shared: Promise<FactSheet> | null = null;

/** The day's sheet, the same for every post in a run. */
export function dailyFacts(): Promise<FactSheet> {
	return (shared ??= build());
}

async function build(): Promise<FactSheet> {
	const { P, close, prev, card } = await loadPrices();
	// prices.json carries more than lib.ts's Row type names.
	const day = P[close] as typeof P[string] & { btc_supply: number; brent_usd?: number };
	const px = day.btc_usd;
	const g = day.xau_per_btc;
	const lines: string[] = [];
	const add = (id: string, text: string) => lines.push(`[${id}] ${text}`);

	add('close', `Latest daily close: ${close}. 1 BTC = $${f0(px)}; gold $${f0(day.xau_usd)}/oz; silver $${day.xag_usd.toFixed(2)}/oz; Brent oil $${day.brent_usd?.toFixed(2)}/barrel.`);
	add('mined', `${f0(day.btc_supply)} of the 21,000,000 bitcoin have been mined (${((day.btc_supply / 21e6) * 100).toFixed(1)}%).`);

	// One coin in everything the site weighs.
	add('gold-1', `1 BTC buys ${g.toFixed(1)} oz of gold (${sig3(g * OZ)} g): a cube ${cubeCm(g).toFixed(1)} cm across. The day before: ${P[prev].xau_per_btc.toFixed(1)} oz.`);
	add('gold-peak', `At the Dec 2024 peak (${PEAK}) 1 BTC bought ${P[PEAK].xau_per_btc.toFixed(1)} oz of gold, a cube ${cubeCm(P[PEAK].xau_per_btc).toFixed(1)} cm across; gold was $${f0(P[PEAK].xau_usd)}/oz and BTC $${f0(P[PEAK].btc_usd)}.`);
	const yearAgo = nearest(P, shiftDays(close, -365));
	if (yearAgo) add('gold-year', `A year earlier (${yearAgo}) 1 BTC bought ${P[yearAgo].xau_per_btc.toFixed(1)} oz of gold at $${f0(P[yearAgo].btc_usd)}.`);
	const first = Object.keys(P).filter((d) => P[d].xau_per_btc).sort()[0];
	add('gold-first', `On ${first}, the first day the site weighs, 1 BTC bought ${P[first].xau_per_btc.toFixed(2)} oz of gold at $${f0(P[first].btc_usd)}.`);
	add('silver-1', `1 BTC buys ${f0(day.xag_per_btc)} oz of silver: ${sig3((day.xag_per_btc * OZ) / 1000)} kg, ${card('silver', 1).subs[0].replace(/\.$/, '').toLowerCase()}.`);
	const cash = card('cash', 1);
	add('cash-1', `1 BTC in $1 bills: ${cash.big} bills, ${cash.subs.join(' ').toLowerCase()}`);
	add('manhattan-1', `1 BTC buys ${card('manhattan', 1).big} sq ft of Manhattan land (Barr, Smith & Kulkarni 2014, illustrative).`);
	add('cocaine-1', `1 BTC buys ${card('cocaine', 1).big} kg of cocaine at US wholesale prices (UNODC/DEA, illustrative).`);
	add('pu238-1', `1 BTC buys ${card('pu238', 1).big} g of plutonium-238 (illustrative).`);
	if (day.brent_per_btc) add('oil-1', `1 BTC buys ${f0(day.brent_per_btc)} barrels of Brent oil.`);

	// The famous stacks.
	const holders: [string, string][] = [['strategy', 'Strategy'], ['blackrock-ibit', 'BlackRock’s IBIT ETF'], ['us-govt', 'The US government'], ['el-salvador', 'El Salvador'], ['spacex', 'SpaceX'], ['satoshi', 'Satoshi (untouched coins)']];
	for (const [slug, name] of holders) {
		const btc = presetBtc(slug);
		if (!btc) continue;
		const m = card('manhattan', btc, slug);
		add(`holder-${slug}`, `${name} holds ${f0(btc)} BTC, worth ${usd(btc * px)}: ${sig3(tonnes(btc * g))} tonnes of gold, or ${m.big}${m.unit} of Manhattan's land (${m.subs[0]?.replace(/\.$/, '')}).`);
	}

	// All 21 million.
	const cap = 21e6 * px;
	const moonPct = ((cap * NOTE_M) / 1000 / MOON_KM) * 100;
	add('all-21m', `All 21,000,000 bitcoin at $${f0(px)} are worth ${usd(cap)}: ${sig3(tonnes(21e6 * g))} tonnes of gold, ${((tonnes(21e6 * g) / 216_000) * 100).toFixed(1)}% of all the gold ever mined.`);
	add('moon', `All 21,000,000 bitcoin stacked as $1 bills reach ${sig3((cap * NOTE_M) / 1000)} km, ${moonPct.toFixed(1)}% of the way to the Moon. They arrive at $${f0((MOON_KM * 1000) / NOTE_M / 21e6)} a coin; every $${f0((MOON_KM * 10) / NOTE_M / 21e6)} on the price adds 1% (${f0(MOON_KM / 100)} km).`);

	const ref = JSON.parse(await readFile('scripts/radar/reference-facts.json', 'utf8')) as { facts: { id: string; text: string }[] };
	for (const f of ref.facts) add(`ref-${f.id}`, f.text);

	const links: Record<string, string> = {
		'gold-1': L('btc=1&commodity=gold'),
		'silver-1': L('btc=1&commodity=silver'),
		'cash-1': L('btc=1&commodity=cash'),
		'manhattan-1': L('btc=1&commodity=manhattan'),
		'cocaine-1': L('btc=1&commodity=cocaine'),
		'pu238-1': L('btc=1&commodity=pu238'),
		moon: L('preset=market-cap&commodity=cash&ride=play'),
		'all-21m-gold': L('preset=market-cap&commodity=gold'),
		...Object.fromEntries(holders.flatMap(([slug]) => [[`${slug}-gold`, L(`preset=${slug}&commodity=gold`)], [`${slug}-manhattan`, L(`preset=${slug}&commodity=manhattan`)]])),
		satoshi: L('preset=satoshi&commodity=cash&ride=play'),
		'pizza-manhattan': L('preset=pizza-day&commodity=manhattan'),
	};
	return { lines, links };
}

/** Figures worked out from numbers the post names: a coin price, a dollar sum. */
export function postFacts(text: string): string[] {
	const out: string[] = [];
	const seen = new Set<number>();
	// Prices said in words: "a million-dollar bitcoin", "seven figures", "$1M".
	const worded = /million[- ]dollar|seven[- ]figure|\$1\s?(?:M|mn|million)\b/i.test(text) ? ' $1,000,000' : '';
	for (const m of (text + worded).matchAll(/\$\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s?(k|K|thousand|million|M|billion|bn|B|trillion|T)?\b/g)) {
		const mult = { k: 1e3, K: 1e3, thousand: 1e3, million: 1e6, M: 1e6, billion: 1e9, bn: 1e9, B: 1e9, trillion: 1e12, T: 1e12 }[m[2] ?? ''] ?? 1;
		const n = Number(m[1].replace(/,/g, '')) * mult;
		if (!n || seen.has(n)) continue;
		seen.add(n);
		const km = (n * NOTE_M) / 1000;
		if (n >= 10_000 && n <= 2_000_000) {
			// Could be a coin price.
			const pct = ((n * 21e6 * NOTE_M) / 1000 / MOON_KM) * 100;
			out.push(`[post-price-${n}] At $${f0(n)} a coin, all 21,000,000 bitcoin stacked as $1 bills reach ${sig3((n * 21e6 * NOTE_M) / 1000)} km, ${pct < 100 ? `${pct.toFixed(1)}% of the way to the Moon` : `${(pct / 100).toFixed(2)}× the distance to the Moon (there and back ${(pct / 200).toFixed(1)} times)`}.`);
		}
		if (n >= 1e6) out.push(`[post-usd-${n}] ${usd(n)} in $1 bills stacks ${km >= 1 ? `${sig3(km)} km` : `${sig3(km * 1000)} m`} high${km > MOON_KM / 10 ? `, ${(km / MOON_KM).toFixed(1)}× the distance to the Moon` : ''}, and weighs ${sig3(n / 1e6)} tonne${n / 1e6 === 1 ? '' : 's'}.`);
	}
	return out;
}

function shiftDays(d: string, n: number): string {
	return new Date(Date.parse(d + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);
}
function nearest(P: Record<string, { xau_per_btc: number }>, d: string): string | null {
	for (let i = 0; i < 7; i++) { const k = shiftDays(d, -i); if (P[k]?.xau_per_btc) return k; }
	return null;
}
