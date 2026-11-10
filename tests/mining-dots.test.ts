import { describe, it, expect } from 'vitest';
import {
	allocateDots,
	buildIndustrialDots,
	buildSoloDots,
	phPerDot,
	devicesPerSoloDot,
	COVERED_PCT,
	INDUSTRIAL_DOT_COUNT,
} from '../src/lib/mining-dots.js';
import { MINING_CLUSTERS, SOLO_DEVICE_COUNT } from '../src/lib/mining-clusters.js';

const everywhere = () => true;
/** Only the northern hemisphere east of Greenwich is "land". */
const quarter = (lat: number, lng: number) => lat > 0 && lng > 0;

describe('allocateDots', () => {
	it('hands out exactly the total, proportional to share', () => {
		const n = allocateDots(MINING_CLUSTERS, 9000);
		expect(n.reduce((s, x) => s + x, 0)).toBe(9000);
		const big = MINING_CLUSTERS.findIndex((c) => c.id === 'kz-ekib');
		const small = MINING_CLUSTERS.findIndex((c) => c.id === 'om');
		expect(n[big]).toBeGreaterThan(n[small] * 10);
	});
});

describe('buildIndustrialDots', () => {
	it('is deterministic', () => {
		const a = buildIndustrialDots(everywhere);
		const b = buildIndustrialDots(everywhere);
		expect(a.length).toBe(b.length);
		expect(a.slice(0, 50)).toEqual(b.slice(0, 50));
	});

	it('produces close to the full count when everything is land', () => {
		const dots = buildIndustrialDots(everywhere);
		expect(dots.length).toBe(INDUSTRIAL_DOT_COUNT);
		for (const d of dots) {
			expect(d.lat).toBeGreaterThanOrEqual(-84);
			expect(d.lat).toBeLessThanOrEqual(84);
			expect(d.lng).toBeGreaterThanOrEqual(-180);
			expect(d.lng).toBeLessThanOrEqual(180);
			expect(d.w).toBeGreaterThan(0);
			expect(d.w).toBeLessThanOrEqual(1);
		}
	});

	it('keeps dots near their cluster and of its type', () => {
		const dots = buildIndustrialDots(everywhere);
		for (const d of dots.filter((_, i) => i % 37 === 0)) {
			const c = MINING_CLUSTERS[d.cluster];
			expect(d.type).toBe(c.type);
			expect(Math.abs(d.lat - c.lat)).toBeLessThan(20);
		}
	});

	it('never places a dot off land', () => {
		const dots = buildIndustrialDots(quarter);
		expect(dots.length).toBeGreaterThan(0);
		for (const d of dots) expect(quarter(d.lat, d.lng)).toBe(true);
	});
});

describe('buildSoloDots', () => {
	it('respects the land test and is non-empty', () => {
		const dots = buildSoloDots(everywhere);
		expect(dots.length).toBeGreaterThan(3000);
		for (const d of buildSoloDots(quarter)) expect(quarter(d.lat, d.lng)).toBe(true);
	});
});

describe('scale', () => {
	it('splits the covered hashrate evenly across dots', () => {
		expect(phPerDot(1000, 9000) * 9000).toBeCloseTo((1000 * 1000 * Math.min(COVERED_PCT, 100)) / 100, 6);
		expect(phPerDot(1000, 0)).toBe(0);
	});
	it('splits home devices across solo dots', () => {
		expect(devicesPerSoloDot(4000)).toBe(SOLO_DEVICE_COUNT / 4000);
	});
});
