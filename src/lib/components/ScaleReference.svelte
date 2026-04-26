<script lang="ts">
	/**
	 * ScaleReference — renders a single entry from the scale-references library
	 * at its true real-world size, scaled by a scene-wide factor so the cube
	 * and reference share a common coordinate system.
	 *
	 * The reference's sprite is sized via inline CSS in mm units. When
	 * sceneScale === 1, this renders at true CSS-mm physical size on a
	 * correctly-DPI-reporting display (e.g. the £1 coin at 23.43 mm). When
	 * the cube grows past the viewport, sceneScale drops below 1 and both
	 * the cube and references shrink proportionally — preserving relative
	 * scale.
	 *
	 * If the reference has an `animatedModelPath`, the static sprite can
	 * swap to a <model-viewer> element on three trigger paths (hover ≥200 ms
	 * desktop, sustained tap ≥500 ms mobile, or `?easter=doge` URL flag).
	 * `prefers-reduced-motion: reduce` disables all triggers. The
	 * @google/model-viewer library and the .gltf are both lazy-loaded —
	 * neither hits the network on initial page load.
	 */

	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
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
	const cssMm = $derived(realSizeMm * sceneScale);

	// === Easter egg state ===
	const HOVER_THRESHOLD_MS = 200;
	const TAP_THRESHOLD_MS = 500;
	const TAP_AUTO_REVERT_MS = 8000;

	let prefersReducedMotion = $state(false);
	let hoverActive = $state(false);
	let tapActive = $state(false);
	let modelViewerReady = $state(false);

	let hoverTimer: ReturnType<typeof setTimeout> | null = null;
	let tapTimer: ReturnType<typeof setTimeout> | null = null;
	let tapAutoRevert: ReturnType<typeof setTimeout> | null = null;

	const easterUrlActive = $derived(
		browser ? $page.url.searchParams.get('easter') === 'doge' : false
	);
	const isAnimatable = $derived(
		!!reference.animatedModelPath && !prefersReducedMotion
	);
	const showAnimated = $derived(
		isAnimatable && (easterUrlActive || hoverActive || tapActive)
	);

	// Lazy-load @google/model-viewer the first time we need it. Both the
	// library and the .gltf must be off the initial page-load critical
	// path — tested via Network tab per the spec's verification list.
	$effect(() => {
		if (showAnimated && !modelViewerReady && browser) {
			import('@google/model-viewer')
				.then(() => {
					modelViewerReady = true;
				})
				.catch((err) => {
					console.error('Failed to load model-viewer', err);
				});
		}
	});

	onMount(() => {
		if (!browser) return;
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		prefersReducedMotion = mq.matches;
		const onChange = (e: MediaQueryListEvent) => {
			prefersReducedMotion = e.matches;
		};
		mq.addEventListener('change', onChange);
		return () => {
			mq.removeEventListener('change', onChange);
			if (hoverTimer) clearTimeout(hoverTimer);
			if (tapTimer) clearTimeout(tapTimer);
			if (tapAutoRevert) clearTimeout(tapAutoRevert);
		};
	});

	function onPointerEnter(e: PointerEvent) {
		// Mouse hover only — touch fires its own pointerenter on tap which
		// would race with the touch handler's 500 ms threshold.
		if (e.pointerType !== 'mouse') return;
		if (!isAnimatable) return;
		if (hoverTimer) clearTimeout(hoverTimer);
		hoverTimer = setTimeout(() => {
			hoverActive = true;
		}, HOVER_THRESHOLD_MS);
	}

	function onPointerLeave(e: PointerEvent) {
		if (e.pointerType !== 'mouse') return;
		if (hoverTimer) {
			clearTimeout(hoverTimer);
			hoverTimer = null;
		}
		hoverActive = false;
	}

	function onTouchStart() {
		if (!isAnimatable) return;
		if (tapTimer) clearTimeout(tapTimer);
		tapTimer = setTimeout(() => {
			tapActive = true;
			if (tapAutoRevert) clearTimeout(tapAutoRevert);
			tapAutoRevert = setTimeout(() => {
				tapActive = false;
			}, TAP_AUTO_REVERT_MS);
		}, TAP_THRESHOLD_MS);
	}

	function onTouchEnd() {
		if (tapTimer) {
			clearTimeout(tapTimer);
			tapTimer = null;
		}
	}
</script>

<div
	class="scale-reference"
	style="width: {cssMm}mm; height: {cssMm}mm;"
	title="{reference.displayName} — {reference.description}"
	onpointerenter={onPointerEnter}
	onpointerleave={onPointerLeave}
	ontouchstart={onTouchStart}
	ontouchend={onTouchEnd}
	ontouchcancel={onTouchEnd}
>
	{#if showAnimated && modelViewerReady && reference.animatedModelPath}
		<svelte:element
			this="model-viewer"
			src={reference.animatedModelPath}
			autoplay
			disable-zoom
			disable-pan
			interaction-prompt="none"
			class="reference-model"
			aria-label={reference.description}
		/>
	{:else}
		<img
			src={reference.spritePath}
			alt={reference.description}
			class="reference-sprite"
			draggable="false"
		/>
	{/if}
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

	.reference-model {
		width: 100%;
		height: 100%;
		display: block;
		--poster-color: transparent;
		background: transparent;
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
