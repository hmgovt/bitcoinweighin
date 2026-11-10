/**
 * The Hashweight fleet model — what the machines behind the network's
 * hashrate weigh, at any date since 2014. Pure; tested in
 * tests/hashweight-fleet.test.ts; explained on /methodology#hashweight.
 *
 * Hashrate alone doesn't give a weight: 1 EH/s was ~870,000 machines in
 * 2015 and ~5,000 today. So the fleet is modelled in cohorts:
 *
 *  1. CAPACITY. The network's installed capacity is the running maximum of
 *     its 30-day-mean hashrate. Machines switched off in a dip (the 2021
 *     China ban halved the hashrate for months) still exist and still weigh.
 *  2. ARRIVALS. Every rise in capacity is built from the most efficient
 *     machine on sale at the time (the "frontier", MACHINES below).
 *  3. RETIREMENT. Each cohort runs for LIFETIME_YEARS, then is replaced,
 *     like for like in hashrate, by that day's frontier machine.
 *
 * The frontier is Bitmain's Antminer line, the most-deployed family, from
 * published spec sheets. Older units ran on a separate power supply, which
 * is added in. Real fleets mix makers and lag the frontier in patches, so
 * treat every output as ±30%.
 */

export interface Machine {
	id: string;
	name: string;
	/** First month it shipped in volume (YYYY-MM). */
	from: string;
	/** Hashrate, TH/s. */
	ths: number;
	/** Net weight of the unit, kg. */
	kg: number;
	/** Separate power supply, kg (0 once the PSU moved inside the case). */
	psuKg: number;
	/** Case size, mm. */
	mm: [number, number, number];
	/** Separate power supply size, mm. */
	psuMm?: [number, number, number];
	/** Where the figures come from — shown on /methodology. */
	source: string;
}

/** Bitmain APW3++ (the external PSU of the S7/S9 era): 2.3 kg. */
const APW3_KG = 2.3;
const APW3_MM: [number, number, number] = [266, 108, 41];

export const MACHINES: Machine[] = [
	{
		id: 's5',
		name: 'Antminer S5',
		from: '2014-12',
		ths: 1.155,
		kg: 3.5,
		psuKg: APW3_KG,
		mm: [298, 137, 155],
		psuMm: APW3_MM,
		source: 'Bitmain S5 spec: 1,155 GH/s, 3.5 kg, 298 × 137 × 155 mm; ran on a separate ATX-class supply (APW3++ used as a stand-in)',
	},
	{
		id: 's7',
		name: 'Antminer S7',
		from: '2015-09',
		ths: 4.73,
		kg: 3.5,
		psuKg: APW3_KG,
		mm: [301, 123, 155],
		psuMm: APW3_MM,
		source: 'Bitmain S7 spec: 4.73 TH/s, 301 × 123 × 155 mm; retailers list 3–4 kg (3.5 used); APW3+ supply 2.3 kg',
	},
	{
		id: 's9',
		name: 'Antminer S9',
		from: '2016-06',
		ths: 13.5,
		kg: 4.2,
		psuKg: APW3_KG,
		mm: [350, 135, 158],
		psuMm: APW3_MM,
		source: 'Bitmain S9 spec: 13.5 TH/s, 4.2 kg, 350 × 135 × 158 mm; APW3++ supply 2.3 kg',
	},
	{
		id: 's17',
		name: 'Antminer S17',
		from: '2019-04',
		ths: 53,
		kg: 9.5,
		psuKg: 0,
		mm: [298, 178, 297],
		source: 'Bitmain S17 spec: 53 TH/s normal mode, 9.5 kg, 298.2 × 178 × 296.6 mm, supply built in',
	},
	{
		id: 's19pro',
		name: 'Antminer S19 Pro',
		from: '2020-05',
		ths: 110,
		kg: 13.2,
		psuKg: 0,
		mm: [400, 195, 290],
		source: 'Bitmain S19 Pro spec: 110 TH/s, 13.2 kg, 400 × 195 × 290 mm',
	},
	{
		id: 's19xp',
		name: 'Antminer S19 XP',
		from: '2022-07',
		ths: 140,
		kg: 14.4,
		psuKg: 0,
		mm: [400, 195, 290],
		source: 'Bitmain S19 XP spec: 140 TH/s, 14.4 kg; S19-family case, 400 × 195 × 290 mm',
	},
	{
		id: 's21',
		name: 'Antminer S21',
		from: '2024-01',
		ths: 200,
		kg: 15.4,
		psuKg: 0,
		mm: [400, 195, 290],
		source: 'Bitmain S21 spec: 200 TH/s, 15.4 kg, 400 × 195 × 290 mm',
	},
	{
		id: 's21xp',
		name: 'Antminer S21 XP',
		from: '2024-11',
		ths: 270,
		kg: 18.7,
		psuKg: 0,
		mm: [400, 195, 290],
		source: 'Bitmain S21 XP spec: 270 TH/s, 18.7 kg; S21-family case, 400 × 195 × 290 mm',
	},
];

