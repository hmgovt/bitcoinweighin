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

	// Brand-voice clarification persists on Pu-238 panels.
	const brandVoice = $derived(commodity.brandVoiceClarification);

	const massGrams = $derived(safeAmount > 0 ? computeMassGrams(safeAmount, commodity) : 0);
	const massKg = $derived((massGrams ?? 0) / 1000);

	const showAnchorCard = $derived(
		commodity.renderStyle === 'cube' && Boolean(commodity.quantityAnchorsKey)
	);
	const showPu238Fact = $derived(commodity.glowScales === true);
	const isStill = $derived(commodity.renderStyle === 'still_with_readout');

	// Cocaine still: hardcoded path matches the user-supplied asset on disk
	// (`/static/sprites/cocaine/cocaine-lab.webp`). StillPanel falls back to
	// a labelled grey placeholder if the file 404s.
	const cocaineImagePath = '/sprites/cocaine/cocaine-lab.webp';
</script>

<section id={commodity.id} class="mb-8 rounded-lg bg-zinc-900 p-4 sm:p-6">
	<div class="mb-3 flex items-center gap-2">
		<h2 class="text-lg font-semibold text-zinc-100">{commodity.displayName}</h2>
		<QualityBadge quality={commodity.dataQuality} />
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
		<ReadoutStrip {commodity} amount={safeAmount} {btcAmount} {btcUsdPrice} {unitSys} />

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
</style>
