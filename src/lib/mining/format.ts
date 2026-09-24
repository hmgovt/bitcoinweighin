/** Number formatting for the /mining page's very large and very small quantities. */

const SUP: Record<string, string> = {
	'0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻',
};
export const sup = (n: number): string => String(n).split('').map((c) => SUP[c] ?? c).join('');
export const n0 = (n: number): string => n.toLocaleString('en-US');

/** 5.7 × 10²³ */
export function fmtSci(n: number, d = 1): string {
	const e = Math.floor(Math.log10(n));
	return `${(n / 10 ** e).toFixed(d)} × 10${sup(e)}`;
}

/** 2.68 sextillion */
export function fmtBig(n: number): string {
	const units: [number, string][] = [
		[1e24, 'septillion'], [1e21, 'sextillion'], [1e18, 'quintillion'], [1e15, 'quadrillion'],
		[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million'],
	];
	for (const [v, w] of units) {
		if (n >= v) {
			const m = n / v;
			return `${m.toFixed(m < 10 ? 2 : m < 100 ? 1 : 0)} ${w}`;
		}
	}
	return Math.round(n).toLocaleString('en-US');
}

/** Seconds → the most readable unit, from nanoseconds to 10¹⁵ years. */
export function fmtDur(s: number): string {
	if (s < 1e-6) return `${(s * 1e9).toFixed(0)} ns`;
	if (s < 1e-3) return `${(s * 1e6).toFixed(0)} µs`;
	if (s < 1) return `${(s * 1e3).toFixed(0)} ms`;
	if (s < 120) return `${s.toFixed(0)} seconds`;
	if (s < 7200) return `${(s / 60).toFixed(0)} minutes`;
	if (s < 172800) return `${(s / 3600).toFixed(0)} hours`;
	const y = s / 31557600;
	if (y < 2) return `${(s / 86400).toFixed(0)} days`;
	if (y < 1e6) return `${Math.round(y).toLocaleString('en-US')} years`;
	return `${fmtSci(y)} years`;
}
