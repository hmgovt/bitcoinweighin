import { describe, it, expect } from 'vitest';
import {
	computePxPerMetre,
	spritePixelSize,
	SHIBA_HEIGHT_M,
	VIEWPORT_MARGIN,
	GAP_FROM_MIDLINE_PX,
} from '../src/lib/volume.js';

/**
 * Viewport rule:
 *   viewportHeightM = max(SHIBA_HEIGHT_M, cubeEdgeM) × VIEWPORT_MARGIN
 *
 * `pxPerMetre` is the *visible* pixels per real metre — slot dimensions
 * are scaled up by 1/visibleHeightFraction so the visible bbox of the
 * sprite (not the transparent canvas) fills the viewport. Cube +
 * Shiba each have a fixed midline anchor at ± GAP_FROM_MIDLINE_PX and
 * scale outward only. The horizontal clamp engages at narrow viewports
 * / extreme amounts so the visible outer edge never crosses the row.
 *
 * Tests use a 360 × 1400 row — close to actual desktop dimensions —
 * so the height-driven branch dominates at all three canonical points.
 */

const ROW_HEIGHT_PX = 360;
const ROW_WIDTH_PX = 1400;

describe('computePxPerMetre — height-driven viewport', () => {
	it('Shiba dominates at sub-millimetre cube (1 sat of gold)', () => {
		// 1 sat of gold ≈ 25 µm cube edge
		const cubeEdgeM = 25e-6;
		const px = computePxPerMetre(cubeEdgeM, ROW_HEIGHT_PX, ROW_WIDTH_PX);
		const shibaVisiblePx = spritePixelSize(SHIBA_HEIGHT_M, px);
		const cubeVisiblePx = spritePixelSize(cubeEdgeM, px);

		// pxPerMetre = 360 / (0.40 × 1.10) = 818.18
		// Shiba visible height ≈ 327 px (≈ 91 % of row)
		expect(shibaVisiblePx).toBeCloseTo(ROW_HEIGHT_PX / VIEWPORT_MARGIN, 0);
		expect(cubeVisiblePx).toBeLessThan(0.1);
	});

	it('cube and Shiba both visible at 1 BTC (24 mm cube)', () => {
		const cubeEdgeM = 0.024;
		const px = computePxPerMetre(cubeEdgeM, ROW_HEIGHT_PX, ROW_WIDTH_PX);
		const shibaVisiblePx = spritePixelSize(SHIBA_HEIGHT_M, px);
		const cubeVisiblePx = spritePixelSize(cubeEdgeM, px);

		// Shiba still dominant — viewportHeightM = 0.40 × 1.10 = 0.44m
		expect(shibaVisiblePx).toBeCloseTo(ROW_HEIGHT_PX / VIEWPORT_MARGIN, 0);
		// Cube ~20 px visible height (small but legible)
		expect(cubeVisiblePx).toBeGreaterThan(15);
		expect(cubeVisiblePx).toBeLessThan(25);
	});

	it('cube dominates at multi-metre edge (≈ market cap of gold)', () => {
		// 21M BTC of gold at session-date prices ≈ 8.44 m cube edge
		const cubeEdgeM = 8.44;
		const px = computePxPerMetre(cubeEdgeM, ROW_HEIGHT_PX, ROW_WIDTH_PX);
		const cubeVisiblePx = spritePixelSize(cubeEdgeM, px);
		const shibaVisiblePx = spritePixelSize(SHIBA_HEIGHT_M, px);

		// On 360 × 1400: height-fit = 360/(8.44*1.10) = 38.79.
		// width-fit  = (700-50)/(8.44*0.976) = 78.91 — height wins.
		// Cube visible height ≈ 327 px (≈ 91 % of row); Shiba ≈ 15 px.
		expect(cubeVisiblePx).toBeCloseTo(ROW_HEIGHT_PX / VIEWPORT_MARGIN, 0);
		expect(shibaVisiblePx).toBeGreaterThan(10);
		expect(shibaVisiblePx).toBeLessThan(20);
	});

	it('horizontal clamp keeps the dominant visible edge within its side', () => {
		// 21M BTC cube on a narrow 500 px viewport. Each side has
		// (500 / 2) − 50 = 200 px between the midline anchor and the
		// row edge. Visible cube width must fit within that.
		const cubeEdgeM = 8.44;
		const narrowWidth = 500;
		const px = computePxPerMetre(cubeEdgeM, ROW_HEIGHT_PX, narrowWidth);
		const cubeVisiblePx = spritePixelSize(cubeEdgeM, px);
		const shibaVisiblePx = spritePixelSize(SHIBA_HEIGHT_M, px);

		const sidePx = narrowWidth / 2 - GAP_FROM_MIDLINE_PX;
		// Visible width = visible height × (visWidthFrac / visHeightFrac)
		// for the cube ≈ visible height × 0.976.
		const visibleCubeWidthPx = cubeVisiblePx * (0.6575 / 0.6738);
		expect(visibleCubeWidthPx).toBeLessThanOrEqual(sidePx + 0.5);
		// Relative scale between cube and Shiba is preserved end-to-end.
		expect(cubeVisiblePx / shibaVisiblePx).toBeCloseTo(cubeEdgeM / SHIBA_HEIGHT_M, 5);
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

	it('mobile gap override gives more side room than the default', () => {
		// Narrow phone: 320 px wide row, default 50 px gap leaves only
		// 110 px per side. A 14 px gap leaves 146 px — visible Shiba
		// can scale up by ≈ 33 % before the width clamp binds again.
		const cubeEdgeM = 25e-6;
		const phoneWidth = 320;
		const phoneHeight = 360;
		const pxDefault = computePxPerMetre(cubeEdgeM, phoneHeight, phoneWidth);
		const pxMobile = computePxPerMetre(cubeEdgeM, phoneHeight, phoneWidth, 14);
		expect(pxMobile).toBeGreaterThan(pxDefault);
		// And the visible Shiba grows in absolute pixels too.
		const visibleShibaDefault = spritePixelSize(SHIBA_HEIGHT_M, pxDefault);
		const visibleShibaMobile = spritePixelSize(SHIBA_HEIGHT_M, pxMobile);
		expect(visibleShibaMobile).toBeGreaterThan(visibleShibaDefault);
	});
});
