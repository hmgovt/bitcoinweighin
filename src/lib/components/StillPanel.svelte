<script lang="ts">
	/**
	 * StillPanel — replaces the cube + reference layout for still-mode
	 * commodities (cocaine). The still image carries register; the
	 * children slot carries the dynamic readout. No Shiba, no Y-axis,
	 * no quantity anchors.
	 *
	 * Placeholder fallback: if the image at `imagePath` 404s, a labelled
	 * grey placeholder of the same dimensions renders in its place. Per
	 * the marathon-session overview: "Asset gaps are placeholder-only,
	 * never fabricated."
	 *
	 * Wired up to the cocaine commodity in Stage 5.
	 */

	import type { Snippet } from 'svelte';

	let {
		commodityId,
		imagePath,
		currentBtc,
		children
	}: {
		commodityId: string;
		imagePath: string;
		currentBtc: number;
		children?: Snippet;
	} = $props();

	let imageFailed = $state(false);

	// `currentBtc` is wired through for child consumers in Stage 5; keep
	// the prop in scope so a TypeScript "declared but unused" warning
	// doesn't surface during the partial wiring window.
	$effect(() => {
		void currentBtc;
	});
</script>

<div class="still-panel">
	<div class="still-image-wrapper">
		{#if imageFailed}
			<div
				class="still-placeholder"
				role="img"
				aria-label="placeholder for {commodityId} forensic still"
			>
				<span class="placeholder-label">{commodityId} still</span>
				<span class="placeholder-hint">image not yet authored</span>
			</div>
		{:else}
			<img
				src={imagePath}
				alt="{commodityId} forensic still"
				class="still-image"
				onerror={() => (imageFailed = true)}
			/>
		{/if}
	</div>

	<div class="readout-slot">
		{@render children?.()}
	</div>
</div>

<style>
	.still-panel {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		align-items: center;
		width: 100%;
	}
	.still-image-wrapper {
		width: 100%;
		max-width: 800px;
		aspect-ratio: 4 / 3;
		background: transparent;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}
	.still-image {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.still-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		color: var(--color-text-secondary, #666);
	}
	.placeholder-label {
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.placeholder-hint {
		font-size: 0.75rem;
		opacity: 0.7;
		font-style: italic;
	}
	.readout-slot {
		width: 100%;
		max-width: 800px;
	}
</style>
