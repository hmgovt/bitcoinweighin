/**
 * _card.ts — the link card (functions/og-image.ts), as pure functions: what a
 * link's amount buys, said in plain words, laid over a real render of the
 * site's stage from the art library (scripts/og/build-card-art.ts).
 *
 * The design borrows from video thumbnails: one huge number, five words or
 * fewer around it, the real object on the right, the same frame every time.
 * The numbers are always the link's own; the picture is the art-library rung
 * nearest the amount, rendered at true scale.
 *
 * Returns a Satori element tree (plain objects), so the Worker and the local
 * preview (scripts/og/preview-cards.ts) render exactly the same card.
 */
import mapMeta from '../src/lib/manhattan-map.json';
import holdings from '../src/lib/entity-holdings.json';
import artManifest from '../static/og/art/manifest.json';
import { OG_COMMODITIES, MANHATTAN_DEVELOPABLE_M2, computeAmount, type DayPrices } from './_lib';

export const CARD_W = 1200;
export const CARD_H = 630;
const OZ_G = 31.1035;
const FORT_KNOX_G = 147_341_858 * OZ_G;
const NOTE_M = 0.10922e-3;
const MOON_M = 384_400_000;
const ORANGE = '#f7931a';

// ── What the link asks for ─────────────────────────────────────

export interface CardQuery {
	commodity: string;
	btc: number;
	/** A famous holder (src/lib/entity-holdings.json slug), named in plain words. */
	preset?: string;
	date: string;
	day: DayPrices | undefined;
}

/** Holders in words anyone understands (not everyone knows who Strategy is). */
const WHO: Record<string, string> = {
	'1btc': '1 bitcoin',
	'make-it': '6.15 bitcoin',
	'el-salvador': 'El Salvador’s bitcoin',
	'pizza-day': 'The 10,000 pizza bitcoin',
	spacex: 'SpaceX’s bitcoin',
	'us-govt': 'The US government’s bitcoin',
	'blackrock-ibit': 'BlackRock’s bitcoin ETF',
	strategy: 'The biggest company stack',
	satoshi: 'Satoshi’s untouched coins',
	'market-cap': 'All 21 million bitcoin',
};

export function presetBtc(slug: string | undefined): number | null {
	const e = holdings.entities.find((x) => x.slug === slug);
	return e ? e.btc : null;
}

// ── Formatting ─────────────────────────────────────────────────

/** Three significant figures, thousands separated; no trailing zeros. */
export function sig3(n: number): string {
	if (!isFinite(n)) return '—';
	if (n >= 1000) return Math.round(n).toLocaleString('en-US');
	const d = n >= 100 ? 0 : n >= 10 ? 1 : n >= 1 ? 2 : Math.min(6, 2 - Math.floor(Math.log10(n)));
	return Number(n.toFixed(d)).toLocaleString('en-US', { maximumFractionDigits: d });
}

function btcWords(btc: number): string {
	if (btc >= 1 && Number.isInteger(btc)) return `${btc.toLocaleString('en-US')} bitcoin`;
	if (btc >= 0.001) return `${sig3(btc)} bitcoin`;
	return `${Math.round(btc * 1e8).toLocaleString('en-US')} sats`;
}

function lengthWords(m: number): string {
	if (m < 0.01) return `${sig3(m * 1000)} mm`;
	if (m < 1) return `${sig3(m * 100)} cm`;
	if (m < 1000) return `${sig3(m)} m`;
	return `${sig3(m / 1000)} km`;
}

function massParts(g: number): [string, string] {
	if (g < 1) return [sig3(g * 1000), ' mg'];
	if (g < 1000) return [sig3(g), ' g'];
	if (g < 1e6) return [sig3(g / 1000), ' kg'];
	return [sig3(g / 1e6), ' t'];
}

function bigCount(n: number): [string, string] {
	if (n < 1e6) return [Math.round(n).toLocaleString('en-US'), ''];
	if (n < 1e9) return [sig3(n / 1e6), 'M'];
	if (n < 1e12) return [sig3(n / 1e9), 'B'];
	return [sig3(n / 1e12), 'T'];
}

// ── The art: the library rung nearest the amount (log scale) ───

/** A rung: its quantity, its file, and the span its subject takes across the 1200-wide frame. */
type Rung = { q: number; file: string; x?: number[] };
type Manifest = { manifest: Record<string, { unit: string; rungs: Rung[] }> };

