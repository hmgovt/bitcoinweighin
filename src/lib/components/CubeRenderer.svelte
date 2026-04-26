<script lang="ts">
	/**
	 * CubeRenderer — renders a single cube of intrinsic substance volume
	 * against a cycling library of scale references.
	 *
	 * The cube sprite is identical at every amount; only its CSS-rendered
	 * size changes. The closest-by-log-scale reference from the library
	 * is rendered alongside at its true real-world size in the same
	 * coordinate system.
	 *
	 * The scene auto-fits the viewport: when both objects fit at true
	 * physical CSS-mm size, they're rendered as such (so the £1 coin
	 * lands at exactly 23.43 mm). When the cube would exceed the
	 * viewport, both objects scale down proportionally.
	 */

	import { onMount } from 'svelte';
	import type { Commodity } from '$lib/commodities.js';
	import {
		computeCubeEdgeMm,
		pickClosestReference,
		type ScaleReference,
	} from '$lib/volume.js';
	import scaleReferencesData from '$lib/scale-references.json';
	import ScaleRef from './ScaleReference.svelte';

	const REFERENCES = scaleReferencesData as ScaleReference[];

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
	const reference = $derived(
		amount > 0 ? pickClosestReference(cubeEdgeMm, REFERENCES) : REFERENCES[0]
	);

	// Scene auto-fit: the scene's logical width in real mm is the larger of
	// (cube edge, reference size) plus breathing room. If that exceeds the
	// viewport in CSS mm, scale both down proportionally; otherwise render
	// at true physical size so the coin reference lands at 23.43 mm.
	let viewportPx = $state(0);
	const VIEWPORT_FALLBACK_PX = 600;
	const PX_PER_MM = 3.7795275591; // CSS px per mm at 96 dpi

	const refMm = $derived(reference.realSizeMetres * 1000);
	const sceneRealMm = $derived(Math.max(cubeEdgeMm, refMm) * 1.6 + 20);
	const viewportMm = $derived(
		(viewportPx > 0 ? viewportPx : VIEWPORT_FALLBACK_PX) / PX_PER_MM
	);
	const sceneScale = $derived(
		sceneRealMm > viewportMm ? viewportMm / sceneRealMm : 1
	);

	const cubeCssMm = $derived(cubeEdgeMm * sceneScale);

	let sceneEl: HTMLDivElement | undefined = $state();

	function formatEdge(mm: number): string {
		if (mm < 1) return `${(mm * 1000).toFixed(0)} µm`;
		if (mm < 10) return `${mm.toFixed(2)} mm`;
		if (mm < 100) return `${mm.toFixed(1)} mm`;
		if (mm < 1000) return `${(mm / 10).toFixed(1)} cm`;
		return `${(mm / 1000).toFixed(2)} m`;
	}

	onMount(() => {
		if (!sceneEl) return;
		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				viewportPx = entry.contentRect.width;
			}
		});
		ro.observe(sceneEl);
		return () => ro.disconnect();
	});
</script>

<div class="cube-scene" bind:this={sceneEl}>
	{#if amount > 0}
		<div class="scene-row">
			<!-- Cube -->
			<div
				class="cube-slot"
				style="width: {cubeCssMm}mm; height: {cubeCssMm}mm;"
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

			<!-- Reference (with smooth swap on boundary crossing) -->
			{#key reference.id}
				<div class="reference-slot fade-in">
					<ScaleRef {reference} {sceneScale} />
				</div>
			{/key}
		</div>

		<!-- Caption strip -->
		<div class="caption-strip">
			Cube edge: <span class="cube-figure">{formatEdge(cubeEdgeMm)}</span>
			·
			Reference: <span class="ref-figure">{reference.displayName}</span>
			{#if reference.culturalNote}
				<span class="cultural-note">({reference.culturalNote})</span>
			{/if}
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
		gap: 24px;
		min-height: 180px;
		flex: 1;
	}

	.cube-slot {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		min-width: 6mm;
		min-height: 6mm;
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

	.ref-figure {
		color: #d4d4d8;
	}

	.cultural-note {
		color: #71717a;
		font-style: italic;
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
