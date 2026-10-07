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
	add('mined', `${f0(day.btc_supply)} of the 21,000,000 bitcoin have been mined (${((day.btc_supply / 21e6) * 100).toFixed(1)}%), with ${f0(21e6 - day.btc_supply)} left to issue.`);

	// One coin in everything the site weighs.
	add('gold-1', `1 BTC buys ${g.toFixed(1)} oz of gold (${sig3(g * OZ)} g): a cube ${cubeCm(g).toFixed(1)} cm across. The day before: ${P[prev].xau_per_btc.toFixed(1)} oz.`);
	add('gold-peak', `At the Dec 2024 peak (${PEAK}) 1 BTC bought ${P[PEAK].xau_per_btc.toFixed(1)} oz of gold, a cube ${cubeCm(P[PEAK].xau_per_btc).toFixed(1)} cm across; gold was $${f0(P[PEAK].xau_usd)}/oz and BTC $${f0(P[PEAK].btc_usd)}.`);
	const yearAgo = nearest(P, shiftDays(close, -365));
	if (yearAgo) add('gold-year', `A year earlier (${yearAgo}) 1 BTC bought ${P[yearAgo].xau_per_btc.toFixed(1)} oz of gold, a cube ${cubeCm(P[yearAgo].xau_per_btc).toFixed(1)} cm across, at $${f0(P[yearAgo].btc_usd)}.`);
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

	const ref = JSON.parse(await readFile('scripts/radar/reference-facts.json', 'utf8')) as {
		facts: { id: string; text: string }[];
		goldReserves: { asOf: string; holders: { name: string; slug: string; tonnes: number }[] };
		everyday: { items: { slug: string; label: string; usd: number; asOf: string; source: string }[] };
	};
	for (const f of ref.facts) add(`ref-${f.id}`, f.text);

	// Weighed the other way: a nation's gold, or all the gold ever mined, in bitcoin.
	// A post about a country or its bank can then be answered about that country.
	const reserves = ref.goldReserves.holders;
	add('ref-reserves', `Official gold reserves (World Gold Council, ${ref.goldReserves.asOf}): ${reserves.map((r) => `${r.name.replace(/^the /, '')} ${f0(r.tonnes)} t`).join('; ')}.`);
	const inBtc = (t: number) => (t * 1e6 / OZ) * day.xau_usd / px;
	for (const r of reserves) {
		const btc = inBtc(r.tonnes);
		const whose = r.name.charAt(0).toUpperCase() + r.name.slice(1) + (r.name.endsWith('s') ? "'" : "'s");
		add(`gold-in-btc-${r.slug}`, `${whose} ~${f0(r.tonnes)} t of official gold (${ref.goldReserves.asOf}) is worth ${usd(r.tonnes * 1e6 / OZ * day.xau_usd)} at today's gold price: about ${aboutBtc(btc)}, ${((btc / 21e6) * 100).toFixed(1)}% of all 21,000,000 bitcoin.`);
	}
	// Everyday prices: what one coin is in pay, homes, gas and eggs.
	for (const e of ref.everyday.items) {
		const n = px / e.usd;
		const price = e.usd >= 100 ? f0(e.usd) : e.usd.toFixed(e.usd < 10 ? 3 : 2).replace(/0+$/, '');
		const said = e.slug === 'wage-week' ? `1 BTC is ${f0(n)} weeks of it, about ${(n / 52).toFixed(1)} years`
			: n < 100 ? `In bitcoin: ${(1 / n).toFixed(2)} BTC`
			: `1 BTC buys ${f0(Number(n.toPrecision(3)))} of them`;
		add(`everyday-${e.slug}`, `${e.label}: $${price} (${e.asOf}, ${e.source}). ${said}.`);
	}

	const allGold = inBtc(216_000);
	add('gold-in-btc-all', `All the gold ever mined (~216,000 t) is worth ${usd(216_000 * 1e6 / OZ * day.xau_usd)} at today's gold price: ${(allGold / 21e6).toFixed(1)}× the value of all 21,000,000 bitcoin.`);

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

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MON = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DATE = new RegExp(`\\b(?:${MON}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?|(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MON})\\b(?:,?\\s+(\\d{4}))?`, 'gi');
const DCA_PER_DAY = 10;

/**
 * The calendar dates a post names ("July 1", "1 July 2025", "Oct 5th"), as
 * ISO dates. A date with no year is the latest one on or before `close`.
 */
export function datesIn(text: string, close: string): string[] {
	const out: string[] = [];
	for (const m of text.matchAll(DATE)) {
		const word = m[1] ?? m[4];
		// "may" in lower case is nearly always the verb ("may 5x"), not the month.
		if (word === 'may') continue;
		const month = MONTHS.findIndex((x) => x.startsWith(word.toLowerCase().slice(0, 3)));
		const day = Number(m[2] ?? m[3]);
		if (month < 0 || day < 1 || day > 31) continue;
		const iso = (y: number) => `${y}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
		let year = m[5] ? Number(m[5]) : Number(close.slice(0, 4));
		if (!m[5] && iso(year) > close) year--;
		if (!out.includes(iso(year))) out.push(iso(year));
	}
	return out;
}

/**
 * Figures for the dates a post names: that day's close and gold, and, for a
 * date at least a week back, what $10 a day bought from then to the latest close.
 */
export async function datedFacts(text: string): Promise<string[]> {
	const { P, close } = await loadPrices();
	const px = P[close].btc_usd;
	const out: string[] = [];
	for (const named of datesIn(text, close)) {
		const d = nearest(P, named);
		if (!d || d > close || out.some((l) => l.startsWith(`[post-date-${d}]`))) continue;
		const g = P[d].xau_per_btc;
		let line = `[post-date-${d}] On ${d}, 1 BTC closed at $${f0(P[d].btc_usd)} and bought ${g.toFixed(1)} oz of gold (a cube ${cubeCm(g).toFixed(1)} cm across).`;
		const days = Object.keys(P).filter((k) => k >= d && k <= close && P[k].btc_usd).sort();
		if (days.length >= 7) {
			const btc = days.reduce((s, k) => s + DCA_PER_DAY / P[k].btc_usd, 0);
			line += ` $${DCA_PER_DAY} a day from then to the latest close (${close}, ${days.length} days): $${f0(DCA_PER_DAY * days.length)} in, ${btc.toPrecision(3)} BTC, worth $${f0(btc * px)}.`;
		}
		out.push(line);
		if (out.length === 3) break;
	}
	return out;
}

/** Tonnes are approximate, so their bitcoin is too: three significant figures. */
const aboutBtc = (btc: number) => (btc >= 1e6 ? `${sig3(btc / 1e6)} million BTC` : `${f0(Number(btc.toPrecision(3)))} BTC`);

function shiftDays(d: string, n: number): string {
	return new Date(Date.parse(d + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);
}
function nearest(P: Record<string, { xau_per_btc: number }>, d: string): string | null {
	for (let i = 0; i < 7; i++) { const k = shiftDays(d, -i); if (P[k]?.xau_per_btc) return k; }
	return null;
}