export const LIFETIME_YEARS = 5;
export const SMOOTH_DAYS = 30;

const DAY_MS = 86_400_000;
const YEAR_MS = 365.25 * DAY_MS;

function monthStartMs(ym: string): number {
	const [y, m] = ym.split('-').map(Number);
	return Date.UTC(y, m - 1, 1);
}
const FROM_MS = MACHINES.map((m) => monthStartMs(m.from));

/** The frontier machine at `ts` (ms). Before the first entry, the first —
 *  earlier ASICs were heavier per TH/s, so 2014 figures are a lower bound. */
export function frontierAt(ts: number): Machine {
	let i = 0;
	while (i + 1 < MACHINES.length && FROM_MS[i + 1] <= ts) i++;
	return MACHINES[i];
}

/** Everything one machine brings, including its separate supply. */
export function machineKg(m: Machine): number {
	return m.kg + m.psuKg;
}
export function machineM3(m: Machine): number {
	const v = (d: [number, number, number]) => (d[0] * d[1] * d[2]) / 1e9;
	return v(m.mm) + (m.psuMm ? v(m.psuMm) : 0);
}

export interface HashPoint {
	/** Unix ms. */
	ts: number;
	/** Hashrate, EH/s. */
	eh: number;
}

export interface FleetPoint {
	ts: number;
	/** Hashrate at this point, EH/s (as measured). */
	eh: number;
	/** Installed capacity, EH/s (running max of the 30-day mean). */
	capacityEh: number;
	machines: number;
	massKg: number;
	volumeM3: number;
	/** Capacity by machine id, EH/s — the fleet mix. */
	mix: Record<string, number>;
}

interface Cohort {
	ts: number;
	eh: number;
	machine: Machine;
}

/**
 * Run the cohort model over a hashrate history (any spacing, any order).
 * Returns one FleetPoint per input point, in time order.
 */
