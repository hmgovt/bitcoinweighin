import { describe, it, expect } from 'vitest';
import {
	cubeModesHz,
	ringPitchHz,
	contactTimeS,
	ringDecayS,
	synthImpact,
	audibleShare,
	hearingBand,
	formatFrequency,
	ringSentence,
	isSoundingMaterial,
} from '../src/lib/scene/impact-sound.js';
import { MATERIAL_ACOUSTICS, poissonOf, RING_Q } from '../src/lib/scene/acoustics.js';
import table from '../src/lib/scene/cube-modes.json';
import { solveBox, landingCoupling, halfSineSpectrum } from '../src/lib/scene/modal.js';
import { LANDING_TILT } from '../src/lib/scene/acoustics.js';
import { cubeEdgeMetres } from '../src/lib/scene/maths.js';
import { getCommodity } from '../src/lib/commodities.js';

const gold = getCommodity('gold')!;
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

describe('materials', () => {
	it('derives Poisson ratios that match the published values', () => {
		expect(poissonOf(MATERIAL_ACOUSTICS.gold)).toBeCloseTo(0.42, 2);
		expect(poissonOf(MATERIAL_ACOUSTICS.silver)).toBeCloseTo(0.38, 2);
		expect(poissonOf(MATERIAL_ACOUSTICS.pu238)).toBeCloseTo(0.32, 6);
	});

	it('the shipped table was generated from these constants', () => {
		const t = table as unknown as Record<string, { poisson: number }>;
		for (const id of ['gold', 'silver', 'pu238'] as const) {
			expect(t[id].poisson).toBeCloseTo(poissonOf(MATERIAL_ACOUSTICS[id]), 4);
		}
	});

	it('knows which commodities ring', () => {
		expect(isSoundingMaterial('gold')).toBe(true);
		expect(isSoundingMaterial('cocaine')).toBe(false);
	});
});

describe('the shipped mode table reproduces a fresh solve', () => {
	it('gold: lowest modes and the loudest one', () => {
		const nu = poissonOf(MATERIAL_ACOUSTICS.gold);
		const model = solveBox([1, 1, 1], nu, 8);
		const shipped = (table as unknown as Record<string, { modes: [number, number][] }>).gold.modes;
		const fresh = model.modes.filter((m) => m.omega > 1e-6).map((m) => m.omega / Math.PI);
		// The shipped lowest mode is in the fresh spectrum (order 8 vs 10: < 0.5%).
		expect(fresh.some((o) => Math.abs(o - shipped[0][0]) / o < 0.005)).toBe(true);
		// …and so is the loudest.
		const loud = shipped.find(([, w]) => w === 1)![0];
		expect(fresh.some((o) => Math.abs(o - loud) / o < 0.005)).toBe(true);
		// Coupling sanity: the loudest mode really is strongly excited by a landing.
		const lm = model.modes.find((m) => Math.abs(m.omega / Math.PI - loud) < 1e-3)!;
		const { force, surface } = landingCoupling(model, lm, LANDING_TILT, 6);
		expect(Math.abs(force) * surface * halfSineSpectrum(loud * 0.7)).toBeGreaterThan(0);
	});
});

describe("Lamé's mode — an exact solution the solver must hit", () => {
	it('every material rings loudest at f = c_t / (√2 L), independent of Poisson ratio', () => {
		for (const id of ['gold', 'silver', 'pu238'] as const) {
			const L = 0.1;
			expect(ringPitchHz(id, L)).toBeCloseTo(MATERIAL_ACOUSTICS[id].ct / (Math.SQRT2 * L), 0);
		}
	});

	it('the solver finds Ω = 1/√2 for any ν', () => {
		for (const nu of [0.25, 0.35, 0.42]) {
			const m = solveBox([1, 1, 1], nu, 8);
			const hit = m.modes.some((mode) => Math.abs(mode.omega / Math.PI - Math.SQRT1_2) < 1e-6);
			expect(hit).toBe(true);
		}
	});
});

describe('scaling — the sound is self-similar in size', () => {
	it('every mode scales as 1/L: double the edge, an octave down', () => {
		const a = cubeModesHz('gold', 0.1);
		const b = cubeModesHz('gold', 0.2);
		a.forEach((m, i) => expect(b[i].f).toBeCloseTo(m.f / 2, 6));
	});

	it('contact time and ring time both scale with L', () => {
		expect(contactTimeS('gold', 0.2) / contactTimeS('gold', 0.1)).toBeCloseTo(2, 12);
		expect(ringDecayS(ringPitchHz('gold', 0.2)) / ringDecayS(ringPitchHz('gold', 0.1))).toBeCloseTo(2, 9);
		expect(ringDecayS(1000)).toBeCloseTo(RING_Q / (Math.PI * 1000), 12);
	});

	it('rendered audio peaks at the predicted note, an octave apart', () => {
		const sr = 48000;
		for (const L of [0.3, 0.6]) {
			const x = synthImpact('gold', L, sr);
			const pitch = ringPitchHz('gold', L);
			const onPitch = goertzel(x, pitch, sr);
			const offPitch = goertzel(x, pitch * 1.37, sr);
			expect(onPitch).toBeGreaterThan(offPitch * 20);
		}
	});
});

describe('hearing — honest about who can hear it', () => {
	it('1 BTC of gold rings above human hearing but within a dog’s', () => {
		const L = goldEdge(1);
		expect(L).toBeGreaterThan(0.03);
		expect(L).toBeLessThan(0.034);
		const f = ringPitchHz('gold', L);
		expect(hearingBand(f)).toBe('dogs');
		expect(ringSentence(f)).toContain('not for Sat');
	});

	it('1 sat rings far beyond even Sat', () => {
		expect(hearingBand(ringPitchHz('gold', goldEdge(1e-8)))).toBe('nobody');
	});

	it('the whole supply is a low gong people can hear', () => {
		const f = ringPitchHz('gold', goldEdge(21e6));
		expect(f).toBeGreaterThan(60);
		expect(f).toBeLessThan(150);
		expect(ringSentence(f)).toMatch(/^It rings at [\d.]+ Hz\.$/);
	});

	it('an ultrasonic cube renders silent — no fake pitching-down', () => {
		const x = synthImpact('gold', goldEdge(0.001), 48000);
		expect(Math.max(...x.map(Math.abs))).toBe(0);
		expect(audibleShare('gold', goldEdge(0.001))).toBe(0);
	});

	it('peak stays ≤ 1 and a big cube is fully audible', () => {
		const x = synthImpact('gold', goldEdge(1000), 48000);
		expect(Math.max(...x.map(Math.abs))).toBeLessThanOrEqual(1.0001);
		expect(audibleShare('gold', goldEdge(21e6))).toBeCloseTo(1, 6);
	});
});

describe('copy', () => {
	it('formats frequencies', () => {
		expect(formatFrequency(68.4)).toBe('68.4 Hz');
		expect(formatFrequency(1893)).toBe('1.89 kHz');
		expect(formatFrequency(26_800)).toBe('26.8 kHz');
		expect(formatFrequency(8_830_000)).toBe('8.83 MHz');
		expect(formatFrequency(250)).toBe('250 Hz');
	});
});
