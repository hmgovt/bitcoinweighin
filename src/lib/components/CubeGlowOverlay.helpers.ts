/**
 * Helper logic for CubeGlowOverlay (Pu-238 cube only).
 *
 * Glow is built from TWO independently-scaling channels — intensity
 * (brightness, opacity, bloom) and colour temperature (hue position
 * along a blackbody emission ladder) — not from threshold bands with
 * bundled colour+opacity pairs. Real incandescence works this way:
 * a small hot pellet is already cherry-red but dim, while a kilogram
 * is bright at the same colour, and ten kilograms is bright AND yellow.
 * Intensity climbs faster than colour temperature.
 */

/** Canonical incandescent emission stops, ~400 °C → 1500 °C+. */
export const COLOR_STOPS = [
	{ t: 0.0, hex: '#1a0000' }, // just-perceptible IR red, ~400 °C
	{ t: 0.15, hex: '#5c1a00' }, // dull red, ~600 °C
	{ t: 0.3, hex: '#a83000' }, // cherry red, ~800 °C
	{ t: 0.5, hex: '#ff5500' }, // orange, ~1000 °C
	{ t: 0.7, hex: '#ffaa00' }, // amber-yellow, ~1200 °C
	{ t: 0.85, hex: '#ffee99' }, // white-yellow, ~1400 °C
	{ t: 1.0, hex: '#ffffff' }, // white-hot, dial-cranked-past-physics
] as const;

/**
 * Hue position 0 → 1 along the blackbody emission ladder.
 *
 * Piecewise log curve calibrated against the canonical positions in
 * `docs/handoff/06-pu238.md`:
 *
 *   1 g     → 0     (just-perceptible IR red)
 *   16 g    → 0.187 (dull red — 1 BTC)
 *   160 g   → 0.343 (cherry red — 10 BTC)
 *   1.6 kg  → 0.557 (orange — 100 BTC, "bright orange")
 *   4.5 kg  → 0.749 (orange-yellow — 280 BTC, Voyager fuel-load)
 *   10 kg  → 0.898 (near white-yellow — 625 BTC, theoretical critical)
 *   16 kg  → 0.986 (white-hot — 1000 BTC)
 *
 * A simple linear-in-log curve can't hit both ends of the table: the
 * 0.18 coefficient that landed in Stage 3 was too warm at 100 BTC and
 * too cool at 1000 BTC. The piecewise sits at 0.156·log10 below 1 kg
 * and accelerates to 0.43·log10 above, blending continuously at 1 kg.
 */
export function massToColorTemp(massGrams: number): number {
	if (massGrams < 1) return 0;
	const log = Math.log10(massGrams);
	if (log <= 3) {
		// 1 g → 1 kg: 0 → 0.468.
		return log * 0.156;
	}
	// 1 kg → 16 kg+: 0.468 → 1.0. Coefficient 0.43 hits 1.0 at 16.16 kg.
	return Math.min(1, 0.468 + (log - 3) * 0.43);
}

/** Brightness 0 → 1; scales faster than colour temperature. */
export function massToIntensity(massGrams: number): number {
	if (massGrams < 0.1) return 0;
	return Math.min(1, Math.log10(massGrams * 10) * 0.22);
}

function hexToRgb(hex: string): [number, number, number] {
	const n = parseInt(hex.replace('#', ''), 16);
	return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function rgbToHex(rgb: [number, number, number]): string {
	return (
		'#' +
		rgb
			.map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0'))
			.join('')
	);
}

/**
 * Linear RGB interpolation between adjacent COLOR_STOPS.
 * (HCL/OKLab would be perceptually smoother; linear RGB is acceptable MVP.)
 */
export function interpolateColor(t: number): string {
	const clamped = Math.max(0, Math.min(1, t));

	for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
		const lo = COLOR_STOPS[i];
		const hi = COLOR_STOPS[i + 1];
		if (clamped >= lo.t && clamped <= hi.t) {
			if (clamped === lo.t) return lo.hex;
			if (clamped === hi.t) return hi.hex;
			const localT = (clamped - lo.t) / (hi.t - lo.t);
			const [lr, lg, lb] = hexToRgb(lo.hex);
			const [hr, hg, hb] = hexToRgb(hi.hex);
			return rgbToHex([lr + (hr - lr) * localT, lg + (hg - lg) * localT, lb + (hb - lb) * localT]);
		}
	}
	return COLOR_STOPS[COLOR_STOPS.length - 1].hex;
}

export interface GlowParams {
	/** Interpolated emission colour at the current colour temperature. */
	color: string;
	/** intensity × 0.9 — peak 0.9 so the glow never fully obscures the cube. */
	opacity: number;
	/** intensity × 64 — peak 64 px bloom radius. */
	bloomPx: number;
	/**
	 * True at mass ≥ 1 kg, where pure plutonium metal would self-melt.
	 * Parent panel appends "(would melt itself in reality)" to the readout.
	 */
	warningCaption: boolean;
}

export function computeGlowParams(massGrams: number): GlowParams {
	const colorTemp = massToColorTemp(massGrams);
	const intensity = massToIntensity(massGrams);
	return {
		color: interpolateColor(colorTemp),
		opacity: intensity * 0.9,
		bloomPx: intensity * 64,
		warningCaption: massGrams >= 1000,
	};
}
