/**
 * Acoustic constants for the Drop's sound — the cube materials, the floor
 * they land on, the air, and the room. Pure; no three.js. Every figure here
 * is shown, with its source, on /methodology.
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

/** Poisson's ratio from the two wave speeds. */
export function poissonOf(m: MaterialAcoustics): number {
	const l2 = m.cl * m.cl;
	const t2 = m.ct * m.ct;
	return (l2 - 2 * t2) / (2 * (l2 - t2));
}

/** Young's modulus, Pa, from the wave speeds and density (kg/m³). */
export function youngsModulusOf(m: MaterialAcoustics, densityKgM3: number): number {
	const l2 = m.cl * m.cl;
	const t2 = m.ct * m.ct;
	return (densityKgM3 * t2 * (3 * l2 - 4 * t2)) / (l2 - t2);
}

/**
 * The floor: a normal-weight concrete slab.
 *  · E from ACI 318-19 §19.2.2.1: E_c = 4700 √f'c MPa, at f'c = 30 MPa
 *    (ordinary structural concrete) → 25.7 GPa.
 *  · ν = 0.2 for uncracked concrete (EN 1992-1-1 §3.1.3).
 *  · 2,400 kg/m³; slab 15 cm thick — a typical ground-floor slab, and the
 *    one figure here chosen rather than looked up.
 */
export const FLOOR = {
	youngsModulusPa: 4700 * Math.sqrt(30) * 1e6,
	poisson: 0.2,
	densityKgM3: 2400,
	slabThicknessM: 0.15,
} as const;

/** Floor slab mass per unit area, kg/m². */
export const FLOOR_SURFACE_DENSITY = FLOOR.densityKgM3 * FLOOR.slabThicknessM;

/** Air at 20 °C. */
export const AIR = { densityKgM3: 1.2, soundSpeedMs: 343 } as const;

/**
 * The room the stage stands in — a large, hard-floored studio. Staging, like
 * the lighting: it shapes how the thud sounds, not how hard it is.
 * RT60 is the time for the sound to decay by 60 dB.
 */
export const ROOM = { rt60S: 1.4, wet: 0.7 } as const;

/** Off-centre load used by the (analysis-only) ring estimate — see modal.ts
 *  and the "the ring is negligible" test. */
export const LANDING_TILT = 0.25;
