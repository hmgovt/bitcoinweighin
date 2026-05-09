<script lang="ts">
	import type { Commodity } from '$lib/commodities.js';
	import type { UnitSystem } from '$lib/stores/url.js';
	import { computeMassGrams } from '$lib/volume.js';
	import { COCAINE_PRICE_DATA } from '$lib/prices.js';
	import { formatMassConsumer } from '$lib/format.js';
	import QualityBadge from './QualityBadge.svelte';
	import PhysicalRep from './PhysicalRep.svelte';
	import ReadoutStrip from './ReadoutStrip.svelte';
	import QuantityAnchorCard from './QuantityAnchorCard.svelte';
	import Pu238FactCard from './Pu238FactCard.svelte';
	import StillPanel from './StillPanel.svelte';
	import CocaineDenominationRow from './CocaineDenominationRow.svelte';
	import TieredPricingTable from './TieredPricingTable.svelte';
	import GeigerCrackle from './GeigerCrackle.svelte';

	let {
		commodity,
		amount,
		btcAmount,
		btcUsdPrice,
		unitSys,
	}: {
		commodity: Commodity;
		amount: number | null;
		btcAmount: number;
		btcUsdPrice: number;
		unitSys: UnitSystem;
	} = $props();

	const safeAmount = $derived(amount ?? 0);

	// Bound on mount; passed to GeigerCrackle so its IntersectionObserver
	// can gate audio on this exact panel being visible.
	let panelEl: HTMLElement | undefined = $state();

	// Brand-voice clarification persists on Pu-238 panels.
	const brandVoice = $derived(commodity.brandVoiceClarification);

	const massGrams = $derived(safeAmount > 0 ? computeMassGrams(safeAmount, commodity) : 0);
	const massKg = $derived((massGrams ?? 0) / 1000);

	const showAnchorCard = $derived(
		commodity.renderStyle === 'cube' && Boolean(commodity.quantityAnchorsKey)
	);
	const showPu238Fact = $derived(commodity.glowScales === true);
	const showGeiger = $derived(commodity.geigerCrackle === true);
	const isStill = $derived(commodity.renderStyle === 'still_with_readout');

	// Pu-238 readout extras. Threshold matches CubeGlowOverlay.helpers.ts —
	// massGrams ≥ 1000 g (1 kg) is the "would self-melt in reality" line per
	// the Stage 6 spec.
	const meltWarning = $derived(showPu238Fact && (massGrams ?? 0) >= 1000);
	const activityCi = $derived(
		commodity.specificActivityCiPerGram && massGrams
			? massGrams * commodity.specificActivityCiPerGram
			: 0
	);
	// 1 Ci = 3.7 × 10¹⁰ disintegrations per second.
	const dps = $derived(activityCi * 3.7e10);

	function formatCi(ci: number): string {
		if (ci <= 0) return '0 Ci';
		if (ci >= 1e6) return `${(ci / 1e6).toFixed(2)} MCi`;
		if (ci >= 1e3) return `${(ci / 1e3).toFixed(2)} kCi`;
		if (ci >= 1) return `${ci.toFixed(0)} Ci`;
		if (ci >= 0.001) return `${(ci * 1000).toFixed(1)} mCi`;
		return `${ci.toExponential(1)} Ci`;
	}

	/** Split a positive number into a (mantissa, exponent) pair for ×10ⁿ rendering. */
	function dpsParts(d: number): { mantissa: string; exponent: number } | null {
		if (d <= 0) return null;
		const exponent = Math.floor(Math.log10(d));
		const mantissa = (d / Math.pow(10, exponent)).toFixed(2);
		return { mantissa, exponent };
	}

	const dpsBig = $derived(dpsParts(dps));

	// Cocaine still: hardcoded path matches the user-supplied asset on disk
	// (`/static/sprites/cocaine/cocaine-lab.webp`). StillPanel falls back to
	// a labelled grey placeholder if the file 404s.
	const cocaineImagePath = '/sprites/cocaine/cocaine-lab.webp';
</script>

<section
	bind:this={panelEl}
	id={commodity.id}
	class="mb-8 rounded-lg bg-zinc-900 p-4 sm:p-6"
