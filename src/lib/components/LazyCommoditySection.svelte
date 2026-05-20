<script lang="ts">
	/**
	 * Partial-hydration wrapper around CommoditySection.
	 *
	 * Above-fold sections (priority=true) mount eagerly so they ship in the
	 * prerendered HTML and Svelte hydrates them normally. Below-fold sections
	 * render as empty min-height placeholders during prerender and during
	 * initial client hydration, then mount their real CommoditySection when
	 * scrolled near via IntersectionObserver.
	 *
	 * This pattern lets the LCP element (the gold Shiba sprite, inside the
	 * first commodity section) live in the static HTML, while the cost of
	 * hydrating the other 7 sections is deferred past the TBT measurement
	 * window. Without this, mounting all 8 sections + their ResizeObservers
	 * + reactive cascades during hydration costs ~800 ms of blocking time.
	 *
	 * Critical: `mounted` is initialised identically in SSR and on the
	 * client (mirrors `priority`), so Svelte's hydration claims matching
	 * DOM and never tears down an inconsistent tree.
	 */
	import { onMount } from 'svelte';
	import type { Commodity } from '$lib/commodities.js';
	import type { PriceData } from '$lib/prices.js';
	import CommoditySection from './CommoditySection.svelte';

	let {
		commodity,
		amount,
		btcAmount,
		btcUsdPrice,
		prices,
		priority = false,
	}: {
		commodity: Commodity;
		amount: number | null;
		btcAmount: number;
		btcUsdPrice: number;
		prices: PriceData | null;
		priority?: boolean;
	} = $props();

	let containerEl: HTMLElement | undefined = $state();
	let mounted = $state(priority);

	onMount(() => {
		if (mounted || !containerEl) return;

		// Two-track mount trigger:
		//   1. requestIdleCallback fires the mount once the browser has spare
		//      CPU — typically after FCP/LCP/TBT-window have closed. This is
		//      the dominant path for users who don't scroll immediately.
		//   2. IntersectionObserver with a tight 50 px margin fires the mount
		//      if the user scrolls the section into view before the idle
		//      callback runs. Without it, fast scrollers see empty placeholders.
		//
		// First trigger to fire wins; the other is cancelled. rootMargin: 400px
		// was the earlier setup — too generous, since on desktop several
		// below-fold sections were within that range and mounted eagerly.
		let idleId: number | null = null;
		const cancelIdle = () => {
			if (idleId === null) return;
			if (typeof cancelIdleCallback === 'function') {
				cancelIdleCallback(idleId);
			} else {
				clearTimeout(idleId);
			}
			idleId = null;
		};

		const mount = () => {
			if (mounted) return;
			mounted = true;
			cancelIdle();
			io.disconnect();
		};

		if (typeof requestIdleCallback === 'function') {
			idleId = requestIdleCallback(mount, { timeout: 3000 });
		} else {
			idleId = window.setTimeout(mount, 800) as unknown as number;
		}

		const io = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) mount();
			},
			{ rootMargin: '50px' }
		);
		io.observe(containerEl);

		return () => {
			io.disconnect();
			cancelIdle();
		};
	});
</script>

<div
	bind:this={containerEl}
	class="lazy-section"
	class:lazy-section--pending={!mounted}
>
	{#if mounted}
		<CommoditySection {commodity} {amount} {btcAmount} {btcUsdPrice} {prices} />
	{/if}
</div>

<style>
	.lazy-section {
		/* Reserve roughly one panel of vertical space so the IO has room to
		   distribute the observers across the page. Real panels override
		   this once mounted — content sets the height. */
		min-height: 0;
	}
	.lazy-section--pending {
		min-height: 520px;
	}

	@media (max-width: 767px) {
		.lazy-section--pending {
			min-height: 420px;
		}
	}
</style>
