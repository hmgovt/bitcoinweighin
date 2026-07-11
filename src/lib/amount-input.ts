/**
 * Parser for the click-to-type BTC amount input (delight brief §1.5a).
 *
 * Grammars accepted (case-insensitive, comma/underscore/whitespace tolerant):
 *   plain BTC:  "0.5"  "1.23"  "21000000"  "21,000,000"
 *   sats:       "50000 sats"  "1 sat"  "10k sats"  "1.5M sats"
 *   dollars:    "$1M"  "$25,000"  "$1.5B"  "$100k"   (via the day's BTC price)
 *
 * Dollar amounts need a positive `btcUsdPrice`; without one they parse to
 * null rather than guessing. "$" combined with a sats suffix is invalid.
 * Results are clamped to the slider's range [1 sat, 21M BTC]. Anything
 * non-finite, non-positive, or outside the grammar returns null — the input
 * simply doesn't commit; there is no error state to style.
 */

export const BTC_MIN = 0.00000001; // 1 sat
export const BTC_MAX = 21_000_000;

const SUFFIX_MULT: Record<string, number> = {
	k: 1e3,
	m: 1e6,
	b: 1e9,
	t: 1e12,
};

/** Parse the numeric core of a token: digits with optional decimal point and
 *  optional single k/m/b/t magnitude suffix. Returns null on anything else. */
function parseNumberWithSuffix(raw: string): number | null {
	const m = raw.match(/^([0-9]*\.?[0-9]+)\s*([kmbt])?$/);
	if (!m) return null;
	const base = Number(m[1]);
	if (!Number.isFinite(base)) return null;
	return m[2] ? base * SUFFIX_MULT[m[2]] : base;
}

export function parseAmountInput(raw: string, btcUsdPrice: number | null): number | null {
	if (typeof raw !== 'string') return null;
	// Normalise: lowercase, strip commas/underscores, collapse whitespace.
	let s = raw.toLowerCase().replace(/[,_]/g, '').trim();
	if (!s) return null;

	const isUsd = s.startsWith('$');
	if (isUsd) s = s.slice(1).trim();

	// Optional sats suffix ("sat" / "sats"), separated or attached.
	let isSats = false;
	const satsMatch = s.match(/^(.*?)\s*sats?$/);
	if (satsMatch) {
		isSats = true;
		s = satsMatch[1].trim();
	}

	if (isUsd && isSats) return null; // "$100 sats" is not a thing
	if (!s) return null;

	const value = parseNumberWithSuffix(s);
	if (value === null || !Number.isFinite(value) || value <= 0) return null;

	let btc: number;
	if (isUsd) {
		if (!btcUsdPrice || !Number.isFinite(btcUsdPrice) || btcUsdPrice <= 0) return null;
		btc = value / btcUsdPrice;
	} else if (isSats) {
		btc = value / 1e8;
	} else {
		btc = value;
	}

	if (!Number.isFinite(btc) || btc <= 0) return null;
	return Math.min(BTC_MAX, Math.max(BTC_MIN, btc));
}
