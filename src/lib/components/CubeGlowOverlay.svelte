<script lang="ts">
	/**
	 * CubeGlowOverlay — Pu-238 cube only. Outer atmospheric glow that
	 * reads as light, not paint. The cube renders normally underneath;
	 * this component composites the radiant glow around (and through)
	 * the cube via blend-mode `screen`.
	 *
	 * Two channels drive the look independently:
	 * - intensity (brightness, opacity, bloom) — climbs faster
	 * - colour temperature (hue along the blackbody ladder) — climbs slower
	 *
	 * The cube's own surface emission (filter/box-shadow) is applied by
	 * the parent CubeRenderer using the same params; this component
	 * exposes them via CSS custom properties so the parent can read them
	 * if needed, and renders the outer glow div itself.
	 *
	 * Wiring up to the Pu-238 panel happens in Stage 6.
	 */

	import { computeGlowParams, type GlowParams } from './CubeGlowOverlay.helpers.js';

	let { massGrams }: { massGrams: number } = $props();

	const params: GlowParams = $derived(computeGlowParams(massGrams));
</script>

<div
	class="cube-glow-overlay"
	style:--glow-color={params.color}
	style:--glow-opacity={params.opacity}
	style:--glow-bloom="{params.bloomPx}px"
	aria-hidden="true"
></div>

<style>
	.cube-glow-overlay {
		position: absolute;
		inset: -50%;
		pointer-events: none;
		opacity: var(--glow-opacity);
		background: radial-gradient(
			circle at center,
			var(--glow-color) 0%,
			transparent 65%
		);
		filter: blur(calc(var(--glow-bloom) * 0.5));
		mix-blend-mode: screen;
		transition:
			opacity 200ms ease-out,
			filter 200ms ease-out;
	}
</style>
