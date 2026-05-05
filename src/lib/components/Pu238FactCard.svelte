<script lang="ts">
	/**
	 * Pu238FactCard — slider-position-dependent contextual fact for the
	 * Pu-238 panel. Lives in the same panel slot the gold/silver cube
	 * panels use for QuantityAnchorCard, with the same italic small-type
	 * styling so the two cube-mode panels read as a coherent family.
	 *
	 * Wiring up to the Pu-238 panel happens in Stage 6.
	 */

	import { pu238Fact } from './Pu238FactCard.helpers.js';

	let { currentMassGrams }: { currentMassGrams: number } = $props();

	const fact = $derived(pu238Fact(currentMassGrams));
</script>

{#if fact}
	<p class="pu238-fact-card">
		<em>{fact}</em>
	</p>
{/if}

<style>
	.pu238-fact-card {
		font-size: 12px;
		font-style: italic;
		color: var(--color-text-secondary, currentColor);
		opacity: 0.85;
		line-height: 1.4;
		margin: 0;
	}
</style>
