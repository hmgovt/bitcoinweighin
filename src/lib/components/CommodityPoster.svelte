<script lang="ts">
	/**
	 * Static cube + Shiba poster for /btc/[commodity] landing pages.
	 *
	 * No event handlers, no $effect, no onMount — pure derived layout from
	 * fixed-dimension viewport math. The component ships as inert
	 * hydration markup so the landing pages keep their static-prerender
	 * perf profile (LCP, TTI unchanged) while still showing the cube and
	 * Shiba at true relative scale.
	 *
	 * Use only for cube-mode commodities (gold, silver, pu238). Cocaine
	 * renders a still-with-readout panel on the homepage; the landing
	 * page keeps its current amber callout box for that case.
	 */

	import type { Commodity } from '$lib/commodities.js';
	import {
		computeCubeEdgeMm,
		computeMassGrams,
		computePxPerMetre,
		spritePixelSize,
		SHIBA_HEIGHT_M,
		CUBE_VISIBLE_HEIGHT_FRACTION,
		SHIBA_VISIBLE_HEIGHT_FRACTION,
	} from '$lib/volume.js';
	import { formatMassConsumer } from '$lib/format.js';

	let {
		commodity,
		amount,
		btcUsdPrice,
	}: {
		commodity: Commodity;
		amount: number;
		btcUsdPrice: number;
	} = $props();

	// Fixed poster geometry. Matches a typical desktop panel width so the
	// layout reads cleanly without the responsive ResizeObserver dance the
	// interactive CubeRenderer does. On narrower viewports the wrapping
	// `.poster-scene` scales the whole row down via the max-width rule.
	const POSTER_WIDTH_PX = 560;
	const POSTER_HEIGHT_PX = 280;
	const GAP_FROM_MIDLINE_PX = 30;
	const MIN_CUBE_VISIBLE_PX = 2;

	const cubeEdgeMm = $derived(computeCubeEdgeMm(amount, commodity));
	const cubeEdgeM = $derived(cubeEdgeMm / 1000);
	const massGrams = $derived(amount > 0 ? computeMassGrams(amount, commodity) ?? 0 : 0);

	const pxPerMetre = $derived(
		computePxPerMetre(cubeEdgeM, POSTER_HEIGHT_PX, POSTER_WIDTH_PX, GAP_FROM_MIDLINE_PX)
	);
	const cubeVisiblePx = $derived(
		Math.max(MIN_CUBE_VISIBLE_PX, spritePixelSize(cubeEdgeM, pxPerMetre))
	);
	const shibaVisiblePx = $derived(spritePixelSize(SHIBA_HEIGHT_M, pxPerMetre));
	const cubeSlotPx = $derived(cubeVisiblePx / CUBE_VISIBLE_HEIGHT_FRACTION);
	const shibaSlotPx = $derived(shibaVisiblePx / SHIBA_VISIBLE_HEIGHT_FRACTION);

	const usdValue = $derived(btcUsdPrice || 0);

	function formatEdge(mm: number): string {
		if (mm < 1) return `${(mm * 1000).toFixed(0)} µm`;
		if (mm < 10) return `${mm.toFixed(2)} mm`;
		if (mm < 100) return `${mm.toFixed(1)} mm`;
		if (mm < 1000) return `${(mm / 10).toFixed(1)} cm`;
		return `${(mm / 1000).toFixed(2)} m`;
	}

	function formatUsd(value: number): string {
		if (!value) return '';
		if (value >= 1_000_000) return '$' + (value / 1_000_000).toFixed(2) + 'M';
		if (value >= 1000) return '$' + Math.round(value).toLocaleString('en-US');
		return '$' + value.toFixed(2);
	}

	const massReadout = $derived(formatMassConsumer(massGrams, 'imperial'));
	const massReadoutMetric = $derived(formatMassConsumer(massGrams, 'metric'));
</script>

<figure class="poster">
	<div class="poster-scene" style="aspect-ratio: {POSTER_WIDTH_PX} / {POSTER_HEIGHT_PX};">
		<div class="poster-row" style="--cube-slot: {cubeSlotPx}px; --shiba-slot: {shibaSlotPx}px; --max-width: {POSTER_WIDTH_PX}px;">
			<div class="cube-anchor" style="width: {cubeSlotPx}px; height: {cubeSlotPx}px;">
				{#if commodity.cubeShadowPath}
					<img
						src={commodity.cubeShadowPath}
						srcset="{commodity.cubeShadowPath.replace('@2x.webp', '@1x.webp')} 1x, {commodity.cubeShadowPath} 2x"
						alt=""
						class="cube-shadow"
						aria-hidden="true"
						draggable="false"
					/>
				{/if}
				{#if commodity.cubeSpritePath}
					<img
						src={commodity.cubeSpritePath}
						srcset="{commodity.cubeSpritePath.replace('@2x.webp', '@1x.webp')} 1x, {commodity.cubeSpritePath} 2x"
						alt="{commodity.displayName} cube at {cubeEdgeMm.toFixed(1)} mm edge"
						class="cube-sprite"
						draggable="false"
					/>
				{/if}
			</div>
			<div class="shiba-anchor" style="width: {shibaSlotPx}px; height: {shibaSlotPx}px;">
				<img
					src="/sprites/references/shiba_inu.webp"
					srcset="/sprites/references/shiba_inu@1x.webp 1x, /sprites/references/shiba_inu@2x.webp 2x"
					alt="A Shiba Inu dog, 40 cm at the shoulder, shown for scale"
					class="shiba-sprite"
					draggable="false"
				/>
			</div>
		</div>
	</div>
	<figcaption class="poster-caption">
		<div class="cap-row">
			<span class="cap-label">Cube edge</span>
			<span class="cap-value">{formatEdge(cubeEdgeMm)}</span>
		</div>
		<div class="cap-row">
			<span class="cap-label">Mass</span>
			<span class="cap-value">{massReadout} · {massReadoutMetric}</span>
		</div>
		{#if usdValue > 0}
			<div class="cap-row">
				<span class="cap-label">USD value</span>
				<span class="cap-value">{formatUsd(usdValue)}</span>
			</div>
		{/if}
	</figcaption>
</figure>

<style>
	.poster {
		margin: 0;
		padding: 1.25rem 1rem 1rem;
		border: 1px solid #27272a;
		border-radius: 8px;
		background: #18181b;
		color: #e4e4e7;
	}
	.poster-scene {
		width: 100%;
		max-width: 560px;
		margin: 0 auto;
		position: relative;
	}
	.poster-row {
		position: relative;
		width: 100%;
		max-width: var(--max-width);
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: flex-end;
		gap: 60px;
	}
	@media (max-width: 480px) {
		.poster-row {
			gap: 28px;
		}
	}
	.cube-anchor,
	.shiba-anchor {
		position: relative;
		flex-shrink: 0;
	}
	.cube-sprite,
	.cube-shadow {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
		object-position: center;
	}
	.shiba-sprite {
		width: 100%;
		height: 100%;
		object-fit: contain;
		object-position: bottom center;
	}
	.poster-caption {
		margin-top: 1rem;
		padding-top: 0.75rem;
		border-top: 1px solid #27272a;
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.4rem;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 0.8125rem;
	}
	@media (min-width: 560px) {
		.poster-caption {
			grid-template-columns: repeat(3, 1fr);
		}
	}
	.cap-row {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	.cap-label {
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #71717a;
	}
	.cap-value {
		font-variant-numeric: tabular-nums;
		color: #f5f0e6;
		font-weight: 600;
	}
</style>
