<!-- src/lib/components/BillRenderer.svelte -->
<script lang="ts">
	/**
	 * BillRenderer — CSS-only poster for the Cash tab. Visible to crawlers,
	 * JS-off visitors, and pre-hydration; anchors LCP the same way
	 * CubeRenderer does for the metal cubes. Always renders the tiered
	 * view (no toggle — the poster is a still).
	 */
	import { selectBillTier, stackHeightMm } from '$lib/billStack.js';
	import { formatNoteCount } from '$lib/format.js';

	let { noteCount = 0 }: { noteCount?: number } = $props();

	const tier = $derived(selectBillTier(noteCount));
	const heightMm = $derived(stackHeightMm(noteCount));

	function formatHeight(mm: number): string {
		if (mm < 10) return `${mm.toFixed(2)} mm`;
		if (mm < 1000) return `${(mm / 10).toFixed(1)} cm`;
		if (mm < 1_000_000) return `${(mm / 1000).toFixed(1)} m`;
		return `${(mm / 1_000_000).toFixed(1)} km`;
	}

	const tierLabel: Record<NonNullable<typeof tier>, string> = {
		loose: 'loose bills',
		strap: 'a strap of 100',
		bundle: 'bundles of 1,000',
		cube: 'a roughly-cubic bundle grid',
		pallet: 'a palletised field',
	};
</script>

<div class="bill-poster">
	{#if noteCount > 0 && tier}
		<div class="bill-icon" aria-hidden="true">$</div>
		<div class="bill-count">{formatNoteCount(noteCount)}</div>
		<div class="bill-tier">{tierLabel[tier]} · {formatHeight(heightMm)} stacked</div>
	{:else}
		<div class="empty-state">No data for this date</div>
	{/if}
</div>

<style>
	.bill-poster {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		height: 100%;
		min-height: 200px;
		color: #e4e4e7;
		font-family: 'Inter Tight', -apple-system, system-ui, sans-serif;
	}
	.bill-icon {
		width: 72px;
		height: 72px;
		border-radius: 50%;
		background: #2f5d3a;
		color: #e9e4d3;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 36px;
		font-weight: 700;
	}
	.bill-count {
		font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
		font-size: 1.5rem;
		font-weight: 600;
	}
	.bill-tier {
		font-size: 0.875rem;
		color: #a1a1aa;
	}
	.empty-state {
		color: #71717a;
		font-size: 0.875rem;
	}
</style>
