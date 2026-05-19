<script lang="ts">
	/**
	 * CocaineDenominationRow — single-line readout that shifts copy as
	 * the slider moves through orders of magnitude. Restyled to the new
	 * design system: mono + tabular-nums, same colour treatment as the
	 * cube-mode volume row (zinc-500 body, zinc-600 label).
	 */

	import { denomination } from './CocaineDenominationRow.helpers.js';

	let { currentMassKg }: { currentMassKg: number } = $props();

	const text = $derived(denomination(currentMassKg));
</script>

{#if text}
	<div class="denomination-row">
		<span class="denomination-label">denomination</span>
		<span class="denomination-value">{text}</span>
	</div>
{/if}

<style>
	.denomination-row {
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-variant-numeric: tabular-nums;
		font-size: 13px;
		color: #71717a; /* zinc-500 */
		letter-spacing: 0.01em;
		margin: 12px 0 0;
		line-height: 1.5;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 6px 10px;
	}
	.denomination-label {
		color: #52525b; /* zinc-600 */
	}
	.denomination-value {
		color: #71717a;
	}
</style>
