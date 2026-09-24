/**
 * Acoustic constants for the cube materials — the single source for both
 * the offline mode table (scripts/build-cube-modes.ts) and the runtime
 * sound (impact-sound.ts). Pure; no three.js, no JSON.
 *
 * Wave speeds are for the bulk polycrystalline material at room temperature.
 * Poisson's ratio follows from the two speeds:
 *   ν = (c_l² − 2 c_t²) / (2 (c_l² − c_t²)).
 */

export interface MaterialAcoustics {
	/** Longitudinal (bulk) wave speed, m/s. */
	cl: number;
	/** Shear (transverse) wave speed, m/s. */
	ct: number;
	/** Where the numbers come from — shown on /methodology. */
	source: string;
}

/** PuO₂: Kato & Matsumoto report G = 89 GPa and ν = 0.32 from ultrasonic
 *  pulse-echo on pellets. Taken at the site's modelled density (11.46 g/cm³,
 *  commodities.ts): c_t = √(G/ρ); c_l from ν. */
const PUO2_RHO = 11460;
const PUO2_G = 89e9;
const PUO2_NU = 0.32;
const puo2Ct = Math.sqrt(PUO2_G / PUO2_RHO);
const puo2Cl = puo2Ct * Math.sqrt((2 * (1 - PUO2_NU)) / (1 - 2 * PUO2_NU));

export const MATERIAL_ACOUSTICS: Record<'gold' | 'silver' | 'pu238', MaterialAcoustics> = {
	gold: {
		cl: 3240,
		ct: 1200,
		source: 'CRC Handbook of Chemistry and Physics, "Speed of sound in various media" (polycrystalline Au)',
	},
	silver: {
		cl: 3650,
		ct: 1610,
		source: 'CRC Handbook of Chemistry and Physics, "Speed of sound in various media" (polycrystalline Ag)',
	},
	pu238: {
		cl: puo2Cl,
		ct: puo2Ct,
		source: 'Kato & Matsumoto, "Thermal and Mechanical Properties of UO2 and PuO2" (IAEA INIS), ultrasonic pulse-echo: G = 89 GPa, ν = 0.32',
	},
};

export function poissonOf(m: MaterialAcoustics): number {
	const l2 = m.cl * m.cl;
	const t2 = m.ct * m.ct;
	return (l2 - 2 * t2) / (2 * (l2 - t2));
}

/**
 * How off-centre the landing is: the load across the bottom face varies by
 * ±LANDING_TILT from one edge to the other (its centroid sits ~4% of an edge
 * off-centre). No real drop lands perfectly flat and centred, and a perfect
 * one would excite only the fully symmetric modes — a purer, less metallic
 * tone than any real block makes. A modelling choice, stated on /methodology.
 */
export const LANDING_TILT = 0.25;

/**
 * Quality factor of the ring. Annealed gold and silver on their own lose
 * very little energy per cycle (internal friction of order 10⁻⁴–10⁻³);
 * a block sitting on a floor loses far more into the floor. Q = 150 stands
 * in for that contact loss — the one assumption in the sound model, and the
 * reason the ring decays in ~Q/(π f) seconds. Stated on /methodology.
 */
export const RING_Q = 150;

/** Upper limit of human hearing, Hz (the conventional 20 kHz). */
export const HUMAN_HEARING_MAX_HZ = 20_000;

/** Upper limit of dog hearing, Hz — Heffner, "Hearing in large and small
 *  dogs", Behavioral Neuroscience 97(2), 1983: about 67 Hz to 45 kHz. */
export const DOG_HEARING_MAX_HZ = 45_000;
