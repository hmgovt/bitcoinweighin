<script lang="ts">
	/**
	 * CubeRenderer — renders a single cube of intrinsic substance volume
	 * against the universal Shiba scale reference (40 cm at the shoulder).
	 *
	 * Viewport sizing rule (2026-05-08):
	 *   viewportHeightM = max(SHIBA_HEIGHT_M, cubeEdgeM) × VIEWPORT_MARGIN
	 *
	 * Both sprites render at true scale within that viewport. Each has
	 * a fixed anchor point relative to the row's vertical midline —
	 * cube's bottom-right (visible) corner at midline − GAP, Shiba's
	 * bottom-left (visible) corner at midline + GAP, both at y = 0
	 * (the row's bottom). Neither crosses the midline at any slider
	 * position; both scale outward from those anchors only.
	 *
	 * The row's height is *derived* from the dominant element's visible
	 * height × VIEWPORT_MARGIN — the row only consumes as much vertical
	 * space as the visible content needs. The gap and a viewport-height
	 * cap respond to a mobile breakpoint so a narrow phone gets a
	 * tighter midline gap and a tighter cap on row height.
	 */

	import { onMount } from 'svelte';
	import type { Commodity } from '$lib/commodities.js';
	import {
		computeCubeEdgeMm,
		computeMassGrams,
		computePxPerMetre,
		spritePixelSize,
		SHIBA_HEIGHT_M,
		VIEWPORT_MARGIN,
		CUBE_VISIBLE_HEIGHT_FRACTION,
		SHIBA_VISIBLE_HEIGHT_FRACTION,
		type ScaleReference,
	} from '$lib/volume.js';
	import scaleReferencesData from '$lib/scale-references.json';
	import ScaleRef from './ScaleReference.svelte';
	import CubeGlowOverlay from './CubeGlowOverlay.svelte';
	import { computeGlowParams } from './CubeGlowOverlay.helpers.js';

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

	// Pu-238 only: blackbody glow overlay + surface emission. Gated on
	// commodity.glowScales === true; CommoditySection is responsible for
	// whether to set the flag — CubeRenderer just reads it. Mass drives
	// the two-channel scaling (intensity, colour temperature).
	const glowEnabled = $derived(commodity.glowScales === true);
	const massGrams = $derived(amount > 0 ? computeMassGrams(amount, commodity) ?? 0 : 0);
	const glow = $derived(glowEnabled ? computeGlowParams(massGrams) : null);

	// Asset gap: when a cube sprite (or its shadow) is missing on disk,
	// fall back to a labelled grey placeholder. Pu-238's sprite isn't
	// rendered yet — see PROJECT-STATUS.md open threads. The placeholder
	// occupies the same visible bbox as a real cube so the midline
	// anchoring stays honest while the asset is in flight.
	let spriteFailed = $state(false);
	function onSpriteError() {
		spriteFailed = true;
	}

	let viewportPx = $state(0);
	let windowHeightPx = $state(0);
	const VIEWPORT_FALLBACK_PX = 600;
	const WINDOW_HEIGHT_FALLBACK_PX = 720;

	const widthPx = $derived(viewportPx > 0 ? viewportPx : VIEWPORT_FALLBACK_PX);

	// Mobile breakpoint — Tailwind's `md:` boundary. Below this, narrow
	// the midline gap and cap the row shorter so cube and Shiba aren't
	// pushed to the row edges and the slider stays in view alongside
	// the visualisation.
	const MOBILE_BREAKPOINT_PX = 768;
	const isMobile = $derived(widthPx < MOBILE_BREAKPOINT_PX);
	const gapPx = $derived(isMobile ? 14 : 50);

	// Cap on row height. The row never exceeds this; if the dominant
	// element's visible height × margin is smaller, the row shrinks to
	// match (see renderedRowHeightPx below).
	const ROW_VH_FRACTION = 0.5;
	const ROW_MIN_PX = isMobile ? 200 : 280;
	const ROW_MAX_PX = isMobile ? 360 : 540;
	const maxRowHeightPx = $derived(
		windowHeightPx > 0
			? Math.min(ROW_MAX_PX, Math.max(ROW_MIN_PX, windowHeightPx * ROW_VH_FRACTION))
			: ROW_MAX_PX
	);

	const pxPerMetre = $derived(
		computePxPerMetre(cubeEdgeM, maxRowHeightPx, widthPx, gapPx)
	);

	// Target visible heights — what the user reads as the "real" size on
	// screen. Floor the cube at 2 px so sub-mm amounts still leave a
	// visible speck.
	const MIN_CUBE_VISIBLE_PX = 2;
	const cubeVisiblePx = $derived(
		Math.max(MIN_CUBE_VISIBLE_PX, spritePixelSize(cubeEdgeM, pxPerMetre))
	);
	const shibaVisiblePx = $derived(spritePixelSize(SHIBA_HEIGHT_M, pxPerMetre));

	// Slot dimensions — square, scaled up so the visible bounding box of
	// the sprite (not the transparent canvas) fills `*VisiblePx`.
	const cubeSlotPx = $derived(cubeVisiblePx / CUBE_VISIBLE_HEIGHT_FRACTION);
	const shibaSlotPx = $derived(shibaVisiblePx / SHIBA_VISIBLE_HEIGHT_FRACTION);

	// Row's actual rendered height: tracks the dominant element after
	// both height and width clamps. When width clamps (typical on
	// mobile), the row shrinks below maxRowHeightPx so the panel
	// doesn't carry empty space above the visualisation.
	const dominantVisiblePx = $derived(Math.max(shibaVisiblePx, cubeVisiblePx));
	const renderedRowHeightPx = $derived(dominantVisiblePx * VIEWPORT_MARGIN);

	let sceneEl: HTMLDivElement | undefined = $state();

	function formatEdge(mm: number): string {
		if (mm < 1) return `${(mm * 1000).toFixed(0)} µm`;
		if (mm < 10) return `${mm.toFixed(2)} mm`;
		if (mm < 100) return `${mm.toFixed(1)} mm`;
		if (mm < 1000) return `${(mm / 10).toFixed(1)} cm`;
		return `${(mm / 1000).toFixed(2)} m`;
	}

	onMount(() => {
		const img = new Image();
		img.src = SHIBA.spritePath;

		windowHeightPx = window.innerHeight;
		const onResize = () => {
			windowHeightPx = window.innerHeight;
		};
		window.addEventListener('resize', onResize);

		let ro: ResizeObserver | null = null;
		if (sceneEl) {
			ro = new ResizeObserver((entries) => {
				for (const entry of entries) {
					if (entry.target === sceneEl) {
						viewportPx = entry.contentRect.width;
					}
				}
			});
			ro.observe(sceneEl);
		}

		return () => {
			window.removeEventListener('resize', onResize);
			ro?.disconnect();
		};
	});
