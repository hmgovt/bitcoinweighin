/// <reference types="@cloudflare/workers-types" />
/**
 * Dynamic OG image endpoint — Cloudflare Pages Function.
 *
 *   /og-image?btc=1&date=2026-05-19&commodity=gold
 *
 * Renders a 1200×630 PNG reflecting the URL's slider state. The image is
 * what social platforms paste into share previews; the meta tags in
 * src/app.html and src/routes/+page.svelte point at this endpoint.
 *
 * Caching: each unique query string is rendered once into the Workers
 * Cache, then served from cache for an hour. Prices update at 02:00 UTC
 * daily so a 1-hour TTL is comfortable; the cache key falls off the next
 * day anyway because the default ?date= advances.
 */

import { ImageResponse } from 'workers-og';
import {
	OG_COMMODITIES,
	computeAmount,
	massGrams,
	volumeCm3,
	cubeEdgeCm,
	formatMassImperial,
	formatMassMetric,
	formatCubeEdge,
	formatAmount,
	formatBtc,
	formatUsd,
	type DayPrices,
	type PricesFile,
} from './_lib';

const FONT_BOLD_URL =
	'https://cdnjs.cloudflare.com/ajax/libs/inter-ui/3.19.3/Inter%20(web)/Inter-Bold.woff';
const FONT_REG_URL =
	'https://cdnjs.cloudflare.com/ajax/libs/inter-ui/3.19.3/Inter%20(web)/Inter-Regular.woff';

