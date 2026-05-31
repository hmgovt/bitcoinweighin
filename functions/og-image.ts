/// <reference types="@cloudflare/workers-types" />
/**
 * Dynamic OG image endpoint — Cloudflare Pages Function.
 *
 *   /og-image?btc=1&date=2026-05-19&commodity=gold
 *
 * Renders a 1200×630 PNG reflecting the URL's slider state. The image
 * embeds a cube of the chosen commodity next to the Shiba scale dog,
 * sized by the same `max(shiba, cube) × 1.10` viewport rule the page
 * uses — so the share preview tells the same story as the site.
 *
 * Cocaine (still-mode commodity, no density) falls back to a text-only
 * layout that quotes the weight purchasable at the current BTC.
 *
 * Caching: each unique query string is rendered once into the Workers
 * Cache, then served from cache for an hour. Prices update at 02:00 UTC
 * daily so a 1-hour TTL is comfortable; the cache key falls off the
 * next day anyway because the default ?date= advances.
 */

import { ImageResponse } from 'workers-og';
import {
	OG_COMMODITIES,
	SCENE,
	computeAmount,
	massGrams,
	cubeEdgeCm,
	formatMassImperial,
	formatMassMetric,
	formatCubeEdge,
	formatHeadlineAmount,
	formatBtc,
	formatUsd,
	type OgCommodity,
	type PricesFile,
} from './_lib';

const FONT_BOLD_URL =
	'https://cdnjs.cloudflare.com/ajax/libs/inter-ui/3.19.3/Inter%20(web)/Inter-Bold.woff';
const FONT_REG_URL =
	'https://cdnjs.cloudflare.com/ajax/libs/inter-ui/3.19.3/Inter%20(web)/Inter-Regular.woff';

// ── Cache helpers ──────────────────────────────────────────────

async function fetchCachedBuffer(
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
			'Cache-Control': 'public, max-age=1800',
		},
	});
	waitUntil(cache.put(url, cacheable));
	return JSON.parse(body);
}

// Workers' btoa expects a binary string. Chunk to keep the call stack
// safe on multi-hundred-KB sprites.
function bufferToBase64(buf: ArrayBuffer): string {
	const bytes = new Uint8Array(buf);
	const chunk = 0x8000;
	let binary = '';
	for (let i = 0; i < bytes.length; i += chunk) {
		const slice = bytes.subarray(i, i + chunk);
		// String.fromCharCode applied across the chunk — safe under stack limit.
		binary += String.fromCharCode(...Array.from(slice));
	}
	return btoa(binary);
}

async function loadSpriteAsDataUrl(
	origin: string,
	relPath: string,
	waitUntil: (p: Promise<unknown>) => void,
): Promise<string | null> {
	try {
		const buf = await fetchCachedBuffer(`${origin}${relPath}`, 'og-sprites', waitUntil);
		return `data:image/png;base64,${bufferToBase64(buf)}`;
	} catch {
		return null;
	}
}

// ── Scene geometry ─────────────────────────────────────────────

interface SceneLayout {
	cubeWrap: { w: number; h: number };
	cubeImg: { w: number; h: number; left: number; top: number };
	shibaWrap: { w: number; h: number };
	shibaImg: { w: number; h: number; left: number; top: number };
	rowHeightPx: number;
}

