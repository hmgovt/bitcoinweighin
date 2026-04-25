<script lang="ts">
	import type { Commodity } from '$lib/commodities.js';
	import type { UnitSystem } from '$lib/stores/url.js';
	import QualityBadge from './QualityBadge.svelte';
	import PhysicalRep from './PhysicalRep.svelte';
	import ReadoutStrip from './ReadoutStrip.svelte';

	let {
		commodity,
		amount,
		btcAmount,
		unitSys,
	}: {
		commodity: Commodity;
		amount: number | null;
		btcAmount: number;
		unitSys: UnitSystem;
	} = $props();

	const safeAmount = $derived(amount ?? 0);
</script>

<section id={commodity.id} class="mb-8 rounded-lg bg-zinc-900 p-4 sm:p-6">
	<div class="mb-3 flex items-center gap-2">
		<h2 class="text-lg font-semibold text-zinc-100">{commodity.displayName}</h2>
		<QualityBadge quality={commodity.dataQuality} />
	</div>

	<!-- Physical representation scene -->
	<div class="mb-4 rounded bg-zinc-800">
		<PhysicalRep {commodity} amount={safeAmount} />
	</div>

	<!-- Readout strip: primary continuity signal -->
	<ReadoutStrip {commodity} amount={safeAmount} {btcAmount} {unitSys} />
</section>
