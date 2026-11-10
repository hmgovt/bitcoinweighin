import { describe, it, expect } from 'vitest';
import {
	STANDARD_GRAVITY,
	J_PER_TONNE_TNT,
	PA_PER_PSF,
	RESTITUTION,
	MAX_BOUNCES,
	dropHeightM,
	fallTimeS,
	impactEnergyJ,
	dropOffset,
	dropDurationS,
	nthImpactEnergyJ,
	hoistOffset,
	impactIntensity,
	shakeProfile,
	dustLifetimeS,
	bearingPressurePa,
	soilClassExceeded,
	exceedsBedrock,
	IBC_PRESUMPTIVE_BEARING,
	formatEnergy,
	formatDuration,
	formatTnt,
	formatPressure,
	formatDropLine,
	clearCameraFromCube,
} from '../src/lib/scene/drop.js';
import { getCommodity } from '../src/lib/commodities.js';
import { cubeEdgeMetres } from '../src/lib/scene/maths.js';

const gold = getCommodity('gold')!;
const silver = getCommodity('silver')!;

/** Gold cube edge + mass for a troy-ounce amount. */
function goldCube(troyOz: number) {
	return { edge: cubeEdgeMetres(troyOz, gold), massKg: (troyOz * gold.unitMassGrams!) / 1000 };
}

describe('drop — free fall from its own height', () => {
	it('drops from exactly one edge-length', () => {
		expect(dropHeightM(0.0317)).toBe(0.0317);
		expect(dropHeightM(-1)).toBe(0);
	});

	it('uses t = √(2h/g) — a 1 m drop takes ~0.4516 s', () => {
		expect(fallTimeS(1)).toBeCloseTo(0.4516, 4);
		expect(fallTimeS(0)).toBe(0);
	});

	it('makes fall time an honest scale cue: 21M BTC of gold falls ~50× longer than 1 sat', () => {
		// Fall time ∝ √edge ∝ mass^(1/6): 2.1e15 sats → (2.1e15)^(1/6) ≈ 360×.
		const ozPerBtc = 19.72; // ~Sep 2026 ratio; exact value irrelevant to the ratio
		const tiny = goldCube(ozPerBtc * 1e-8);
		const huge = goldCube(ozPerBtc * 21e6);
		const ratio = fallTimeS(huge.edge) / fallTimeS(tiny.edge);
		expect(ratio).toBeCloseTo(Math.pow(21e6 / 1e-8, 1 / 6), 3);
		expect(fallTimeS(huge.edge)).toBeGreaterThan(1); // monolith: over a second
		expect(fallTimeS(tiny.edge)).toBeLessThan(0.01); // speck: milliseconds
	});

	it('impact energy is m·g·h', () => {
		expect(impactEnergyJ(10, 2)).toBeCloseTo(10 * STANDARD_GRAVITY * 2, 9);
		expect(impactEnergyJ(-1, 2)).toBe(0);
	});
});

describe('drop — analytic trajectory', () => {
	it('starts at the drop height and lands at the free-fall time', () => {
		const y0 = 0.5;
		expect(dropOffset(y0, 0)).toEqual({ y: y0, impacts: 0, settled: false });
		const tf = fallTimeS(y0);
		expect(dropOffset(y0, tf * 0.5).y).toBeCloseTo(y0 - 0.5 * STANDARD_GRAVITY * (tf * 0.5) ** 2, 9);
		expect(dropOffset(y0, tf * 0.999).impacts).toBe(0);
		expect(dropOffset(y0, tf * 1.001).impacts).toBe(1);
	});

	it('never goes below the floor or above the drop height', () => {
		const y0 = 2;
		const T = dropDurationS(y0);
		for (let i = 0; i <= 400; i++) {
			const { y } = dropOffset(y0, (T * 1.1 * i) / 400);
			expect(y).toBeGreaterThanOrEqual(0);
			expect(y).toBeLessThanOrEqual(y0 + 1e-12);
		}
	});

	it('first bounce peaks at restitution² × drop height', () => {
		const y0 = 1;
		const tf = fallTimeS(y0);
		const v1 = STANDARD_GRAVITY * tf * RESTITUTION;
		const peakT = tf + v1 / STANDARD_GRAVITY;
		expect(dropOffset(y0, peakT).y).toBeCloseTo(RESTITUTION ** 2 * y0, 9);
	});

	it('counts every floor contact and settles after the last bounce', () => {
		const y0 = 1;
		const T = dropDurationS(y0);
		expect(dropOffset(y0, T - 1e-6).settled).toBe(false);
		const end = dropOffset(y0, T + 1e-6);
		expect(end.settled).toBe(true);
		expect(end.impacts).toBe(MAX_BOUNCES + 1);
		expect(end.y).toBe(0);
	});

	it('a zero-height drop is already at rest', () => {
		expect(dropOffset(0, 1)).toEqual({ y: 0, impacts: 0, settled: true });
	});

	it('bounce energies fall by restitution² each contact', () => {
		expect(nthImpactEnergyJ(100, 1)).toBe(100);
		expect(nthImpactEnergyJ(100, 2)).toBeCloseTo(100 * RESTITUTION ** 2, 9);
		expect(nthImpactEnergyJ(100, 3)).toBeCloseTo(100 * RESTITUTION ** 4, 9);
	});

	it('hoist eases from start to target and holds there', () => {
		expect(hoistOffset(0, 1, 0)).toBe(0);
		expect(hoistOffset(0, 1, 10)).toBe(1);
		const mid = hoistOffset(0, 1, 0.15, 0.3);
		expect(mid).toBeGreaterThan(0.5); // ease-out: past halfway at half time
		expect(mid).toBeLessThan(1);
	});
});