function computeScene(
	cubeEdgeM: number,
	maxWidthPx: number,
	maxHeightPx: number,
	gapPx: number,
	minCubePx = 2,
): SceneLayout {
	const {
		SHIBA_HEIGHT_M,
		VIEWPORT_MARGIN,
		CUBE_VISIBLE_WIDTH_FRACTION,
		CUBE_VISIBLE_HEIGHT_FRACTION,
		SHIBA_VISIBLE_WIDTH_FRACTION,
		SHIBA_VISIBLE_HEIGHT_FRACTION,
		CUBE_LEFT_MARGIN_FRACTION,
		CUBE_TOP_MARGIN_FRACTION,
		SHIBA_LEFT_MARGIN_FRACTION,
		SHIBA_TOP_MARGIN_FRACTION,
	} = SCENE;

	const cubeWoH = CUBE_VISIBLE_WIDTH_FRACTION / CUBE_VISIBLE_HEIGHT_FRACTION;
	const shibaWoH = SHIBA_VISIBLE_WIDTH_FRACTION / SHIBA_VISIBLE_HEIGHT_FRACTION;

	// Height clamp — mirror the page's `max(shiba, cube) × 1.10` viewport.
	const viewportHeightM = Math.max(SHIBA_HEIGHT_M, cubeEdgeM) * VIEWPORT_MARGIN;
	const pxPerM_h = maxHeightPx / viewportHeightM;

	// Width clamp — total visible width = cubeWidth + shibaWidth + gap ≤ maxWidth.
	const widthDenomM = cubeEdgeM * cubeWoH + SHIBA_HEIGHT_M * shibaWoH;
	const pxPerM_w =
		widthDenomM > 0 ? (maxWidthPx - gapPx) / widthDenomM : pxPerM_h;

	const pxPerMetre = Math.min(pxPerM_h, pxPerM_w);

	const cubeVisibleHpx = Math.max(minCubePx, cubeEdgeM * pxPerMetre);
	const cubeVisibleWpx = cubeVisibleHpx * cubeWoH;
	const cubeSlotPx = cubeVisibleHpx / CUBE_VISIBLE_HEIGHT_FRACTION;

	const shibaVisibleHpx = SHIBA_HEIGHT_M * pxPerMetre;
	const shibaVisibleWpx = shibaVisibleHpx * shibaWoH;
	const shibaSlotPx = shibaVisibleHpx / SHIBA_VISIBLE_HEIGHT_FRACTION;

	// Row height: dominant visible × VIEWPORT_MARGIN, capped by maxHeightPx.
	const dominantVisible = Math.max(cubeVisibleHpx, shibaVisibleHpx);
	const rowHeightPx = Math.min(maxHeightPx, dominantVisible * VIEWPORT_MARGIN);

	return {
		cubeWrap: { w: Math.round(cubeVisibleWpx), h: Math.round(cubeVisibleHpx) },
		cubeImg: {
			w: Math.round(cubeSlotPx),
			h: Math.round(cubeSlotPx),
			left: Math.round(cubeSlotPx * CUBE_LEFT_MARGIN_FRACTION),
			top: Math.round(cubeSlotPx * CUBE_TOP_MARGIN_FRACTION),
		},
		shibaWrap: { w: Math.round(shibaVisibleWpx), h: Math.round(shibaVisibleHpx) },
		shibaImg: {
			w: Math.round(shibaSlotPx),
			h: Math.round(shibaSlotPx),
			left: Math.round(shibaSlotPx * SHIBA_LEFT_MARGIN_FRACTION),
			top: Math.round(shibaSlotPx * SHIBA_TOP_MARGIN_FRACTION),
		},
		rowHeightPx: Math.round(rowHeightPx),
	};
}

// ── HTML templates ─────────────────────────────────────────────

interface ReadoutLines {
	btcLabel: string;
	usdLabel: string;
	primaryReadout: string;
	commodityName: string;
	secondary: string;
	dateLabel: string;
	accent: string;
}

