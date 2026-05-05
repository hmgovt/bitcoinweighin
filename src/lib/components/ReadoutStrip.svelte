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
		computeCubeEdgeMm,
		pickStage,
		computeTileState,
	} from '$lib/volume.js';
	import {
		formatMass,
		formatVolume,
		formatVolumeSolid,
		formatLength,
		formatPair,
		formatCommodityAmount,
		unitLabel,
		formatBtc,
	} from '$lib/format.js';

	let {
		commodity,
		amount,
		btcAmount,
		btcUsdPrice = 0,
		unitSys,
	}: {
		commodity: Commodity;
		amount: number;
		btcAmount: number;
		/** USD per BTC. Defaults to 0; CommoditySection plumbs the real value in Stage 4 §4. */
		btcUsdPrice?: number;
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

	// Cube-mode-only deriveds (cheap to compute regardless of mode; the
	// template gates them).
	const cubeEdgeMetres = $derived(
		isCubeMode && amount > 0 ? computeCubeEdgeMm(amount, commodity) / 1000 : 0
	);
	const usdValue = $derived(btcAmount * btcUsdPrice);

	// Cube-mode readout shows imperial primary regardless of unitSys
	// (per the 2026-05-04 US-primacy decision and Stage 4 prompt). Metric
	// users still see the metric value as the secondary half of the pair.
	const massPair = $derived(
		massGrams !== null
			? formatPair(formatMass(massGrams, 'imperial'), formatMass(massGrams, 'metric'))
			: ''
	);
	const volumePair = $derived(
		formatPair(formatVolumeSolid(volumeCm3, 'imperial'), formatVolumeSolid(volumeCm3, 'metric'))
	);
	const edgePair = $derived(
		cubeEdgeMetres > 0
			? formatPair(
					formatLength(cubeEdgeMetres, 'imperial'),
					formatLength(cubeEdgeMetres, 'metric')
				)
			: ''
	);

	function formatUsd(amount: number): string {
		if (amount >= 1e12) return `$${(amount / 1e12).toFixed(2)}T`;
		if (amount >= 1e9) return `$${(amount / 1e9).toFixed(2)}B`;
		if (amount >= 1e6) return `$${(amount / 1e6).toFixed(2)}M`;
		if (amount >= 1) return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
		if (amount > 0) return `$${amount.toFixed(2)}`;
		return '$0';
	}
</script>

{#if amount > 0}
	{#if isCubeMode}
		<!-- Cube-mode readout: bold mass, then volume + edge pair, then dollar value. -->
		<div class="readout-strip cube-readout">
			{#if massGrams !== null}
				<div class="readout-mass-bold">{massPair}</div>
			{/if}
			<div class="readout-line">
				<span class="readout-metric">{volumePair}</span>
				{#if edgePair}
					<span class="readout-divider">·</span>
					<span class="readout-metric">cube edge {edgePair}</span>
				{/if}
			</div>
			<div class="readout-line">
				<span class="readout-usd">{formatUsd(usdValue)}</span>
			</div>
			<div class="readout-line readout-continuity">
				<span class="readout-primary">
					{formatBtc(btcAmount)} = {formatCommodityAmount(
						amount,
						unitLabel(commodity.unit)
					)}
				</span>
			</div>
		</div>
	{:else}
		<!-- Progression-mode readout: existing shape preserved. -->
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

	/* Cube-mode shape: vertical stack with a hero mass line on top. */
	.cube-readout {
		flex-direction: column;
		gap: 4px;
		align-items: flex-start;
	}

	.readout-mass-bold {
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-variant-numeric: tabular-nums;
		font-size: 1.5rem;
		font-weight: 600;
		color: #fafafa; /* zinc-50 */
		line-height: 1.2;
	}

	.readout-line {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 8px;
		align-items: baseline;
	}

	.readout-divider {
		color: #71717a; /* zinc-500 */
	}

	.readout-usd {
		font-size: 0.9375rem;
		color: #d4d4d8; /* zinc-300 */
	}

	.readout-continuity {
		margin-top: 2px;
		opacity: 0.85;
		font-size: 0.8125rem;
	}
</style>