describe('drop — effect intensity is one monotonic dial', () => {
	it('is 0 below 1 mJ, 1 at the top, and monotonic between', () => {
		expect(impactIntensity(0)).toBe(0);
		expect(impactIntensity(1e-6)).toBe(0);
		expect(impactIntensity(1e12)).toBe(1);
		let prev = -1;
		for (let e = -4; e <= 10; e += 0.25) {
			const v = impactIntensity(10 ** e);
			expect(v).toBeGreaterThanOrEqual(prev);
			prev = v;
		}
	});

	it('the whole-supply gold cube pins the dial, one sat does not register', () => {
		const huge = goldCube(19.72 * 21e6);
		const tiny = goldCube(19.72 * 1e-8);
		expect(impactIntensity(impactEnergyJ(huge.massKg, huge.edge))).toBeGreaterThan(0.99);
		expect(impactIntensity(impactEnergyJ(tiny.massKg, tiny.edge))).toBe(0);
	});

	it('shake is off for tiny impacts and grows with intensity', () => {
		expect(shakeProfile(0.01).amplitudeRad).toBe(0);
		expect(shakeProfile(1).amplitudeRad).toBeGreaterThan(shakeProfile(0.5).amplitudeRad);
		expect(shakeProfile(1).decayS).toBeGreaterThan(shakeProfile(0.5).decayS);
	});

	it('dust lingers longer for bigger cubes', () => {
		expect(dustLifetimeS(0.001)).toBe(0.5);
		expect(dustLifetimeS(8.7)).toBeGreaterThan(dustLifetimeS(0.3));
	});
});

describe('bearing pressure vs IBC Table 1806.2', () => {
	it('is ρ·g·edge', () => {
		expect(bearingPressurePa(19.3, 1)).toBeCloseTo(19300 * STANDARD_GRAVITY, 6);
	});

	it('pins the presumptive values from the code table', () => {
		expect(IBC_PRESUMPTIVE_BEARING.map((c) => [c.id, c.allowablePsf])).toEqual([
			['clay', 1500],
			['sand', 2000],
			['gravel', 3000],
			['sedimentary_rock', 4000],
			['bedrock', 12000],
		]);
	});

	it('picks the most generous class exceeded', () => {
		const psf = (v: number) => v * PA_PER_PSF;
		expect(soilClassExceeded(psf(1000))).toBeNull();
		expect(soilClassExceeded(psf(1600))?.id).toBe('clay');
		expect(soilClassExceeded(psf(2500))?.id).toBe('sand');
		expect(soilClassExceeded(psf(12001))?.id).toBe('bedrock');
		expect(exceedsBedrock(psf(11999))).toBe(false);
		expect(exceedsBedrock(psf(12001))).toBe(true);
	});

	it('a gold cube crosses the bedrock allowance at ~3.03 m, regardless of price', () => {
		const edgeAtBedrock = (12000 * PA_PER_PSF) / (19300 * STANDARD_GRAVITY);
		expect(edgeAtBedrock).toBeCloseTo(3.035, 2);
		expect(exceedsBedrock(bearingPressurePa(19.3, 3.0))).toBe(false);
		expect(exceedsBedrock(bearingPressurePa(19.3, 3.1))).toBe(true);
	});

	it('silver needs a taller cube than gold to crack the floor', () => {
		const at = (rho: number) => (12000 * PA_PER_PSF) / (rho * 1000 * STANDARD_GRAVITY);
		expect(at(silver.densityGPerCm3!)).toBeGreaterThan(at(gold.densityGPerCm3!));
	});
});

