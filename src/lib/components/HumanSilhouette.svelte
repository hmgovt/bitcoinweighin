<script lang="ts">
	/**
	 * Human silhouette reference — fixed at 1.75 m true height.
	 * Shown only when commodity display width exceeds 300 mm.
	 * Uses CSS mm units for physical-size accuracy.
	 */

	let {
		displayWidthMm,
	}: {
		displayWidthMm: number;
	} = $props();

	const SILHOUETTE_HEIGHT_MM = 1750; // 1.75 m in mm
	const SHOW_THRESHOLD_MM = 300;
	// Above this commodity width the silhouette is dwarfed and the
	// ComparisonCard text takes over as the reference. Keeping it on screen
	// would also reserve >2000px of fixed flex column on a typical DPI,
	// which squeezes the sprite/tile-grid to zero width inside the
	// scene-area's `overflow: hidden` flex layout. Matches
	// COMPARISON_THRESHOLD_MM in PhysicalRep.svelte.
	const HIDE_THRESHOLD_MM = 5000;

	const visible = $derived(
		displayWidthMm >= SHOW_THRESHOLD_MM && displayWidthMm < HIDE_THRESHOLD_MM
	);

	// Scale silhouette relative to the commodity: both share the same mm coordinate system
	// The silhouette SVG is drawn in a 200×600 viewBox, displayed at its true physical height
</script>

{#if visible}
	<div
		class="silhouette-container"
		style="height: {SILHOUETTE_HEIGHT_MM}mm; opacity: {Math.min(1, (displayWidthMm - SHOW_THRESHOLD_MM) / 100)};"
	>
		<svg viewBox="0 0 200 600" fill="currentColor" class="h-full w-auto text-zinc-600">
			<!-- Simplified human silhouette -->
			<ellipse cx="100" cy="42" rx="28" ry="35" />
			<path d="M60 85 C60 75 140 75 140 85 L150 250 L120 250 L115 580 L85 580 L80 250 L50 250 Z" />
		</svg>
	</div>
{/if}

<style>
	.silhouette-container {
		transition: opacity 300ms ease;
		flex-shrink: 0;
	}
</style>
