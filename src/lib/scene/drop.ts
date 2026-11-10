/**
 * Drop physics — pure, tested. "The Drop" is the live stage's weigh-in
 * moment: when the visitor lets go of the slider, picks a preset, types an
 * amount or taps the cube, the cube is hoisted and dropped onto the floor
 * beside Sat. Everything that follows — how long it falls, how hard it
 * lands, how far the dust goes, how much the camera shakes, whether the
 * floor cracks — derives from real physics on the real cube:
 *
 *  · It is dropped from its OWN HEIGHT (underside one edge-length above the
 *    floor), under standard gravity, in real time. That makes fall time an
 *    honest scale cue: a speck lands in milliseconds, a monolith takes over
 *    a second. It's the reason film-makers over-crank miniatures — gravity
 *    gives scale away — played straight instead of hidden.
 *  · Impact energy is m·g·h. Nothing is scaled "by feel": shake, dust and
 *    Sat's reaction are monotonic in that one number.
 *  · Resting bearing pressure is ρ·g·edge (a cube's weight over its own
 *    footprint), compared against the International Building Code's
 *    presumptive allowable bearing values (IBC Table 1806.2).
 *
 * The camera-clearance helper at the bottom keeps a held camera (the shot
 * freezes while the visitor drags, so the cube can outgrow it) from ever
 * ending up inside a cube that has grown past it.
 */

import { formatLength, formatNum, type UnitSystem } from '../format.js';

/** Standard gravity, m/s² — exact by definition (3rd CGPM, 1901). */
export const STANDARD_GRAVITY = 9.80665;

/** Joules per tonne of TNT — exact by convention (NIST SP 811). */
export const J_PER_TONNE_TNT = 4.184e9;

/** Pascals per pound-force per square foot. */
export const PA_PER_PSF = 47.880259;

/** Coefficient of restitution for the cube's bounce. A dense metal block on
 *  a hard floor bounces little; 0.3 reads right and is never quoted in copy
 *  (it only shapes the visual settle, not any stated figure). */
export const RESTITUTION = 0.3;

/** Bounces drawn after the first impact before the cube is declared at rest. */
export const MAX_BOUNCES = 2;

/** Hoist duration, seconds — the quick lift to drop height before release.
 *  Choreography, not physics: nothing in the readout depends on it. */
export const HOIST_S = 0.3;

// ── The drop itself ─────────────────────────────────────────────────────────

/** Drop height, metres: the cube is dropped from its own height. */
export function dropHeightM(edge: number): number {
	return Math.max(edge, 0);
}

/** Free-fall time from height `h` (metres) under standard gravity, seconds. */
export function fallTimeS(h: number): number {
	return h > 0 ? Math.sqrt((2 * h) / STANDARD_GRAVITY) : 0;
}

/** Impact energy, joules: m·g·h. */
export function impactEnergyJ(massKg: number, h: number): number {
	return Math.max(massKg, 0) * STANDARD_GRAVITY * Math.max(h, 0);
}

/**
 * Height of the cube's underside above the floor at time `t` seconds after
 * release from `y0`. Analytic (no integration drift): a free fall, then up to
 * `maxBounces` ballistic bounces, each launched at `restitution` × the
 * previous impact speed. `impacts` counts floor contacts so far, so the
 * caller can fire effects on the frame where it increments.
 */
export function dropOffset(
	y0: number,
	t: number,
	restitution: number = RESTITUTION,
	maxBounces: number = MAX_BOUNCES
): { y: number; impacts: number; settled: boolean } {
	if (y0 <= 0) return { y: 0, impacts: 0, settled: true };
	if (t <= 0) return { y: y0, impacts: 0, settled: false };

	const g = STANDARD_GRAVITY;
	const tf = fallTimeS(y0);
	if (t < tf) return { y: y0 - 0.5 * g * t * t, impacts: 0, settled: false };

	let tt = t - tf;
	let v = g * tf; // impact speed
	for (let k = 1; k <= maxBounces; k++) {
		v *= restitution;
		const dur = (2 * v) / g;
		if (tt < dur) {
			return { y: Math.max(v * tt - 0.5 * g * tt * tt, 0), impacts: k, settled: false };
		}
		tt -= dur;
	}
	return { y: 0, impacts: maxBounces + 1, settled: true };
}

/** Total time from release to rest for a drop from `y0`, seconds. */
export function dropDurationS(
	y0: number,
	restitution: number = RESTITUTION,
	maxBounces: number = MAX_BOUNCES
): number {
	if (y0 <= 0) return 0;
	const g = STANDARD_GRAVITY;
	const tf = fallTimeS(y0);
	let total = tf;
	let v = g * tf;
	for (let k = 1; k <= maxBounces; k++) {
		v *= restitution;
		total += (2 * v) / g;
	}
	return total;
}

/** Energy delivered by the n-th floor contact (1-based): the first impact
 *  carries m·g·h, each bounce keeps restitution² of the kinetic energy. */