function renderSceneHtml(
	r: ReadoutLines,
	scene: SceneLayout,
	cubeDataUrl: string | null,
	shibaDataUrl: string | null,
): string {
	const cubeBlock = cubeDataUrl
		? `<div style="display: flex; width: ${scene.cubeWrap.w}px; height: ${scene.cubeWrap.h}px; overflow: hidden; position: relative;">
			<img src="${cubeDataUrl}" width="${scene.cubeImg.w}" height="${scene.cubeImg.h}" style="position: absolute; left: -${scene.cubeImg.left}px; top: -${scene.cubeImg.top}px;" />
		</div>`
		: '';
	const shibaBlock = shibaDataUrl
		? `<div style="display: flex; width: ${scene.shibaWrap.w}px; height: ${scene.shibaWrap.h}px; overflow: hidden; position: relative;">
			<img src="${shibaDataUrl}" width="${scene.shibaImg.w}" height="${scene.shibaImg.h}" style="position: absolute; left: -${scene.shibaImg.left}px; top: -${scene.shibaImg.top}px;" />
		</div>`
		: '';
	return `
<div style="display: flex; flex-direction: column; width: 1200px; height: 630px; background: #09090b; color: #f4f4f5; font-family: 'Inter', system-ui, sans-serif; padding: 48px 64px; box-sizing: border-box;">
	<div style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; width: 100%;">
		<div style="display: flex; flex-direction: row; align-items: center;">
			<div style="display: flex; font-size: 34px; font-weight: 700; color: ${r.accent}; margin-right: 12px; line-height: 1;">₿</div>
			<div style="display: flex; font-size: 26px; font-weight: 700; color: #f4f4f5; letter-spacing: -0.01em;">Bitcoin Weigh-In</div>
		</div>
		<div style="display: flex; font-size: 18px; color: #71717a;">${r.dateLabel}</div>
	</div>

	<div style="display: flex; flex-direction: row; align-items: flex-end; flex: 1; margin-top: 24px;">
		<div style="display: flex; flex-direction: column; width: 600px; padding-bottom: 8px;">
			<div style="display: flex; font-size: 22px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.15em;">${r.btcLabel}</div>
			<div style="display: flex; font-size: 26px; color: #71717a; margin-top: 6px;">${r.usdLabel} USD</div>
			<div style="display: flex; font-size: 84px; font-weight: 700; color: ${r.accent}; line-height: 1.05; letter-spacing: -0.03em; margin-top: 24px;">${r.primaryReadout}</div>
			<div style="display: flex; font-size: 32px; color: #d4d4d8; margin-top: 8px; letter-spacing: -0.01em;">of ${r.commodityName}</div>
			<div style="display: flex; font-size: 20px; color: #a1a1aa; margin-top: 18px;">${r.secondary}</div>
		</div>
		<div style="display: flex; flex: 1; align-items: flex-end; justify-content: flex-end; height: ${scene.rowHeightPx}px;">
			<div style="display: flex; flex-direction: row; align-items: flex-end; gap: 24px;">
				${cubeBlock}
				${shibaBlock}
			</div>
		</div>
	</div>

	<div style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; width: 100%; margin-top: 16px;">
		<div style="display: flex; font-size: 22px; color: #71717a;">bitcoinweighin.com</div>
		<div style="display: flex; font-size: 16px; color: #52525b; letter-spacing: 0.04em;">WHAT DOES A BITCOIN WEIGH?</div>
	</div>
</div>
`;
}

function renderTextOnlyHtml(r: ReadoutLines): string {
	return `
<div style="display: flex; flex-direction: column; width: 1200px; height: 630px; background: #09090b; color: #f4f4f5; font-family: 'Inter', system-ui, sans-serif; padding: 64px 72px; box-sizing: border-box;">
	<div style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; width: 100%;">
		<div style="display: flex; flex-direction: row; align-items: center;">
			<div style="display: flex; font-size: 36px; font-weight: 700; color: ${r.accent}; margin-right: 12px; line-height: 1;">₿</div>
			<div style="display: flex; font-size: 26px; font-weight: 700; color: #f4f4f5; letter-spacing: -0.01em;">Bitcoin Weigh-In</div>
		</div>
		<div style="display: flex; font-size: 18px; color: #71717a;">${r.dateLabel}</div>
	</div>

	<div style="display: flex; flex-direction: column; flex: 1; justify-content: center;">
		<div style="display: flex; font-size: 22px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.15em;">${r.btcLabel}</div>
		<div style="display: flex; font-size: 28px; color: #71717a; margin-top: 8px;">${r.usdLabel} USD</div>
		<div style="display: flex; font-size: 108px; font-weight: 700; color: ${r.accent}; line-height: 1; letter-spacing: -0.03em; margin-top: 28px;">${r.primaryReadout}</div>
		<div style="display: flex; font-size: 36px; color: #d4d4d8; margin-top: 14px; letter-spacing: -0.01em;">of ${r.commodityName}</div>
		<div style="display: flex; font-size: 24px; color: #a1a1aa; margin-top: 28px;">${r.secondary}</div>
	</div>

	<div style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; width: 100%;">
		<div style="display: flex; font-size: 22px; color: #71717a;">bitcoinweighin.com</div>
		<div style="display: flex; font-size: 16px; color: #52525b; letter-spacing: 0.04em;">WHAT DOES A BITCOIN WEIGH?</div>
	</div>
</div>
`;
}

