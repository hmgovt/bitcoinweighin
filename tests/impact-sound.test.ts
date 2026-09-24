import { describe, it, expect } from 'vitest';
import {
	contactStiffness,
	contactTimeS,
	impactImpulse,
	peakForceN,
	crackTimeS,
	synthImpact,
	formatForce,
	blowSentence,
	isSoundingMaterial,
} from '../src/lib/scene/impact-sound.js';
import {
	MATERIAL_ACOUSTICS,
	poissonOf,
	youngsModulusOf,
	FLOOR,
	FLOOR_SURFACE_DENSITY,
	AIR,
	LANDING_TILT,
} from '../src/lib/scene/acoustics.js';
import { RESTITUTION, STANDARD_GRAVITY } from '../src/lib/scene/drop.js';
import { solveBox, landingCoupling, halfSineSpectrum } from '../src/lib/scene/modal.js';
import { cubeEdgeMetres } from '../src/lib/scene/maths.js';
import { getCommodity } from '../src/lib/commodities.js';

const gold = getCommodity('gold')!;
const RHO_AU = 19.3;
/** ~Sep 2026 ratio; only used to put realistic sizes on things. */
const OZ_PER_BTC = 19.72;
const goldEdge = (btc: number) => cubeEdgeMetres(OZ_PER_BTC * btc, gold);

/** Power of `x` at `f` Hz (Goertzel). */
function goertzel(x: Float32Array, f: number, sr: number): number {
	const w = (2 * Math.PI * f) / sr;
	const c = 2 * Math.cos(w);
	let s1 = 0;
	let s2 = 0;
	for (let i = 0; i < x.length; i++) {
		const s0 = x[i] + c * s1 - s2;
		s2 = s1;
		s1 = s0;
	}
	return s1 * s1 + s2 * s2 - c * s1 * s2;
}
const peak = (x: Float32Array) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

describe('materials and floor', () => {
	it('derives the published Poisson ratios and moduli', () => {
		expect(poissonOf(MATERIAL_ACOUSTICS.gold)).toBeCloseTo(0.42, 2);
		expect(poissonOf(MATERIAL_ACOUSTICS.silver)).toBeCloseTo(0.38, 2);
		expect(poissonOf(MATERIAL_ACOUSTICS.pu238)).toBeCloseTo(0.32, 6);
		expect(youngsModulusOf(MATERIAL_ACOUSTICS.gold, 19300) / 1e9).toBeCloseTo(79, 0);
	});

	it('uses ACI 318 concrete: E = 4700√30 MPa ≈ 25.7 GPa', () => {
		expect(FLOOR.youngsModulusPa / 1e9).toBeCloseTo(25.74, 2);
		expect(FLOOR_SURFACE_DENSITY).toBe(360);
	});

	it('knows which commodities make this sound', () => {
		expect(isSoundingMaterial('gold')).toBe(true);
		expect(isSoundingMaterial('cocaine')).toBe(false);
	});
});

describe('the blow', () => {
	it('contact stiffness and contact time both scale exactly with edge', () => {
		expect(contactStiffness('gold', 0.2, RHO_AU) / contactStiffness('gold', 0.1, RHO_AU)).toBeCloseTo(2, 12);
		expect(contactTimeS('gold', 0.2, RHO_AU) / contactTimeS('gold', 0.1, RHO_AU)).toBeCloseTo(2, 12);
	});

	it('500 BTC of gold: a ~0.74 ms blow peaking near 190 tonnes-force', () => {
		const L = goldEdge(500);
		expect(contactTimeS('gold', L, RHO_AU) * 1000).toBeGreaterThan(0.6);
		expect(contactTimeS('gold', L, RHO_AU) * 1000).toBeLessThan(0.9);
		const tf = peakForceN('gold', L, RHO_AU) / 9806.65;
		expect(tf).toBeGreaterThan(120);
		expect(tf).toBeLessThan(260);
	});

	it('1 BTC of gold — 613 g dropped 3 cm — still peaks around a tonne-force', () => {
		const tf = peakForceN('gold', goldEdge(1), RHO_AU) / 9806.65;
		expect(tf).toBeGreaterThan(0.7);
		expect(tf).toBeLessThan(1.6);
	});

	it('peak force scales as L^2.5 (m ∝ L³, v ∝ √L, τ ∝ L)', () => {
		const r = peakForceN('gold', 0.4, RHO_AU) / peakForceN('gold', 0.1, RHO_AU);
		expect(r).toBeCloseTo(4 ** 2.5, 6);
	});

	it('impulse is m·v·(1+e) from its own height', () => {
		const L = 0.3;
		const m = RHO_AU * 1000 * L ** 3;
		expect(impactImpulse(L, RHO_AU)).toBeCloseTo(m * Math.sqrt(2 * STANDARD_GRAVITY * L) * (1 + RESTITUTION), 6);
	});

	it('the crack time constant is 0.75·m″/(c₀ρ): ~41 µs for gold', () => {
		expect(crackTimeS(RHO_AU) * 1e6).toBeCloseTo((0.75 * 360 * 1e6) / (343 * 19300), 6);
		expect(crackTimeS(RHO_AU) * 1e6).toBeGreaterThan(35);
		expect(crackTimeS(RHO_AU) * 1e6).toBeLessThan(45);
	});
});

