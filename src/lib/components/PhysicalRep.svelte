<script lang="ts">
	/**
	 * PhysicalRep — orchestrates the full physical representation scene.
	 *
	 * Computes stage, display width, tile state. Renders:
	 * - SpriteStage (scale or tile mode, with crossfade)
	 * - CoinReference (£1 coin at actual physical size, unless suppressed)
	 * - HumanSilhouette (shown when display width > 300 mm)
	 * - ComparisonCard (shown when display width > 5000 mm or tile cap hit)
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

	let {
		commodity,
		amount,
	}: {
		commodity: Commodity;
		amount: number;
	} = $props();

	const COMPARISON_THRESHOLD_MM = 5000;

	const stage = $derived(pickStage(amount, commodity));
	const isTileMode = $derived((stage.renderMode ?? 'scale') === 'tile');

	const displayWidthMm = $derived(
		amount > 0 ? computeDisplayWidthMm(amount, stage) : 0
	);

	const tileState: TileState | null = $derived.by(() => {
		if (!isTileMode || amount <= 0) return null;
		return computeTileState(amount, stage);
	});

	// Comparison card triggers: display > 5m OR tile cap hit
	const showComparison = $derived(
		displayWidthMm > COMPARISON_THRESHOLD_MM ||
		(tileState?.capped ?? false)
	);

	const massGrams = $derived(amount > 0 ? computeMassGrams(amount, commodity) : null);
	const volumeCm3 = $derived(amount > 0 ? computeIntrinsicVolumeCm3(amount, commodity) : 0);

	const massComparisonText = $derived(
		showComparison && massGrams ? getComparisonByMass(massGrams / 1000) : null
	);
	const volumeComparisonText = $derived(
		showComparison ? getComparisonByVolume(volumeCm3 / 1_000_000) : null
	);

	const suppressCoin = $derived(stage.suppressCoinRef === true);

	// Track previous stage for crossfade
	let prevStageId = $state('');
	let transitioning = $state(false);

	$effect(() => {
		if (stage.id !== prevStageId && prevStageId !== '') {
			transitioning = true;
			const timeout = setTimeout(() => {
				transitioning = false;
			}, 300);
			prevStageId = stage.id;
			return () => clearTimeout(timeout);
		}
		prevStageId = stage.id;
	});
</script>

<div class="physical-rep">
	{#if amount > 0}
		<div class="scene-area">
			<!-- Coin reference (left-aligned, suppressed for dust stage) -->
			<CoinReference suppressed={suppressCoin} />

			<!-- Sprite / tile area -->
			<div class="sprite-area" class:transitioning>
				{#key stage.id}
					<SpriteStage
						{stage}
						{displayWidthMm}
						{tileState}
					/>
				{/key}
			</div>

			<!-- Human silhouette (right edge) -->
			<HumanSilhouette {displayWidthMm} />
		</div>

		<!-- Comparison card -->
		<ComparisonCard
			massText={massComparisonText}
			volumeText={volumeComparisonText}
		/>
	{:else}
		<div class="flex items-center justify-center py-8 text-sm text-zinc-600">
			No data for this date
		</div>
	{/if}
</div>

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
		transition: opacity 300ms ease;
	}

	.sprite-area.transitioning {
		opacity: 0.6;
	}
</style>