function nearestRung(commodity: string, quantity: number): Rung | null {
	const rungs = (artManifest as Manifest).manifest[commodity]?.rungs;
	if (!rungs?.length || !(quantity > 0)) return null;
	let best = rungs[0];
	for (const r of rungs) if (Math.abs(Math.log(r.q / quantity)) < Math.abs(Math.log(best.q / quantity))) best = r;
	return best;
}

export function nearestArt(commodity: string, quantity: number): string | null {
	return nearestRung(commodity, quantity)?.file ?? null;
}

/** The art rung for a card, with its subject span when the library measured one. */
function artFor(commodity: string, quantity: number): Pick<CardModel, 'art' | 'artX'> {
	const r = nearestRung(commodity, quantity);
	return { art: r?.file ?? null, artX: r?.x?.length === 2 ? [r.x[0], r.x[1]] : undefined };
}

// ── The card, as data ──────────────────────────────────────────

export type Theme = 'metal' | 'floor' | 'land' | 'space';

export interface CardModel {
	theme: Theme;
	/** Art-library path under /og/art/, or null for a text-only card. */
	art: string | null;
	/** Where the art's subject sits across its 1200-wide frame (left, right px), if measured. */
	artX?: [number, number];
	eyebrow: string;
	big: string;
	unit: string;
	mid: string;
	subs: string[];
	fine: string;
	dateLabel: string;
}

const NAME: Record<string, string> = { gold: 'gold', silver: 'silver', pu238: 'plutonium-238', cocaine: 'cocaine' };

export function cardModel(q: CardQuery): CardModel {
	const c = OG_COMMODITIES[q.commodity] ?? OG_COMMODITIES.gold;
	const amount = computeAmount(q.btc, c, q.day) ?? 0;
	const who = (q.preset && WHO[q.preset]) || btcWords(q.btc);
	const dateLabel = q.date ? `${new Date(q.date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })} close` : '';
	const base = { eyebrow: who, dateLabel, fine: '' };

	if (c.id === 'gold' || c.id === 'silver' || c.id === 'pu238') {
		const g = amount * (c.unitMassGrams ?? 1);
		const edgeM = Math.cbrt(g / (c.densityGPerCm3 ?? 1)) / 100;
		const [big, unit] = c.unit === 'troy_oz' && g >= OZ_G && g < 1e6 ? [sig3(g / OZ_G), ' oz'] : massParts(g);
		const subs = [`A cube ${lengthWords(edgeM)} across.`];
		if (c.id === 'gold' && g >= 1e6) {
			const knox = (g / FORT_KNOX_G) * 100;
			if (knox >= 0.1) subs.push(`${knox >= 10 ? Math.round(knox) : sig3(knox)}% of Fort Knox.`);
		}
		return { ...base, theme: 'metal', ...artFor(c.id, g), big, unit, mid: `of ${NAME[c.id]}`, subs, fine: c.id === 'pu238' ? 'Illustrative price · DOE / NASA estimates' : '' };
	}

	if (c.id === 'cocaine') {
		const g = amount;
		const [big, unit] = massParts(g);
		const subs = ['At US wholesale prices.'];
		if (g >= 1500 && g < 1e6) subs.push(`About ${Math.round(g / 1000).toLocaleString('en-US')} taped kilo bricks.`);
		return { ...base, theme: 'floor', ...artFor('cocaine', g), big, unit, mid: 'of cocaine', subs, fine: 'UNODC / DEA prices · illustrative' };
	}

	if (c.id === 'cash') {
		const notes = amount;
		const stackM = notes * NOTE_M;
		if (stackM >= 1_000_000) {
			// A stack past low orbit reads better against the Moon.
			const pct = (stackM / MOON_M) * 100;
			const past = pct >= 100;
			return {
				...base, theme: 'space', art: 'moon.jpg',
				big: past ? `${sig3(pct / 100)}×` : pct >= 45 && pct <= 55 ? 'HALFWAY' : `${sig3(pct)}%`, unit: '',
				mid: past ? 'the way to the Moon' : pct >= 45 && pct <= 55 ? 'to the Moon' : 'of the way to the Moon',
				subs: [`In $1 bills: a stack ${lengthWords(stackM)} tall.`],
				fine: q.preset === 'market-cap' ? `At $${Math.round(MOON_M / NOTE_M / 21e6).toLocaleString('en-US')} a coin, all 21M reach it.` : '',
			};
		}
		const [big, unit] = bigCount(notes);
		const kg = notes / 1000;
		return {
			...base, theme: 'floor', ...artFor('cash', notes), big, unit, mid: 'one-dollar bills',
			subs: [`A stack ${lengthWords(stackM)} tall.`, `${kg >= 1000 ? `${sig3(kg / 1000)} tonnes` : `${sig3(kg)} kg`} of paper.`],
		};
	}

	// Manhattan
	const m2 = amount;
	const share = m2 / MANHATTAN_DEVELOPABLE_M2;
	const art = nearestArt('manhattan', m2);
	if (share >= 1) {
		const spareAcres = ((m2 - MANHATTAN_DEVELOPABLE_M2) / 4046.86);
		return { ...base, theme: 'land', art, big: 'ALL', unit: '', mid: 'of Manhattan', subs: ['Every lot, the Battery to Inwood.', spareAcres >= 1 ? `${sig3(spareAcres)} acres to spare.` : ''].filter(Boolean), fine: 'Land value: Barr, Smith & Kulkarni (2014) · illustrative' };
	}
	if (share >= 0.01) {
		const street = frontierStreet(m2);
		const pct = share * 100;
		return { ...base, theme: 'land', art, big: pct < 10 ? pct.toFixed(1) : String(Math.round(pct)), unit: '%', mid: 'OF MANHATTAN', subs: [street ? `The Battery → ${street}.` : 'At the Battery.'], fine: 'Land value: Barr, Smith & Kulkarni (2014) · illustrative' };
	}
	const sqft = m2 / 0.09290304;
	const [big, unit] = sqft < 1 ? [sig3(sqft * 144), ' sq in'] : sqft < 43_560 ? [sig3(sqft), ' sq ft'] : [sig3(sqft / 43_560), ' acres'];
	return { ...base, theme: 'land', art, big, unit, mid: 'of Manhattan land', subs: ['At the Battery, the island’s southern tip.'], fine: 'Land value: Barr, Smith & Kulkarni (2014) · illustrative' };
}

