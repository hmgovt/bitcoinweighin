<script lang="ts">
	/**
	 * YAxis — a single vertical line beside the cube with an adaptive-unit
	 * label at its midpoint, used by cube-mode commodities (gold, silver,
	 * Pu-238). Wired up by the consuming panel in Stages 4 and 6.
	 *
	 * The line's height in CSS px tracks the cube's true edge length scaled
	 * by the same `viewportZoom` factor the cube uses, so the cube and the
	 * axis stay coherent through the slider's full range.
	 *
	 * Imperial primary; metric appears only when `unitSystem === 'metric'`.
	 */

	let {
		cubeEdgeMetres,
		viewportZoom,
		unitSystem,
		displayHeightMm,
	}: {
		cubeEdgeMetres: number;
		viewportZoom: number;
		unitSystem: 'imperial' | 'metric';
		/**
		 * Optional override for the line's visual height in CSS mm. When provided,
		 * the line tracks this value instead of `cubeEdgeMetres × viewportZoom`,
		 * so the y-axis stays coherent with the cube even when the cube clamps
		 * at a visual minimum below its real edge length. The label always
		 * reflects the real cube edge regardless.
		 */
		displayHeightMm?: number;
	} = $props();

	function formatLength(metres: number, system: 'imperial' | 'metric'): string {
		if (metres <= 0) return '';
		if (system === 'metric') {
			const mm = metres * 1000;
			if (mm < 10) return `${mm.toFixed(1)} mm`;
			if (mm < 1000) return `${(mm / 10).toFixed(1)} cm`;
			if (metres < 1000) return `${metres.toFixed(2)} m`;
			return `${(metres / 1000).toFixed(2)} km`;
		}
		const inches = metres * 39.3701;
		if (inches < 12) return `${inches.toFixed(1)} in`;
		const feet = inches / 12;
		if (feet < 5280) return `${feet.toFixed(1)} ft`;
		return `${(feet / 5280).toFixed(2)} mi`;
	}

	// Height in CSS mm, matching the cube's mm-unit rendering in CubeRenderer.
	// (cubeEdgeMetres × 1000) → mm; × viewportZoom (the cube's sceneScale) → CSS mm.
	// When `displayHeightMm` is supplied (e.g. cube clamped at a visual floor),
	// it takes precedence so the axis tracks the cube's displayed size.
	const heightMm = $derived(
		displayHeightMm !== undefined
			? Math.max(0, displayHeightMm)
			: Math.max(0, cubeEdgeMetres * 1000 * viewportZoom)
	);
	const label = $derived(formatLength(cubeEdgeMetres, unitSystem));
</script>

<div class="y-axis" style:height="{heightMm}mm" aria-hidden="true">
	<div class="y-axis-line"></div>
	{#if label}
		<div class="y-axis-label">{label}</div>
	{/if}
</div>

<style>
	.y-axis {
		position: relative;
		width: 1px;
		min-height: 1px;
	}
	.y-axis-line {
		position: absolute;
		inset: 0;
		width: 1px;
		background: var(--color-text-secondary, currentColor);
		opacity: 0.4;
	}
	.y-axis-label {
		position: absolute;
		top: 50%;
		left: 4px;
		transform: translateY(-50%);
		font-size: 11px;
		color: var(--color-text-secondary, currentColor);
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
</style>
