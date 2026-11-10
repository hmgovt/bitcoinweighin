import { describe, it, expect } from 'vitest';
import {
	SENSOR_HEIGHT_M,
	F_NUMBER,
	focalLengthM,
	cocFraction,
	cocScalePx,
	projectedSizePx,
	loupeMagnification,
	magnifiedFovDeg,
	LOUPE_TRIGGER_PX,
	LOUPE_LADDER,
} from '../src/lib/scene/optics.js';
import {
	dragRatio,
	pinchRatio,
	wheelZoomRatio,
	orbitYaw,
	clampBtc,
	roundBtc,
	BTC_MIN,
	BTC_MAX,
	DECADES_PER_STAGE,
	ORBIT_MAX_RAD,
} from '../src/lib/scene/grab.js';
import { FOV_DEG, framingDistance, framingDominant, cubeEdgeMetres } from '../src/lib/scene/maths.js';
import { getCommodity } from '../src/lib/commodities.js';

const gold = getCommodity('gold')!;

describe('optics — declared lens', () => {
	it('derives a ~38 mm focal length from the 35° FOV on a full-frame sensor', () => {
		expect(SENSOR_HEIGHT_M).toBe(0.024);
		expect(F_NUMBER).toBe(2.8);
		expect(focalLengthM(FOV_DEG) * 1000).toBeCloseTo(38.06, 1);
	});

	it('is sharp at the focus distance and blurs either side', () => {
		expect(cocFraction(1, 1)).toBe(0);
		expect(cocFraction(0.5, 1)).toBeGreaterThan(0);
		expect(cocFraction(2, 1)).toBeGreaterThan(0);
	});

	it('matches the thin-lens formula', () => {
		const f = focalLengthM();
		const A = f / F_NUMBER;
		const d = 3;
		const S = 0.3;
		expect(cocFraction(d, S)).toBeCloseTo((A * f * (d - S)) / (d * (S - f) * SENSOR_HEIGHT_M), 12);
	});

	it('gives macro shots heavy blur and wide shots almost none — the tilt-shift cue, honestly', () => {
		const macroFocus = framingDistance(framingDominant(0.001)); // speck: framing floor
		const wideFocus = framingDistance(framingDominant(8.7)); // whole-supply gold
		const bgMacro = cocFraction(1e6, macroFocus);
		const bgWide = cocFraction(1e6, wideFocus);
		expect(bgMacro).toBeGreaterThan(0.05); // >5% of the frame
		expect(bgWide).toBeLessThan(0.002); // <0.2% of the frame
	});

	it('cocScalePx equals the blur of a point at infinity, in pixels', () => {
		const S = 0.4;
		expect(cocScalePx(S, 1000)).toBeCloseTo(cocFraction(1e12, S) * 1000, 4);
	});

	it('returns 0 for a focus distance inside the focal length', () => {
		expect(cocScalePx(0.01, 1000)).toBe(0);
		expect(cocFraction(1, 0.01)).toBe(0);
	});
});

describe('optics — loupe', () => {
	it('is off when the cube reads unaided', () => {
		expect(loupeMagnification(LOUPE_TRIGGER_PX)).toBeNull();
		expect(loupeMagnification(50)).toBeNull();
		expect(loupeMagnification(0)).toBeNull();
	});

	it('shows 1 sat of gold at ×200 on a 520 px stage (the scene brief\'s example)', () => {
		const edge = cubeEdgeMetres(19.72e-8, gold); // ~68 µm
		const dist = framingDistance(framingDominant(edge));
		const px = projectedSizePx(edge, dist, 520);
		expect(px).toBeLessThan(1);
		expect(loupeMagnification(px)).toBe(200);
	});

	it('always lands the magnified cube in a legible band', () => {
		for (let px = 0.01; px < LOUPE_TRIGGER_PX; px *= 1.3) {
			const m = loupeMagnification(px)!;
			expect(LOUPE_LADDER).toContain(m);
			expect(px * m).toBeGreaterThan(30);
			expect(px * m).toBeLessThan(200);
		}
	});

	it('magnifies by narrowing the field of view from the same viewpoint', () => {
		const m = 200;
		const t0 = Math.tan(((FOV_DEG * Math.PI) / 180) / 2);
		const t1 = Math.tan(((magnifiedFovDeg(m) * Math.PI) / 180) / 2);
		expect(t0 / t1).toBeCloseTo(m, 6);
	});
});

describe('grab — direct manipulation mapping', () => {
	it('dragging up a full stage height grows the amount by DECADES_PER_STAGE decades', () => {
		expect(dragRatio(-500, 500)).toBeCloseTo(10 ** DECADES_PER_STAGE, 6);
		expect(dragRatio(500, 500)).toBeCloseTo(10 ** -DECADES_PER_STAGE, 12);
		expect(dragRatio(0, 500)).toBe(1);
	});

	it('pinch makes the edge follow the fingers (amount ∝ spread³)', () => {
		expect(pinchRatio(200, 100)).toBeCloseTo(8, 9);
		expect(pinchRatio(0, 100)).toBe(1);
	});

	it('ctrl+wheel zooms like a pinch and is symmetric', () => {
		expect(wheelZoomRatio(-10) * wheelZoomRatio(10)).toBeCloseTo(1, 12);
		expect(wheelZoomRatio(-10)).toBeGreaterThan(1);
	});

	it('orbit is clamped', () => {
		expect(orbitYaw(0, 1e6, 500)).toBe(-ORBIT_MAX_RAD);
		expect(orbitYaw(0, -1e6, 500)).toBe(ORBIT_MAX_RAD);
		expect(orbitYaw(0, 0, 500)).toBe(0);
	});

	it('clamps to 1 sat … 21M', () => {
		expect(clampBtc(0)).toBe(BTC_MIN);
		expect(clampBtc(1e9)).toBe(BTC_MAX);
		expect(clampBtc(NaN)).toBe(BTC_MIN);
		expect(clampBtc(2)).toBe(2);
	});

	it('rounds like the slider and never to zero', () => {
		expect(roundBtc(12.340000000000002)).toBe(12.34);
		expect(roundBtc(1234.6)).toBe(1235);
		expect(roundBtc(0.012345)).toBe(0.0123);
		expect(roundBtc(1.4e-9)).toBe(BTC_MIN);
	});
});
