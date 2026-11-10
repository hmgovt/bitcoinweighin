/**
 * The sound of the cube hitting the floor — pure, tested.
 *
 * A block landing flat on a concrete floor is heard mostly through the
 * FLOOR, not the block. The pieces, each from textbook acoustics:
 *
 *  1. THE BLOW. A flat face on an elastic floor is a mass on a spring: the
 *     cube's mass against the stiffness of a flat, square punch pressed into
 *     an elastic half-space (k ≈ 2E*·a, a = L/√π) in series with the cube's
 *     own axial stiffness (E·L). The contact force is a half-sine lasting
 *     τ = π√(m/k) and carrying the impulse J = m·v·(1+e). Since m ∝ L³ and
 *     k ∝ L, τ ∝ L: bigger cubes land with longer, deeper blows. Its peak,
 *     F₀ = πJ/(2τ), is startling — ~190 tonnes-force for 500 BTC of gold.
 *  2. THE THUD. A point force on a floor slab radiates a pressure that
 *     follows the force itself (Cremer & Heckl, "Structure-Borne Sound":
 *     below coincidence p ≈ ρ₀·F(t) / (2π·m''·r)) — so what you hear is the
 *     shape of the blow, low-passed by its own duration.
 *  3. THE CRACK. The cube stopping dead is an accelerating body: a dipole
 *     whose pressure follows dF/dt. Relative to the thud it scales as
 *     T·dF/dt with T = 0.75·m''/(c₀·ρ_cube) (~41 µs for gold) — it
 *     dominates for small cubes ("tick") and fades for big ones ("whump").
 *  4. FRACTURE. Past the building code's bedrock allowance the stage draws
 *     the floor cracked; the sound adds a burst of fracture clicks. This is
 *     the one stylised element: the timing and texture of cracking concrete
 *     are illustrative, only whether it cracks is computed.
 *  5. THE ROOM, a stated large studio (acoustics.ts ROOM).
 *
 * The cube's own ring is left out ON PURPOSE: its free-vibration modes
 * (modal.ts) carry under 1/500th of the thud's acoustic energy for a 500 BTC
 * cube even undamped, and a block pressed flat on concrete loses it into the
 * floor within a few cycles (see the "ring is negligible" test).
 */

import {
	MATERIAL_ACOUSTICS,
	youngsModulusOf,
	FLOOR,
	FLOOR_SURFACE_DENSITY,
	AIR,
	ROOM,
} from './acoustics.js';
import { STANDARD_GRAVITY, RESTITUTION, dropHeightM, formatDuration } from './drop.js';
import { formatNum, type UnitSystem } from '../format.js';

export type SoundingMaterial = keyof typeof MATERIAL_ACOUSTICS;

export function isSoundingMaterial(id: string): id is SoundingMaterial {
	return id in MATERIAL_ACOUSTICS;
}

// ── The blow ────────────────────────────────────────────────────────────────

/** Contact stiffness, N/m: flat square punch on the concrete half-space, in
 *  series with the cube's own axial stiffness. Both ∝ edge. */
export function contactStiffness(id: SoundingMaterial, edge: number, densityGPerCm3: number): number {
	const eStar = FLOOR.youngsModulusPa / (1 - FLOOR.poisson * FLOOR.poisson);
	const kFloor = 2 * eStar * (edge / Math.sqrt(Math.PI));
	const kCube = youngsModulusOf(MATERIAL_ACOUSTICS[id], densityGPerCm3 * 1000) * edge;
	return 1 / (1 / kFloor + 1 / kCube);
}

/** How long the blow lasts, seconds: τ = π√(m/k). ∝ edge. */
export function contactTimeS(id: SoundingMaterial, edge: number, densityGPerCm3: number): number {
	if (!(edge > 0)) return 0;
	const m = densityGPerCm3 * 1000 * edge ** 3;
	return Math.PI * Math.sqrt(m / contactStiffness(id, edge, densityGPerCm3));
}

/** Impulse of the first landing, N·s: J = m·v·(1 + e), dropped from its own height. */
export function impactImpulse(edge: number, densityGPerCm3: number): number {
	const m = densityGPerCm3 * 1000 * edge ** 3;
	const v = Math.sqrt(2 * STANDARD_GRAVITY * dropHeightM(edge));
	return m * v * (1 + RESTITUTION);
}

/** Peak contact force, newtons: F₀ = πJ / (2τ) for a half-sine blow. ∝ L^2.5. */
export function peakForceN(id: SoundingMaterial, edge: number, densityGPerCm3: number): number {
	const tau = contactTimeS(id, edge, densityGPerCm3);
	return tau > 0 ? (Math.PI * impactImpulse(edge, densityGPerCm3)) / (2 * tau) : 0;
}

/** The crack's weight relative to the thud: p ∝ F + T·dF/dt, seconds. */
export function crackTimeS(densityGPerCm3: number): number {
	return (0.75 * FLOOR_SURFACE_DENSITY) / (AIR.soundSpeedMs * densityGPerCm3 * 1000);
}

// ── Synthesis ───────────────────────────────────────────────────────────────