describe('drop — readout copy', () => {
	it('formats energy across twenty orders of magnitude', () => {
		expect(formatEnergy(0.19)).toBe('0.19 J');
		expect(formatEnergy(1906)).toBe('1.91 kJ');
		expect(formatEnergy(1.1e9)).toBe('1.1 GJ');
		expect(formatEnergy(4.1e-12)).toBe('4.1 pJ');
		expect(formatEnergy(0.005)).toBe('5 mJ');
		expect(formatEnergy(0)).toBe('0 J');
	});

	it('formats fall times', () => {
		expect(formatDuration(1.3345)).toBe('1.33 s');
		expect(formatDuration(0.0804)).toBe('80 ms');
		expect(formatDuration(0.0037)).toBe('3.7 ms');
	});

	it('states TNT only from one gram up, by the 4.184 GJ/t convention', () => {
		expect(formatTnt(4000)).toBeNull();
		expect(formatTnt(J_PER_TONNE_TNT / 1e6)).toBe('1 g of TNT');
		expect(formatTnt(1.1e9)).toBe('263 kg of TNT');
		expect(formatTnt(J_PER_TONNE_TNT * 2)).toBe('2 t of TNT');
	});

	it('formats pressure in the code unit (psf) or kPa', () => {
		expect(formatPressure(12000 * PA_PER_PSF, 'imperial')).toBe('12,000 psf');
		expect(formatPressure(12000 * PA_PER_PSF, 'metric')).toBe('574.6 kPa');
		expect(formatPressure(12.9, 'metric')).toBe('12.9 Pa');
	});

	it('builds the whole-supply line with the bedrock clause', () => {
		const { edge, massKg } = goldCube(19.72 * 21e6);
		const line = formatDropLine({ edge, massGrams: massKg * 1000, densityGPerCm3: 19.3, unit: 'imperial' });
		expect(line).toMatch(/^Dropped from its own height \(.+ ft\), it falls for 1\.\d\d s and hits the floor with 1\.\d+ GJ — about \d+ kg of TNT\./);
		expect(line).toContain('more than the building code allows even on bedrock (12,000 psf).');
	});

	it('builds a small line with no TNT and no code clause', () => {
		const { edge, massKg } = goldCube(19.72);
		const line = formatDropLine({ edge, massGrams: massKg * 1000, densityGPerCm3: 19.3, unit: 'metric' });
		expect(line).not.toContain('TNT');
		expect(line).not.toContain('building code');
		expect(line.endsWith('.')).toBe(true);
	});

	it('returns empty for no cube', () => {
		expect(formatDropLine({ edge: 0, massGrams: 0, densityGPerCm3: 19.3, unit: 'metric' })).toBe('');
	});
});

describe('held camera — never ends up inside a grown cube', () => {
	it('is a no-op when the camera is already clear', () => {
		const p = { x: 2, y: 0.5, z: 3 };
		expect(clearCameraFromCube(p, 1)).toEqual(p);
	});

	it('is a no-op above the cube', () => {
		const p = { x: 0.1, y: 5, z: 0.1 };
		expect(clearCameraFromCube(p, 1)).toEqual(p);
	});

	it('pushes horizontally out of the footprint, keeping height', () => {
		const p = { x: -0.17, y: 0.04, z: 0.28 }; // 1 BTC macro camera
		const edge = 8.7; // …after dragging to the whole supply
		const out = clearCameraFromCube(p, edge);
		expect(out.y).toBe(p.y);
		expect(Math.max(Math.abs(out.x), Math.abs(out.z))).toBeGreaterThanOrEqual(edge / 2 + edge * 0.12 - 1e-9);
		// Direction preserved — the camera backs straight away from the cube.
		expect(Math.atan2(out.x, out.z)).toBeCloseTo(Math.atan2(p.x, p.z), 9);
	});

	it('respects the lift — a hovering cube only blocks its own height band', () => {
		const p = { x: 0.1, y: 0.2, z: 0.1 };
		expect(clearCameraFromCube(p, 1, 5)).not.toEqual(p); // below lift+edge+margin → still pushed
		expect(clearCameraFromCube({ ...p, y: 7 }, 1, 5)).toEqual({ ...p, y: 7 });
	});
});
