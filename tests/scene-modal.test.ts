import { describe, it, expect } from 'vitest';
import { solveBox, landingCoupling, halfSineSpectrum, gaussLegendre, jacobiEigen } from '../src/lib/scene/modal.js';

/**
 * The Rayleigh–Ritz solver behind the cube's impact sound. It has to be
 * right before any pitch it produces is worth stating, so it is checked
 * against things that are known independently: rigid-body modes, cubic
 * symmetry, and closed-form beam theory for a long bar.
 */

describe('numerics', () => {
	it('Gauss–Legendre integrates polynomials exactly', () => {
		const { x, w } = gaussLegendre(5);
		const int = (f: (t: number) => number) => x.reduce((s, t, i) => s + w[i] * f(t), 0);
		expect(int(() => 1)).toBeCloseTo(2, 12);
		expect(int((t) => t ** 8)).toBeCloseTo(2 / 9, 12);
		expect(int((t) => t ** 9)).toBeCloseTo(0, 12);
	});

	it('Jacobi diagonalises a symmetric matrix', () => {
		const { values } = jacobiEigen([
			[2, 1, 0],
			[1, 2, 1],
			[0, 1, 2],
		]);
		const sorted = [...values].sort((a, b) => a - b);
		expect(sorted[0]).toBeCloseTo(2 - Math.SQRT2, 10);
		expect(sorted[1]).toBeCloseTo(2, 10);
		expect(sorted[2]).toBeCloseTo(2 + Math.SQRT2, 10);
	});
});

describe('free cube', () => {
	const cube = solveBox([1, 1, 1], 0.3, 8);

	it('has exactly six rigid-body modes (3 translations, 3 rotations)', () => {
		const zeros = cube.modes.filter((m) => m.omega < 1e-6).length;
		expect(zeros).toBe(6);
		expect(cube.modes[6].omega).toBeGreaterThan(0.5);
	});

	it('shows cubic symmetry: every frequency is 1-, 2- or 3-fold degenerate', () => {
		const elastic = cube.modes.filter((m) => m.omega > 1e-6).slice(0, 40).map((m) => m.omega);
		let i = 0;
		while (i < elastic.length - 3) {
			let j = i + 1;
			while (j < elastic.length && Math.abs(elastic[j] - elastic[i]) < 1e-7 * elastic[i]) j++;
			expect([1, 2, 3]).toContain(j - i);
			i = j;
		}
	});

	it('has converged: the lowest ten frequencies move < 0.5% from order 8 to 10', () => {
		const hi = solveBox([1, 1, 1], 0.3, 10);
		for (let k = 6; k < 16; k++) {
			expect(Math.abs(hi.modes[k].omega - cube.modes[k].omega) / hi.modes[k].omega).toBeLessThan(0.005);
		}
	});

	it("reproduces Lamé's exact cube mode, Ω = f·L/c_t = 1/√2 (1852)", () => {
		expect(cube.modes.some((m) => Math.abs(m.omega / Math.PI - Math.SQRT1_2) < 1e-6)).toBe(true);
	});

	it('a centred flat landing only excites modes symmetric under both side mirrors', () => {
		for (const m of cube.modes.slice(6, 40)) {
			const flat = landingCoupling(cube, m, 0, 6);
			// Modes odd under x→-x or y→-y integrate to zero over a centred face load.
			const sym = cube.basis.every((b, k) => m.coeffs[k] === 0 || (((b.l + (b.i === 0 ? 1 : 0)) & 1) === 0 && ((b.m + (b.i === 1 ? 1 : 0)) & 1) === 0));
			if (!sym) expect(Math.abs(flat.force)).toBeLessThan(1e-9);
		}
	});

	it('an off-centre landing also reaches the asymmetric modes', () => {
		const tilted = cube.modes.slice(6, 40).filter((m) => Math.abs(landingCoupling(cube, m, 0.3, 6).force) > 1e-6).length;
		const flat = cube.modes.slice(6, 40).filter((m) => Math.abs(landingCoupling(cube, m, 0, 6).force) > 1e-6).length;
		expect(tilted).toBeGreaterThan(flat);
	});
});

describe('long bar vs closed-form beam theory', () => {
	// 10 × 1 × 1 bar, ν = 0.3, ρ = 1, G = 1  →  E = 2(1+ν) = 2.6.
	const nu = 0.3;
	const E = 2 * (1 + nu);
	const L = 10;
	const bar = solveBox([L / 2, 0.5, 0.5], nu, 10);
	const elastic = bar.modes.filter((m) => m.omega > 1e-6).map((m) => m.omega);

	it('first bending mode matches Timoshenko beam theory within 1%', () => {
		// Euler–Bernoulli free–free: ω = β² √(E I / (ρ A)) / L², β = 4.7300,
		// I/A = w²/12 for a square of side 1. At this slenderness shear
		// deformation and rotary inertia lower it by a few percent; first-order
		// Timoshenko correction: × [1 − ½(β r/L)²(1 + E/(κG))], with Cowper's
		// shear coefficient for a square section κ = 10(1+ν)/(12+11ν).
		const beta = 4.73004;
		const eb = (beta ** 2 * Math.sqrt(E / 12)) / L ** 2;
		const kappa = (10 * (1 + nu)) / (12 + 11 * nu);
		const timoshenko = eb * (1 - 0.5 * (beta ** 2 / 12 / L ** 2) * (1 + E / kappa));
		expect(elastic[0]).toBeLessThan(eb); // shear only ever softens it
		expect(Math.abs(elastic[0] - timoshenko) / timoshenko).toBeLessThan(0.01);
		expect(Math.abs(elastic[1] - elastic[0]) / elastic[0]).toBeLessThan(1e-6); // bends in y and z alike
	});

	it('first longitudinal mode matches c_bar / 2L within 1%', () => {
		// f = √(E/ρ) / (2L)  →  ω = π √E / L.
		const expected = (Math.PI * Math.sqrt(E)) / L;
		const nearest = elastic.reduce((best, w) => (Math.abs(w - expected) < Math.abs(best - expected) ? w : best));
		expect(Math.abs(nearest - expected) / expected).toBeLessThan(0.01);
	});
});

describe('contact spectrum', () => {
	it('is 1 at DC, π/4 at the removable singularity, and falls away above', () => {
		expect(halfSineSpectrum(0)).toBe(1);
		expect(halfSineSpectrum(0.5)).toBeCloseTo(Math.PI / 4, 6);
		expect(halfSineSpectrum(0.5 + 1e-7)).toBeCloseTo(Math.PI / 4, 4);
		expect(halfSineSpectrum(3)).toBeLessThan(0.03);
	});
});
