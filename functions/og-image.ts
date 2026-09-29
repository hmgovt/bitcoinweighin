/// <reference types="@cloudflare/workers-types" />
/**
 * Link-card endpoint — Cloudflare Pages Function.
 *
 *   /og-image?commodity=gold&btc=1
 *   /og-image?commodity=manhattan&preset=strategy
 *   /og-image?commodity=cash&preset=market-cap&date=2026-09-28
 *
 * Renders the 1200×630 card X and others show under a link: one huge number,
 * a few plain words, and a real render of the site's stage from the art
 * library (static/og/art, built by scripts/og/build-card-art.ts). The layout
 * and wording live in ./_card.ts, shared with the local preview
 * (scripts/og/preview-cards.ts). functions/_middleware.ts points each
 * homepage link's share tags here with that link's own settings.
 *
 * Caching: each unique query is rendered once into the Workers cache for an
 * hour. Prices update daily at 02:00 UTC and the default date advances with
 * them, so a stale card falls away by itself.
 */

import { ImageResponse, loadGoogleFont } from 'workers-og';
import { BRAND_MARK_DATA_URL, type PricesFile } from './_lib';
import { buildCard, cardModel, presetBtc, CARD_W, CARD_H } from './_card';

/** Bump when the card design changes, so cached cards are re-rendered. */
const CARD_VERSION = 'v2';

async function cachedBuffer(key: string, load: () => Promise<ArrayBuffer>, waitUntil: (p: Promise<unknown>) => void): Promise<ArrayBuffer> {
	const cache = await caches.open('og-assets');
	const hit = await cache.match(key);
	if (hit) return hit.arrayBuffer();
	const buf = await load();
	waitUntil(cache.put(key, new Response(buf, { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } })));
	return buf;
}

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Fetch failed for ${url}: ${res.status}`);
	return res.arrayBuffer();
}

async function fetchPrices(origin: string, waitUntil: (p: Promise<unknown>) => void): Promise<PricesFile> {
	const url = `${origin}/prices.json`;
	const cache = await caches.open('og-prices');
	const cached = await cache.match(url);
	if (cached) return cached.json();
	const res = await fetch(url);
	if (!res.ok) throw new Error(`prices.json fetch failed: ${res.status}`);
	const body = await res.text();
	waitUntil(cache.put(url, new Response(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=1800' } })));
	return JSON.parse(body);
}

// Workers' btoa expects a binary string. Chunk to keep the call stack safe.
function bufferToBase64(buf: ArrayBuffer): string {
	const bytes = new Uint8Array(buf);
	let binary = '';
	for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + 0x8000)));
	return btoa(binary);
}

const FONTS: { family: string; weight: 500 | 600 | 700 | 900 }[] = [
	{ family: 'Inter Tight', weight: 600 },
	{ family: 'Inter Tight', weight: 700 },
	{ family: 'Inter Tight', weight: 900 },
	{ family: 'JetBrains Mono', weight: 500 },
	{ family: 'JetBrains Mono', weight: 700 },
];

interface Env {}

export const onRequest: PagesFunction<Env> = async (context) => {
	const { request, waitUntil } = context;
	const url = new URL(request.url);

	const cacheKey = new Request(`https://og-cache.local/og-image/${CARD_VERSION}${url.search || ''}`, { method: 'GET' });
	const cache = caches.default;
	const cached = await cache.match(cacheKey);
	if (cached) return cached;

	// ── The link's settings ──
	const q = url.searchParams;
	const preset = q.get('preset') ?? undefined;
	const btcParam = parseFloat(q.get('btc') ?? '');
	const btc = isFinite(btcParam) && btcParam > 0 ? btcParam : presetBtc(preset) ?? 1;
	const commodity = q.get('commodity') ?? 'gold';

	const prices = await fetchPrices(url.origin, waitUntil);
	const dates = Object.keys(prices).sort();
	const dateParam = q.get('date');
	const date = dateParam && prices[dateParam] ? dateParam : dates[dates.length - 1];

	// ── The card ──
	const model = cardModel({ commodity, btc, preset, date, day: prices[date] });
	let artDataUrl: string | null = null;
	if (model.art) {
		try {
			const buf = await cachedBuffer(`https://og-assets.local/art/${model.art}`, () => fetchBuffer(`${url.origin}/og/art/${model.art}`), waitUntil);
			artDataUrl = `data:image/jpeg;base64,${bufferToBase64(buf)}`;
		} catch {
			artDataUrl = null; // a card without its picture still beats a broken one
		}
	}
	const fonts = await Promise.all(
		FONTS.map(async (f) => ({
			name: f.family,
			weight: f.weight,
			style: 'normal' as const,
			data: await cachedBuffer(`https://og-assets.local/font/${f.family}/${f.weight}`, () => loadGoogleFont({ family: f.family, weight: f.weight }), waitUntil),
		}))
	);

	const img = new ImageResponse(buildCard(model, artDataUrl, BRAND_MARK_DATA_URL) as never, { width: CARD_W, height: CARD_H, fonts });
	const headers = new Headers(img.headers);
	headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
	headers.set('Content-Type', 'image/png');
	const response = new Response(img.body, { status: 200, headers });
	waitUntil(cache.put(cacheKey, response.clone()));
	return response;
};
