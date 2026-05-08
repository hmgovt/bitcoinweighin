<script lang="ts">
	/**
	 * ScaleReference — renders a single entry from the scale-references library
	 * at a caller-supplied pixel size. The cube renderer drives sizing via
	 * `pxPerMetre × realSizeMetres`, so the cube and the reference always
	 * share a single metres-to-pixels scale.
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
		pxSize,
	}: {
		reference: ScaleReference;
		/** Rendered pixel size (width = height) for the reference slot. */
		pxSize: number;
	} = $props();

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
	style="width: {pxSize}px; height: {pxSize}px;"
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
</div>

<style>
	.scale-reference {
		display: block;
		flex-shrink: 0;
		position: relative;
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
</style>
