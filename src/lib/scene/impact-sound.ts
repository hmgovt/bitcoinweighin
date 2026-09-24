/**
 * The sound of the cube hitting the floor — pure, tested.
 *
 * Physics, in one paragraph: a block landing flat on a hard floor is struck
 * for about as long as a compression wave takes to cross it and come back
 * (τ = 2L / c_l, as for a bar striking end-on). That blow sets the block's
 * own free-vibration modes ringing; the floor soaks the ring up over a few
 * hundred cycles. The modes were computed once, for a unit cube of each
 * material, by `scripts/build-cube-modes.ts` (Rayleigh–Ritz — see
 * `modal.ts`), and ship as DIMENSIONLESS frequencies Ω = f·L / c_t. So for a
 * real cube of edge L every mode is simply f = Ω · c_t / L — the whole sound
 * scales as 1/L. A cube twice as big rings exactly an octave lower, for
 * exactly twice as long, and the contact time stretches with it: the sound
 * of 21 million BTC of gold is the sound of 1 BTC slowed down ~276×.
 *
 * Because the ring scales with 1/L, small cubes ring above human hearing:
 * gold is inaudible to people below roughly 2 BTC. The synthesis keeps that
 * honest — anything above the audio device's range is simply absent, and
 * the normalisation counts it, so an ultrasonic cube comes out silent
 * rather than being "helpfully" pitched down.
 */

import table from './cube-modes.json';
import {
	MATERIAL_ACOUSTICS,
	RING_Q,
	HUMAN_HEARING_MAX_HZ,
	DOG_HEARING_MAX_HZ,
} from './acoustics.js';

export type SoundingMaterial = keyof typeof MATERIAL_ACOUSTICS;

interface ModeTable {
	poisson: number;
	modes: [number, number][];
}
const TABLE = table as unknown as Record<SoundingMaterial, ModeTable>;

export function isSoundingMaterial(id: string): id is SoundingMaterial {
	return id in MATERIAL_ACOUSTICS && id in TABLE;
}

/** Every mode of a cube of `edge` metres: frequency (Hz) and relative amplitude. */
export function cubeModesHz(id: SoundingMaterial, edge: number): { f: number; w: number }[] {
	const { ct } = MATERIAL_ACOUSTICS[id];
	return TABLE[id].modes.map(([omega, w]) => ({ f: (omega * ct) / edge, w }));
}

/** The note you hear: the loudest mode. For a cube landing on a face this
 *  is Lamé's exact mode, f = c_t / (√2 · L), whatever the material. */
export function ringPitchHz(id: SoundingMaterial, edge: number): number {
	const modes = cubeModesHz(id, edge);
	return modes.reduce((best, m) => (m.w > best.w ? m : best), modes[0]).f;
}

/** Contact time of a flat landing, seconds: τ = 2L / c_l. */
export function contactTimeS(id: SoundingMaterial, edge: number): number {
	return (2 * edge) / MATERIAL_ACOUSTICS[id].cl;
}

/** How long a mode at `f` Hz takes to decay by a factor e, seconds. */
export function ringDecayS(f: number): number {
	return RING_Q / (Math.PI * f);
}

/**
 * Render the ring of a cube of `edge` metres as mono samples at `sampleRate`.
 *  · Each mode is a decaying cosine starting in phase (the velocity response
 *    to an impulse), eased in over the contact time.
 *  · Modes above ~0.45 × sampleRate are left out — the device can't play
 *    them and aliasing would fold them down into fake audible tones.
 *  · Normalised by the sum of ALL mode amplitudes, audible or not, so the
 *    peak is ≤ 1 and a cube that rings mostly in ultrasound comes out quiet
 *    or silent, as it would to a person standing there.
 * Cost is proportional to Σ ring time, so small (high, short) rings are cheap.
 */
export function synthImpact(
	id: SoundingMaterial,
	edge: number,
	sampleRate: number,
	maxSeconds = 4
): Float32Array<ArrayBuffer> {
	const modes = cubeModesHz(id, edge);
	const norm = modes.reduce((s, m) => s + m.w, 0) || 1;
	const playable = modes.filter((m) => m.f < 0.45 * sampleRate && m.f > 0);
	if (!playable.length) return new Float32Array(Math.max(1, Math.round(0.05 * sampleRate)));

	const longest = Math.max(...playable.map((m) => ringDecayS(m.f)));
	const n = Math.max(1, Math.round(Math.min(maxSeconds, longest * 7) * sampleRate));
	const out = new Float32Array(n);
	for (const m of playable) {
		const w = (2 * Math.PI * m.f) / sampleRate;
		const cw = Math.cos(w);
		const sw = Math.sin(w);
		const r = Math.exp(-1 / (ringDecayS(m.f) * sampleRate));
		let c = 1;
		let s = 0;
		let a = m.w / norm;
		// Stop once the mode is 80 dB down.
		const stop = Math.min(n, Math.ceil(ringDecayS(m.f) * 9.2 * sampleRate));
		for (let i = 0; i < stop; i++) {
			out[i] += a * c;
			const c2 = c * cw - s * sw;
			s = s * cw + c * sw;
			c = c2;
			a *= r;
		}
	}
	// Ease in over the contact time (raised cosine) — the blow isn't instant.
	const attack = Math.min(n, Math.round(contactTimeS(id, edge) * sampleRate));
	for (let i = 0; i < attack; i++) out[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / attack);
	return out;
}

/** Share of the ring's amplitude a person can hear (modes ≤ 20 kHz). */
export function audibleShare(id: SoundingMaterial, edge: number): number {
	const modes = cubeModesHz(id, edge);
	const total = modes.reduce((s, m) => s + m.w, 0) || 1;
	return modes.filter((m) => m.f <= HUMAN_HEARING_MAX_HZ).reduce((s, m) => s + m.w, 0) / total;
}

/** Who can hear a ring at `hz`. */
export function hearingBand(hz: number): 'people' | 'dogs' | 'nobody' {
	if (hz <= HUMAN_HEARING_MAX_HZ) return 'people';
	if (hz <= DOG_HEARING_MAX_HZ) return 'dogs';
	return 'nobody';
}

/** "68 Hz", "1.9 kHz", "26.8 kHz", "8.8 MHz". */
export function formatFrequency(hz: number): string {
	const sig = (v: number) => (v >= 100 ? Math.round(v).toLocaleString('en-US') : String(Number(v.toPrecision(3))));
	if (hz >= 1e9) return `${sig(hz / 1e9)} GHz`;
	if (hz >= 1e6) return `${sig(hz / 1e6)} MHz`;
	if (hz >= 1e3) return `${sig(hz / 1e3)} kHz`;
	return `${sig(hz)} Hz`;
}

/** The readout's sound sentence. */
export function ringSentence(hz: number): string {
	const f = formatFrequency(hz);
	switch (hearingBand(hz)) {
		case 'people':
			return `It rings at ${f}.`;
		case 'dogs':
			return `It rings at ${f} — too high for people to hear, not for Sat.`;
		default:
			return `It rings at ${f} — too high even for Sat.`;
	}
}
