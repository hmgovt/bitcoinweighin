/**
 * A synthetic weekly hashrate history, log-interpolated between rough
 * anchor values for the real network (EH/s). For tests and screenshots
 * only — the site always uses mempool.space's real series.
 */
import type { HashPoint } from '../../src/lib/hashweight/fleet.js';

export const ANCHORS: [string, number][] = [
	['2014-01-01', 0.012],
	['2014-07-01', 0.12],
	['2015-01-01', 0.3],
	['2016-01-01', 0.8],
	['2016-07-01', 1.5],
	['2017-01-01', 2.8],
	['2018-01-01', 16],
	['2019-01-01', 40],
	['2020-01-01', 110],
	['2021-05-01', 170],
	['2021-07-01', 95],
	['2022-01-01', 190],
	['2023-01-01', 260],
	['2024-01-01', 520],
	['2025-01-01', 800],
	['2026-01-01', 1050],
	['2026-09-20', 920],
];

export function syntheticHashrate(stepDays = 7): HashPoint[] {
	const a = ANCHORS.map(([d, eh]) => [Date.parse(d + 'T00:00:00Z'), eh] as const);
	const out: HashPoint[] = [];
	for (let t = a[0][0]; t <= a[a.length - 1][0]; t += stepDays * 86_400_000) {
		let i = 0;
		while (i + 2 < a.length && a[i + 1][0] <= t) i++;
		const [t0, e0] = a[i];
		const [t1, e1] = a[i + 1];
		const k = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
		out.push({ ts: t, eh: Math.exp(Math.log(e0) + (Math.log(e1) - Math.log(e0)) * k) });
	}
	return out;
}
