<script lang="ts">
	/**
	 * ScaleReference — renders a single entry from the scale-references library
	 * at its true real-world size, scaled by a scene-wide factor so the cube
	 * and reference share a common coordinate system.
	 *
	 * The reference's sprite (SVG) is sized via inline CSS in mm units.
	 * When sceneScale === 1, this renders at true CSS-mm physical size on
	 * a correctly-DPI-reporting display (e.g. the £1 coin at 23.43 mm).
	 * When the cube grows past the viewport, sceneScale drops below 1 and
	 * both the cube and references shrink proportionally — preserving
	 * relative scale.
	 */

	import type { ScaleReference } from '$lib/volume.js';

	let {
		reference,
		sceneScale,
	}: {
		reference: ScaleReference;
		/** Pixels per millimetre to apply to the reference's true size */
		sceneScale: number;
	} = $props();

	const realSizeMm = $derived(reference.realSizeMetres * 1000);
	// Display size on screen, in CSS px. Browsers treat 1mm ≈ 3.7795 px (96 dpi assumption).
	const cssMm = $derived(realSizeMm * sceneScale);
</script>

<div
	class="scale-reference"
	style="width: {cssMm}mm; height: {cssMm}mm;"
	title="{reference.displayName} — {reference.description}"
>
	<img
		src={reference.spritePath}
		alt={reference.description}
		class="reference-sprite"
		draggable="false"
	/>
	<div class="reference-label">
		{reference.displayName}{#if sceneScale === 1 && reference.id === 'pound_coin'}
			<span class="actual-size-badge"> · actual size</span>
		{/if}
	</div>
</div>

<style>
	.scale-reference {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		flex-shrink: 0;
		position: relative;
		min-width: 6mm;
		min-height: 6mm;
	}

	.reference-sprite {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
		user-select: none;
	}

	.reference-label {
		position: absolute;
		top: 100%;
		margin-top: 4px;
		font-size: 0.625rem;
		color: #71717a;
		white-space: nowrap;
		text-align: center;
		font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
	}

	.actual-size-badge {
		color: #a1a1aa;
	}
</style>