export function frontierStreet(m2: number): string | null {
	let best: string | null = null;
	for (const s of mapMeta.streets) {
		if (s.areaM2 <= m2) best = s.name;
		else break;
	}
	return best;
}

function titleParts(q: { commodity: string; btc: number; preset?: string }): [string, string] {
	const who = (q.preset && WHO[q.preset]) || btcWords(q.btc);
	const what = q.commodity === 'manhattan' ? 'Manhattan' : q.commodity === 'cash' ? '$1 bills' : NAME[q.commodity] ?? 'gold';
	return [who, what];
}

export function cardTitle(q: { commodity: string; btc: number; preset?: string }): string {
	const [who, what] = titleParts(q);
	return `${who}, weighed in ${what} · Bitcoin Weigh-In`;
}

/** The share description: no numbers, so it needs no prices and never goes stale. */
export function cardDescription(q: { commodity: string; btc: number; preset?: string }): string {
	const [who, what] = titleParts(q);
	return `${who}, weighed in ${what} at today’s prices and drawn at true scale. Bitcoin measured against real things: gold, silver, plutonium-238, cocaine, cash and Manhattan.`;
}

// ── The card, as a Satori element tree ─────────────────────────

export interface El { type: string; props: { style?: Record<string, unknown>; children?: El | El[] | string; [k: string]: unknown } }
const el = (type: string, style: Record<string, unknown>, children?: El | El[] | string, extra: Record<string, unknown> = {}): El => ({ type, props: { style, children, ...extra } });

/** The text's backdrop: solid to here, then fading to clear (fractions of the width). */
const FADE_SOLID = 0.36;
const FADE_CLEAR = 0.6;
/** Art starting further right would show its left edge through the fade. */
const ART_MAX_LEFT = Math.floor(CARD_W * FADE_SOLID) - 12;

const THEME: Record<Theme, { bg: string; fade: string; art: { left: number; top: number; width: number; height: number } }> = {
	metal: { bg: '#1b1b1f', fade: '#1b1b1f', art: { left: 230, top: -20, width: 1200, height: 630 } },
	floor: { bg: '#29251f', fade: '#29251f', art: { left: 170, top: -20, width: 1200, height: 630 } },
	land: { bg: '#18181b', fade: '#18181b', art: { left: 260, top: -10, width: 1200, height: 630 } },
	space: { bg: '#000000', fade: '#000000', art: { left: 500, top: 0, width: 700, height: 630 } },
};

/** The part of the card the art's subject should sit in: clear of the text, inside the right edge. */
const SUBJECT_WINDOW: [number, number] = [560, 1180];

