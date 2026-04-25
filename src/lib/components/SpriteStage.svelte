<script lang="ts">
	/**
	 * SpriteStage — renders a single stage's visual.
	 *
	 * Scale mode: single sprite at computed CSS mm width.
	 * Tile mode: grid of tile sprites with fractional trailing tile.
	 *
	 * Crossfade between stages handled by the parent (PhysicalRep)
	 * via CSS opacity transitions keyed on stage.id.
	 */

	import type { RenderStage } from '$lib/commodities.js';
	import type { TileState } from '$lib/volume.js';

	let {
		stage,
		displayWidthMm,
		tileState,
	}: {
		stage: RenderStage;
		displayWidthMm: number;
		tileState: TileState | null;
	} = $props();

	const isScale = $derived((stage.renderMode ?? 'scale') === 'scale');
	const isIsometric = $derived((stage.projection ?? 'three_quarter') === 'isometric');

	// Aspect ratio: isometric stages ~1.7:1, three-quarter ~1:1
	const aspectRatio = $derived(isIsometric ? 1.7 : 1);

	// For scale mode: clamp display width to something viewport-reasonable
	// 5000mm = 5m is the comparison-card threshold
	const clampedWidthMm = $derived(Math.min(displayWidthMm, 5000));

	// Grid layout for tile mode
	const gridCols = $derived.by(() => {
		if (!tileState || !stage.tileConfig) return 5;
		// Use mobile default; desktop override applied via CSS media query
		return stage.tileConfig.maxGridCols.mobile;
	});

	const desktopGridCols = $derived.by(() => {
		if (!stage.tileConfig) return 10;
		return stage.tileConfig.maxGridCols.desktop;
	});
</script>

{#if isScale}
	<!-- Scale mode: single sprite at physical size -->
	<div
		class="sprite-scale"
		style="width: {clampedWidthMm}mm; aspect-ratio: {aspectRatio};"
	>
		<img
			src={stage.spritePath}
			alt={stage.id.replace(/_/g, ' ')}
			class="h-full w-full object-contain"
			loading="lazy"
			onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
		/>
		<!-- Stub fallback: coloured rectangle with label -->
		<div
			class="absolute inset-0 flex items-center justify-center rounded border-2 transition-colors {isIsometric ? 'border-amber-500 bg-amber-800/30' : 'border-amber-700 bg-amber-900/30'}"
		>
			<span class="font-mono text-xs text-amber-400/80 uppercase">
				{stage.id.replace(/_/g, ' ')}
			</span>
		</div>
	</div>
{:else if tileState}
	<!-- Tile mode: grid of tiles -->
	<div
		class="tile-grid"
		style="--mobile-cols: {gridCols}; --desktop-cols: {desktopGridCols};"
	>
		{#each Array(tileState.fullTiles) as _, i}
			<div class="tile-cell" style="aspect-ratio: {aspectRatio};">
				<div class="h-full w-full rounded border border-amber-600/40 bg-amber-700/40 flex items-center justify-center">
					<span class="font-mono text-[9px] text-amber-400/60">100%</span>
				</div>
			</div>
		{/each}
		{#if tileState.trailingFill > 0.01}
			{@const fillPct = Math.round(tileState.trailingFill * 100)}
			<div class="tile-cell" style="aspect-ratio: {aspectRatio};">
				<div class="relative h-full w-full rounded border border-amber-600/30 bg-zinc-800 overflow-hidden">
					<div
						class="absolute bottom-0 left-0 right-0 bg-amber-700/40 transition-all duration-150"
						style="height: {fillPct}%;"
					></div>
					<span class="absolute inset-0 flex items-center justify-center font-mono text-[9px] text-amber-400/60">
						{fillPct}%
					</span>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.sprite-scale {
		position: relative;
		max-width: 100%;
		margin: 0 auto;
		transition: width 150ms ease;
	}

	.tile-grid {
		display: grid;
		grid-template-columns: repeat(var(--mobile-cols), 1fr);
		gap: 3px;
		width: 100%;
	}

	@media (min-width: 640px) {
		.tile-grid {
			grid-template-columns: repeat(var(--desktop-cols), 1fr);
		}
	}

	.tile-cell {
		min-width: 0;
	}
</style>
