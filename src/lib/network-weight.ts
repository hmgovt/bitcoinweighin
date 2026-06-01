/**
 * Bitcoin network physical weight estimates.
 *
 * Methodology:
 *   1. Fetch current network hashrate from mempool.space (H/s).
 *   2. Divide by blended fleet efficiency (TH/s per machine).
 *   3. Multiply by average machine weight (kg).
 *   4. Add node hardware mass.
 *
 * ASIC fleet model:
 *   The installed base mixes older S19-era hardware (~100 TH/s, ~13 kg) with
 *   newer S21-era units (~200 TH/s, ~14 kg). A blended average of 150 TH/s
 *   and 13.5 kg is used as the central estimate. The model will over-count
 *   recently retired machines and under-count very new hardware, so treat
 *   all outputs as order-of-magnitude estimates with ~30% uncertainty.
 */

/** Blended fleet average: TH/s capacity per machine. */
export const FLEET_AVG_TH_PER_S = 150;

/** Blended fleet average: kg per machine (S19 ~13.2 kg, S21 ~14.2 kg). */
export const FLEET_AVG_KG = 13.5;

/** Approximate full node count (source: bitnodes.io, ~20k nodes). */
export const NODE_COUNT = 20_000;

/** Average node weight — blend of Raspberry Pi (0.045 kg) to NUC/server. */
export const NODE_AVG_KG = 0.5;

/** RMS Titanic gross tonnage in tonnes (used as comparison). */
export const TITANIC_TONNES = 46_328;

/** Eiffel Tower steel mass in tonnes. */
export const EIFFEL_TOWER_TONNES = 7_300;

/** Statue of Liberty total mass (copper + steel) in tonnes. */
export const STATUE_OF_LIBERTY_TONNES = 225;

export interface NetworkWeightEstimate {
	hashrateEH: number;
	asicCount: number;
	asicMassKg: number;
	asicMassTonnes: number;
	nodeMassTonnes: number;
	totalMassTonnes: number;
	titanicMultiple: number;
}

export function computeNetworkWeight(hashrateEH: number): NetworkWeightEstimate {
	const hashrateT = hashrateEH * 1e6; // EH/s → TH/s
	const asicCount = Math.round(hashrateT / FLEET_AVG_TH_PER_S);
	const asicMassKg = asicCount * FLEET_AVG_KG;
	const asicMassTonnes = asicMassKg / 1000;
	const nodeMassTonnes = (NODE_COUNT * NODE_AVG_KG) / 1000;
	const totalMassTonnes = asicMassTonnes + nodeMassTonnes;
	return {
		hashrateEH,
		asicCount,
		asicMassKg,
		asicMassTonnes,
		nodeMassTonnes,
		totalMassTonnes,
		titanicMultiple: totalMassTonnes / TITANIC_TONNES,
	};
}

/**
 * Fetch the current network hashrate from mempool.space.
 * Returns hashrate in EH/s, or null on failure.
 */
export async function fetchHashrateEH(): Promise<number | null> {
	try {
		const res = await fetch('https://mempool.space/api/v1/mining/hashrate/1w');
		if (!res.ok) return null;
		const data = await res.json();
		// API returns { hashrates: [{avgHashrate, timestamp},...], difficulty: [...], currentHashrate, currentDifficulty }
		const h = data?.currentHashrate;
		if (typeof h !== 'number' || h <= 0) return null;
		// currentHashrate is in H/s — convert to EH/s
		return h / 1e18;
	} catch {
		return null;
	}
}
