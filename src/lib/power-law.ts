/**
 * Power-law + log-periodic oscillation model for BTC/USD.
 *
 * A TypeScript port of a Python notebook ("Bitcoin: Power Laws and
 * Log-Periodic Oscillations") shared by @CaffeSatoshi on X
 * (https://x.com/CaffeSatoshi/status/2119977416038965561; code at
 * https://pastebin.com/1171prcG, 9 Nov 2026).
 *
 * Credits:
 *   - Dacoinminster power law: Bitcointalk user dacoinminster, 13 Feb 2013
 *     (price = 4.41877e-17 × days^5.598, rounded to 4.42e-17 and 5.6).
 *   - Perrenod global power law (0.00688 × T^5.848) and log-periodic scaling
 *     ratios λ₁ = 2.081, λ₂ = 1.305: Stephen Perrenod, "Two-Year Scenario for
 *     Bitcoin: Two Log-Periodic Modes", Money or Debt Newsletter, 9 Aug 2026,
 *     https://stephenperrenod.substack.com/p/two-year-scenario-for-bitcoin-two
 *
 * Two published power laws act as the
 * baseline; two log-periodic waves (fixed scale ratios λ₁, λ₂) are
 * least-squares fitted to log10(actual / Perrenod) over the most recent
 * FIT_YEARS of price history.
 *
 * Every function here is pure, so the server load can fit the coefficients
 * once at build time and the browser can evaluate the curves out to any
 * horizon the reader picks.
 *
 * This is curve-fitting, not a forecast anyone should trade on.
 */

export const GENESIS_MS = Date.UTC(2009, 0, 3);
const DAY_MS = 86_400_000;
const YEAR_DAYS = 365.2425;

export const FIT_YEARS = 5;

export const LAMBDA_1 = 2.081;
export const LAMBDA_2 = 1.305;
export const OMEGA_1 = (2 * Math.PI) / Math.log(LAMBDA_1);
export const OMEGA_2 = (2 * Math.PI) / Math.log(LAMBDA_2);

export const DACOINMINSTER_COEFFICIENT = 4.42e-17;
export const DACOINMINSTER_EXPONENT = 5.6;
export const PERRENOD_COEFFICIENT = 0.00688;
export const PERRENOD_EXPONENT = 5.848;

/** Whole days since the genesis block (2009-01-03 UTC). */
export function daysSinceGenesis(ms: number): number {
	return Math.floor((ms - GENESIS_MS) / DAY_MS);
}

export function ageYears(ms: number): number {
	return daysSinceGenesis(ms) / YEAR_DAYS;
}

export function dacoinminster(ms: number): number {
	return DACOINMINSTER_COEFFICIENT * daysSinceGenesis(ms) ** DACOINMINSTER_EXPONENT;
}

export function perrenod(ms: number): number {
	return PERRENOD_COEFFICIENT * ageYears(ms) ** PERRENOD_EXPONENT;
}

/** Design-matrix row: [1, cos ω₁ln t, sin ω₁ln t, cos ω₂ln t, sin ω₂ln t]. */
function basis(age: number): number[] {
	const lt = Math.log(age);
	return [
		1,
		Math.cos(OMEGA_1 * lt),
		Math.sin(OMEGA_1 * lt),
		Math.cos(OMEGA_2 * lt),
		Math.sin(OMEGA_2 * lt),
	];
}

/** Solve A x = b (square) by Gaussian elimination with partial pivoting. */
function solve(A: number[][], b: number[]): number[] {
	const n = b.length;
	const M = A.map((row, i) => [...row, b[i]]);
	for (let col = 0; col < n; col++) {
		let pivot = col;
		for (let r = col + 1; r < n; r++) {
			if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
		}
		if (Math.abs(M[pivot][col]) < 1e-12) throw new Error('power-law fit: singular matrix');
		[M[col], M[pivot]] = [M[pivot], M[col]];
		for (let r = col + 1; r < n; r++) {
			const f = M[r][col] / M[col][col];
			for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
		}
	}
	const x = new Array<number>(n).fill(0);
	for (let r = n - 1; r >= 0; r--) {
		let s = M[r][n];
		for (let c = r + 1; c < n; c++) s -= M[r][c] * x[c];
		x[r] = s / M[r][r];
	}
	return x;
}

