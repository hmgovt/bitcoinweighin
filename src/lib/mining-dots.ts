/**
 * The globe's dot field: thousands of points modelled from the regional
 * hashrate shares in mining-clusters.ts. These are NOT surveyed mine sites —
 * no public site-level dataset exists. Each region's share becomes a number
 * of dots (one dot ≈ the same slice of hashrate everywhere), clumped into
 * campus-like sites scattered around the region, and kept on land by an
 * `isLand` test (the globe samples its own Earth texture, so dots never sit
 * in visible water).
 *
 * Deterministic: the same inputs always give the same dots.
 */
import {
	MINING_CLUSTERS,
	SOLO_REGIONS,
	SOLO_DEVICE_COUNT,
	type MiningCluster,
	type MiningType,
} from './mining-clusters.js';

export type IsLand = (lat: number, lng: number) => boolean;

export interface MiningDot {
	lat: number;
	lng: number;
	type: MiningType;
	/** Index into the clusters list (-1 for solo dots). */
	cluster: number;
	/** Relative brightness / size, 0–1. */
	w: number;
}

/** Industrial dots across all clusters. */
export const INDUSTRIAL_DOT_COUNT = 14000;
/** Home/solo miner dots. */
export const SOLO_DOT_COUNT = 4000;

/** mulberry32 — small, fast, good enough for scatter. */
export function seededRandom(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function gauss(rng: () => number): number {
	const u = Math.max(rng(), 1e-12);
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

/** Offset a point by (dLat, dLng) degrees of ground distance, longitude stretched by latitude. */
function offset(lat: number, lng: number, dLat: number, dLng: number): [number, number] {
	const la = Math.max(-84, Math.min(84, lat + dLat));
	const k = 1 / Math.max(0.2, Math.cos((la * Math.PI) / 180));
	let ln = lng + dLng * k;
	if (ln > 180) ln -= 360;
	if (ln < -180) ln += 360;
	return [la, ln];
}

/** Find a land point near (lat, lng) with Gaussian spread `sigma` degrees, or null. */
function landNear(
	rng: () => number,
	isLand: IsLand,
	lat: number,
	lng: number,
	sigma: number,
	tries: number
): [number, number] | null {
	for (let t = 0; t < tries; t++) {
		const p = offset(lat, lng, gauss(rng) * sigma, gauss(rng) * sigma);
		if (isLand(p[0], p[1])) return p;
	}
	return null;
}

/** Number of dots per cluster, proportional to hashrate share (largest remainder). */
export function allocateDots(clusters: MiningCluster[], total: number): number[] {
	const sum = clusters.reduce((s, c) => s + c.hashratePct, 0);
	const exact = clusters.map((c) => (c.hashratePct / sum) * total);
	const n = exact.map(Math.floor);
	let left = total - n.reduce((s, x) => s + x, 0);
	const order = exact.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]);
	for (let k = 0; left > 0; k++, left--) n[order[k % order.length][1]]++;
	return n;
}

export function buildIndustrialDots(
	isLand: IsLand,
	clusters: MiningCluster[] = MINING_CLUSTERS,
	total = INDUSTRIAL_DOT_COUNT
): MiningDot[] {
	const rng = seededRandom(0xb17c0de);
	const counts = allocateDots(clusters, total);
	const dots: MiningDot[] = [];

	clusters.forEach((c, ci) => {
		const n = counts[ci];
		if (n === 0) return;
		// Bigger regions sprawl further and hold more sites.
		const regionSigma = 1.6 + Math.sqrt(c.hashratePct) * 1.1;
		const siteCount = Math.max(4, Math.min(160, Math.round(n / 12)));
		const sites: { lat: number; lng: number; weight: number; sigma: number }[] = [];
		for (let s = 0; s < siteCount; s++) {
			const p = landNear(rng, isLand, c.lat, c.lng, regionSigma, 40) ?? [c.lat, c.lng];
			// Heavy-tailed weights: a few big campuses, many small ones.
			sites.push({ lat: p[0], lng: p[1], weight: Math.pow(rng(), -0.6), sigma: 0.05 + rng() * 0.25 });
		}
		const wSum = sites.reduce((s, x) => s + x.weight, 0);
		for (let k = 0; k < n; k++) {
			// Pick a site by weight.
			let r = rng() * wSum;
			let site = sites[0];
			for (const s of sites) {
				r -= s.weight;
				if (r <= 0) {
					site = s;
					break;
				}
			}
			// Most dots hug their site; some wander (outlying rigs).
			const sigma = rng() < 0.7 ? site.sigma : regionSigma * 0.7;
			const p = landNear(rng, isLand, site.lat, site.lng, sigma, 12);
			if (!p) continue;
			dots.push({ lat: p[0], lng: p[1], type: c.type, cluster: ci, w: 0.35 + 0.65 * Math.pow(rng(), 1.6) });
		}
	});
	return dots;
}

export function buildSoloDots(isLand: IsLand, total = SOLO_DOT_COUNT): MiningDot[] {
	const rng = seededRandom(0x50110);
	const weightSum = SOLO_REGIONS.reduce((s, r) => s + r.weight, 0);
	const dots: MiningDot[] = [];
	for (const reg of SOLO_REGIONS) {
		const n = Math.round((reg.weight / weightSum) * total);
		for (let k = 0; k < n; k++) {
			const p = landNear(rng, isLand, reg.lat, reg.lng, reg.spread, 10);
			if (!p) continue;
			dots.push({ lat: p[0], lng: p[1], type: 'industrial', cluster: -1, w: 0.3 + 0.7 * rng() });
		}
	}
	return dots;
}

/** Share of hashrate the industrial dots stand for, 0–100 (the clusters' summed share). */
export const COVERED_PCT = MINING_CLUSTERS.reduce((s, c) => s + c.hashratePct, 0);

/** PH/s one industrial dot stands for, at a given network hashrate. */
export function phPerDot(hashrateEh: number, dotCount: number): number {
	if (dotCount <= 0) return 0;
	return (hashrateEh * 1000 * Math.min(COVERED_PCT, 100)) / 100 / dotCount;
}

/** Home devices one solo dot stands for. */
export function devicesPerSoloDot(dotCount: number): number {
	return dotCount > 0 ? SOLO_DEVICE_COUNT / dotCount : 0;
}
