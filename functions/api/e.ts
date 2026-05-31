/// <reference types="@cloudflare/workers-types" />
/**
 * Plausible event proxy — Cloudflare Pages Function (POST /api/e).
 *
 * Privacy/ad blockers block the `plausible.io` hostname, which kills both
 * the tracker script and its event beacon. Routing events through our own
 * origin makes them first-party, so they're no longer dropped.
 *
 * Plausible derives geolocation and the daily rotating visitor hash from
 * the client IP + User-Agent, so we MUST forward the real values — without
 * X-Forwarded-For every hit would look like one Cloudflare datacenter,
 * collapsing unique counts and country stats.
 *
 * Pairs with the script proxy at /js/s and `plausible.init({ endpoint })`.
 */
const UPSTREAM = 'https://plausible.io/api/event';

export const onRequestPost: PagesFunction = async ({ request }) => {
	const body = await request.text();
	const upstream = await fetch(UPSTREAM, {
		method: 'POST',
		headers: {
			'Content-Type': request.headers.get('Content-Type') ?? 'text/plain',
			'User-Agent': request.headers.get('User-Agent') ?? '',
			'X-Forwarded-For':
				request.headers.get('CF-Connecting-IP') ??
				request.headers.get('X-Forwarded-For') ??
				'',
		},
		body,
	});
	return new Response(upstream.body, {
		status: upstream.status,
		statusText: upstream.statusText,
	});
};