</script>

<div class="cube-scene" bind:this={sceneEl}>
	{#if amount > 0}
		<!--
			Cube and Shiba each have a fixed anchor at midline ± gapPx.
			The cube's visible bottom-right corner stays put at midline −
			gap; the Shiba's visible bottom-left corner stays put at
			midline + gap. Both scale outward from those anchors only.
			Sizes come from pxPerMetre × real metres so relative scale
			between the two is always honest.
		-->
		<div
			class="scene-row"
			style="height: {renderedRowHeightPx}px; --gap: {gapPx}px;"
		>
			<div
				class="cube-anchor"
				style="width: {cubeSlotPx}px; height: {cubeSlotPx}px;"
				title="{commodity.displayName} cube — {cubeEdgeMm.toFixed(1)} mm edge"
			>
				{#if commodity.cubeShadowPath && !spriteFailed}
					<img
						src={commodity.cubeShadowPath}
						srcset="{commodity.cubeShadowPath.replace('@2x.webp', '@1x.webp')} 1x, {commodity.cubeShadowPath} 2x"
						alt=""
						class="cube-shadow"
						aria-hidden="true"
						draggable="false"
						onerror={() => { /* shadow optional; main sprite carries the asset-gap signal */ }}
					/>
				{/if}
				{#if glow}
					<CubeGlowOverlay massGrams={massGrams} />
				{/if}
				{#if !spriteFailed}
					<img
						src={commodity.cubeSpritePath}
						srcset="{commodity.cubeSpritePath.replace('@2x.webp', '@1x.webp')} 1x, {commodity.cubeSpritePath} 2x"
						alt="{commodity.displayName} cube at {cubeEdgeMm.toFixed(1)} mm edge length"
						class="cube-sprite"
						class:cube-sprite-glowing={glow !== null}
						draggable="false"
						onerror={onSpriteError}
						style:--glow-color={glow?.color ?? 'transparent'}
						style:--glow-opacity={glow?.opacity ?? 0}
						style:--glow-bloom="{glow?.bloomPx ?? 0}px"
					/>
				{:else}
					<div
						class="cube-placeholder"
						class:cube-placeholder-glowing={glow !== null}
						aria-label="{commodity.displayName} cube placeholder ({cubeEdgeMm.toFixed(1)} mm edge) — sprite asset pending"
						style:--glow-color={glow?.color ?? 'transparent'}
						style:--glow-opacity={glow?.opacity ?? 0}
						style:--glow-bloom="{glow?.bloomPx ?? 0}px"
					></div>
				{/if}
			</div>

			<div
				class="shiba-anchor"
				style="width: {shibaSlotPx}px; height: {shibaSlotPx}px;"
			>
				<ScaleRef reference={SHIBA} pxSize={shibaSlotPx} />
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
		/* No horizontal padding — the row uses the full width available
		   from its parent so cube and Shiba can scale up before the
		   horizontal clamp binds. The midline gap is the only inner
		   spacing the visualisation needs. */
		padding: 8px 0 16px;
		container-type: inline-size;
	}

	.scene-row {
		position: relative;
		width: 100%;
		/* Height set inline as `dominantVisiblePx × VIEWPORT_MARGIN`. */
		overflow: hidden;
	}

	/*
	   Sprite-margin offsets, measured from the actual asset files:
	     cube@2x.png    bbox (244, 331, 1296, 1409) on 1600 × 1600
	                    → R margin 19.0 %, B margin 11.9 %
	     shiba_inu.webp bbox (486, 490, 1008, 1203) on 1600 × 1600
	                    → L margin 30.4 %, B margin 24.8 %
	   The translate values shift each slot so its *visible* corner
	   (not the transparent canvas edge) lands on the midline ± gap
	   anchor. translateY pushes the slot down by its own bottom-margin
	   fraction so the visible bottom sits on the row baseline.
	*/
	.cube-anchor {
		position: absolute;
		bottom: 0;
		right: calc(50% + var(--gap, 50px));
		transform: translate(19%, 12%);
	}

	.shiba-anchor {
		position: absolute;
		bottom: 0;
		left: calc(50% + var(--gap, 50px));
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

	/*
	 * Pu-238 surface emission. `drop-shadow` is preferred over `box-shadow`
	 * because it respects the sprite's alpha channel — the glow halo wraps
	 * the cube silhouette, not the 1600 × 1600 transparent canvas. Brightness
	 * climbs with intensity so the cube reads as actively emitting rather
	 * than just lit at higher masses.
	 */
	.cube-sprite-glowing {
		filter:
			brightness(calc(1 + var(--glow-opacity, 0) * 0.45))
			drop-shadow(0 0 var(--glow-bloom, 0) var(--glow-color, transparent));
		transition:
			filter 200ms ease-out;
	}

	/*
	 * Asset-gap placeholder. Sized to occupy the same visible bbox as a
	 * real cube sprite (margins computed from the canonical 1600 × 1600
	 * canvas — see CUBE_VISIBLE_*_FRACTION) so the midline anchoring stays
	 * accurate while the Pu-238 cube is in flight.
	 *   bbox (244, 331, 1296, 1409) → top 20.69 %, right 19.0 %,
	 *                                 bottom 11.94 %, left 15.25 %
	 */
	.cube-placeholder {
		position: absolute;
		top: 20.69%;
		left: 15.25%;
		right: 19%;
		bottom: 11.94%;
		background: repeating-linear-gradient(
			45deg,
			#3f3f46,
			#3f3f46 4px,
			#52525b 4px,
			#52525b 8px
		);
		border: 1px dashed #71717a;
		border-radius: 2px;
	}

	.cube-placeholder-glowing {
		filter:
			brightness(calc(1 + var(--glow-opacity, 0) * 0.45))
			drop-shadow(0 0 var(--glow-bloom, 0) var(--glow-color, transparent));
		transition:
			filter 200ms ease-out;
	}

	.caption-strip {
		margin-top: 10px;
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
