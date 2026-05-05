/**
 * Slider-position-dependent contextual fact for the Pu-238 panel.
 * Same slot the gold/silver panels use for QuantityAnchorCard.
 */
export function pu238Fact(g: number): string {
	if (g < 1) return 'About a grain';
	if (g < 10) return 'About a heat-source pellet for a small RTG';
	if (g < 50) return 'Roughly the canonical fuel for a CubeSat-scale deep-space mission';
	if (g < 200) return "About one GPHS fuel module — NASA's standard heat-source unit (~150 g)";
	if (g < 1000) return 'Several GPHS modules — enough for a small RTG';
	if (g < 5000)
		return "Roughly Voyager 1's original fuel load (~4.5 kg) — the substance powering humanity's farthest object";
	if (g < 10000)
		return 'Approaching theoretical critical mass for bare metal (~10 kg) — would melt itself long before assembly';
	if (g < 50000) return "Multiple flagship deep-space missions' worth of fuel";
	return 'More than all Pu-238 ever produced for civilian space use';
}
