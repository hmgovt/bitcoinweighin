/// <reference types="@cloudflare/workers-types" />
/**
 * Lightning Address proxy — Cloudflare Pages Function.
 *
 *   GET /.well-known/lnurlp/tips
 *
 * Routes tips@bitcoinweighin.com to the upstream Xverse LNURL-pay
 * endpoint. Wallets do an initial lookup here, then call the upstream
 * `callback` URL directly to fetch a Lightning invoice — we only sit
 * on step 2 of the LNURL flow.
 *
 * Upstream returns a 307 to lightningaddress.snsnames.xyz; `fetch`
 * follows redirects by default, so the body that lands here is the
 * final payRequest JSON.
 */

const XVERSE_LNURL =
	'https://xverse.sati.pro/.well-known/lnurlp/bc1qaam6e5xmqxwxpwwns02jf7t7hvhnkqwyxc92qj';

export const onRequest: PagesFunction = async ({ request }) => {
	const upstream = new URL(XVERSE_LNURL);
	const incomingParams = new URL(request.url).searchParams;
	incomingParams.forEach((v, k) => upstream.searchParams.set(k, v));

	let response: Response;
	try {
		response = await fetch(upstream.toString(), {
			headers: { Accept: 'application/json' },
		});
	} catch {
		return new Response(
			JSON.stringify({ status: 'ERROR', reason: 'Upstream unavailable' }),
			{ status: 502, headers: { 'Content-Type': 'application/json' } },
		);
	}

	if (!response.ok) {
		return new Response(
			JSON.stringify({ status: 'ERROR', reason: 'Upstream unavailable' }),
			{ status: 502, headers: { 'Content-Type': 'application/json' } },
		);
	}

	const body = await response.text();

	return new Response(body, {
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
			'Cache-Control': 'no-store',
		},
	});
};