describe('the sound', () => {
	const sr = 48000;

	it('a big cube thuds low; a small one ticks high', () => {
		// 3 m cube: τ ≈ 9 ms → energy far below 1 kHz.
		const big = synthImpact({ id: 'gold', edge: 3, densityGPerCm3: RHO_AU, sampleRate: sr, room: false });
		expect(goertzel(big, 40, sr)).toBeGreaterThan(goertzel(big, 1000, sr) * 100);
		// 5 cm cube: τ ≈ 0.15 ms → most energy up in the kHz.
		const small = synthImpact({ id: 'gold', edge: 0.05, densityGPerCm3: RHO_AU, sampleRate: sr, room: false });
		expect(goertzel(small, 3000, sr)).toBeGreaterThan(goertzel(small, 100, sr));
	});

	it('a blow shorter than a sample is a faint click, not a full-scale spike', () => {
		const speck = synthImpact({ id: 'gold', edge: goldEdge(1e-8), densityGPerCm3: RHO_AU, sampleRate: sr, room: false });
		expect(peak(speck)).toBeLessThan(0.01);
		const block = synthImpact({ id: 'gold', edge: 0.3, densityGPerCm3: RHO_AU, sampleRate: sr, room: false });
		expect(peak(block)).toBeGreaterThan(0.9);
	});

	it('fracture adds crackle only when the floor cracks', () => {
		const base = { id: 'gold' as const, edge: 4, densityGPerCm3: RHO_AU, sampleRate: sr, room: false };
		const quiet = synthImpact(base);
		const cracked = synthImpact({ ...base, cracks: true });
		expect(goertzel(cracked, 3000, sr)).toBeGreaterThan(goertzel(quiet, 3000, sr) * 10);
	});

	it('the room adds a tail and stays bounded', () => {
		const dry = synthImpact({ id: 'gold', edge: 0.3, densityGPerCm3: RHO_AU, sampleRate: sr, room: false });
		const wet = synthImpact({ id: 'gold', edge: 0.3, densityGPerCm3: RHO_AU, sampleRate: sr });
		expect(wet.length).toBeGreaterThan(dry.length + sr * 0.5);
		const tail = wet.subarray(Math.round(0.2 * sr), Math.round(0.4 * sr));
		expect(peak(tail)).toBeGreaterThan(1e-3);
		expect(peak(wet)).toBeLessThan(3);
		expect(wet.every(Number.isFinite)).toBe(true);
	});
});

describe("the cube's own ring is negligible — why it isn't in the sound", () => {
	// Acoustic energy of each free-vibration mode after the blow (radiation
	// efficiency ≈ 1, generously undamped at Q = 150) vs the floor's thud
	// energy ∫ W dt with W = ρ₀F²/(2π c₀ m″²) (Cremer & Heckl).
	it('500 BTC of gold: ring < 1/300 of the thud (−25 dB) even at Q = 150', () => {
		const L = goldEdge(500);
		const rho = RHO_AU * 1000;
		const { ct } = MATERIAL_ACOUSTICS.gold;
		const tau = contactTimeS('gold', L, RHO_AU);
		const J = impactImpulse(L, RHO_AU);
		const F0 = peakForceN('gold', L, RHO_AU);
		const thud = (AIR.densityKgM3 / (2 * Math.PI * AIR.soundSpeedMs * FLOOR_SURFACE_DENSITY ** 2)) * F0 * F0 * (tau / 2);
		const model = solveBox([1, 1, 1], poissonOf(MATERIAL_ACOUSTICS.gold), 8);
		let ring = 0;
		for (const mode of model.modes) {
			if (mode.omega < 1e-6) continue;
			const omega = mode.omega / Math.PI;
			if (omega > 4) break;
			const f = (omega * ct) / L;
			const ft = f * tau;
			// Envelope of the half-sine spectrum (no real blow has exact nulls).
			const H = ft < 0.5 ? halfSineSpectrum(ft) : 1 / Math.abs(1 - 4 * ft * ft);
			const { force, surface } = landingCoupling(model, mode, LANDING_TILT, 6);
			const vs = (J * H * Math.abs(force) * surface) / (rho * (L / 2) ** 3);
			const w0 = (AIR.densityKgM3 * AIR.soundSpeedMs * vs * vs * 6 * L * L) / 2;
			ring += (w0 * 150) / (2 * Math.PI * f);
		}
		expect(10 * Math.log10(ring / thud)).toBeLessThan(-25);
	});
});

describe('copy', () => {
	it('formats force in either system', () => {
		expect(formatForce(1.845e6, 'metric')).toBe('188.1 tonnes of force');
		expect(formatForce(1.845e6, 'imperial')).toBe('207.4 tons of force');
		expect(formatForce(10_000, 'imperial')).toBe('1.12 tons of force');
		expect(formatForce(4_000, 'imperial')).toBe('899.2 pounds of force');
		expect(formatForce(5000, 'metric')).toBe('509.9 kilograms of force');
	});

	it('writes the blow sentence', () => {
		const s = blowSentence('gold', goldEdge(500), RHO_AU, 'metric');
		expect(s).toMatch(/^The blow lasts 0\.\d ms and peaks at \d+(\.\d)? tonnes of force\.$/);
	});
});
