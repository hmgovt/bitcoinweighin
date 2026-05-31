/// <reference types="@cloudflare/workers-types" />
/**
 * Plausible event proxy — Cloudflare Pages Function (POST /api/e).
 *
 * Privacy/ad blockers block the `plausible.io` hostname, which drops both
 * the tracker script and its event beacon. Routing events through our own
 * origin makes them first-party so they survive.
 *
 * We forward the ORIGINAL request (only stripping cookies) and return
 * Plausible's response unchanged — per Plausible's official Cloudflare
 * guide. This lets Cloudflare carry the real visitor IP through to
 * Plausible (a hand-built X-Forwarded-For is ignored on the CF→CF hop, so
 * Plausible would see a datacenter IP and bot-filter the event), and it
 * preserves Plausible's `x-plausible-dropped` diagnostic header.
 *
 * Pairs with the script proxy at /js/s and `plausible.init({ endpoint })`.
 */
export const onRequestPost: PagesFunction = async ({ request }) => {
	const proxied = new Request('https://plausible.io/api/event', request);
	proxied.headers.delete('cookie');
	return fetch(proxied);
};
