/// <reference types="@cloudflare/workers-types" />
/**
 * GET /api/live-price — current BTC/USD spot, refreshed far more often
 * than the once-daily static prices.json.
 *
 * Backed by Bitstamp's keyless public ticker (the oldest continuously
 * operating BTC/USD exchange, EU-regulated) rather than an aggregate like
 * CoinGecko — a single-venue quote is what a spot-checking user expects
 * "the price" to mean, and Bitstamp's ticker conveniently reports its own
 * timestamp so the freshness readout reflects the exchange, not just our
 * edge fetch. Edge-cached for 30s via the Workers Cache API — same
 * pattern as fetchPrices in functions/api/v1/weighin.ts — so traffic of
 * any volume collapses to ~2 upstream calls/minute total, keeping this
 * free and unrate-limited regardless of visitor count.
 *
 * Response: { usd: number, asOf: number } — asOf is Bitstamp's own
 * `timestamp` (unix seconds), so the client shows real feed freshness
 * rather than just when this edge fetched it.
 */

const BITSTAMP_URL = 'https://www.bitstamp.net/api/v2/ticker/btcusd/';

// Workers' default fetch User-Agent gets blocked by some exchange WAFs
// (confirmed for CoinGecko in an earlier iteration of this endpoint) —
// send a browser UA defensively, same as scripts/fetchers.ts does for
// the daily cron's Yahoo/CoinGecko calls.
const USER_AGENT =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
	'(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const CORS_HEADERS: Record<string, string> = {
	'Access-Control-Allow-Origin': '*',
};

function json(status: number, body: unknown, cacheControl: string): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': cacheControl,
			...CORS_HEADERS,
		},
	});
}

export const onRequestGet: PagesFunction = async (context) => {
	const { waitUntil } = context;

	const cache = await caches.open('live-price');
	const cached = await cache.match(BITSTAMP_URL);
	if (cached) return cached;

	let res: Response;
	try {
		res = await fetch(BITSTAMP_URL, {
			headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
		});
	} catch (err) {
		console.error(`live-price: fetch failed: ${err}`);
		return json(503, { error: 'Live price temporarily unavailable' }, 'no-store');
	}
	if (!res.ok) {
		console.error(`live-price: upstream HTTP ${res.status}`);
		return json(503, { error: 'Live price temporarily unavailable' }, 'no-store');
	}

	// Bitstamp returns numeric fields as strings.
	const upstream = (await res.json()) as { last?: string; timestamp?: string };
	const usd = upstream.last !== undefined ? parseFloat(upstream.last) : NaN;
	const asOf = upstream.timestamp !== undefined ? parseInt(upstream.timestamp, 10) : NaN;
	if (!isFinite(usd) || !isFinite(asOf)) {
		console.error('live-price: upstream returned no usable price');
		return json(503, { error: 'Live price temporarily unavailable' }, 'no-store');
	}

	const response = json(200, { usd, asOf }, 'public, max-age=30, s-maxage=30');
	waitUntil(cache.put(BITSTAMP_URL, response.clone()));
	return response;
};