export function nthImpactEnergyJ(firstImpactJ: number, n: number, restitution: number = RESTITUTION): number {
	return firstImpactJ * Math.pow(restitution * restitution, Math.max(n - 1, 0));
}

/** Hoist profile: ease-out cubic from `fromY` to `toY` over HOIST_S. */
export function hoistOffset(fromY: number, toY: number, t: number, duration: number = HOIST_S): number {
	const k = Math.min(Math.max(t / duration, 0), 1);
	const eased = 1 - Math.pow(1 - k, 3);
	return fromY + (toY - fromY) * eased;
}

// ── Effect scaling — one monotonic dial from impact energy ─────────────────

/** Energy band the effects span, joules (log-mapped onto 0..1). Below
 *  1 mJ nothing visible happens; the 21M-BTC gold cube (~1.1 GJ) pins 1. */
const INTENSITY_MIN_J = 1e-3;
const INTENSITY_MAX_J = 1e9;

/** 0→1 effect intensity, log-mapped from impact energy. Monotonic. */
export function impactIntensity(energyJ: number): number {
	if (!(energyJ > 0)) return 0;
	const t =
		(Math.log10(energyJ) - Math.log10(INTENSITY_MIN_J)) /
		(Math.log10(INTENSITY_MAX_J) - Math.log10(INTENSITY_MIN_J));
	return Math.min(Math.max(t, 0), 1);
}

/** Camera shake for an impact: angular amplitude (radians — angular so it
 *  reads the same at every scale) and exponential decay time (seconds). */
export function shakeProfile(intensity: number): { amplitudeRad: number; decayS: number } {
	if (intensity < 0.05) return { amplitudeRad: 0, decayS: 0 };
	const deg = 0.12 + 1.5 * intensity * intensity;
	return { amplitudeRad: (deg * Math.PI) / 180, decayS: 0.18 + 0.6 * intensity };
}

/** Dust lifetime, seconds. Scales with √(edge / g) — the free-fall
 *  timescale of the cube itself — so big impacts billow for longer. */
export function dustLifetimeS(edge: number): number {
	return Math.max(0.5, 3 * Math.sqrt(Math.max(edge, 0) / STANDARD_GRAVITY));
}

/** How far the dust skirt spreads from the cube's centre, metres. */
export function dustRadiusM(edge: number, intensity: number): number {
	return edge * (0.9 + 1.6 * intensity);
}

// ── Bearing pressure vs the building code ──────────────────────────────────

/** Resting bearing pressure of a cube on its own footprint, pascals: ρ·g·edge. */
export function bearingPressurePa(densityGPerCm3: number, edge: number): number {
	return densityGPerCm3 * 1000 * STANDARD_GRAVITY * Math.max(edge, 0);
}

export interface SoilClass {
	id: string;
	/** Reads mid-sentence: "…allows on {label}". */
	label: string;
	allowablePsf: number;
}

/**
 * Presumptive load-bearing values, International Building Code (2018/2021)
 * Table 1806.2 — allowable foundation pressure, psf. Allowable values carry
 * the code's safety margin: exceeding one is a code violation, not proof the
 * ground would fail. Ascending.
 */
export const IBC_PRESUMPTIVE_BEARING: readonly SoilClass[] = [
	{ id: 'clay', label: 'clay', allowablePsf: 1500 },
	{ id: 'sand', label: 'sand', allowablePsf: 2000 },
	{ id: 'gravel', label: 'gravel', allowablePsf: 3000 },
	{ id: 'sedimentary_rock', label: 'sedimentary rock', allowablePsf: 4000 },
	{ id: 'bedrock', label: 'bedrock', allowablePsf: 12000 },
] as const;

/** The most generous soil class whose allowable pressure `pressurePa`
 *  exceeds, or null when it's within what the code allows on clay. */
export function soilClassExceeded(pressurePa: number): SoilClass | null {
	const psf = pressurePa / PA_PER_PSF;
	let hit: SoilClass | null = null;
	for (const c of IBC_PRESUMPTIVE_BEARING) {
		if (psf > c.allowablePsf) hit = c;
	}
	return hit;
}

/** True once the cube bears down harder than the code allows even on
 *  bedrock — the threshold at which the stage draws the floor cracked. */
export function exceedsBedrock(pressurePa: number): boolean {
	return soilClassExceeded(pressurePa)?.id === 'bedrock';
}

// ── Readout copy ────────────────────────────────────────────────────────────

/** "0.19 J", "1.1 GJ", "4.1 pJ" — SI prefixes, three significant figures. */
export function formatEnergy(j: number): string {
	if (!(j > 0)) return '0 J';
	const ladder: [number, string][] = [
		[1e9, 'GJ'],
		[1e6, 'MJ'],
		[1e3, 'kJ'],
		[1e-2, 'J'],
		[1e-3, 'mJ'],
		[1e-6, 'µJ'],
		[1e-9, 'nJ'],
		[1e-12, 'pJ'],
	];
	for (const [scale, unit] of ladder) {
		if (j >= scale) {
			const v = unit === 'J' ? j : j / scale;
			return `${sig3(v)} ${unit}`;
		}
	}
	return `${sig3(j / 1e-15)} fJ`;
}

