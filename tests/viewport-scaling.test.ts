import { describe, it, expect } from 'vitest';
import {
	computePxPerMetre,
	spritePixelSize,
	SHIBA_HEIGHT_M,
	VIEWPORT_MARGIN,
} from '../src/lib/volume.js';

/**
 * 2026-05-08 viewport rule:
 *   viewportHeightM = max(SHIBA_HEIGHT_M, cubeEdgeM) × VIEWPORT_MARGIN
 *
 * Both sprites render at true scale within that viewport. The dominant
 * element fills its side; the other element scales down proportionally.
 * On narrow viewports a horizontal-fit clamp kicks in so cube + Shiba
 * never overlap edge-to-edge.
 */

const ROW_HEIGHT_PX = 600;
const ROW_WIDTH_PX = 1000;

describe('computePxPerMetre — height-driven viewport', () => {
	it('Shiba dominates at sub-millimetre cube (1 sat of gold)', () => {
		// 1 sat of gold ≈ 25 µm cube edge
		const cubeEdgeM = 25e-6;
		const px = computePxPerMetre(cubeEdgeM, ROW_HEIGHT_PX, ROW_WIDTH_PX);
		const shibaPx = spritePixelSize(SHIBA_HEIGHT_M, px);
		const cubePx = spritePixelSize(cubeEdgeM, px);

		// pxPerMetre = 600 / (0.40 × 1.10) = 600 / 0.44 ≈ 1363.6
		// Shiba ≈ 545 px (≈ 91 % of 600 px row, i.e. 1/VIEWPORT_MARGIN)
		expect(shibaPx).toBeCloseTo(ROW_HEIGHT_PX / VIEWPORT_MARGIN, 0);
		expect(cubePx).toBeLessThan(0.1);
	});

	it('cube and Shiba both visible at 1 BTC (24 mm cube)', () => {
		const cubeEdgeM = 0.024;
		const px = computePxPerMetre(cubeEdgeM, ROW_HEIGHT_PX, ROW_WIDTH_PX);
		const shibaPx = spritePixelSize(SHIBA_HEIGHT_M, px);
		const cubePx = spritePixelSize(cubeEdgeM, px);

		// Shiba still dominant — viewportHeightM = 0.40 × 1.10 = 0.44m
		expect(shibaPx).toBeCloseTo(ROW_HEIGHT_PX / VIEWPORT_MARGIN, 0);
		// Cube ~33 px (small but visible)
		expect(cubePx).toBeGreaterThan(20);
		expect(cubePx).toBeLessThan(50);
	});

	it('cube dominates at multi-metre edge (≈ market cap of gold)', () => {
		// 21M BTC of gold at session-date prices ≈ 8.44 m cube edge
		const cubeEdgeM = 8.44;
		const px = computePxPerMetre(cubeEdgeM, ROW_HEIGHT_PX, ROW_WIDTH_PX);
		const cubePx = spritePixelSize(cubeEdgeM, px);
		const shibaPx = spritePixelSize(SHIBA_HEIGHT_M, px);

		// On a 1000px wide viewport: width-fit = 1000/(8.44+0.40) = 113.1
		// height-fit = 600/(8.44*1.10) = 64.66 — height wins (smaller).
		// So cube ≈ 545 px (≈ 91 % of row), Shiba ≈ 26 px.
		expect(cubePx).toBeCloseTo(ROW_HEIGHT_PX / VIEWPORT_MARGIN, 0);
		expect(shibaPx).toBeGreaterThan(20);
		expect(shibaPx).toBeLessThan(40);
	});

	it('horizontal safety scales both down on narrow viewports', () => {
		// 21M BTC cube on a narrow 500 px viewport — height-only would
		// have cube + Shiba overlap horizontally. The width clamp kicks in.
		const cubeEdgeM = 8.44;
		const narrowWidth = 500;
		const px = computePxPerMetre(cubeEdgeM, ROW_HEIGHT_PX, narrowWidth);
		const cubePx = spritePixelSize(cubeEdgeM, px);
		const shibaPx = spritePixelSize(SHIBA_HEIGHT_M, px);

		// Combined width must fit within the viewport.
		expect(cubePx + shibaPx).toBeLessThanOrEqual(narrowWidth + 0.5);
		// Relative scale between cube and Shiba is preserved.
		expect(cubePx / shibaPx).toBeCloseTo(cubeEdgeM / SHIBA_HEIGHT_M, 5);
	});

	it('preserves honest relative scale at every amount', () => {
		// The cube/Shiba pixel ratio always equals their real-world ratio
		// — that's the point of cube mode.
		for (const cubeEdgeM of [25e-6, 0.012, 0.024, 0.5, 1.0, 8.44]) {
			const px = computePxPerMetre(cubeEdgeM, ROW_HEIGHT_PX, ROW_WIDTH_PX);
			const cubePx = spritePixelSize(cubeEdgeM, px);
			const shibaPx = spritePixelSize(SHIBA_HEIGHT_M, px);
			expect(cubePx / shibaPx).toBeCloseTo(cubeEdgeM / SHIBA_HEIGHT_M, 5);
		}
	});

	it('returns 0 when viewport height is unknown (pre-mount)', () => {
		expect(computePxPerMetre(0.024, 0, ROW_WIDTH_PX)).toBe(0);
	});
});
