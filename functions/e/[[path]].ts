/// <reference types="@cloudflare/workers-types" />
/**
 * /e/* — relay for the site's anonymous visit counts (PostHog EU, cookieless).
 *
 * static/count.js loads PostHog from here and sends its events here, so the
 * visitor's browser only ever talks to bitcoinweighin.com. This function passes
 * each request on to PostHog's EU servers:
 *   /e/static/*, /e/array/*  → eu-assets.i.posthog.com (the script itself)
 *   everything else          → eu.i.posthog.com (events)
 *
 * Only five request headers go on. The visitor's IP goes as x-forwarded-for
 * because PostHog's cookieless mode needs it for a daily, salted one-way hash
 * that tells one day's visits apart; the project is set to discard the IP
 * before anything is stored. Any cookie PostHog tries to set is dropped.
 * Described on /privacy.
 */

const POSTHOG_INGEST = 'eu.i.posthog.com';
const POSTHOG_ASSETS = 'eu-assets.i.posthog.com';
const FORWARDED_HEADERS = ['content-type', 'content-encoding', 'user-agent', 'accept', 'accept-encoding'];

export const onRequest: PagesFunction = async ({ request }) => {
	const url = new URL(request.url);
	const path = url.pathname.slice('/e'.length) || '/';
	const host = path.startsWith('/static/') || path.startsWith('/array/') ? POSTHOG_ASSETS : POSTHOG_INGEST;

	const headers = new Headers();
	for (const name of FORWARDED_HEADERS) {
		const value = request.headers.get(name);
		if (value) headers.set(name, value);
	}
	const ip = request.headers.get('cf-connecting-ip');
	if (ip) headers.set('x-forwarded-for', ip);

	const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
	const answer = await fetch(`https://${host}${path}${url.search}`, {
		method: request.method,
		headers,
		body: hasBody ? await request.arrayBuffer() : undefined,
	});
	const out = new Response(answer.body, answer);
	out.headers.delete('set-cookie');
	return out;
};
