<script lang="ts">
	/**
	 * CubeRenderer — renders a single cube of intrinsic substance volume
	 * against the universal Shiba scale reference (40 cm at the shoulder).
	 *
	 * Viewport sizing rule (2026-05-08):
	 *   viewportHeightM = max(SHIBA_HEIGHT_M, cubeEdgeM) × VIEWPORT_MARGIN
	 *
	 * Both sprites render at true scale within that viewport. The cube is
	 * pinned to the left edge, the Shiba to the right edge, both
	 * bottom-aligned. Whichever element is larger in real metres ends up
	 * near full viewport height on its side; the other scales down
	 * proportionally. At sub-millimetre cube sizes the dog dominates; at
	 * multi-metre cube sizes the cube dominates and the dog is a speck.
	 *
	 * (The cycling 20-entry reference library used by earlier drafts was
	 * deleted on 2026-05-04 in favour of the universal Shiba — see
	 * DECISIONS.md. The half-divide / cube-root half-fit viewport rule
	 * was reversed on 2026-05-08 in favour of the height-driven formula
	 * above.)
	 */

	import { onMount } from 'svelte';
	import type { Commodity } from '$lib/commodities.js';
	import {
		computeCubeEdgeMm,
		computePxPerMetre,
		spritePixelSize,
		SHIBA_HEIGHT_M,
		type ScaleReference,
	} from '$lib/volume.js';
	import scaleReferencesData from '$lib/scale-references.json';
	import ScaleRef from './ScaleReference.svelte';

	// Single universal reference (the Shiba). Stage 4 of the marathon
	// session reduced scale-references.json to one entry.
	const SHIBA = (scaleReferencesData as ScaleReference[])[0];

	let {
		commodity,
		amount,
	}: {
		commodity: Commodity;
		amount: number;
	} = $props();

	if (!commodity.cubeSpritePath) {
		throw new Error(
			`CubeRenderer: commodity ${commodity.id} has no cubeSpritePath. ` +
				`Set cubeSpritePath when migrating to renderStyle: "cube".`
		);
	}

	const cubeEdgeMm = $derived(computeCubeEdgeMm(amount, commodity));
	const cubeEdgeM = $derived(cubeEdgeMm / 1000);

	let viewportPx = $state(0);
	let viewportHeightPx = $state(0);
	const VIEWPORT_FALLBACK_PX = 600;
	const VIEWPORT_HEIGHT_FALLBACK_PX = 600;

	const widthPx = $derived(viewportPx > 0 ? viewportPx : VIEWPORT_FALLBACK_PX);
	const heightPx = $derived(
		viewportHeightPx > 0 ? viewportHeightPx : VIEWPORT_HEIGHT_FALLBACK_PX
	);
	const pxPerMetre = $derived(computePxPerMetre(cubeEdgeM, heightPx, widthPx));

	const cubePx = $derived(spritePixelSize(cubeEdgeM, pxPerMetre));
	const shibaPx = $derived(spritePixelSize(SHIBA_HEIGHT_M, pxPerMetre));

	// Visual floor so sub-millimetre cubes don't disappear entirely. The
	// caption strip keeps showing the real cube edge — the floor is visual
	// only.
	const MIN_CUBE_DISPLAY_PX = 2;
	const cubeDisplayPx = $derived(Math.max(MIN_CUBE_DISPLAY_PX, cubePx));

	let sceneEl: HTMLDivElement | undefined = $state();
	let sceneRowEl: HTMLDivElement | undefined = $state();

	function formatEdge(mm: number): string {
		if (mm < 1) return `${(mm * 1000).toFixed(0)} µm`;
		if (mm < 10) return `${mm.toFixed(2)} mm`;
		if (mm < 100) return `${mm.toFixed(1)} mm`;
		if (mm < 1000) return `${(mm / 10).toFixed(1)} cm`;
		return `${(mm / 1000).toFixed(2)} m`;
	}

	onMount(() => {
		// Preload the Shiba sprite so the first render doesn't show a
		// blank reference slot while the asset fetch lands.
		const img = new Image();
		img.src = SHIBA.spritePath;

		if (!sceneEl) return;
		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				if (entry.target === sceneEl) {
					viewportPx = entry.contentRect.width;
				} else if (entry.target === sceneRowEl) {
					viewportHeightPx = entry.contentRect.height;
				}
			}
		});
		ro.observe(sceneEl);
		if (sceneRowEl) ro.observe(sceneRowEl);
		return () => ro.disconnect();
	});
</script>

<div class="cube-scene" bind:this={sceneEl}>
	{#if amount > 0}
		<!--
			Cube anchored to the left edge, Shiba to the right edge, both
			bottom-aligned. Sizes come from pxPerMetre × real metres so the
			relative scale between the two is always honest.
		-->
		<div class="scene-row" bind:this={sceneRowEl}>
			<div
				class="cube-anchor"
				style="width: {cubeDisplayPx}px; height: {cubeDisplayPx}px;"
				title="{commodity.displayName} cube — {cubeEdgeMm.toFixed(1)} mm edge"
			>
				{#if commodity.cubeShadowPath}
					<img
						src={commodity.cubeShadowPath}
						alt=""
						class="cube-shadow"
						aria-hidden="true"
						draggable="false"
					/>
				{/if}
				<img
					src={commodity.cubeSpritePath}
					alt="{commodity.displayName} cube at {cubeEdgeMm.toFixed(1)} mm edge length"
					class="cube-sprite"
					draggable="false"
				/>
			</div>

			<div class="shiba-anchor">
				<ScaleRef reference={SHIBA} pxSize={shibaPx} />
			</div>
		</div>

		<div class="caption-strip">
			Cube edge: <span class="cube-figure">{formatEdge(cubeEdgeMm)}</span>
		</div>
	{:else}
		<div class="empty-state">No data for this date</div>
	{/if}
</div>

<style>
	.cube-scene {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		min-height: 220px;
		padding: 16px 8px 32px;
		container-type: inline-size;
	}

	.scene-row {
		position: relative;
		width: 100%;
		/* Vertical extent the cube + Shiba scale into. The dominant
		   element ends up near 1/VIEWPORT_MARGIN (≈ 91 %) of this height. */
		height: clamp(440px, 90vh, 1100px);
		overflow: hidden;
	}

	.cube-anchor {
		position: absolute;
		left: 0;
		bottom: 0;
		flex-shrink: 0;
		/* Cube sprite has ~12 % intrinsic transparent bottom margin
		   (191/1600 px on cube@2x.png). Translating down by the same
		   fraction places the *visible* cube bottom on the row's baseline. */
		transform: translateY(12%);
	}

	.shiba-anchor {
		position: absolute;
		right: 0;
		bottom: 0;
		flex-shrink: 0;
		/* Shiba sprite has ~25 % intrinsic transparent bottom margin
		   (397/1600 px on shiba_inu.webp). Same baseline-correction trick
		   as the cube. */
		transform: translateY(25%);
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

	.caption-strip {
		margin-top: 12px;
		font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
		font-variant-numeric: tabular-nums;
		font-size: 0.75rem;
		color: #a1a1aa;
		text-align: center;
		line-height: 1.4;
	}

	.cube-figure {
		color: #fbbf24;
	}

	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 80px;
		color: #71717a;
		font-size: 0.875rem;
	}
</style>
