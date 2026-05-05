<script lang="ts">
	import type { Commodity } from '$lib/commodities.js';
	import type { UnitSystem } from '$lib/stores/url.js';
	import { computeMassGrams } from '$lib/volume.js';
	import QualityBadge from './QualityBadge.svelte';
	import PhysicalRep from './PhysicalRep.svelte';
	import ReadoutStrip from './ReadoutStrip.svelte';
	import QuantityAnchorCard from './QuantityAnchorCard.svelte';
	import Pu238FactCard from './Pu238FactCard.svelte';

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
	const massKg = $derived(massGrams / 1000);

	const showAnchorCard = $derived(
		commodity.renderStyle === 'cube' && Boolean(commodity.quantityAnchorsKey)
	);
	const showPu238Fact = $derived(commodity.glowScales === true);
</script>

<section id={commodity.id} class="mb-8 rounded-lg bg-zinc-900 p-4 sm:p-6">
	<div class="mb-3 flex items-center gap-2">
		<h2 class="text-lg font-semibold text-zinc-100">{commodity.displayName}</h2>
		<QualityBadge quality={commodity.dataQuality} />
	</div>

	{#if brandVoice}
		<p class="mb-3 text-sm italic text-zinc-400">{brandVoice}</p>
	{/if}

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
			<Pu238FactCard currentMassGrams={massGrams} />
		</div>
	{/if}
</section>
