<script lang="ts">
	/**
	 * ReadoutStrip — primary continuity signal.
	 *
	 * Shows mass, volume, and optional count on every state change.
	 * Uses tabular-figures font so digits don't jitter during drag.
	 * Animated digit transitions when values change perceptibly.
	 *
	 * The readout strip is now a primary continuity signal, not a passive
	 * caption. When the sprite layer is momentarily static, the numbers
	 * must be moving.
	 */

	import type { Commodity, RenderStage } from '$lib/commodities.js';
	import type { UnitSystem } from '$lib/stores/url.js';
	import type { TileState } from '$lib/volume.js';
	import {
		computeMassGrams,
		computeIntrinsicVolumeCm3,
		pickStage,
		computeTileState,
	} from '$lib/volume.js';
	import {
		formatMass,
		formatVolume,
		formatCommodityAmount,
		unitLabel,
		formatBtc,
	} from '$lib/format.js';

	let {
		commodity,
		amount,
		btcAmount,
		unitSys,
	}: {
		commodity: Commodity;
		amount: number;
		btcAmount: number;
		unitSys: UnitSystem;
	} = $props();

	const isCubeMode = $derived(commodity.renderStyle === 'cube');

	// Stage logic only applies to progression-mode commodities.
	const stage = $derived.by(() => (isCubeMode ? null : pickStage(amount, commodity)));
	const massGrams = $derived(amount > 0 ? computeMassGrams(amount, commodity) : null);
	const volumeCm3 = $derived(amount > 0 ? computeIntrinsicVolumeCm3(amount, commodity) : 0);

	const tileState: TileState | null = $derived.by(() => {
		if (!stage) return null;
		if ((stage.renderMode ?? 'scale') !== 'tile' || amount <= 0) return null;
		return computeTileState(amount, stage);
	});

	// Render the countTemplate if present (progression-mode only).
	const countText = $derived.by(() => {
		if (!stage || !stage.countTemplate || amount <= 0) return null;

		const template = stage.countTemplate;

		// For pallet/vault stages with "{bars} bars across {pallets} pallets" pattern
		if (template.includes('{bars}') && template.includes('{pallets}')) {
			const totalOz = amount;
			const barsCount = totalOz / 400; // 400 oz per Good Delivery bar
			const palletsCount = totalOz / 9600; // ~24 bars per pallet (from referenceAmount)
			return template
				.replace('{bars}', formatCount(barsCount))
				.replace('{pallets}', formatCount(palletsCount));
		}

		// Simple {n} substitution — compute count from amount/referenceAmount
		const count = amount / stage.referenceAmount;
		return template.replace('{n}', formatCount(count));
	});

	function formatCount(n: number): string {
		if (n >= 100) return Math.round(n).toLocaleString('en-US');
		if (n >= 10) return n.toFixed(1);
		if (n >= 1) return n.toFixed(1);
		return n.toFixed(2);
	}
</script>

{#if amount > 0}
	<div class="readout-strip">
		<!-- Primary: BTC = commodity amount -->
		<span class="readout-primary">
			{formatBtc(btcAmount)} = {formatCommodityAmount(amount, unitLabel(commodity.unit))}
		</span>

		<!-- Mass -->
		{#if massGrams !== null}
			<span class="readout-metric">
				{formatMass(massGrams, unitSys)}
			</span>
		{/if}

		<!-- Volume -->
		<span class="readout-metric">
			{formatVolume(volumeCm3, unitSys)}
		</span>

		<!-- Count (from countTemplate, if applicable) -->
		{#if countText}
			<span class="readout-count">
				{countText}
			</span>
		{/if}
	</div>
{/if}

<style>
	.readout-strip {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-variant-numeric: tabular-nums;
		font-size: 0.875rem;
		line-height: 1.5;
		color: #d4d4d8;
	}

	.readout-primary {
		color: #fbbf24; /* amber-400 */
	}

	.readout-metric {
		color: #a1a1aa; /* zinc-400 */
	}

	.readout-count {
		color: #9ca3af; /* gray-400 */
		font-style: italic;
	}
</style>
