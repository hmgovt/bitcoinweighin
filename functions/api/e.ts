/// <reference types="@cloudflare/workers-types" />
/**
 * Plausible event proxy — Cloudflare Pages Function (POST /api/e).
 *
 * Privacy/ad blockers block the `plausible.io` hostname, which drops both
 * the tracker script and its event beacon. Routing events through our own
 * origin makes them first-party so they survive.
 *
 * We forward the ORIGINAL request (only stripping cookies) and return
 * Plausible's response unchanged. plausible.io sits behind BunnyCDN/Caddy
 * (not Cloudflare), so we must hand the real visitor IP across the hop
 * ourselves: Cloudflare sets `CF-Connecting-IP` on the inbound request, and
 * we copy it into `X-Forwarded-For` on the outbound one. Without this,
 * Plausible sees the Cloudflare datacenter egress IP and bot-filters every
 * event (`x-plausible-dropped: 1`). Returning Plausible's response verbatim
 * preserves that diagnostic header.
 *
 * Pairs with the script proxy at /js/s and `plausible.init({ endpoint })`.
 */
export const onRequestPost: PagesFunction = async ({ request }) => {
	const proxied = new Request('https://plausible.io/api/event', request);
	proxied.headers.delete('cookie');
	const ip = request.headers.get('CF-Connecting-IP');
	if (ip) proxied.headers.set('X-Forwarded-For', ip);
	return fetch(proxied);
};
