/// <reference types="@cloudflare/workers-types" />
/**
 * Per-link share tags for the homepage. A route function for `/` only (not
 * a site-wide middleware), so no other request runs a Function; next() serves
 * the prerendered page.
 *
 * The homepage is prerendered once, so every link to it used to carry the
 * same card (the default gold weigh-in) whatever it opened. For a link with
 * settings (?preset=satoshi&commodity=manhattan, ?btc=1&commodity=cash…),
 * this rewrites the share tags on the way out, so X, iMessage and the rest
 * show the card for what the link actually opens: a file pre-rendered at
 * build time (functions/_static-card.ts).
 * Everything else passes straight through.
 */
import { cardDescription, cardTitle, presetBtc } from './_card';
import { cardParams, staticCardPath } from './_static-card';

const CARD_PARAMS = ['commodity', 'btc', 'preset', 'date'] as const;

export const onRequest: PagesFunction<{ ASSETS: Fetcher }> = async (context) => {
	const url = new URL(context.request.url);
	const response = await context.next();
	if (!CARD_PARAMS.some((k) => url.searchParams.has(k))) return response;
	if (!(response.headers.get('content-type') ?? '').includes('text/html')) return response;

	const preset = url.searchParams.get('preset') ?? undefined;
	const btc = parseFloat(url.searchParams.get('btc') ?? '') || presetBtc(preset) || 1;
	const q = { commodity: url.searchParams.get('commodity') ?? 'gold', btc, preset };
	const title = cardTitle(q);
	const description = cardDescription(q);
	const image = new URL(await staticCardPath(context.env.ASSETS, url.origin, cardParams(url.searchParams)), url.origin).toString();
	// The canonical link keeps what it opens and drops the campaign tags.
	const canonical = new URL('/', url.origin);
	for (const [k, v] of url.searchParams) if (!k.startsWith('utm_')) canonical.searchParams.append(k, v);
	const set = (value: string) => ({ element: (e: Element) => { e.setAttribute('content', value); } });

	return new HTMLRewriter()
		.on('meta[property="og:image"]', set(image))
		.on('meta[name="twitter:image"]', set(image))
		.on('meta[property="og:image:alt"]', set(title))
		.on('meta[property="og:title"]', set(title))
		.on('meta[name="twitter:title"]', set(title))
		.on('meta[property="og:description"]', set(description))
		.on('meta[name="twitter:description"]', set(description))
		.on('meta[property="og:url"]', set(canonical.toString()))
		.transform(response);
};