/** Fall time: "1.33 s", "80 ms", "3.7 ms". */
export function formatDuration(s: number): string {
	if (s >= 1) return `${s.toFixed(2)} s`;
	const ms = s * 1000;
	if (ms >= 10) return `${Math.round(ms)} ms`;
	if (ms >= 0.1) return `${ms.toFixed(1)} ms`;
	return `${sig3(ms * 1000)} µs`;
}

/** TNT equivalent: "260 kg of TNT", "3.2 g of TNT". Null below one gram. */
export function formatTnt(j: number): string | null {
	const tonnes = j / J_PER_TONNE_TNT;
	const grams = tonnes * 1e6;
	if (grams < 1) return null;
	if (grams < 1000) return `${sig3(grams)} g of TNT`;
	if (tonnes < 1) return `${sig3(grams / 1000)} kg of TNT`;
	return `${sig3(tonnes)} t of TNT`;
}

/** Pressure: psf (the building code's own unit) or kPa. */
export function formatPressure(pa: number, unit: UnitSystem): string {
	if (unit === 'imperial') return `${formatNum(pa / PA_PER_PSF)} psf`;
	if (pa < 1000) return `${formatNum(pa)} Pa`;
	return `${formatNum(pa / 1000)} kPa`;
}

function sig3(v: number): string {
	if (v >= 100) return Math.round(v).toLocaleString('en-US');
	return String(Number(v.toPrecision(3)));
}

/**
 * The drop line under the readout, e.g.
 *   "Dropped from its own height (1.25 in), it falls for 80 ms and hits
 *    the floor with 0.19 J. At rest it bears down at 125 psf."
 * plus, past the clay allowance, the building-code clause. Every figure is
 * derived here from (edge, mass, density) — nothing is hard-coded.
 */
export function formatDropLine(opts: {
	edge: number;
	massGrams: number;
	densityGPerCm3: number;
	unit: UnitSystem;
}): string {
	const { edge, massGrams, densityGPerCm3, unit } = opts;
	if (!(edge > 0) || !(massGrams > 0)) return '';
	const h = dropHeightM(edge);
	const e = impactEnergyJ(massGrams / 1000, h);
	const tnt = formatTnt(e);
	const pa = bearingPressurePa(densityGPerCm3, edge);
	const soil = soilClassExceeded(pa);

	let line =
		`Dropped from its own height (${formatLength(h, unit)}), it falls for ` +
		`${formatDuration(fallTimeS(h))} and hits the floor with ${formatEnergy(e)}` +
		(tnt ? ` — about ${tnt}.` : '.') +
		` At rest it bears down at ${formatPressure(pa, unit)}`;
	if (soil) {
		const limit = formatPressure(soil.allowablePsf * PA_PER_PSF, unit);
		line +=
			soil.id === 'bedrock'
				? `, more than the building code allows even on bedrock (${limit}).`
				: `, more than the building code allows on ${soil.label} (${limit}).`;
	} else {
		line += '.';
	}
	return line;
}

// ── Held-camera clearance ───────────────────────────────────────────────────

export interface Vec3Like {
	x: number;
	y: number;
	z: number;
}

/** Clearance the held camera keeps from the cube's faces, as a fraction of
 *  the edge (plus a 2 cm floor). Close enough that the face fills the frame
 *  — the "wall of gold" — never so close that the near plane clips it. */
export const HOLD_CLEARANCE_RATIO = 0.12;

/**
 * Push a camera position out of a cube that has grown around it. The cube
 * sits on the floor centred on the origin, occupying [-e/2, e/2] in x and z
 * and [lift, lift + e] in y. Pushes HORIZONTALLY only (radially in xz, y
 * untouched) — a radial 3-D push from the cube's centre would drive a
 * low camera down through the floor. No-op when the camera is already clear.
 */
export function clearCameraFromCube(pos: Vec3Like, edge: number, lift = 0): Vec3Like {
	const margin = Math.max(edge * HOLD_CLEARANCE_RATIO, 0.02);
	const half = edge / 2 + margin;
	if (pos.y > lift + edge + margin) return { ...pos }; // above the cube
	const ax = Math.abs(pos.x);
	const az = Math.abs(pos.z);
	if (Math.max(ax, az) >= half) return { ...pos };
	const r = Math.max(ax, az);
	if (r < 1e-9) return { x: pos.x, y: pos.y, z: half }; // dead centre — step back toward +z
	const s = half / r;
	return { x: pos.x * s, y: pos.y, z: pos.z * s };
}
