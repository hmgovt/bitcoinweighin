/**
 * Mass-tier-switching denomination copy for the cocaine still panel.
 * Single readout line that adapts as the slider moves.
 *
 * Tiers (cumulative thresholds):
 *   < 1 g                    lines (30 mg each)
 *   < 1000 g (= 1 kg)        retail bags (~1 g each)
 *   < 1000 kg (= 1 tonne)    1-kg bricks
 *   < 100,000 kg (= 100 t)   pallets · bricks
 *   above                    fraction of one year of global production,
 *                            then years (UNODC 2024 estimate ~2,250 t/yr)
 */
export function denomination(massKg: number): string {
	if (massKg <= 0) return '';
	const massG = massKg * 1000;

	if (massG < 1) return `≈ ${Math.round(massG / 0.03)} lines (30 mg each)`;
	if (massG < 1000) return `≈ ${Math.round(massG)} retail bags (~1 g each)`;
	if (massKg < 1000) return `≈ ${Math.round(massKg)} 1-kg bricks`;
	if (massKg < 100000) {
		const pallets = Math.round(massKg / 1000);
		return `≈ ${pallets.toLocaleString()} pallets · ≈ ${Math.round(massKg).toLocaleString()} bricks`;
	}

	const yearsOfGlobal = massKg / 2_250_000;
	if (yearsOfGlobal < 1) {
		return `≈ ${Math.round(yearsOfGlobal * 100)}% of one year of global production`;
	}
	return `≈ ${yearsOfGlobal.toFixed(1)} years of global production`;
}
