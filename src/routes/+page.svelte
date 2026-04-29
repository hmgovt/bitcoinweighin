<script lang="ts">
	import { onMount } from 'svelte';
	import { CORE_COMMODITIES } from '$lib/commodities.js';
	import { computeCommodityAmount } from '$lib/prices.js';
	import type { PriceData, DayPrices } from '$lib/prices.js';
	import {
		btcAmount,
		selectedDate,
		unitSystem,
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

	function handleDateChange(e: Event) {
		const target = e.target as HTMLInputElement;
		setDateFromPicker(target.value);
	}

	function handleUnitToggle() {
		unitSystem.update((u) => (u === 'metric' ? 'imperial' : 'metric'));
	}

	function handlePresetSelect(id: string) {
		activatePreset(id, getDayPrices, lastDate);
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
		hydrateFromUrl(lastDate, getDayPrices);
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
	<!-- Header + controls column: text-driven, stays narrow at all widths. -->
	<div class="mx-auto max-w-2xl px-4 pt-6 sm:pt-10">
		<header class="mb-6 text-center">
			<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Bitcoin Weigh-In</h1>
			<p class="mt-1 text-sm text-zinc-500">The purchasing power of one coin, in things you can hold.</p>
		</header>
	</div>

	{#if loading}
		<div class="mx-auto max-w-2xl px-4 pb-6 sm:pb-10">
			<div class="flex items-center justify-center py-20">
				<div class="text-zinc-500 text-sm">Loading price data…</div>
			</div>
		</div>
	{:else}
		<div class="mx-auto max-w-2xl px-4">
			<!-- Preset pills -->
			<PresetBar activePresetId={$activePreset} onSelect={handlePresetSelect} />

			<!-- Controls -->
			<div class="mb-6 space-y-4 rounded-lg bg-zinc-900 p-4">
				<!-- BTC slider -->
				<div>
					<label class="mb-1 flex items-center justify-between text-sm">
						<span class="text-zinc-400">BTC amount</span>
						<span class="font-mono text-amber-400">{formatBtc($btcAmount)}</span>
					</label>
					<input
						type="range"
						min="0"
						max={SLIDER_STEPS}
						value={sliderPos}
						oninput={handleSliderInput}
						class="w-full accent-amber-500"
					/>
					<div class="mt-0.5 flex justify-between text-xs text-zinc-600">
						<span>1 sat</span>
						<span>21M</span>
					</div>
				</div>

				<!-- Dollar readout: primary UI element -->
				{#if dayPrices}
					<div class="dollar-readout text-center">
						<div class="dollar-value">
							{formatUsd($btcAmount * dayPrices.btc)}
						</div>
						<div class="dollar-secondary">
							at {formatUsd(dayPrices.btc)} per BTC on {formatDateReadout($selectedDate)}
						</div>
					</div>
				{/if}

				<!-- Date + Unit row -->
				<div class="flex items-end gap-3">
					<div class="flex-1">
						<label class="mb-1 block text-sm text-zinc-400">Date</label>
						<input
							type="date"
							value={$selectedDate}
							min={firstDate}
							max={lastDate}
							onchange={handleDateChange}
							class="w-full rounded bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 border border-zinc-700 focus:outline-none focus:border-amber-500"
						/>
					</div>
					<button
						onclick={handleUnitToggle}
						class="rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
					>
						{$unitSystem === 'metric' ? 'Metric' : 'Imperial'}
					</button>
				</div>
			</div>
		</div>

		<!--
			Commodity panels: visualisation-driven, expand at desktop widths to
			give the cube and reference more pixels to occupy. Mobile stays at
			max-w-2xl (672px) so the panel keeps filling the viewport. From md:
			(768px) up, the panels widen up to 1400px — capped to prevent
			absurd stretching on ultrawide displays. CubeRenderer's
			ResizeObserver picks up the new width automatically.
		-->
		<div class="mx-auto max-w-2xl md:max-w-[1400px] px-4 pb-6 sm:pb-10">
			{#each commodityAmounts as { commodity, amount } (commodity.id)}
				<CommoditySection
					{commodity}
					{amount}
					btcAmount={$btcAmount}
					unitSys={$unitSystem}
				/>
			{/each}
		</div>
	{/if}
</div>

<style>
	.dollar-readout {
		padding: 4px 0 8px;
	}

	.dollar-value {
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-variant-numeric: tabular-nums;
		font-size: 1.75rem;
		font-weight: 600;
		line-height: 1.2;
		color: #e4e4e7; /* zinc-200 */
		letter-spacing: -0.02em;
	}

	.dollar-secondary {
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-variant-numeric: tabular-nums;
		font-size: 0.75rem;
		color: #71717a; /* zinc-500 */
		margin-top: 2px;
	}
</style>
