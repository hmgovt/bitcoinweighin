/**
 * Oxide (PuO₂) specific decay-heat power, W per gram of oxide — NOT pure
 * Pu-238 metal's ~0.567 W/g. The site depicts the sintered ceramic fuel,
 * not the metal (DECISIONS.md 2026-06-11), and `massGrams` throughout this
 * module is oxide mass (commodities.ts `densityGPerCm3: 11.46`, PuO₂'s
 * theoretical density). Because RTG-grade material isn't isotopically
 * pure Pu-238 and PuO₂ carries the oxygen's extra molecular weight, the
 * oxide's effective specific power is lower than the bare-metal figure —
 * approximately 0.40–0.42 W/g of oxide is the accepted range (vs.
 * ~0.567 W/g for pure Pu-238 metal). This uses the midpoint, 0.41 W/g.
 * Source: DOE Office of Nuclear Energy / NASA Planetary Science Division
 * published RTG fuel specifications.
 */
export const PU238_OXIDE_W_PER_GRAM = 0.41;

/**
 * DOE/NASA Oak Ridge Pu-238 restart target production rate, grams per
 * year, as of 2026. Actual output has been ramping from ~50 g/yr (2015)
 * through ~400 g/yr (2023) toward this ~1.5 kg/yr steady-state design
 * target; the site uses the higher target figure as the conservative
 * (less dramatic, more defensible) choice per the "pick the conservative
 * figure when sources disagree" rule. Source: DOE Office of Nuclear
 * Energy / NASA Planetary Science Division / Oak Ridge National
 * Laboratory public statements on the Pu-238 supply program.
 */
export const PU238_ANNUAL_PRODUCTION_G = 1500;

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

/** Everyday-wattage comparison ladder for `pu238DecayHeatLine`, calibrated
 *  against a ~1,500–2,000 W household space heater. The ladder must stay
 *  honest across the slider's full range: at 21M BTC the oxide mass runs to
 *  hundreds of tonnes and the decay heat past 100 MW, so the top rungs are
 *  utility-scale, not appliance-scale. Every rung must also read cleanly
 *  before the fixed ", running for decades." tail — no rung may contain
 *  "running" itself. */
function decayHeatComparison(watts: number): string {
	if (watts < 5) return 'a phone charger left plugged in';
	if (watts < 60) return 'a bright incandescent bulb';
	if (watts < 900) return 'about half a space heater';
	if (watts < 2200) return 'a space heater';
	if (watts < 20_000) return 'a bank of space heaters';
	if (watts < 2_000_000) return 'the electric heating for an entire street';
	return 'a small power station';
}

/**
 * Decay-heat readout line (delight pass, 2026-07-10, brief §5.2). Always
 * computed at any positive mass — unlike `pu238Fact`/`pu238Blurb`'s
 * categorical bands, this is a continuous physical quantity, so it sits
 * alongside them as an additional line rather than another threshold band.
 * Uses `PU238_OXIDE_W_PER_GRAM` because `g` here is oxide mass (see that
 * constant's doc comment for why pure-metal 0.567 W/g would be wrong).
 */
export function pu238DecayHeatLine(g: number): string | null {
	if (!(g > 0)) return null;
	const watts = g * PU238_OXIDE_W_PER_GRAM;
	return `Decay heat: ${formatWatts(watts)} — ${decayHeatComparison(watts)}, running for decades.`;
}

/** Wattage for copy: W below 10 kW, kW to 10 MW, MW above — so the 21M-BTC
 *  extreme reads "127 MW", never "126,935,700 W". One decimal while the
 *  leading figure is a single digit, whole numbers after. */
function formatWatts(watts: number): string {
	if (watts < 10) return `${watts.toFixed(1)} W`;
	if (watts < 10_000) return `${Math.round(watts).toLocaleString('en-US')} W`;
	if (watts < 10_000_000) {
		const kw = watts / 1000;
		return kw < 10 ? `${kw.toFixed(1)} kW` : `${Math.round(kw).toLocaleString('en-US')} kW`;
	}
	const mw = watts / 1_000_000;
	return mw < 10 ? `${mw.toFixed(1)} MW` : `${Math.round(mw).toLocaleString('en-US')} MW`;
}

/**
 * Format a "years of global production" figure for copy. Always shows one
 * decimal below 100 (matching the sibling cocaine `denomination()`
 * convention of "1.0 years" rather than the grammatically awkward
 * "1 years"); rounds to a locale-grouped whole number at or above 100,
 * where a decimal adds no useful precision.
 */
function formatYears(years: number): string {
	if (years < 100) return years.toFixed(1);
	return Math.round(years).toLocaleString('en-US');
}

/**
 * Honesty line for masses beyond a year of current global Pu-238
 * production (delight pass, 2026-07-10, brief §1.2 + §5.2). Distinct in
 * construction from the gold/silver/cocaine "×" impossibility lines
 * (`formatImpossibilityLine` in `$lib/format.ts`) because Pu-238's supply
 * is understood as an annual production rate rather than a finite
 * historical stock, so the honest framing is "years of global production"
 * rather than a bare multiple. Extends the existing threshold-band
 * pattern in this file (sits alongside `pu238Fact`/`pu238Blurb`) rather
 * than duplicating it as a parallel system.
 *
 * Returns null at or below one year of current annual production.
 */
export function pu238ProductionLine(g: number): string | null {
	if (!(g > PU238_ANNUAL_PRODUCTION_G)) return null;
	const years = g / PU238_ANNUAL_PRODUCTION_G;
	return `At this mass you would own roughly ${formatYears(years)} years of global production.`;
}
