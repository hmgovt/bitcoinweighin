<script lang="ts">
	/**
	 * CubeRenderer — renders a single cube of intrinsic substance volume
	 * against the universal Shiba scale reference (40 cm at the shoulder).
	 *
	 * The cube sprite is identical at every amount; only its CSS-rendered
	 * size changes. The Shiba is rendered at its true 40 cm height in the
	 * same coordinate system. The viewport auto-fits both objects: when
	 * the cube is sub-millimetre the dog dominates; at multi-metre cube
	 * sizes the cube dominates and the dog is a recognisable speck. Cube
	 * vs Shiba ratio is always honest.
	 *
	 * (The cycling 20-entry reference library used by earlier drafts was
	 * deleted on 2026-05-04 in favour of the universal Shiba — see
	 * DECISIONS.md.)
	 */

	import { onMount } from 'svelte';
	import type { Commodity } from '$lib/commodities.js';
	import { computeCubeEdgeMm, type ScaleReference } from '$lib/volume.js';
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
	const reference = SHIBA;

	// Scene auto-fit: the scene's logical width in real mm is the larger of
	// (cube edge, reference size) plus breathing room. If that exceeds the
	// viewport in CSS mm, scale both down proportionally; otherwise render
	// at true physical size so the coin reference lands at 23.43 mm.
	let viewportPx = $state(0);
	let viewportHeightPx = $state(0);
	const VIEWPORT_FALLBACK_PX = 600;
	const VIEWPORT_HEIGHT_FALLBACK_PX = 360;
	const PX_PER_MM = 3.7795275591; // CSS px per mm at 96 dpi

	const refMm = $derived(reference.realSizeMetres * 1000);
	const viewportMm = $derived(
		(viewportPx > 0 ? viewportPx : VIEWPORT_FALLBACK_PX) / PX_PER_MM
	);
	const viewportHeightMm = $derived(
		(viewportHeightPx > 0 ? viewportHeightPx : VIEWPORT_HEIGHT_FALLBACK_PX) / PX_PER_MM
	);

	// Each element is anchored to the divide and free to fill its half of
	// the scene-row. The horizontal-fit constraint is therefore "neither
	// element exceeds half the scene-row width" — the larger of cube vs
	// dog drives the scale, the smaller renders at honest relative size.
	// HALF_PANEL_GUTTER_MM keeps the outermost edge from kissing scene-row's
	// border on the panel's outside edges.
	const HALF_PANEL_GUTTER_MM = 4;
	const halfPanelMm = $derived(
		Math.max(0, viewportMm / 2 - HALF_PANEL_GUTTER_MM)
	);

	// Vertical: budget must cover whichever sprite — cube or Shiba —
	// extends furthest below the layout baseline after its translateY
	// (CUBE_BOTTOM_MARGIN_PCT for the cube; REF_BOTTOM_MARGIN_PCT for the
	// dog, measured from the actual sprites). Plus a touch of breathing
	// room above so the cube top doesn't kiss the scene-row top edge.
	const CUBE_BOTTOM_MARGIN_PCT = 12; // 11.94 % from cube@2x.png bbox
	const REF_BOTTOM_MARGIN_PCT = 25; // 24.81 % from shiba_inu.webp bbox
	const sceneVerticalRealMm = $derived(
		Math.max(
			cubeEdgeMm * (1 + CUBE_BOTTOM_MARGIN_PCT / 100),
			refMm * (1 + REF_BOTTOM_MARGIN_PCT / 100)
		) * 1.04
	);

	// Cap upscale so the £1 coin retains its "actual size" guarantee on
	// mobile (sceneScale=1) and desktop doesn't blow past sensible bounds.
	const DESKTOP_THRESHOLD_PX = 700;
	const MAX_SCENE_SCALE_DESKTOP = 5.0;
	const maxSceneScale = $derived(
		viewportPx >= DESKTOP_THRESHOLD_PX ? MAX_SCENE_SCALE_DESKTOP : 1
	);
	// Scale must satisfy both half-fit (so neither element overflows its
	// half of the row) and vertical-fit (so the taller sprite doesn't
	// overflow the scene-row).
	const sceneScale = $derived(
		Math.min(
			maxSceneScale,
			halfPanelMm / Math.max(cubeEdgeMm, refMm),
			viewportHeightMm / sceneVerticalRealMm
		)
	);

	// Cube clamps at a visual floor of 2 mm so sub-mm cubes don't disappear
	// against the dog at the divide. The caption strip keeps showing the
	// real cube edge — the clamp is visual only.
	const MIN_CUBE_DISPLAY_MM = 2;
	const cubeDisplayMm = $derived(
		Math.max(MIN_CUBE_DISPLAY_MM, cubeEdgeMm * sceneScale)
	);

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
			Scene-row is split at an invisible vertical divide. The cube's
			bottom-right corner anchors to the divide on the left half;
			the Shiba's bottom-left corner anchors to the divide on the
			right half. Both elements scale freely without losing this
			relative anchor.
		-->
		<div class="scene-row" bind:this={sceneRowEl}>
			<div class="left-of-divide">
				<!-- Cube — anchored to the right edge of the left half (the divide). -->
				<div
					class="cube-slot"
					style="width: {cubeDisplayMm}mm; height: {cubeDisplayMm}mm;"
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
			</div>

			<div class="right-of-divide">
				<!-- Universal Shiba — anchored to the left edge of the right half (the divide). -->
				<div class="reference-slot">
					<ScaleRef {reference} {sceneScale} />
				</div>
			</div>
		</div>

		<!-- Caption strip -->
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
		align-items: center;
		justify-content: flex-end;
		min-height: 220px;
		padding: 16px 8px 32px;
		overflow: hidden;
		container-type: inline-size;
	}

	.scene-row {
		display: flex;
		align-items: flex-end;
		justify-content: center;
		flex: 1;
		width: 100%;
		/* Bounded vertical extent so the cube and dog can't overflow at any
		   slider position. CubeRenderer reads this height back via
		   ResizeObserver to feed the vertical-fit branch of sceneScale. */
		height: clamp(440px, 90vh, 1100px);
		overflow: hidden;
	}

	/* Each half occupies an equal share of scene-row; the shared inner edge
	   is the invisible divide. The cube right-anchors to the left half's
	   right edge; the dog left-anchors to the right half's left edge. */
	.left-of-divide {
		flex: 1 1 0;
		min-width: 0;
		display: flex;
		align-items: flex-end;
		justify-content: flex-end;
	}

	.right-of-divide {
		flex: 1 1 0;
		min-width: 0;
		display: flex;
		align-items: flex-end;
		justify-content: flex-start;
	}

	.cube-slot {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		min-width: 2mm;
		min-height: 2mm;
		/* Sprite has ~12% intrinsic transparent bottom margin baked in
		   (191/1600 px on cube@2x.png — measured from the actual file).
		   Translating the slot down by the same fraction places the
		   *visible* cube bottom on the scene-row's baseline. */
		transform: translateY(12%);
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

	.reference-slot {
		display: flex;
		align-items: flex-end;
		justify-content: center;
		flex-shrink: 0;
		/* The Shiba sprite has a *larger* intrinsic bottom margin than
		   the cube (397/1600 ≈ 25 % vs 191/1600 ≈ 12 %, both measured
		   from the actual files). Translating by the dog's own margin
		   fraction keeps its visible bottom on the same baseline as the
		   cube's. */
		transform: translateY(25%);
	}

	.fade-in {
		animation: fade-in 280ms ease-out;
	}

	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
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
