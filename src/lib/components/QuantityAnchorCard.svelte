<script lang="ts">
	/**
	 * QuantityAnchorCard — small italic caption beside the readout strip
	 * for gold and silver cube panels. Reads quantity-anchors.json, finds
	 * anchors within ±10% of `currentMassKg`, picks the highest-priority
	 * (priority 1 beats 2; ties broken by ascending mass).
	 *
	 * Pu-238 has its own equivalent (Pu238FactCard); cocaine doesn't have
	 * one (still mode is image + readout only).
	 */

	import anchorsData from '$lib/quantity-anchors.json';
	import { selectAnchor, type QuantityAnchor } from './QuantityAnchorCard.helpers.js';

	let {
		commodityId,
		currentMassKg
	}: {
		commodityId: string;
		currentMassKg: number;
	} = $props();

	const ANCHORS = anchorsData as Record<string, QuantityAnchor[]>;

	const list = $derived(ANCHORS[commodityId] ?? []);
	const selected = $derived(selectAnchor(list, currentMassKg));
</script>

{#if selected}
	<p class="anchor-card" title={selected.description}>
		<em>{selected.displayName}</em>
	</p>
{/if}

<style>
	.anchor-card {
		font-size: 12px;
		font-style: italic;
		color: var(--color-text-secondary, currentColor);
		opacity: 0.85;
		line-height: 1.4;
		margin: 0;
	}
</style>