export function fleetHistory(
	points: HashPoint[],
	opts: { lifetimeYears?: number; smoothDays?: number } = {}
): FleetPoint[] {
	const life = (opts.lifetimeYears ?? LIFETIME_YEARS) * YEAR_MS;
	const window = (opts.smoothDays ?? SMOOTH_DAYS) * DAY_MS;
	const pts = points.filter((p) => Number.isFinite(p.eh) && p.eh >= 0).sort((a, b) => a.ts - b.ts);

	const byId: Record<string, number> = {};
	for (const m of MACHINES) byId[m.id] = 0;
	const queue: Cohort[] = [];
	let head = 0;
	const push = (c: Cohort) => {
		if (!(c.eh > 0)) return;
		queue.push(c);
		byId[c.machine.id] += c.eh;
	};

	const out: FleetPoint[] = [];
	let lo = 0;
	let sum = 0;
	let capacity = 0;
	for (let i = 0; i < pts.length; i++) {
		const p = pts[i];
		// Trailing mean over the smoothing window.
		sum += p.eh;
		while (pts[lo].ts < p.ts - window) sum -= pts[lo++].eh;
		const mean = sum / (i - lo + 1);

		// Arrivals: any rise in capacity, on today's frontier machine.
		if (mean > capacity) {
			push({ ts: p.ts, eh: mean - capacity, machine: frontierAt(p.ts) });
			capacity = mean;
		}
		// Retirements, replaced like for like in hashrate by today's frontier.
		// Cohorts sit in time order, and replacements are stamped `now`, so
		// they join the back of the queue.
		while (head < queue.length && queue[head].ts <= p.ts - life) {
			const old = queue[head++];
			byId[old.machine.id] -= old.eh;
			push({ ts: p.ts, eh: old.eh, machine: frontierAt(p.ts) });
		}

		let machines = 0;
		let massKg = 0;
		let volumeM3 = 0;
		const mix: Record<string, number> = {};
		for (const m of MACHINES) {
			const eh = Math.max(0, byId[m.id]);
			if (eh < 1e-12) continue;
			mix[m.id] = eh;
			const units = (eh * 1e6) / m.ths;
			machines += units;
			massKg += units * machineKg(m);
			volumeM3 += units * machineM3(m);
		}
		out.push({ ts: p.ts, eh: p.eh, capacityEh: capacity, machines, massKg, volumeM3, mix });
	}
	return out;
}

/** The fleet point nearest `ts` (binary search). */
export function fleetAt(series: FleetPoint[], ts: number): FleetPoint | null {
	if (!series.length) return null;
	let a = 0;
	let b = series.length - 1;
	while (b - a > 1) {
		const mid = (a + b) >> 1;
		if (series[mid].ts <= ts) a = mid;
		else b = mid;
	}
	return Math.abs(series[a].ts - ts) <= Math.abs(series[b].ts - ts) ? series[a] : series[b];
}

// ── Bitcoin in existence ────────────────────────────────────────────────────

/** Halving dates and the supply at each (the block subsidy halves every
 *  210,000 blocks; supply at the n-th halving is 21M × (1 − 2⁻ⁿ)). The 2028
 *  date is a projection. Between them, blocks arrive at a near-steady rate,
 *  so supply is interpolated linearly in time. */
const HALVINGS: [string, number][] = [
	['2012-11-28', 10_500_000],
	['2016-07-09', 15_750_000],
	['2020-05-11', 18_375_000],
	['2024-04-20', 19_687_500],
	['2028-04-15', 20_343_750],
];

/** Bitcoin in existence at `ts` (ms), to within a few thousand BTC. */
export function btcSupplyAt(ts: number): number {
	const pts = HALVINGS.map(([d, s]) => [Date.parse(d + 'T00:00:00Z'), s] as const);
	if (ts <= pts[0][0]) return pts[0][1];
	for (let i = 1; i < pts.length; i++) {
		if (ts <= pts[i][0]) {
			const [t0, s0] = pts[i - 1];
			const [t1, s1] = pts[i];
			return s0 + ((s1 - s0) * (ts - t0)) / (t1 - t0);
		}
	}
	return pts[pts.length - 1][1];
}

// ── Comparisons ─────────────────────────────────────────────────────────────

/** RMS Titanic loaded displacement, tonnes (see network-weight.ts). */
export const TITANIC_T = 53_150;
/** Titanic, keel to funnel tops, and overall length, m. */
export const TITANIC_HEIGHT_M = 53;
export const TITANIC_LENGTH_M = 269;
/** A 40-ft shipping container (ISO 668), outside: 12.19 × 2.44 × 2.59 m. */
export const CONTAINER_M: [number, number, number] = [12.19, 2.44, 2.59];

export function cubeEdgeM(volumeM3: number): number {
	return volumeM3 > 0 ? Math.cbrt(volumeM3) : 0;
}
