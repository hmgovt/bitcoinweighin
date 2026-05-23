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

<!--
  Two concentric atmospheric layers, both behind the sprite.
  The tight layer concentrates the halo near the cube; the wide layer
  gives the impression of the dark room being lit up in orange.
-->
<div
	class="cube-glow-tight"
	style:--glow-color={params.color}
	style:--glow-opacity={Math.min(1, params.opacity * 1.3)}
	style:--glow-bloom="{params.bloomPx * 0.4}px"
	aria-hidden="true"
></div>
<div
	class="cube-glow-wide"
	style:--glow-color={params.color}
	style:--glow-opacity={params.opacity}
	style:--glow-bloom="{params.bloomPx}px"
	aria-hidden="true"
></div>

<style>
	.cube-glow-tight,
	.cube-glow-wide {
		position: absolute;
		inset: -50%;
		pointer-events: none;
		mix-blend-mode: screen;
		transition:
			opacity 200ms ease-out,
			filter 200ms ease-out;
	}

	.cube-glow-tight {
		opacity: var(--glow-opacity);
		background: radial-gradient(
			circle at center,
			var(--glow-color) 0%,
			transparent 55%
		);
		filter: blur(calc(var(--glow-bloom) * 0.6));
	}

	.cube-glow-wide {
		opacity: var(--glow-opacity);
		background: radial-gradient(
			circle at center,
			var(--glow-color) 0%,
			transparent 70%
		);
		filter: blur(calc(var(--glow-bloom) * 0.5));
	}
</style>