>
	<div class="mb-3 flex flex-wrap items-center gap-2">
		<h2 class="text-lg font-semibold text-zinc-100">{commodity.displayName}</h2>
		<QualityBadge quality={commodity.dataQuality} />
		{#if showGeiger}
			<!--
				Geiger toggle lives in the panel header, not the global header,
				per the Stage 6 spec. Audio is local to this panel and silenced
				whenever the panel scrolls out of viewport / tab is hidden /
				mass drops below 1 g.
			-->
			<div class="ml-auto">
				<GeigerCrackle massGrams={massGrams ?? 0} panelElement={panelEl} />
			</div>
		{/if}
	</div>

	{#if brandVoice}
		<p class="mb-3 text-sm italic text-zinc-400">{brandVoice}</p>
	{/if}

	{#if isStill}
		<!--
			Still-with-readout panel (cocaine). Image carries register; the
			children slot below is the entire dynamic readout. No Shiba, no
			Y-axis, no quantity-anchor card.
		-->
		<StillPanel
			commodityId={commodity.id}
			imagePath={cocaineImagePath}
			currentBtc={btcAmount}
		>
			<div class="cocaine-readout">
				<!-- a. Primary mass readout — wholesale midpoint canonical equivalence. -->
				{#if safeAmount > 0}
					<div class="mass-primary">
						<span class="mass-imperial">{formatMassConsumer(massGrams ?? 0, 'imperial')}</span>
						<span class="mass-metric">{formatMassConsumer(massGrams ?? 0, 'metric')}</span>
					</div>
				{:else}
					<div class="mass-primary mass-empty">—</div>
				{/if}

				<!-- b. Slider-keyed denomination row. -->
				<CocaineDenominationRow currentMassKg={massKg} />

				<!-- c. Three-tier pricing table; wholesale primary. -->
				<TieredPricingTable
					commodityId={commodity.id}
					currentBtc={btcAmount}
					priceData={COCAINE_PRICE_DATA}
					btcPriceUsd={btcUsdPrice}
				/>

				<!-- d. Markup fact line. -->
				<p class="micro markup">
					Producer-to-retail markup: ~30–50×. The bulk of cocaine's market
					value is in trafficking and distribution, not production.
				</p>

				<!-- e. Purity footnote. -->
				<p class="micro purity">
					Street retail figures reflect 30–50% purity; wholesale and
					retail-pure-equivalent prices use standardised purity for
					cross-tier comparison.
				</p>

				<!-- f. Persistent source attribution. -->
				<p class="micro sources">
					Wholesale: UNODC 2024 · Retail: DEA 2024 · Producer: UNODC 2024 ·
					Illustrative pricing — see methodology.
				</p>
			</div>
		</StillPanel>
	{:else}
		<!-- Physical representation scene -->
		<div class="mb-4 rounded bg-zinc-800">
			<PhysicalRep {commodity} amount={safeAmount} />
		</div>

		<!-- Readout strip: primary continuity signal -->
		<ReadoutStrip
			{commodity}
			amount={safeAmount}
			{btcAmount}
			{btcUsdPrice}
			{unitSys}
			{meltWarning}
		/>

		<!--
			Pu-238-only readout extras. Activity readout sets the user's
			intuition for what they're hearing if the Geiger toggle is on.
			Source attribution row is mandatory and persistent per the Stage 6
			spec — DOE / NASA / Planetary Society / Cassini OIG.
		-->
		{#if showPu238Fact && safeAmount > 0}
			<div class="mt-2 pu238-activity">
				<span class="pu238-activity-label">Activity:</span>
				<span class="pu238-activity-value">{formatCi(activityCi)}</span>
				<span class="pu238-activity-divider">·</span>
				{#if dpsBig}
					<span class="pu238-activity-value">
						{dpsBig.mantissa} × 10<sup>{dpsBig.exponent}</sup> disintegrations/sec
					</span>
				{:else}
					<span class="pu238-activity-value">0 disintegrations/sec</span>
				{/if}
			</div>
		{/if}

		<!-- Contextual fact card (cube-mode commodities only) -->
		{#if showAnchorCard}
			<div class="mt-2">
				<QuantityAnchorCard commodityId={commodity.id} currentMassKg={massKg} />
			</div>
		{:else if showPu238Fact}
			<div class="mt-2">
				<Pu238FactCard currentMassGrams={massGrams ?? 0} />
			</div>
		{/if}

		{#if showPu238Fact}
			<p class="pu238-sources">
				DOE Office of Nuclear Energy · NASA Planetary Science · The Planetary Society ·
				Cassini OIG (1997, escalated) · See methodology.
			</p>
		{/if}
	{/if}
</section>

<style>
	.cocaine-readout {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		width: 100%;
	}
	.mass-primary {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem 1rem;
		font-variant-numeric: tabular-nums;
	}
	.mass-imperial {
		font-size: 1.875rem;
		font-weight: 700;
		color: #fafafa;
		line-height: 1.1;
	}
	.mass-metric {
		font-size: 1rem;
		color: #a1a1aa;
	}
	.mass-empty {
		color: #52525b;
		font-size: 1.875rem;
		font-weight: 700;
	}
	.micro {
		margin: 0;
		font-size: 0.75rem;
		line-height: 1.5;
		color: #a1a1aa;
	}
	.markup {
		font-style: italic;
	}
	.sources {
		color: #71717a;
		border-top: 1px solid #27272a;
		padding-top: 0.5rem;
		margin-top: 0.25rem;
	}

	.pu238-activity {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 6px;
		align-items: baseline;
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-variant-numeric: tabular-nums;
		font-size: 0.8125rem;
		line-height: 1.4;
		color: #a1a1aa;
	}
	.pu238-activity-label {
		color: #71717a;
	}
	.pu238-activity-value {
		color: #d4d4d8;
	}
	.pu238-activity-value sup {
		font-size: 0.7em;
		line-height: 0;
		vertical-align: super;
	}
	.pu238-activity-divider {
		color: #52525b;
	}

	.pu238-sources {
		margin-top: 0.75rem;
		padding-top: 0.5rem;
		border-top: 1px solid #27272a;
		font-size: 0.7rem;
		line-height: 1.5;
		color: #71717a;
	}
</style>