/** Small deterministic PRNG so a given drop always sounds the same. */
function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Schroeder reverberator (4 damped combs → 2 allpasses) for the room. */
function addRoom(dry: Float32Array, sampleRate: number, rt60: number, wet: number): Float32Array<ArrayBuffer> {
	const out = new Float32Array(dry.length);
	const combsMs = [29.7, 37.1, 41.1, 43.7];
	const acc = new Float32Array(dry.length);
	for (const ms of combsMs) {
		const d = Math.round((ms / 1000) * sampleRate);
		const g = Math.pow(10, (-3 * (ms / 1000)) / rt60);
		const buf = new Float32Array(d);
		let idx = 0;
		let lp = 0;
		for (let i = 0; i < dry.length; i++) {
			const y = buf[idx];
			lp = y * 0.7 + lp * 0.3; // high frequencies die faster, as in a real room
			buf[idx] = dry[i] + g * lp;
			acc[i] += y;
			idx = (idx + 1) % d;
		}
	}
	let sig = acc;
	for (const [ms, g] of [
		[5.0, 0.7],
		[1.7, 0.7],
	] as const) {
		const d = Math.max(1, Math.round((ms / 1000) * sampleRate));
		const buf = new Float32Array(d);
		const next = new Float32Array(sig.length);
		let idx = 0;
		for (let i = 0; i < sig.length; i++) {
			const b = buf[idx];
			const y = -g * sig[i] + b;
			buf[idx] = sig[i] + g * y;
			next[i] = y;
			idx = (idx + 1) % d;
		}
		sig = next;
	}
	for (let i = 0; i < dry.length; i++) out[i] = dry[i] + (wet / combsMs.length) * sig[i];
	return out;
}

export interface ImpactSoundOptions {
	id: SoundingMaterial;
	edge: number;
	densityGPerCm3: number;
	sampleRate: number;
	/** The floor is drawn cracked (bearing pressure past bedrock) — add fracture. */
	cracks?: boolean;
	/** Add the room (default true; tests switch it off to inspect the blow). */
	room?: boolean;
}

/**
 * Render one landing as mono samples. The blow's force F(t) (half-sine, τ)
 * and its derivative are integrated over each sample period — so a blow
 * shorter than a sample comes out as the faint click it really is, not a
 * full-scale spike — and normalised by the peak force F₀. Loudness between
 * cubes is applied by the caller (from impact energy), not here.
 */
export function synthImpact(opts: ImpactSoundOptions): Float32Array<ArrayBuffer> {
	const { id, edge, densityGPerCm3, sampleRate } = opts;
	const room = opts.room ?? true;
	const tau = contactTimeS(id, edge, densityGPerCm3);
	if (!(tau > 0)) return new Float32Array(1);
	const dt = 1 / sampleRate;
	const T = crackTimeS(densityGPerCm3);
	const fracture = opts.cracks ? Math.max(0.15, 8 * tau) : 0;
	const tail = room ? ROOM.rt60S * 1.1 : 0.05;
	const n = Math.ceil((tau + fracture + tail) * sampleRate) + 2;
	const dry = new Float32Array(n);

	// F(t)/F₀ = sin(πt/τ) on [0, τ]; its integral is (τ/π)(1 − cos(πt/τ)).
	const F = (t: number) => (t <= 0 || t >= tau ? 0 : Math.sin((Math.PI * t) / tau));
	const intF = (t: number) => {
		const c = Math.min(Math.max(t, 0), tau);
		return (tau / Math.PI) * (1 - Math.cos((Math.PI * c) / tau));
	};
	const pulseSamples = Math.ceil(tau * sampleRate) + 1;
	for (let i = 0; i < pulseSamples && i < n; i++) {
		const a = i * dt;
		const b = a + dt;
		dry[i] = (intF(b) - intF(a)) / dt + (T * (F(b) - F(a))) / dt;
	}

	if (opts.cracks) {
		// Fracture: clicks front-loaded after the blow, each a short burst of
		// low-passed noise. Deterministic per cube size.
		const rnd = mulberry32(Math.round(edge * 1e6) ^ 0x5eed);
		const grains = 60;
		for (let g = 0; g < grains; g++) {
			const u = rnd();
			const t0 = tau * 0.5 + fracture * u * u;
			const len = Math.round((0.002 + 0.006 * rnd()) * sampleRate);
			const amp = (0.12 + 0.3 * rnd()) * (1 - 0.6 * u);
			let lp = 0;
			const s0 = Math.round(t0 * sampleRate);
			for (let k = 0; k < len && s0 + k < n; k++) {
				lp = lp * 0.55 + (rnd() * 2 - 1) * 0.45;
				dry[s0 + k] += amp * lp * Math.exp((-6 * k) / len);
			}
		}
	}

	return room ? addRoom(dry, sampleRate, ROOM.rt60S, ROOM.wet) : (dry as Float32Array<ArrayBuffer>);
}

// ── Copy ────────────────────────────────────────────────────────────────────

const N_PER_LBF = 4.4482216;
const N_PER_KGF = 9.80665;

/** "209 tons of force", "2,361 pounds of force", "190 tonnes of force". */
export function formatForce(newtons: number, unit: UnitSystem): string {
	if (unit === 'imperial') {
		const lbf = newtons / N_PER_LBF;
		return lbf >= 2000 ? `${formatNum(lbf / 2000)} tons of force` : `${formatNum(lbf)} pounds of force`;
	}
	const kgf = newtons / N_PER_KGF;
	return kgf >= 1000 ? `${formatNum(kgf / 1000)} tonnes of force` : `${formatNum(kgf)} kilograms of force`;
}

/** The readout's sound sentence: "The blow lasts 0.74 ms and peaks at 209 tons of force." */
export function blowSentence(id: SoundingMaterial, edge: number, densityGPerCm3: number, unit: UnitSystem): string {
	const tau = contactTimeS(id, edge, densityGPerCm3);
	if (!(tau > 0)) return '';
	return `The blow lasts ${formatDuration(tau)} and peaks at ${formatForce(peakForceN(id, edge, densityGPerCm3), unit)}.`;
}
