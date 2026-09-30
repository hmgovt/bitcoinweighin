/// <reference types="@cloudflare/workers-types" />
/**
 * Which pre-rendered card (scripts/og/build-cards.ts) a link gets.
 *
 * Cards are rendered at build time because rendering one takes far more CPU
 * than a Worker may use. A link with a card of its own (1 BTC or a holder
 * at the latest close, or one listed in scripts/og/card-links.json) gets it.
 * Any other link gets its commodity's 1 BTC card, which says "1 bitcoin" on
 * its face, so it is never wrong, only less specific.
 */
import { cardKey, presetBtc } from './_card';

export interface CardParams {
	commodity: string | null;
	btc: string | null;
	preset: string | null;
	date: string | null;
}

export function cardParams(q: URLSearchParams): CardParams {
	return { commodity: q.get('commodity'), btc: q.get('btc'), preset: q.get('preset'), date: q.get('date') };
}

/** Path of the best pre-rendered card for these settings. */
export async function staticCardPath(assets: Fetcher, origin: string, p: CardParams): Promise<string> {
	const btc = parseFloat(p.btc ?? '');
	const own = `/og/cards/${cardKey({ commodity: p.commodity, btc: isFinite(btc) && btc > 0 ? btc : presetBtc(p.preset ?? undefined) ?? 1, preset: p.preset, date: p.date })}.png`;
	const res = await assets.fetch(new Request(new URL(own, origin), { method: 'GET' }));
	await res.body?.cancel();
	if (res.ok && (res.headers.get('content-type') ?? '').startsWith('image/')) return own;
	return `/og/cards/${cardKey({ commodity: p.commodity, btc: 1 })}.png`;
}
