import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	GeigerEngine,
	clicksPerSecond,
	poissonIntervalMs,
	SAMPLE_RATIO,
	SPECIFIC_ACTIVITY_CI_PER_GRAM,
	MAX_CLICKS_PER_SEC,
	MASS_THRESHOLD_GRAMS,
} from '../src/lib/components/GeigerEngine.js';

/**
 * Pure-TS engine tests. The audio synthesis and IntersectionObserver
 * hookup live in the Svelte component layer — those are exercised in
 * tests/pu238-section-render.test.ts and (longer-term) Playwright.
 */

describe('clicksPerSecond', () => {
	it('returns 0 below the 1 g threshold', () => {
		expect(clicksPerSecond(0)).toBe(0);
		expect(clicksPerSecond(0.5)).toBe(0);
		expect(clicksPerSecond(0.999)).toBe(0);
	});

	it('returns 3 clicks/sec at exactly 1 g (sparse, distinct, recognisable)', () => {
		// 1 × 17 × 0.18 = 3.06
		expect(clicksPerSecond(1)).toBeCloseTo(3.06, 5);
	});

	it('returns ~50 clicks/sec at 16 g (1 BTC: clear counter)', () => {
		// 16 × 17 × 0.18 = 48.96
		expect(clicksPerSecond(16)).toBeCloseTo(48.96, 5);
	});

	it('returns ~500 clicks/sec at 160 g (10 BTC: rapid counter)', () => {
		expect(clicksPerSecond(160)).toBeCloseTo(489.6, 5);
	});

	it('caps at 1000 clicks/sec at the continuous-hiss range', () => {
		// 1.6 kg uncapped would be 4896; 16 kg uncapped 48960.
		expect(clicksPerSecond(1600)).toBe(MAX_CLICKS_PER_SEC);
		expect(clicksPerSecond(16000)).toBe(MAX_CLICKS_PER_SEC);
		expect(clicksPerSecond(1e9)).toBe(MAX_CLICKS_PER_SEC);
	});

	it('uses the canonical sample ratio and specific activity', () => {
		// Sanity check: the constants haven't been silently retuned out
		// from under the canonical-positions table.
		expect(SAMPLE_RATIO).toBeCloseTo(0.18, 5);
		expect(SPECIFIC_ACTIVITY_CI_PER_GRAM).toBe(17);
	});
});

describe('poissonIntervalMs', () => {
	it('returns Infinity at zero rate (silence)', () => {
		expect(poissonIntervalMs(0)).toBe(Infinity);
		expect(poissonIntervalMs(-1)).toBe(Infinity);
	});

	it('produces a stable mean inter-arrival of 1/rate seconds', () => {
		// Average 100 draws against deterministic uniform RNG; should
		// land within ~10% of 1000/rate ms.
		const rate = 50; // 20 ms mean
		let total = 0;
		const samples = 1000;
		// Deterministic-ish pseudo-RNG via mulberry32 seeded for repeatable test.
		let seed = 1234567;
		const rng = () => {
			seed |= 0;
			seed = (seed + 0x6d2b79f5) | 0;
			let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
		for (let i = 0; i < samples; i++) total += poissonIntervalMs(rate, rng);
		const mean = total / samples;
		expect(mean).toBeGreaterThan(18);
		expect(mean).toBeLessThan(22);
	});

	it('clamps tiny RNG values to avoid -log(0) → Infinity', () => {
		// rng returns 0 — should still produce a finite (large) interval,
		// not NaN or Infinity.
		const v = poissonIntervalMs(50, () => 0);
		expect(Number.isFinite(v)).toBe(true);
	});
});

describe('GeigerEngine state machine', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	function makeEngine(overrides: { rng?: () => number } = {}): GeigerEngine {
		// No window — engine still initialises (windowRef is optional);
		// the visual-pulse dispatch becomes a no-op which is fine in
		// pure-state tests.
		return new GeigerEngine({
			windowRef: undefined,
			rng: overrides.rng,
		});
	}

	it('starts non-audible (all gates closed by default)', () => {
		const e = makeEngine();
		expect(e.audible).toBe(false);
	});

	it('requires all four gates open to be audible: enabled + viewport + tabVisible + rate ≥ 1', () => {
		const e = makeEngine();
		e.setMass(16); // rate = 48.96
		expect(e.audible).toBe(false); // enabled: false

		e.setEnabled(true);
		expect(e.audible).toBe(false); // inViewport: false

		e.setInViewport(true);
		expect(e.audible).toBe(true); // tabVisible defaults to true

		e.setTabVisible(false);
		expect(e.audible).toBe(false); // tab hidden

		e.setTabVisible(true);
		expect(e.audible).toBe(true);
	});

	it('falls silent when mass drops below the 1 g threshold', () => {
		const e = makeEngine();
		e.setMass(16);
		e.setEnabled(true);
		e.setInViewport(true);
		expect(e.audible).toBe(true);

		e.setMass(MASS_THRESHOLD_GRAMS / 2);
		expect(e.audible).toBe(false);
		expect(e.rate).toBe(0);
	});

	it('updates the running rate when mass changes', () => {
		const e = makeEngine();
		e.setMass(1);
		expect(e.rate).toBeCloseTo(3.06, 5);
		e.setMass(160);
		expect(e.rate).toBeCloseTo(489.6, 5);
		e.setMass(1e6); // way over cap
		expect(e.rate).toBe(MAX_CLICKS_PER_SEC);
	});

	it('destroy() clears any pending schedule and is idempotent', () => {
		const e = makeEngine();
		e.setMass(16);
		e.setEnabled(true);
		e.setInViewport(true);
		// scheduleNext fired internally; destroy should not throw.
		expect(() => e.destroy()).not.toThrow();
		expect(() => e.destroy()).not.toThrow();
	});
});
