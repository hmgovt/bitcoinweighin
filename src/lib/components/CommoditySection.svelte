<script lang="ts">
	import type { Commodity } from '$lib/commodities.js';
	import type { UnitSystem } from '$lib/stores/url.js';
	import { computeIntrinsicVolumeCm3, computeMassGrams, computeDisplayWidthMm, pickStage, computeTileState } from '$lib/volume.js';
	import { formatMass, formatVolume, formatCommodityAmount, unitLabel, formatBtc } from '$lib/format.js';
	import QualityBadge from './QualityBadge.svelte';
	import PhysicalRep from './PhysicalRep.svelte';

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
	const stage = $derived(pickStage(safeAmount, commodity));
	const displayWidthMm = $derived(safeAmount > 0 ? computeDisplayWidthMm(safeAmount, stage) : 0);
	const massGrams = $derived(safeAmount > 0 ? computeMassGrams(safeAmount, commodity) : null);
	const volumeCm3 = $derived(safeAmount > 0 ? computeIntrinsicVolumeCm3(safeAmount, commodity) : 0);
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

	<!-- Readout strip (basic — will be replaced by ReadoutStrip component) -->
	{#if safeAmount > 0}
		<div class="flex flex-wrap gap-x-4 gap-y-1 text-sm font-mono text-zinc-300">
			<span class="text-amber-400">
				{formatBtc(btcAmount)} = {formatCommodityAmount(safeAmount, unitLabel(commodity.unit))}
			</span>
			{#if massGrams !== null}
				<span>{formatMass(massGrams, unitSys)}</span>
			{/if}
			<span>{formatVolume(volumeCm3, unitSys)}</span>
		</div>
	{/if}
</section>
