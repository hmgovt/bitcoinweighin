/**
 * bitcointreasuries.net scraper for the holdings-sync orchestrator.
 *
 * Each entity has a dedicated detail page that server-renders the
 * current BTC figure in plain HTML (no JS execution needed). We fetch
 * the page with a real browser UA and pull the first `<digits> BTC`
 * occurrence — the detail-page hero displays the figure four times in
 * the first kilobyte, so the first match is reliably the live total.
 *
 * Returning `null` (rather than throwing) lets the orchestrator skip
 * one bad source without aborting the rest of the daily sync.
 *
 * The site's response headers grew past Node's 16 KB default around
 * 1 Oct 2026 (a ~16 KB `link` preload header), which fails every fetch
 * with UND_ERR_HEADERS_OVERFLOW. `npm run holdings:sync` raises the
 * limit with --max-http-header-size.
 */

const BASE = 'https://bitcointreasuries.net';
const UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
	'(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface BitcointreasuriesResult {
	btc: number;
	sourceUrl: string;
}

export async function fetchBitcointreasuries(
	path: string
): Promise<BitcointreasuriesResult | null> {
	const sourceUrl = `${BASE}/${path.replace(/^\//, '')}`;
	let html: string;
	try {
		const res = await fetch(sourceUrl, {
			headers: { 'User-Agent': UA, Accept: 'text/html' },
		});
		if (!res.ok) {
			console.warn(`  bitcointreasuries: HTTP ${res.status} for ${path}`);
			return null;
		}
		html = await res.text();
	} catch (err) {
		// Node's fetch reports every network failure as "fetch failed"; the reason is in err.cause.
		const cause = (err as { cause?: { code?: string; message?: string } }).cause;
		const why = cause ? ` (${[cause.code, cause.message].filter(Boolean).join(': ')})` : '';
		console.warn(`  bitcointreasuries: fetch failed for ${path}: ${err}${why}`);
		return null;
	}

	const match = html.match(/(\d[\d,]*)\s*BTC/);
	if (!match) {
		console.warn(`  bitcointreasuries: no BTC figure parsed for ${path}`);
		return null;
	}
	const btc = Number(match[1].replace(/,/g, ''));
	if (!isFinite(btc) || btc <= 0) {
		console.warn(`  bitcointreasuries: unparseable BTC "${match[1]}" for ${path}`);
		return null;
	}
	return { btc, sourceUrl };
}
