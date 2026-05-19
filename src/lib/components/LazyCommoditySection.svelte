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
		const io = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) {
					mounted = true;
					io.disconnect();
				}
			},
			{ rootMargin: '400px' }
		);
		io.observe(containerEl);
		return () => io.disconnect();
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
