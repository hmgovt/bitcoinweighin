/// <reference types="@cloudflare/workers-types" />
/**
 * Link-card endpoint — Cloudflare Pages Function.
 *
 *   /og-image?commodity=gold&btc=1
 *   /og-image?commodity=manhattan&preset=strategy
 *
 * Serves the pre-rendered card for a link's settings (see
 * functions/_static-card.ts and scripts/og/build-cards.ts). Cards used to
 * be rendered here on request, but a render takes about a second of CPU,
 * far past a Worker's limit, so most failed (error 1102) or came back empty.
 * Share tags now point at the card files directly; this endpoint stays for
 * links whose tags already name it.
 */

import { cardParams, staticCardPath } from './_static-card';

export const onRequest: PagesFunction<{ ASSETS: Fetcher }> = async (context) => {
	const url = new URL(context.request.url);
	const path = await staticCardPath(context.env.ASSETS, url.origin, cardParams(url.searchParams));
	const card = await context.env.ASSETS.fetch(new Request(new URL(path, url.origin), { method: 'GET' }));
	const headers = new Headers(card.headers);
	// Cards change when the price does (each daily build), so an hour at most.
	headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
	return new Response(card.body, { status: card.status, headers });
};
