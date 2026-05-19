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

/**
 * Optional second-line blurb that pairs with `pu238Fact()`. Returns null
 * where the headline is already self-sufficient. The Voyager-scale entry
 * gets the most context because it's the most evocative anchor in the
 * Pu-238 range.
 */
export function pu238Blurb(g: number): string | null {
	if (g < 1) return null;
	if (g < 10) return null;
	if (g < 50) return 'Sub-50 g cores power CubeSat-class deep-space probes for decades.';
	if (g < 200)
		return "NASA's General Purpose Heat Source — the standard ~150 g brick used in deep-space RTGs since Galileo.";
	if (g < 1000) return 'A few GPHS bricks ganged together is the canonical small-RTG fuel load.';
	if (g < 5000)
		return 'Voyager 1 launched in 1977 with ~4.5 kg of Pu-238 — still transmitting from interstellar space.';
	if (g < 10000)
		return 'Bare-metal critical mass for Pu-238 is theoretical: the heat would melt the assembly first.';
	if (g < 50000)
		return 'On the order of every flagship deep-space mission since Galileo, combined.';
	return 'Cumulative civilian Pu-238 production since 1957 is on the order of a few hundred kilograms.';
}