/**
 * Where the art goes across the card. Cubes, stacks and bricks (with Sat
 * beside them) are placed by their measured span: centred in the window to
 * the right of the text, and never pushed off the right edge, where Sat
 * usually sits. The art never starts right of the text's solid backdrop (its
 * left edge would show) or left of the card (its right edge would).
 * Manhattan's map and the Moon fill their frames, so they keep a fixed place.
 */
export function artLeft(m: Pick<CardModel, 'theme' | 'artX'>): number {
	const fixed = THEME[m.theme].art.left;
	if (!m.artX || (m.theme !== 'metal' && m.theme !== 'floor')) return fixed;
	const [a, b] = m.artX;
	const [w0, w1] = SUBJECT_WINDOW;
	const left = Math.min((w0 + w1) / 2 - (a + b) / 2, w1 - b);
	return Math.round(Math.max(0, Math.min(ART_MAX_LEFT, left)));
}

/** Big-number size: as large as fits the text column. */
export function bigSize(text: string): number {
	return Math.max(96, Math.min(176, Math.round(880 / Math.max(4, text.length))));
}

export function buildCard(m: CardModel, artDataUrl: string | null, markDataUrl: string): El {
	const t = THEME[m.theme];
	const bigText = m.big + m.unit;
	const size = bigSize(bigText);
	const layers: El[] = [];
	if (artDataUrl) layers.push(el('img', { position: 'absolute', left: artLeft(m), top: t.art.top, width: t.art.width, height: t.art.height }, undefined, { src: artDataUrl, width: t.art.width, height: t.art.height }));
	const [r, g, b] = [1, 3, 5].map((i) => parseInt(t.fade.slice(i, i + 2), 16));
	layers.push(el('div', { position: 'absolute', left: 0, top: 0, width: CARD_W, height: CARD_H, backgroundImage: `linear-gradient(90deg, rgba(${r},${g},${b},1) 0%, rgba(${r},${g},${b},1) ${FADE_SOLID * 100}%, rgba(${r},${g},${b},0) ${FADE_CLEAR * 100}%)` }));
	const text: El[] = [
		el('div', { display: 'flex', fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 22, letterSpacing: 1.5, textTransform: 'uppercase', color: ORANGE }, m.eyebrow),
		el('div', { display: 'flex', alignItems: 'baseline', marginTop: 18, fontWeight: 900, fontSize: size, lineHeight: 0.86, letterSpacing: Math.round(-0.05 * size), color: '#fafafa' }, [
			el('span', {}, m.big),
			// A leading space collapses in Satori, so a spaced unit gets a margin instead.
			...(m.unit ? [el('span', { color: ORANGE, marginLeft: m.unit.startsWith(' ') ? Math.round(size * 0.12) : 0 }, m.unit.trim())] : []),
		]),
		el('div', { display: 'flex', marginTop: 12, fontWeight: 900, fontSize: 56, lineHeight: 1, letterSpacing: -2, color: '#fafafa' }, m.mid),
		el('div', { display: 'flex', flexDirection: 'column', marginTop: 16, fontWeight: 600, fontSize: 27, lineHeight: 1.25, color: '#d4d4d8' }, m.subs.map((s) => el('div', { display: 'flex' }, s))),
	];
	if (m.fine) text.push(el('div', { display: 'flex', marginTop: 14, fontFamily: 'JetBrains Mono', fontWeight: 500, fontSize: 15, color: '#a1a1aa' }, m.fine));
	layers.push(el('div', { position: 'absolute', left: 48, top: 48, width: 620, display: 'flex', flexDirection: 'column' }, text));
	layers.push(el('div', { position: 'absolute', left: 48, bottom: 34, display: 'flex', alignItems: 'center', fontWeight: 700, fontSize: 25, color: '#fafafa' }, [
		el('img', { width: 40, height: 40, marginRight: 12 }, undefined, { src: markDataUrl, width: 40, height: 40 }),
		el('span', {}, 'bitcoinweighin.com'),
	]));
	if (m.dateLabel) layers.push(el('div', { position: 'absolute', right: 30, bottom: 22, display: 'flex', fontFamily: 'JetBrains Mono', fontSize: 14, color: 'rgba(250,250,250,0.55)' }, m.dateLabel));
	return el('div', { display: 'flex', position: 'relative', width: CARD_W, height: CARD_H, background: t.bg, fontFamily: 'Inter Tight', overflow: 'hidden' }, layers);
}

/** Every character a card uses, for subsetting the Google Fonts it loads. */
export function cardText(m: CardModel): string {
	return [m.eyebrow.toUpperCase(), m.big, m.unit, m.mid, ...m.subs, m.fine, m.dateLabel, 'bitcoinweighin.com'].join('');
}