async function fetchCached(
	url: string,
	cacheName: string,
	waitUntil: (p: Promise<unknown>) => void,
): Promise<ArrayBuffer> {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(url);
	if (cached) return cached.arrayBuffer();
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Fetch failed for ${url}: ${res.status}`);
	const buf = await res.arrayBuffer();
	// Re-create response for cache.put (body already consumed by arrayBuffer)
	const cacheableRes = new Response(buf, {
		headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
	});
	waitUntil(cache.put(url, cacheableRes));
	return buf;
}

async function fetchPrices(
	origin: string,
	waitUntil: (p: Promise<unknown>) => void,
): Promise<PricesFile> {
	const url = `${origin}/prices.json`;
	const cache = await caches.open('og-prices');
	const cached = await cache.match(url);
	if (cached) return cached.json();
	const res = await fetch(url);
	if (!res.ok) throw new Error(`prices.json fetch failed: ${res.status}`);
	const body = await res.text();
	const cacheable = new Response(body, {
		headers: {
			'Content-Type': 'application/json',
			// Prices update once a day at 02:00 UTC; 30-min cache absorbs bursts.
			'Cache-Control': 'public, max-age=1800',
		},
	});
	waitUntil(cache.put(url, cacheable));
	return JSON.parse(body);
}

function renderHtml(opts: {
	btcLabel: string;
	usdLabel: string;
	commodityName: string;
	primaryReadout: string;
	imperialMass: string;
	metricMass: string;
	cubeEdge: string | null;
	dateLabel: string;
	accent: string;
}): string {
	const { btcLabel, usdLabel, commodityName, primaryReadout, imperialMass, metricMass, cubeEdge, dateLabel, accent } = opts;
	return `
<div style="display: flex; flex-direction: column; width: 1200px; height: 630px; background: #09090b; color: #f4f4f5; font-family: 'Inter', system-ui, sans-serif; padding: 64px 72px; box-sizing: border-box; position: relative;">
  <div style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; width: 100%;">
    <div style="display: flex; flex-direction: row; align-items: center;">
      <div style="display: flex; font-size: 36px; font-weight: 700; color: ${accent}; margin-right: 12px; line-height: 1;">₿</div>
      <div style="display: flex; font-size: 26px; font-weight: 700; color: #f4f4f5; letter-spacing: -0.01em;">Bitcoin Weigh-In</div>
    </div>
    <div style="display: flex; font-size: 18px; color: #71717a; font-family: 'Inter', system-ui, sans-serif;">${dateLabel}</div>
  </div>

  <div style="display: flex; flex-direction: column; margin-top: 56px;">
    <div style="display: flex; font-size: 22px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.15em;">${btcLabel}</div>
    <div style="display: flex; font-size: 28px; color: #71717a; margin-top: 8px;">${usdLabel} USD</div>
  </div>

  <div style="display: flex; flex-direction: column; margin-top: 36px;">
    <div style="display: flex; align-items: baseline; flex-wrap: wrap;">
      <div style="display: flex; font-size: 108px; font-weight: 700; color: ${accent}; line-height: 1; letter-spacing: -0.03em;">${primaryReadout}</div>
    </div>
    <div style="display: flex; font-size: 36px; color: #d4d4d8; margin-top: 18px; letter-spacing: -0.01em;">of ${commodityName}</div>
  </div>

  <div style="display: flex; flex-direction: column; margin-top: 36px;">
    <div style="display: flex; font-size: 24px; color: #a1a1aa;">${imperialMass}  ·  ${metricMass}${cubeEdge ? `  ·  cube edge: ${cubeEdge}` : ''}</div>
  </div>

  <div style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; position: absolute; bottom: 56px; left: 72px; right: 72px;">
    <div style="display: flex; font-size: 22px; color: #71717a;">bitcoinweighin.com</div>
    <div style="display: flex; font-size: 16px; color: #52525b; letter-spacing: 0.04em;">WHAT DOES A BITCOIN WEIGH?</div>
  </div>
</div>
`;
}

interface Env {}

export const onRequest: PagesFunction<Env> = async (context) => {
	const { request, waitUntil } = context;
	const url = new URL(request.url);

	// ── Cache lookup ───────────────────────────────────────────
	const cacheKey = new Request(
		`https://og-cache.local/og-image${url.search || ''}`,
		{ method: 'GET' },
	);
	const cache = caches.default;
	const cached = await cache.match(cacheKey);
	if (cached) return cached;

	// ── Parse params ───────────────────────────────────────────
	const btcParam = parseFloat(url.searchParams.get('btc') ?? '1');
	const btc = isFinite(btcParam) && btcParam > 0 ? btcParam : 1;
	const dateParam = url.searchParams.get('date');
	const commodityId = url.searchParams.get('commodity') ?? 'gold';
	const commodity = OG_COMMODITIES[commodityId] ?? OG_COMMODITIES.gold;

	// ── Load prices, pick day ──────────────────────────────────
	const prices = await fetchPrices(url.origin, waitUntil);
	const dates = Object.keys(prices).sort();
	const lastDate = dates[dates.length - 1];
	const date =
		dateParam && prices[dateParam] ? dateParam : lastDate;
	const day = prices[date];

	const amount = computeAmount(btc, commodity, day);
	const usdValue = day ? btc * day.btc : null;

	// ── Compose readouts ───────────────────────────────────────
	let primaryReadout = '—';
	let imperialMass = '—';
	let metricMass = '—';
	let cubeEdgeLabel: string | null = null;

	if (amount !== null && isFinite(amount) && amount > 0) {
		primaryReadout = formatAmount(amount, commodity);
		const g = massGrams(amount, commodity);
		imperialMass = formatMassImperial(g, commodity.unit);
		metricMass = formatMassMetric(g);
		const edge = cubeEdgeCm(amount, commodity);
		if (edge !== null && edge > 0) cubeEdgeLabel = formatCubeEdge(edge);
	}

	const html = renderHtml({
		btcLabel: formatBtc(btc),
		usdLabel: usdValue !== null ? formatUsd(usdValue) : '—',
		commodityName: commodity.displayName,
		primaryReadout,
		imperialMass,
		metricMass,
		cubeEdge: cubeEdgeLabel,
		dateLabel: date,
		accent: commodity.accentColor,
	});

	// ── Load fonts (cached) ────────────────────────────────────
	const [boldFont, regFont] = await Promise.all([
		fetchCached(FONT_BOLD_URL, 'og-fonts', waitUntil),
		fetchCached(FONT_REG_URL, 'og-fonts', waitUntil),
	]);

	const imgResponse = new ImageResponse(html, {
		width: 1200,
		height: 630,
		fonts: [
			{ name: 'Inter', data: regFont, weight: 400, style: 'normal' },
			{ name: 'Inter', data: boldFont, weight: 700, style: 'normal' },
		],
	});

	// Repackage so we can set headers and stash a clone in cache.
	const headers = new Headers(imgResponse.headers);
	headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
	headers.set('Content-Type', 'image/png');
	const response = new Response(imgResponse.body, {
		status: 200,
		headers,
	});
	waitUntil(cache.put(cacheKey, response.clone()));
	return response;
};
