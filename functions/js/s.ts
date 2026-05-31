/// <reference types="@cloudflare/workers-types" />
/**
 * Plausible tracker-script proxy — Cloudflare Pages Function (GET /js/s).
 *
 * Serves the site's pinned Plausible script from our own origin so filters
 * targeting the plausible.io hostname can't block it from loading. The
 * script is content-hashed upstream and rarely changes; we edge-cache it
 * for a day. Pairs with the event proxy at /api/e.
 */
const UPSTREAM = 'https://plausible.io/js/pa-vdAGMCTZCfgkdxvEf8I4J.js';

export const onRequestGet: PagesFunction = async () => {
	const upstream = await fetch(UPSTREAM, {
		cf: { cacheTtl: 86400, cacheEverything: true },
	});
	return new Response(upstream.body, {
		status: upstream.status,
		headers: {
			'Content-Type': 'application/javascript; charset=utf-8',
			'Cache-Control': 'public, max-age=86400',
		},
	});
};
