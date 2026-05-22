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
		console.warn(`  bitcointreasuries: fetch failed for ${path}: ${err}`);
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
