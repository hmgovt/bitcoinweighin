/**
 * The Moon ride: the Cash tab's notes restacked as ONE column of $1 notes
 * laid flat, true height (0.10922 mm a note), and a camera ride up it past
 * real heights to wherever the stack ends — for the whole 21M supply,
 * about halfway to the Moon. Pure maths only; the scene is
 * `scene/moonRideScene.ts`.
 *
 * The climb is logarithmic in altitude — every factor of ten takes the same
 * time — because the stack spans nine orders of magnitude and a linear
 * climb would spend the whole ride in the last one.
 */
import { BILL_THICKNESS_MM, DISTANCE_TO_MOON_KM } from './billStack.js';

/** One note's thickness, m. */
export const NOTE_M = BILL_THICKNESS_MM / 1000;
/** Average Earth–Moon distance, m — the site's one Moon figure (billStack.ts). */
export const MOON_M = DISTANCE_TO_MOON_KM * 1000;
export const TOTAL_SUPPLY_BTC = 21_000_000;

/** No ride below a doorway's height — there'd be nothing to climb. */
export const RIDE_MIN_M = 2;
/** The camera starts level with Sat's head. */
export const RIDE_START_M = 0.6;

export interface RideMarker {
	id: string;
	/** Reads after "passing" / "next up:". */
	label: string;
	metres: number;
}

/**
 * Real heights the ride passes, ascending. Altitudes are above sea level
 * (or the ground, for buildings); the Moon is its average distance, which
 * is how the readout has always measured "of the way to the Moon".
 */
export const RIDE_MARKERS: RideMarker[] = [
	{ id: 'liberty', label: 'the Statue of Liberty', metres: 93 },
	{ id: 'eiffel', label: 'the Eiffel Tower', metres: 330 },
	{ id: 'burj', label: 'the Burj Khalifa', metres: 828 },
	{ id: 'everest', label: 'Mount Everest', metres: 8_849 },
	{ id: 'airliners', label: 'airliners at cruising height', metres: 11_000 },
	{ id: 'karman', label: 'the edge of space', metres: 100_000 },
	{ id: 'iss', label: 'the International Space Station', metres: 408_000 },
	{ id: 'gps', label: 'the GPS satellites', metres: 20_200_000 },
	{ id: 'geo', label: 'geostationary orbit', metres: 35_786_000 },
	{ id: 'moon', label: 'the Moon', metres: MOON_M },
];

/** Stack height of `notes` $1 notes laid flat, m. */
export function stackHeightM(notes: number): number {
	return Math.max(0, notes) * NOTE_M;
}

export function rideAvailable(heightM: number): boolean {
	return heightM >= RIDE_MIN_M;
}

/** Decades of altitude the climb covers. */
function decades(heightM: number): number {
	return Math.log10(Math.max(heightM, RIDE_START_M * 1.01) / RIDE_START_M);
}

/**
 * How long each act takes, s: the lift-off from the pile to the column's
 * foot, the climb (~1.1 s per decade, 3.5–12 s), the crest over the top
 * note, and the pull back to the whole-stack view.
 */
export function rideTiming(heightM: number): { liftS: number; climbS: number; crestS: number; pullS: number } {
	const climbS = Math.min(12, Math.max(3.5, 1.6 + 1.1 * decades(heightM)));
	return { liftS: 1.2, climbS, crestS: 1.6, pullS: 3 };
}

function easeInOutSine(u: number): number {
	return -(Math.cos(Math.PI * u) - 1) / 2;
}

/** Camera altitude at climb progress `u` (0–1), m: log-eased from the
 *  start height to the top of the stack. */
export function climbAltitude(u: number, heightM: number): number {
	const t = easeInOutSine(Math.min(1, Math.max(0, u)));
	return RIDE_START_M * Math.pow(Math.max(heightM, RIDE_START_M) / RIDE_START_M, t);
}

/** The highest marker at or below `altM`, or null. */
export function markerPassed(altM: number): RideMarker | null {
	let best: RideMarker | null = null;
	for (const m of RIDE_MARKERS) {
		if (m.metres <= altM) best = m;
		else break;
	}
	return best;
}

/** The first marker above `altM`, or null past the Moon. */
export function nextMarker(altM: number): RideMarker | null {
	return RIDE_MARKERS.find((m) => m.metres > altM) ?? null;
}

/**
 * The closing view's vertical range, m: the whole stack with some sky over
 * it, stretched to take in the next marker up when it's within reach
 * (under 2.5× the stack), so there's always something to measure against.
 * Past a third of the way to the Moon, the Moon itself.
 */
export function endViewTopM(heightM: number): number {
	if (heightM >= MOON_M / 3) return Math.max(heightM, MOON_M) * 1.06;
	const next = nextMarker(heightM);
	const withNext = next && next.metres <= heightM * 2.5 ? next.metres * 1.08 : 0;
	return Math.max(heightM * 1.2, withNext);
}

export interface RideSummary {
	heightM: number;
	/** The whole 21M supply as one stack at today's price, m. */
	supplyHeightM: number;
	/** Share of the way to the Moon, 0–∞. */
	moonShare: number;
	supplyMoonShare: number;
	/** BTC price at which the whole supply's stack reaches the Moon, USD —
	 *  independent of today's price: one note is one dollar. */
	moonPriceUsd: number;
	/** BTC it would take to reach the Moon at today's price. */
	btcToMoon: number;
}

export function rideSummary(notes: number, btcUsd: number): RideSummary {
	const heightM = stackHeightM(notes);
	const notesToMoon = MOON_M / NOTE_M;
	const supplyHeightM = stackHeightM(TOTAL_SUPPLY_BTC * btcUsd);
	return {
		heightM,
		supplyHeightM,
		moonShare: heightM / MOON_M,
		supplyMoonShare: supplyHeightM / MOON_M,
		moonPriceUsd: notesToMoon / TOTAL_SUPPLY_BTC,
		btcToMoon: btcUsd > 0 ? notesToMoon / btcUsd : Infinity,
	};
}
