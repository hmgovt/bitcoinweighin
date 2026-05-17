<script lang="ts">
	import { onMount } from 'svelte';
	import { CORE_COMMODITIES } from '$lib/commodities.js';
	import { computeCommodityAmount } from '$lib/prices.js';
	import type { PriceData, DayPrices } from '$lib/prices.js';
	import {
		btcAmount,
		selectedDate,
		activePreset,
		setBtcFromSlider,
		setDateFromPicker,
		activatePreset,
		hydrateFromUrl,
	} from '$lib/stores/url.js';
	import { formatBtc } from '$lib/format.js';
	import CommoditySection from '$lib/components/CommoditySection.svelte';
	import PresetBar from '$lib/components/PresetBar.svelte';

	let { data } = $props();

	let prices = $state<PriceData | null>(null);
	let firstDate = $state(data.firstDate);
	let lastDate = $state(data.lastDate);
	let loading = $state(true);

	function getDayPrices(date: string): DayPrices | undefined {
		return prices?.[date];
	}

	// ── Slider log-scale helpers ────────────────────────────────
	const BTC_MIN = 0.00000001; // 1 sat
	const BTC_MAX = 21_000_000;
	const LOG_MIN = Math.log10(BTC_MIN);
	const LOG_MAX = Math.log10(BTC_MAX);
	const SLIDER_STEPS = 10000;

	function btcToSlider(btc: number): number {
		const clamped = Math.max(BTC_MIN, Math.min(BTC_MAX, btc));
		const log = Math.log10(clamped);
		return Math.round(((log - LOG_MIN) / (LOG_MAX - LOG_MIN)) * SLIDER_STEPS);
	}

	function sliderToBtc(pos: number): number {
		const log = LOG_MIN + (pos / SLIDER_STEPS) * (LOG_MAX - LOG_MIN);
		const raw = Math.pow(10, log);
		if (raw >= 1000) return Math.round(raw);
		if (raw >= 1) return Math.round(raw * 100) / 100;
		if (raw >= 0.001) return Math.round(raw * 10000) / 10000;
		if (raw >= 0.00001) return Math.round(raw * 100000000) / 100000000;
		return Math.round(raw * 100000000) / 100000000;
	}

	let sliderPos = $state(btcToSlider(1));

	$effect(() => {
		const newPos = btcToSlider($btcAmount);
		if (Math.abs(newPos - sliderPos) > 1) {
			sliderPos = newPos;
		}
	});

	function handleSliderInput(e: Event) {
		const target = e.target as HTMLInputElement;
		sliderPos = parseInt(target.value);
		setBtcFromSlider(sliderToBtc(sliderPos));
	}

	// Compact pinned bar — appears once the user has scrolled past the
	// full controls card. Sentinel sits just below the controls; we watch
	// its IntersectionObserver entry and flip the bar visible when it
	// has scrolled above the viewport (not just merely off-screen below).
	let sentinelEl: HTMLElement | undefined = $state();
	let showStickyBar = $state(false);

	$effect(() => {
		if (!sentinelEl) return;
		const obs = new IntersectionObserver((entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					showStickyBar = false;
				} else {
					// Off-screen — distinguish above (scrolled past) from below (not yet reached).
					showStickyBar = entry.boundingClientRect.top < 0;
				}
			}
		});
		obs.observe(sentinelEl);
		return () => obs.disconnect();
	});

	function handleDateChange(e: Event) {
		const target = e.target as HTMLInputElement;
		setDateFromPicker(target.value);
	}

	function handlePresetSelect(slug: string) {
		activatePreset(slug);
	}

	const dayPrices = $derived(getDayPrices($selectedDate));

	function formatUsd(value: number): string {
		if (value >= 1_000_000_000_000) {
			return '$' + (value / 1_000_000_000_000).toFixed(2) + 'T';
		}
		if (value >= 1_000_000_000) {
			return '$' + (value / 1_000_000_000).toFixed(2) + 'B';
		}
		if (value >= 1_000_000) {
			return '$' + (value / 1_000_000).toFixed(2) + 'M';
		}
		return '$' + value.toLocaleString('en-US', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		});
	}

	function formatDateReadout(dateStr: string): string {
		if (!dateStr) return '';
		const d = new Date(dateStr + 'T00:00:00');
		return d.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	}

	const commodityAmounts = $derived(
		CORE_COMMODITIES.map((c) => ({
			commodity: c,
			amount: computeCommodityAmount($btcAmount, c, dayPrices),
		}))
	);

	onMount(async () => {
		// Beehiiv loader self-positions (sticky-bottom). Append to body so
		// the script governs its own placement rather than getting trapped
		// inside an inline container.
		const BEEHIIV_ID = '6a25c97c-4b00-4c3e-9ed4-cb25c2db7be2';
		if (!document.querySelector(`script[data-beehiiv-form="${BEEHIIV_ID}"]`)) {
			const s = document.createElement('script');
			s.async = true;
			s.src = 'https://subscribe-forms.beehiiv.com/v3/loader.js';
			s.setAttribute('data-beehiiv-form', BEEHIIV_ID);
			document.body.appendChild(s);
		}

		const res = await fetch('/prices.json');
		const data: PriceData = await res.json();
		prices = data;
		const dates = Object.keys(data).sort();
		firstDate = dates[0];
		lastDate = dates[dates.length - 1];
		loading = false;

		// Set default date, then hydrate URL params
		if (!$selectedDate) {
			selectedDate.set(lastDate);
		}
		hydrateFromUrl(lastDate);
	});
