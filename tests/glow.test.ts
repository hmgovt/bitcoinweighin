import { describe, it, expect } from 'vitest';
import {
	massToColorTemp,
	massToIntensity,
	interpolateColor,
	computeGlowParams,
	COLOR_STOPS,
} from '../src/lib/components/CubeGlowOverlay.helpers.js';

describe('massToColorTemp', () => {
	it('returns 0 below 1 g', () => {
		expect(massToColorTemp(0)).toBe(0);
		expect(massToColorTemp(0.5)).toBe(0);
		expect(massToColorTemp(0.999)).toBe(0);
	});

	it('returns 0 at exactly 1 g (piecewise lower bound)', () => {
		expect(massToColorTemp(1)).toBeCloseTo(0, 6);
	});

	it('returns 0.156 at 10 g (log10(10) = 1, × 0.156)', () => {
		expect(massToColorTemp(10)).toBeCloseTo(0.156, 6);
	});

	it('returns 0.312 at 100 g (log10(100) = 2, × 0.156)', () => {
		expect(massToColorTemp(100)).toBeCloseTo(0.312, 6);
	});

	it('returns 0.468 at the 1 kg piecewise breakpoint', () => {
		expect(massToColorTemp(1000)).toBeCloseTo(0.468, 6);
	});

	it('clamps at 1 for very large masses', () => {
		expect(massToColorTemp(1e10)).toBe(1);
	});

	// Canonical positions from docs/handoff/06-pu238.md. The piecewise was
	// tuned to hit each row of the table; if these regress, the panel's
	// glow will read wrong against the spec.
	describe('canonical Pu-238 positions', () => {
		it('at 16 g (1 BTC) reads "dull red"', () => {
			// 0.187 → 25 % of the way from dull-red (0.15) to cherry-red (0.30)
			expect(massToColorTemp(16)).toBeCloseTo(0.187, 2);
		});

		it('at 160 g (10 BTC) reads "cherry red"', () => {
			expect(massToColorTemp(160)).toBeCloseTo(0.343, 2);
		});

		it('at 1.6 kg (100 BTC) reads "bright orange"', () => {
			// 0.557 → 28 % from orange (0.50) toward amber-yellow (0.70)
			expect(massToColorTemp(1600)).toBeCloseTo(0.557, 2);
		});

		it('at 4.5 kg (280 BTC, Voyager fuel-load) reads "orange-yellow"', () => {
			expect(massToColorTemp(4500)).toBeCloseTo(0.749, 2);
		});

		it('at 10 kg (625 BTC, theoretical critical) reads "incandescent"', () => {
			expect(massToColorTemp(10000)).toBeCloseTo(0.898, 2);
		});

		it('at 16 kg (1000 BTC) reads near white-hot', () => {
			expect(massToColorTemp(16000)).toBeCloseTo(0.986, 2);
		});
	});
});

describe('massToIntensity', () => {
	it('returns 0 below 0.1 g', () => {
		expect(massToIntensity(0)).toBe(0);
		expect(massToIntensity(0.05)).toBe(0);
		expect(massToIntensity(0.099)).toBe(0);
	});

	it('returns 0 at exactly 0.1 g (log10(1) = 0)', () => {
		expect(massToIntensity(0.1)).toBeCloseTo(0, 6);
	});

	it('returns 0.22 at 1 g (log10(1 × 10) = 1, × 0.22)', () => {
		expect(massToIntensity(1)).toBeCloseTo(0.22, 6);
	});

	it('returns 0.44 at 10 g (log10(100) = 2, × 0.22)', () => {
		expect(massToIntensity(10)).toBeCloseTo(0.44, 6);
	});

	it('clamps at 1 for very large masses', () => {
		expect(massToIntensity(1e10)).toBe(1);
	});

	it('reaches 1 faster than colour temp does (intensity 0.22 vs colour 0 at 1 g)', () => {
		const g = 1;
		expect(massToIntensity(g)).toBeGreaterThan(massToColorTemp(g));
	});
});

describe('interpolateColor', () => {
	it('returns first stop verbatim at t=0', () => {
		expect(interpolateColor(0)).toBe(COLOR_STOPS[0].hex);
	});

	it('returns last stop verbatim at t=1', () => {
		expect(interpolateColor(1)).toBe(COLOR_STOPS[COLOR_STOPS.length - 1].hex);
	});

	it('returns the literal stop hex when t hits a stop position', () => {
		for (const stop of COLOR_STOPS) {
			expect(interpolateColor(stop.t)).toBe(stop.hex);
		}
	});

	it('returns an intermediate value between adjacent stops at t=0.4', () => {
		// Cherry red (#a83000 → R=168) at t=0.30; orange (#ff5500 → R=255) at t=0.50
		const result = interpolateColor(0.4);
		const r = parseInt(result.slice(1, 3), 16);
		expect(r).toBeGreaterThan(168);
		expect(r).toBeLessThan(255);
		// Halfway between the two stops in linear RGB
		expect(r).toBeCloseTo(168 + (255 - 168) * 0.5, -1);
	});

	it('clamps t outside [0, 1]', () => {
		expect(interpolateColor(-1)).toBe(COLOR_STOPS[0].hex);
		expect(interpolateColor(2)).toBe(COLOR_STOPS[COLOR_STOPS.length - 1].hex);
	});
});

describe('computeGlowParams', () => {
	it('warningCaption is false below 1000 g', () => {
		expect(computeGlowParams(999).warningCaption).toBe(false);
	});

	it('warningCaption is true at exactly 1000 g (≥ 1 kg threshold)', () => {
		expect(computeGlowParams(1000).warningCaption).toBe(true);
	});

	it('warningCaption is true above 1000 g', () => {
		expect(computeGlowParams(10000).warningCaption).toBe(true);
	});

	it('opacity peaks at 0.9 at very high intensity', () => {
		expect(computeGlowParams(1e10).opacity).toBeCloseTo(0.9, 6);
	});

	it('bloomPx peaks at 120 px at very high intensity', () => {
		expect(computeGlowParams(1e10).bloomPx).toBeCloseTo(120, 6);
	});

	it('opacity is 0 below the intensity threshold (0.1 g)', () => {
		expect(computeGlowParams(0.05).opacity).toBe(0);
	});

	it('bloomPx is 0 below the intensity threshold (0.1 g)', () => {
		expect(computeGlowParams(0.05).bloomPx).toBe(0);
	});

	it('returns the IR-red colour at sub-1 g where colour temp is still 0', () => {
		expect(computeGlowParams(0.5).color).toBe(COLOR_STOPS[0].hex);
	});
});