export interface PricePoint {
	/** UTC midnight, epoch ms */
	t: number;
	btc: number;
}

export interface OscillationFit {
	/** [c0, c1, c2, c3, c4] */
	coefficients: number[];
	fitStart: number;
	fitEnd: number;
	n: number;
}

/**
 * Least-squares fit of the two oscillations over the last `years` of
 * `series` (which must be sorted ascending). Same window rule as the
 * notebook: fit_end = last observation, fit_start = fit_end − years.
 */
export function fitOscillations(series: PricePoint[], years = FIT_YEARS): OscillationFit {
	if (series.length === 0) throw new Error('power-law fit: empty series');
	const fitEnd = series[series.length - 1].t;
	const end = new Date(fitEnd);
	const fitStart = Date.UTC(end.getUTCFullYear() - years, end.getUTCMonth(), end.getUTCDate());

	// Normal equations XᵀX c = Xᵀy (5×5, well conditioned for sin/cos columns).
	const XtX = Array.from({ length: 5 }, () => new Array<number>(5).fill(0));
	const Xty = new Array<number>(5).fill(0);
	let n = 0;
	for (const p of series) {
		if (p.t < fitStart || p.t > fitEnd || !(p.btc > 0)) continue;
		const age = ageYears(p.t);
		const row = basis(age);
		const y = Math.log10(p.btc / perrenod(p.t));
		for (let i = 0; i < 5; i++) {
			Xty[i] += row[i] * y;
			for (let j = 0; j < 5; j++) XtX[i][j] += row[i] * row[j];
		}
		n++;
	}
	if (n < 5) throw new Error('power-law fit: not enough points in fit window');
	return { coefficients: solve(XtX, Xty), fitStart, fitEnd, n };
}

export interface ModelValues {
	dacoinminster: number;
	perrenod: number;
	oscillation1: number;
	oscillation2: number;
	combined: number;
	average: number;
}

export function evaluate(ms: number, coefficients: number[]): ModelValues {
	const [c0, c1, c2, c3, c4] = coefficients;
	const lt = Math.log(ageYears(ms));
	const o1 = c1 * Math.cos(OMEGA_1 * lt) + c2 * Math.sin(OMEGA_1 * lt);
	const o2 = c3 * Math.cos(OMEGA_2 * lt) + c4 * Math.sin(OMEGA_2 * lt);
	const base = perrenod(ms);
	const oscillation1 = base * 10 ** (c0 + o1);
	const oscillation2 = base * 10 ** (c0 + o2);
	const combined = base * 10 ** (c0 + o1 + o2);
	return {
		dacoinminster: dacoinminster(ms),
		perrenod: base,
		oscillation1,
		oscillation2,
		combined,
		average: (oscillation1 + oscillation2 + combined) / 3,
	};
}

export interface Peak {
	t: number;
	price: number;
}

/** Day with the highest Combined value in [from, to] (inclusive, daily). */
export function peakBetween(from: number, to: number, coefficients: number[]): Peak {
	let best: Peak = { t: from, price: -Infinity };
	for (let t = from; t <= to; t += DAY_MS) {
		const v = evaluate(t, coefficients).combined;
		if (v > best.price) best = { t, price: v };
	}
	return best;
}

/**
 * Local maxima of the Combined curve strictly after `from`, up to `to`.
 * Scans weekly, then refines each candidate to the exact day.
 */
export function forecastPeaks(from: number, to: number, coefficients: number[]): Peak[] {
	const WEEK = 7 * DAY_MS;
	const peaks: Peak[] = [];
	let prev = evaluate(from, coefficients).combined;
	let cur = evaluate(from + WEEK, coefficients).combined;
	for (let t = from + WEEK; t + WEEK <= to; t += WEEK) {
		const next = evaluate(t + WEEK, coefficients).combined;
		if (cur > prev && cur >= next) {
			peaks.push(peakBetween(t - WEEK, t + WEEK, coefficients));
		}
		prev = cur;
		cur = next;
	}
	return peaks;
}

/** First day in [from, to] the Combined curve reaches `level`, or null. */
export function firstCrossing(
	from: number,
	to: number,
	level: number,
	coefficients: number[]
): number | null {
	for (let t = from; t <= to; t += DAY_MS) {
		if (evaluate(t, coefficients).combined >= level) return t;
	}
	return null;
}