// ── Handler ────────────────────────────────────────────────────

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
	const commodity: OgCommodity =
		OG_COMMODITIES[commodityId] ?? OG_COMMODITIES.gold;

	// ── Load prices, pick day ──────────────────────────────────
	const prices = await fetchPrices(url.origin, waitUntil);
	const dates = Object.keys(prices).sort();
	const lastDate = dates[dates.length - 1];
	const date = dateParam && prices[dateParam] ? dateParam : lastDate;
	const day = prices[date];

	const amount = computeAmount(btc, commodity, day);
	const usdValue = day ? btc * day.btc : null;

	// ── Compose readouts ───────────────────────────────────────
	let primaryReadout = '—';
	let secondary = '—';
	let cubeEdgeM = 0;
	if (amount !== null && isFinite(amount) && amount > 0) {
		primaryReadout = formatHeadlineAmount(amount, commodity);
		const g = massGrams(amount, commodity);
		const parts: string[] = [];
		parts.push(formatMassImperial(g, commodity.unit));
		parts.push(formatMassMetric(g));
		const edgeCm = cubeEdgeCm(amount, commodity);
		if (edgeCm !== null && edgeCm > 0) {
			parts.push(`cube edge: ${formatCubeEdge(edgeCm)}`);
			cubeEdgeM = edgeCm / 100;
		}
		secondary = parts.join('  ·  ');
	}

	const readout: ReadoutLines = {
		btcLabel: formatBtc(btc),
		usdLabel: usdValue !== null ? formatUsd(usdValue) : '—',
		primaryReadout,
		commodityName: commodity.displayName,
		secondary,
		dateLabel: date,
		accent: commodity.accentColor,
	};

	// ── Pick layout ────────────────────────────────────────────
	// Cube-mode commodities get the scene; cocaine (no density, no cube
	// sprite) falls back to a text-only headline. Sprite fetch failures
	// also fall back to text-only — the OG must never return broken.
	const wantsScene = !!commodity.cubeSpritePath && cubeEdgeM > 0;
	let html: string;
	if (wantsScene) {
		const [cubeDataUrl, shibaDataUrl] = await Promise.all([
			loadSpriteAsDataUrl(url.origin, commodity.cubeSpritePath!, waitUntil),
			loadSpriteAsDataUrl(url.origin, SCENE.SHIBA_SPRITE_PATH, waitUntil),
		]);
		if (cubeDataUrl && shibaDataUrl) {
			// Scene area on the right side of the card. The text column
			// is 600 px wide; the scene gets the rest minus padding.
			const SCENE_MAX_WIDTH = 460;
			const SCENE_MAX_HEIGHT = 420;
			const SCENE_GAP = 24;
			const scene = computeScene(cubeEdgeM, SCENE_MAX_WIDTH, SCENE_MAX_HEIGHT, SCENE_GAP, 80);
			html = renderSceneHtml(readout, scene, cubeDataUrl, shibaDataUrl);
		} else {
			html = renderTextOnlyHtml(readout);
		}
	} else {
		html = renderTextOnlyHtml(readout);
	}

	// ── Load fonts (cached) ────────────────────────────────────
	const [boldFont, regFont] = await Promise.all([
		fetchCachedBuffer(FONT_BOLD_URL, 'og-fonts', waitUntil),
		fetchCachedBuffer(FONT_REG_URL, 'og-fonts', waitUntil),
	]);

	const imgResponse = new ImageResponse(html, {
		width: 1200,
		height: 630,
		fonts: [
			{ name: 'Inter', data: regFont, weight: 400, style: 'normal' },
			{ name: 'Inter', data: boldFont, weight: 700, style: 'normal' },
		],
	});

	const headers = new Headers(imgResponse.headers);
	headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
	headers.set('Content-Type', 'image/png');
	const response = new Response(imgResponse.body, { status: 200, headers });
	waitUntil(cache.put(cacheKey, response.clone()));
	return response;
};
