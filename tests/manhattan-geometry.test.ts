import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildManhattan } from '../src/lib/scene/manhattanGeometry.js';
import meta from '../src/lib/manhattan-map.json';

const bin = readFileSync(path.resolve('static/data/manhattan.bin'));
const buf = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);

describe('manhattan geometry', () => {
	const t0 = performance.now();
	const m = buildManhattan(buf, meta);
	const ms = performance.now() - t0;

	it('builds every lot and building from the packed map', () => {
		expect(meta.bytes).toBe(bin.byteLength);
		expect(m.lotIndexStart.length).toBe(meta.counts.lots + 1);
		expect(m.lots.index.length).toBe(m.lotIndexStart[meta.counts.lots]);
		expect(m.buildings.index.length).toBe(m.bldIndexByLot[meta.counts.lots] + (m.buildings.index.length - m.bldIndexByLot[meta.counts.lots]));
		expect(m.buildings.positions.length / 3).toBeGreaterThan(700_000);
		for (const mesh of [m.land, m.parks, m.lots, m.buildings]) {
			const nv = mesh.positions.length / 3;
			let max = 0;
			for (const i of mesh.index) max = Math.max(max, i);
			expect(max).toBeLessThan(nv);
			expect(mesh.index.length % 3).toBe(0);
		}
		console.log(`buildManhattan: ${ms.toFixed(0)} ms, ${(m.buildings.index.length / 3 / 1e6).toFixed(2)}M building tris, ${(m.lots.index.length / 3 / 1e3).toFixed(0)}k lot tris`);
	});

	it('keeps owned things a prefix: lot and building index starts only climb', () => {
		for (let i = 1; i < m.lotIndexStart.length; i++) expect(m.lotIndexStart[i]).toBeGreaterThanOrEqual(m.lotIndexStart[i - 1]);
		for (let i = 1; i < m.bldIndexByLot.length; i++) expect(m.bldIndexByLot[i]).toBeGreaterThanOrEqual(m.bldIndexByLot[i - 1]);
	});

	it('starts at the Battery and grows its bounds northward', () => {
		const n = meta.counts.lots;
		expect(m.lotCentroid[1]).toBeLessThan(-9000); // first lot: the island's southern tip
		expect(m.prefixBounds[(n - 1) * 4 + 3]).toBeGreaterThan(m.prefixBounds[3]);
		expect(m.prefixMaxHeight[meta.mainIslandLots - 1]).toBeGreaterThan(400); // the tallest towers are on the island
	});

	it('lays lots face-up', () => {
		// Every lot triangle's normal points up (+y) in the scene frame.
		const p = m.lots.positions;
		let down = 0;
		for (let t = 0; t < m.lots.index.length; t += 3) {
			const [a, b, c] = [m.lots.index[t] * 3, m.lots.index[t + 1] * 3, m.lots.index[t + 2] * 3];
			const ux = p[b] - p[a], uz = p[b + 2] - p[a + 2];
			const vx = p[c] - p[a], vz = p[c + 2] - p[a + 2];
			const ny = uz * vx - ux * vz;
			if (ny < 0) down++;
		}
		expect(down).toBe(0);
	});
});

import { southernSlice, ringsArea, fitDistance } from '../src/lib/scene/landPatch.js';

describe('land patch helpers', () => {
	const square: [number, number][] = [
		[0, 0],
		[10, 0],
		[10, 10],
		[0, 10],
	];

	it('slices a lot from the south to the owned fraction', () => {
		for (const f of [0.1, 0.37, 0.5, 0.9]) {
			const s = southernSlice([square], f);
			expect(ringsArea(s)).toBeCloseTo(100 * f, 3);
			for (const r of s) for (const [, y] of r) expect(y).toBeLessThanOrEqual(10 * f + 1e-6);
		}
	});

	it('counts holes when slicing', () => {
		const hole: [number, number][] = [
			[4, 1],
			[6, 1],
			[6, 3],
			[4, 3],
		];
		const s = southernSlice([square, hole], 0.5);
		expect(ringsArea(s)).toBeCloseTo((100 - 4) * 0.5, 3);
	});

	it('backs the camera off until a box fits', () => {
		// A 10 m cube seen head-on, 60° vertical field, square frame.
		const corners: [number, number, number][] = [];
		for (const x of [-5, 5]) for (const y of [-5, 5]) for (const z of [-5, 5]) corners.push([x, y, z]);
		const d = fitDistance(corners, [0, 0, 1], [1, 0, 0], [0, 1, 0], Math.PI / 3, 1, 1);
		expect(d).toBeCloseTo(5 + 5 / Math.tan(Math.PI / 6), 6);
	});
});
