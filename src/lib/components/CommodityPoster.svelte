<script lang="ts">
	/**
	 * Static cube + Shiba poster for /btc/[commodity] landing pages.
	 *
	 * No event handlers, no $effect, no onMount — pure derived layout from
	 * fixed-dimension viewport math. Ships as inert hydration markup so
	 * the landing pages keep their static-prerender perf profile (LCP /
	 * TTI unchanged) while still showing the cube and Shiba at true
	 * relative scale.
	 *
	 * Layout mirrors CubeRenderer's anchor scheme:
	 *   - Each slot is positioned absolutely against the scene baseline.
	 *   - Translate offsets shift each slot by its sprite's transparent
	 *     margin fractions so the *visible* corner (not the canvas edge)
	 *     lands on the midline-gap anchor at the row baseline.
	 *   - Sprite-canvas overflow above the scene is clipped.
	 *
	 * Sprite margin constants are duplicated from volume.ts comments
	 * rather than imported so this stays a leaf component with no extra
	 * cross-file coupling. Keep these in sync if the sprites are recropped.
	 *   cube@2x.png    bbox (244, 331, 1296, 1409) on 1600 x 1600
	 *                  → R margin 19.0%, B margin 11.9%
	 *   shiba_inu.webp bbox (486, 490, 1008, 1203) on 1600 x 1600
	 *                  → L margin 30.4%, B margin 24.8%
	 *
	 * Use only for cube-mode commodities (gold, silver, pu238). Cocaine
	 * renders a still-with-readout panel on the homepage; the landing
	 * page keeps its amber callout box for that case.
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
		VIEWPORT_MARGIN,
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

	// Scene height grows to fit the taller of the two visible sprites.
	// With margin the row is at most ~280px (the bigger of SHIBA_HEIGHT_M ×
	// pxPerMetre × 1.1 and cubeVisiblePx × 1.1) — matches the fixed
	// aspect-ratio of the wrapper so nothing leaks.
	const dominantVisiblePx = $derived(Math.max(shibaVisiblePx, cubeVisiblePx));
	const sceneHeightPx = $derived(dominantVisiblePx * VIEWPORT_MARGIN);

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
	<div
		class="poster-scene"
		style="height: {sceneHeightPx}px; max-width: {POSTER_WIDTH_PX}px;"
	>
		<!--
			Cube anchor: visible bottom-right corner sits at midline − gap.
			translate(19%, 12%) accounts for the sprite's right and bottom
			transparent margins so the visible content lands on the anchor
			rather than the canvas edge.
		-->
		<div
			class="cube-anchor"
			style="
				width: {cubeSlotPx}px;
				height: {cubeSlotPx}px;
				right: calc(50% + {GAP_FROM_MIDLINE_PX}px);
			"
		>
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
		<!--
			Shiba anchor: visible bottom-left corner at midline + gap.
			translate(-30.4%, 25%) accounts for the Shiba's left margin
			(absent visible content from canvas edge in) and the
			transparent strip below the dog's feet.
		-->
		<div
			class="shiba-anchor"
			style="
				width: {shibaSlotPx}px;
				height: {shibaSlotPx}px;
				left: calc(50% + {GAP_FROM_MIDLINE_PX}px);
			"
		>
			<img
				src="/sprites/references/shiba_inu.webp"
				srcset="/sprites/references/shiba_inu@1x.webp 1x, /sprites/references/shiba_inu@2x.webp 2x"
				alt="A Shiba Inu dog, 40 cm at the shoulder, shown for scale"
				class="shiba-sprite"
				draggable="false"
			/>
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
		{#if btcUsdPrice > 0}
			<div class="cap-row">
				<span class="cap-label">USD value</span>
				<span class="cap-value">{formatUsd(btcUsdPrice)}</span>
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
		position: relative;
		width: 100%;
		margin: 0 auto;
		overflow: hidden;
	}
	.cube-anchor,
	.shiba-anchor {
		position: absolute;
		bottom: 0;
	}
	.cube-anchor {
		transform: translate(19%, 12%);
	}
	.shiba-anchor {
		transform: translate(-30.4%, 25%);
	}
	.cube-shadow {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
		opacity: 0.6;
		mix-blend-mode: multiply;
		pointer-events: none;
	}
	.cube-sprite {
		position: relative;
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
		user-select: none;
	}
	.shiba-sprite {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
		user-select: none;
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