</script>

<svelte:head>
	<title>Bitcoin Weigh-In — What does a bitcoin weigh?</title>
	<meta
		name="description"
		content="The purchasing power of bitcoin, measured in commodities you can hold. Gold, silver, copper, oil, and nuclear fuel — at true relative scale."
	/>
</svelte:head>

<div class="min-h-screen bg-zinc-950 text-zinc-100">
	<!-- Compact pinned bar — slides in once user has scrolled past the full controls. -->
	<div class="sticky-bar" class:visible={showStickyBar} aria-hidden={!showStickyBar}>
		<div class="mx-auto flex h-11 max-w-2xl items-center gap-3 px-4">
			<span class="min-w-[3.25rem] whitespace-nowrap font-mono text-xs text-amber-400">
				{formatBtc($btcAmount)}
			</span>
			<input
				type="range"
				min="0"
				max={SLIDER_STEPS}
				value={sliderPos}
				oninput={handleSliderInput}
				class="flex-1 accent-amber-500"
				aria-label="BTC amount"
				tabindex={showStickyBar ? 0 : -1}
			/>
			{#if dayPrices}
				<span class="min-w-[4.5rem] whitespace-nowrap text-right font-mono text-xs text-zinc-200">
					{formatUsd($btcAmount * dayPrices.btc)}
				</span>
			{/if}
		</div>
	</div>

	<!--
		Header: two-zone layout. Brand left (image + subtitle), preset pills
		right. The subscribe form has moved out of the header — Beehiiv code
		decides where it surfaces (sticky-bottom or wherever the loader chooses);
		the markup container lives later in the document so the loader has a
		DOM target to attach to without crowding the masthead.
	-->
	<div class="mx-auto max-w-[1280px] px-6 pt-4 sm:pt-6">
		<header class="site-header">
			<a href="/" class="brand" aria-label="Bitcoin Weigh-In home">
				<h1 class="sr-only">Bitcoin Weigh-In</h1>
				<img
					src="/header.jpg"
					alt="Bitcoin Weigh-In"
					width="1600"
					height="562"
					class="brand__mark"
				/>
				<p class="brand__subtitle">
					The purchasing power of bitcoin, in&nbsp;things you can hold.
				</p>
			</a>
			<div class="header-pills">
				<PresetBar activePresetId={$activePreset} onSelect={handlePresetSelect} />
			</div>
		</header>
	</div>

	{#if loading}
		<div class="mx-auto max-w-2xl px-4 pb-6 sm:pb-10">
			<div class="flex items-center justify-center py-20">
				<div class="text-zinc-500 text-sm">Loading price data…</div>
			</div>
		</div>
	{:else}
		<div class="mx-auto mt-8 max-w-2xl px-4">
			<!-- Controls — two-row compact panel (~120px tall) -->
			<div class="controls-panel">
				<div class="controls-slider">
					<input
						type="range"
						min="0"
						max={SLIDER_STEPS}
						value={sliderPos}
						oninput={handleSliderInput}
						class="slider accent-amber-500"
						aria-label="BTC amount"
					/>
					<div class="slider-range">
						<span>1 sat</span>
						<span>21M</span>
					</div>
				</div>

				<div class="controls-value-row">
					<div class="value-block">
						<div class="value-btc">{formatBtc($btcAmount)}</div>
						{#if dayPrices}
							<div class="value-context">
								{formatUsd($btcAmount * dayPrices.btc)} · {formatDateReadout($selectedDate)}
							</div>
						{/if}
					</div>
					<input
						type="date"
						value={$selectedDate}
						min={firstDate}
						max={lastDate}
						onchange={handleDateChange}
						class="date-input"
						aria-label="Date"
					/>
				</div>
			</div>

			<!--
				Sentinel: sits just below the controls card. When it scrolls above
				the viewport the pinned compact bar slides in. The IO entry's
				boundingClientRect.top < 0 means "above" rather than "below" — so
				we distinguish "scrolled past" from "not yet reached".
			-->
			<div bind:this={sentinelEl} aria-hidden="true" class="h-px"></div>
		</div>

		<!--
			Commodity panels: visualisation-driven, expand at desktop widths to
			give the cube and reference more pixels to occupy. Mobile stays at
			max-w-2xl (672px) so the panel keeps filling the viewport. From md:
			(768px) up, the panels widen up to 1400px — capped to prevent
			absurd stretching on ultrawide displays. CubeRenderer's
			ResizeObserver picks up the new width automatically.
		-->
		<div class="mx-auto mt-12 max-w-2xl md:max-w-[1400px] px-4 pb-6 sm:pb-10">
			{#each commodityAmounts as { commodity, amount } (commodity.id)}
				<CommoditySection
					{commodity}
					{amount}
					btcAmount={$btcAmount}
					btcUsdPrice={dayPrices?.btc ?? 0}
				/>
			{/each}
		</div>
	{/if}
</div>

<style>
	.controls-panel {
		background: #18181b; /* zinc-900 */
		border-radius: 8px;
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.controls-slider {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.slider {
		width: 100%;
	}
	.slider-range {
		display: flex;
		justify-content: space-between;
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-size: 11px;
		color: #71717a; /* zinc-500 */
	}
	.controls-value-row {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 16px;
	}
	.value-block {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.value-btc {
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-variant-numeric: tabular-nums;
		font-size: 22px;
		font-weight: 600;
		line-height: 1.15;
		color: #f5f0e6;
		letter-spacing: -0.01em;
	}
	.value-context {
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-variant-numeric: tabular-nums;
		font-size: 14px;
		color: #9aa0a6;
	}
	.date-input {
		flex-shrink: 0;
		background: #27272a; /* zinc-800 */
		color: #e4e4e7;
		border: 1px solid #3f3f46; /* zinc-700 */
		border-radius: 6px;
		padding: 6px 10px;
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-size: 13px;
		color-scheme: dark;
	}
	.date-input:focus {
		outline: none;
		border-color: #f59e0b; /* amber-500 */
	}

	@media (max-width: 479px) {
		.controls-value-row {
			flex-direction: column;
			align-items: stretch;
			gap: 8px;
		}
		.date-input {
			width: 100%;
		}
	}

	.site-header {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding-bottom: 0;
	}
	.brand {
		display: flex;
		flex-direction: column;
		gap: 6px;
		flex-shrink: 0;
		text-decoration: none;
		color: inherit;
	}
	.brand__mark {
		display: block;
		height: 96px;
		width: auto;
		max-width: 100%;
	}
	.brand__subtitle {
		margin: 0;
		color: #9aa0a6;
		font-size: 14px;
		font-weight: 400;
		line-height: 1.35;
		text-wrap: balance;
	}
	.header-pills {
		width: 100%;
	}

	@media (min-width: 768px) {
		.site-header {
			flex-direction: row;
			align-items: flex-start;
			gap: 24px;
		}
		.brand {
			flex: 0 0 38%;
		}
		.header-pills {
			flex: 1 1 62%;
		}
	}

	.sticky-bar {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 50;
		background: rgba(9, 9, 11, 0.92); /* zinc-950 @ 92% */
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		border-bottom: 1px solid #27272a; /* zinc-800 */
		transform: translateY(-100%);
		opacity: 0;
		transition:
			transform 200ms ease-out,
			opacity 200ms ease-out;
		pointer-events: none;
	}
	.sticky-bar.visible {
		transform: translateY(0);
		opacity: 1;
		pointer-events: auto;
	}
	@media (prefers-reduced-motion: reduce) {
		.sticky-bar {
			transition: none;
		}
	}
</style>
