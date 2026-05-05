<script lang="ts">
	/**
	 * CocaineDenominationRow — single-line readout that shifts copy as
	 * the slider moves through orders of magnitude. Lives in the still
	 * panel's readout slot. Wired up in Stage 5.
	 */

	import { denomination } from './CocaineDenominationRow.helpers.js';

	let { currentMassKg }: { currentMassKg: number } = $props();

	const text = $derived(denomination(currentMassKg));
</script>

{#if text}
	<p class="denomination-row">{text}</p>
{/if}

<style>
	.denomination-row {
		font-size: 1rem;
		color: var(--color-text, currentColor);
		font-variant-numeric: tabular-nums;
		margin: 0;
		line-height: 1.4;
	}
</style>
