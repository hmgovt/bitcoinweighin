<script lang="ts">
	/**
	 * PhysicalRep — dispatches to the renderer that matches the commodity's
	 * `renderStyle`. Branches:
	 *
	 *   "cube"        → CubeRenderer (single cube + universal Shiba)
	 *   "progression" → SpriteStage with cross-fade, coin reference, silhouette,
	 *                   and comparison-card fallback at extreme sizes
	 *   "vessel"      → not yet implemented (next handoff)
	 *   "bulk"        → not yet implemented (next handoff)
	 *
	 * "still_with_readout" commodities (cocaine) bypass PhysicalRep entirely —
	 * CommoditySection branches before reaching here and renders StillPanel
	 * directly with the readout slot composed inline.
	 */

	import type { Commodity } from '$lib/commodities.js';
	import {
		computeDisplayWidthMm,
		computeMassGrams,
		computeIntrinsicVolumeCm3,
		pickStage,
		computeTileState,
	} from '$lib/volume.js';
	import type { TileState } from '$lib/volume.js';
	import { getComparisonByMass, getComparisonByVolume } from '$lib/comparisons.js';
	import SpriteStage from './SpriteStage.svelte';
	import CoinReference from './CoinReference.svelte';
	import HumanSilhouette from './HumanSilhouette.svelte';
	import ComparisonCard from './ComparisonCard.svelte';
	import CubeRenderer from './CubeRenderer.svelte';

	let {
		commodity,
		amount,
	}: {
		commodity: Commodity;
		amount: number;
	} = $props();

	const COMPARISON_THRESHOLD_MM = 5000;
</script>

{#if commodity.renderStyle === 'cube'}
	<CubeRenderer {commodity} {amount} />
{:else if commodity.renderStyle === 'progression'}
	{@const stage = pickStage(amount, commodity)}
	{@const isTileMode = (stage.renderMode ?? 'scale') === 'tile'}
	{@const displayWidthMm = amount > 0 ? computeDisplayWidthMm(amount, stage) : 0}
	{@const tileState = isTileMode && amount > 0 ? computeTileState(amount, stage) : null}
	{@const showComparison =
		displayWidthMm > COMPARISON_THRESHOLD_MM || (tileState?.capped ?? false)}
	{@const massGrams = amount > 0 ? computeMassGrams(amount, commodity) : null}
	{@const volumeCm3 = amount > 0 ? computeIntrinsicVolumeCm3(amount, commodity) : 0}
	{@const massComparisonText =
		showComparison && massGrams ? getComparisonByMass(massGrams / 1000) : null}
	{@const volumeComparisonText =
		showComparison ? getComparisonByVolume(volumeCm3 / 1_000_000) : null}
	{@const suppressCoin = stage.suppressCoinRef === true}

	<div class="physical-rep">
		{#if amount > 0}
			<div class="scene-area">
				<CoinReference suppressed={suppressCoin} />
				<div class="sprite-area">
					{#key stage.id}
						<SpriteStage {stage} {displayWidthMm} {tileState} />
					{/key}
				</div>
				<HumanSilhouette {displayWidthMm} />
			</div>
			<ComparisonCard
				massText={massComparisonText}
				volumeText={volumeComparisonText}
			/>
		{:else}
			<div class="empty-state">No data for this date</div>
		{/if}
	</div>
{:else if commodity.renderStyle === 'vessel'}
	<!-- TODO(handoff: vessel renderer) -->
	<div class="not-implemented">
		<p><strong>{commodity.displayName}</strong>: vessel-mode renderer not yet implemented.</p>
		<p class="hint">
			Coming in the next handoff (oil tankers + LNG carriers — Aframax, VLCC, Q-Max).
		</p>
	</div>
{:else if commodity.renderStyle === 'bulk'}
	<!-- TODO(handoff: bulk renderer) -->
	<div class="not-implemented">
		<p><strong>{commodity.displayName}</strong>: bulk-mode renderer not yet implemented.</p>
		<p class="hint">Coming in a future handoff.</p>
	</div>
{:else}
	<div class="not-implemented">
		Unknown renderStyle: {commodity.renderStyle}
	</div>
{/if}

<style>
	.physical-rep {
		min-height: 80px;
	}

	.scene-area {
		display: flex;
		align-items: flex-end;
		justify-content: center;
		gap: 12px;
		min-height: 60px;
		padding: 8px 0;
		overflow: hidden;
	}

	.sprite-area {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 0;
	}

	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 32px 0;
		font-size: 0.875rem;
		color: #71717a;
	}

	.not-implemented {
		padding: 32px 16px;
		text-align: center;
		font-size: 0.875rem;
		color: #a1a1aa;
		background: repeating-linear-gradient(
			45deg,
			rgba(100, 100, 100, 0.04),
			rgba(100, 100, 100, 0.04) 10px,
			transparent 10px,
			transparent 20px
		);
		border-radius: 0.375rem;
	}

	.hint {
		margin-top: 6px;
		font-size: 0.75rem;
		color: #71717a;
	}
</style>
