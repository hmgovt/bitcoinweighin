/**
 * Massive.com secondary-source fetcher for cross-validation.
 *
 * The exact endpoint and response shape for Massive's quote API are not
 * pinned in the project handoff; the configuration below treats the
 * endpoint as a single template string read from MASSIVE_QUOTE_URL with
 * {symbol} and {date} placeholders, plus a JSON field path read from
 * MASSIVE_QUOTE_FIELD. This lets the URL and parser be set once via repo
 * secrets without code changes when the Massive API contract is confirmed.
 *
 * Environment:
 *   MASSIVE_API_KEY    — required; passed as Bearer token.
 *   MASSIVE_QUOTE_URL  — optional; default
 *     "https://api.massive.com/v1/quote?symbol={symbol}&date={date}".
 *   MASSIVE_QUOTE_FIELD — optional; default "close". Dot path into the
 *     JSON response (e.g. "data.close" or "quote.last").
 *
 * Returns null in every failure mode (no key, HTTP error, parse error,
 * value missing) so the daily cron can degrade gracefully — cross
 * validation is a quality signal, not a build blocker.
 */

const DEFAULT_URL_TEMPLATE = 'https://api.massive.com/v1/quote?symbol={symbol}&date={date}';
const DEFAULT_FIELD_PATH = 'close';

export interface MassiveQuoteResult {
	value: number | null;
	httpStatus?: number;
	error?: string;
	url: string;
}

function readPath(obj: unknown, path: string): unknown {
	let cur: unknown = obj;
	for (const seg of path.split('.')) {
		if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
		cur = (cur as Record<string, unknown>)[seg];
	}
	return cur;
}

function redactUrl(url: string): string {
	return url
		.replace(/apikey=[^&]*/g, 'apikey=***')
		.replace(/api_key=[^&]*/g, 'api_key=***')
		.replace(/token=[^&]*/g, 'token=***');
}

export async function fetchMassiveQuote(
	symbol: string,
	dateISO: string
): Promise<MassiveQuoteResult> {
	const apiKey = process.env.MASSIVE_API_KEY;
	const template = process.env.MASSIVE_QUOTE_URL || DEFAULT_URL_TEMPLATE;
	const fieldPath = process.env.MASSIVE_QUOTE_FIELD || DEFAULT_FIELD_PATH;

	const url = template.replace(/\{symbol\}/g, encodeURIComponent(symbol)).replace(/\{date\}/g, dateISO);
	const redactedUrl = redactUrl(url);

	if (!apiKey) {
		return { value: null, error: 'MASSIVE_API_KEY not set', url: redactedUrl };
	}

	try {
		const res = await fetch(url, {
			headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
		});
		if (!res.ok) {
			return { value: null, httpStatus: res.status, error: `HTTP ${res.status}`, url: redactedUrl };
		}
		const json = await res.json();
		const raw = readPath(json, fieldPath);
		const num = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : NaN;
		if (!Number.isFinite(num)) {
			return {
				value: null,
				httpStatus: res.status,
				error: `field "${fieldPath}" missing or non-numeric`,
				url: redactedUrl,
			};
		}
		return { value: num, httpStatus: res.status, url: redactedUrl };
	} catch (err) {
		return { value: null, error: (err as Error).message, url: redactedUrl };
	}
}

/**
 * Tickers in the project dataset that Massive plausibly covers. If a ticker
 * isn't available on Massive, fetchMassiveQuote will return null and the
 * cross-validation step will skip it without writing a flag.
 *
 * symbol = how Massive identifies the instrument (best guess until confirmed)
 * datasetField = field name in static/prices.json
 */
export const MASSIVE_CROSS_VALIDATED: Array<{ symbol: string; datasetField: string }> = [
	{ symbol: 'BTC-USD', datasetField: 'btc' },
	{ symbol: 'XAU-USD', datasetField: 'xau' },
	{ symbol: 'XAG-USD', datasetField: 'xag' },
	{ symbol: 'XPT-USD', datasetField: 'xpt' },
];

export const CROSS_VALIDATION_THRESHOLD_PCT = 0.5;
