<script lang="ts">
	import { onMount } from 'svelte';
	import { CORE_COMMODITIES } from '$lib/commodities.js';
	import { computeCommodityAmount } from '$lib/prices.js';
	import type { PriceData, DayPrices } from '$lib/prices.js';
	import {
		btcAmount,
		selectedDate,
		activePreset,
		scrollToCommodity,
		setBtcFromSlider,
		setDateFromPicker,
		activatePreset,
		hydrateFromUrl,
	} from '$lib/stores/url.js';
	import { formatBtc } from '$lib/format.js';
	import LazyCommoditySection from '$lib/components/LazyCommoditySection.svelte';
	import PresetBar from '$lib/components/PresetBar.svelte';
	import NetworkWeightPanel from '$lib/components/NetworkWeightPanel.svelte';
	import BitCubePanel from '$lib/components/BitCubePanel.svelte';
	import {
		organizationJsonLd,
		websiteJsonLd,
		webPageJsonLd,
		faqJsonLd,
		breadcrumbJsonLd,
	} from '$lib/seo/jsonld.js';
	import { HOMEPAGE_FAQS } from '$lib/seo/faqs.js';

	let { data } = $props();

	// Initial prices are the latest day only (inlined via +page.ts → load
	// → prices-latest.json). The full archive lazy-loads in onMount. The
	// first commodity (gold) renders eagerly so its Shiba ships in the
	// prerendered HTML and anchors LCP; the other 7 sections lazy-mount
	// via IntersectionObserver to keep hydration cheap.
	let prices = $state<PriceData>(data.initialPrices);
	let firstDate = $state(data.firstDate);
	let lastDate = $state(data.lastDate);

	// Seed selectedDate before the first reactive read so the inlined day's
	// data resolves. URL params are applied in onMount once the full archive
	// is loaded — applying them earlier would cause a hydration mismatch
	// when the URL date isn't in the inlined day.
	selectedDate.set(data.lastDate);

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

	// Dual-mode slider: 'btc' adjusts BTC amount; 'date' locks BTC and scrubs through history.
	let sliderMode = $state<'btc' | 'date'>('btc');
	let lockedBtcForDateMode = $state(1);

	const sortedDates = $derived(prices ? Object.keys(prices).sort() : []);

	function dateToSliderIdx(date: string, dates: string[]): number {
		if (!dates.length) return SLIDER_STEPS;
		let idx = dates.indexOf(date);
		if (idx === -1) {
			idx = dates.findIndex(d => d >= date);
			if (idx === -1) idx = dates.length - 1;
		}
		return Math.round((idx / Math.max(1, dates.length - 1)) * SLIDER_STEPS);
	}

	function sliderIdxToDate(pos: number, dates: string[]): string {
		if (!dates.length) return '';
		const idx = Math.round((pos / SLIDER_STEPS) * (dates.length - 1));
		return dates[Math.max(0, Math.min(dates.length - 1, idx))];
	}

	let sliderPos = $state(btcToSlider(1));

	$effect(() => {
		if (sliderMode === 'btc') {
			const newPos = btcToSlider($btcAmount);
			if (Math.abs(newPos - sliderPos) > 1) sliderPos = newPos;
		} else {
			const newPos = dateToSliderIdx($selectedDate, sortedDates);
			if (Math.abs(newPos - sliderPos) > 1) sliderPos = newPos;
		}
	});

	function handleSliderInput(e: Event) {
		const target = e.target as HTMLInputElement;
		sliderPos = parseInt(target.value);
		if (sliderMode === 'btc') {
			setBtcFromSlider(sliderToBtc(sliderPos));
		} else {
			setDateFromPicker(sliderIdxToDate(sliderPos, sortedDates));
		}
	}

	function handleSliderDblClick() {
		if (sortedDates.length <= 1) return;
		if (sliderMode === 'btc') {
			lockedBtcForDateMode = $btcAmount;
			sliderMode = 'date';
		} else {
			sliderMode = 'btc';
			setBtcFromSlider(lockedBtcForDateMode);
		}
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

	function handlePresetSelect(slug: string) {
		sliderMode = 'btc';
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

	// ── Open Graph metadata (reactive) ──────────────────────────
	// og:image points at /og-image (functions/og-image.ts) so the share
	// preview reflects the current slider state. When ?commodity=X is set
	// (via deep-link or a per-panel share button), the title and image
	// pivot to that commodity; otherwise gold is the default voice.
	// Server-prerender bakes the defaults; client hydration updates the
	// reactive bindings for JS-aware crawlers.
	const ogCommodity = $derived(
		CORE_COMMODITIES.find((c) => c.id === $scrollToCommodity) ??
			CORE_COMMODITIES.find((c) => c.id === 'gold')
	);

	const ogReadoutText = $derived.by(() => {
		if (!ogCommodity || !dayPrices) return null;
		const amt = computeCommodityAmount($btcAmount, ogCommodity, dayPrices);
		if (amt === null || !isFinite(amt) || amt <= 0) return null;
		if (ogCommodity.unit === 'troy_oz') {
			const formatted =
				amt >= 1000 ? Math.round(amt).toLocaleString('en-US')
					: amt >= 1 ? amt.toFixed(2)
						: amt.toPrecision(3);
			return `${formatted} troy oz`;
		}
		// Grams-unit commodities use the consumer ladder (kg/tonnes at scale).
		if (ogCommodity.unit === 'gram' && ogCommodity.unitMassGrams) {
			// Inline grams formatter — mirrors functions/_lib.ts formatHeadlineAmount
			const g = amt * ogCommodity.unitMassGrams;
			if (g >= 1_000_000) return `${(g / 1_000_000).toFixed(2)} tonnes`;
			if (g >= 1000) return `${(g / 1000).toFixed(2)} kg`;
			if (g < 1) return `${(g * 1000).toFixed(0)} mg`;
			return `${g.toFixed(1)} g`;
		}
		return null;
	});

	const ogCommodityName = $derived(ogCommodity?.displayName.toLowerCase() ?? 'gold');

	// Page-level <title> stays keyword-stable so it doesn't churn with the
	// daily ratio (which used to bake into the title and tanked queries like
	// "bitcoin to gold" because the title kept shifting). og:title still
	// carries the dynamic ratio so share previews remain conversation-worthy.
	const pageTitle =
		'Bitcoin Weigh-In — BTC to Gold, Silver, Oil & Commodities Visualised';
	const pageDescription =
		"Bitcoin's purchasing power, visualised in physical commodities. See how much gold, silver, oil, or plutonium one BTC buys, with a daily-updated dataset back to 2013.";

	const ogTitle = $derived(
		ogReadoutText
			? `${formatBtc($btcAmount)} = ${ogReadoutText} of ${ogCommodityName} · Bitcoin Weigh-In`
			: pageTitle
	);

	const ogDescription = $derived(
		ogReadoutText
			? `What does ${formatBtc($btcAmount)} buy? ${ogReadoutText} of ${ogCommodityName} today. Explore BTC purchasing power across gold, silver, plutonium-238 and more.`
			: pageDescription
	);

	// Default state (1 BTC, latest date, no preset/commodity) emits the
	// bare canonical and an undated og-image. The SSR pass seeds
	// selectedDate to the build day, which baked a dated og:url into the
	// prerendered HTML — fragmenting the share graph by day and dating
	// the share card for anyone sharing the bare homepage later (SEO
	// audit C2). Dynamic values still apply after user interaction.
	const isDefaultState = $derived(
		$btcAmount === 1 &&
			!$activePreset &&
			!$scrollToCommodity &&
			(!$selectedDate || $selectedDate === lastDate)
	);

	const ogPageUrl = $derived.by(() => {
		if (isDefaultState) return 'https://bitcoinweighin.com/';
		const params = new URLSearchParams();
		if ($btcAmount !== 1) params.set('btc', String($btcAmount));
		if ($selectedDate) params.set('date', $selectedDate);
		if ($activePreset) params.set('preset', $activePreset);
		if ($scrollToCommodity) params.set('commodity', $scrollToCommodity);
		const qs = params.toString();
		return `https://bitcoinweighin.com/${qs ? '?' + qs : ''}`;
	});

	const ogImageUrl = $derived.by(() => {
		if (isDefaultState) return 'https://bitcoinweighin.com/og-image?btc=1';
		const params = new URLSearchParams();
		params.set('btc', String($btcAmount));
		if ($selectedDate) params.set('date', $selectedDate);
		if ($scrollToCommodity) params.set('commodity', $scrollToCommodity);
		return `https://bitcoinweighin.com/og-image?${params.toString()}`;
	});

	const ogImageAlt = $derived(
		ogReadoutText
			? `${formatBtc($btcAmount)} buys ${ogReadoutText} of ${ogCommodityName}`
			: 'Bitcoin Weigh-In — BTC purchasing power in physical commodities'
	);

	onMount(async () => {
		// Beehiiv loader self-positions (sticky-bottom). Append to body so
		// the script governs its own placement rather than getting trapped
		// inside an inline container. Defer to idle — the subscribe form is
		// below the fold and not needed for first paint; injecting the
		// script during onMount adds ~30 ms to the TBT measurement window.
		const BEEHIIV_ID = '6a25c97c-4b00-4c3e-9ed4-cb25c2db7be2';
		const insertBeehiiv = () => {
			if (document.querySelector(`script[data-beehiiv-form="${BEEHIIV_ID}"]`)) return;
			const s = document.createElement('script');
			s.async = true;
			s.src = 'https://subscribe-forms.beehiiv.com/v3/loader.js';
			s.setAttribute('data-beehiiv-form', BEEHIIV_ID);
			document.body.appendChild(s);
		};
		if (typeof requestIdleCallback === 'function') {
			requestIdleCallback(insertBeehiiv, { timeout: 4000 });
		} else {
			setTimeout(insertBeehiiv, 1500);
		}

		// Background load of the full archive so the slider/preset can
		// reach historical dates. Initial render already has today's
		// prices inlined; this fills in the rest.
		const res = await fetch('/prices.json');
		const archive: PriceData = await res.json();
		prices = archive;
		const dates = Object.keys(archive).sort();
		firstDate = dates[0];
		lastDate = dates[dates.length - 1];

		// URL params come in after the archive arrives so the requested date
		// is guaranteed to be in `prices`. A brief flicker on deep-links is
		// the cost of avoiding an SSR/client hydration mismatch.
		hydrateFromUrl(lastDate);
	});
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={pageDescription} />
	<link rel="canonical" href="https://bitcoinweighin.com/" />
	<!--
		Open Graph + Twitter cards. The og:image hits the /og-image Pages
		Function (functions/og-image.ts) with the current slider state, so
		share previews reflect the URL's btc / date / commodity params.
		Defaults bake into the prerendered HTML for non-JS crawlers; the
		reactive bindings update for JS-aware crawlers and post-hydration.
	-->
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Bitcoin Weigh-In" />
	<meta property="og:title" content={ogTitle} />
	<meta property="og:description" content={ogDescription} />
	<meta property="og:url" content={ogPageUrl} />
	<meta property="og:image" content={ogImageUrl} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={ogImageAlt} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={ogTitle} />
	<meta name="twitter:description" content={ogDescription} />
	<meta name="twitter:image" content={ogImageUrl} />
	<!-- Structured data: WebSite + Organization + WebPage + FAQPage + BreadcrumbList. Stable across daily rebuilds so Google's structured-data cache stays warm. -->
	{@html `<script type="application/ld+json">${websiteJsonLd()}</script>`}
	{@html `<script type="application/ld+json">${organizationJsonLd()}</script>`}
	{@html `<script type="application/ld+json">${webPageJsonLd({ url: 'https://bitcoinweighin.com/', name: pageTitle, description: pageDescription })}</script>`}
	{@html `<script type="application/ld+json">${faqJsonLd(HOMEPAGE_FAQS)}</script>`}
	{@html `<script type="application/ld+json">${breadcrumbJsonLd([{ name: 'Home', url: 'https://bitcoinweighin.com/' }])}</script>`}
</svelte:head>

<div class="min-h-screen bg-zinc-950 text-zinc-100">
	<!-- Compact pinned bar — slides in once user has scrolled past the full controls. -->
	<div class="sticky-bar" class:visible={showStickyBar} aria-hidden={!showStickyBar}>
		<div class="mx-auto flex h-11 max-w-2xl items-center gap-3 px-4">
			<span class="min-w-[3.25rem] whitespace-nowrap font-mono text-xs text-amber-400">
				{sliderMode === 'btc' ? formatBtc($btcAmount) : formatBtc(lockedBtcForDateMode)}
			</span>
			<div
				class="slider-wrap slider-wrap--below flex-1 min-w-0"
				data-tooltip={sliderMode === 'btc' ? 'double-click to lock BTC amount and change date' : 'double-click to lock date and change BTC amount'}
			>
				<input
					type="range"
					min="0"
					max={SLIDER_STEPS}
					value={sliderPos}
					oninput={handleSliderInput}
					ondblclick={handleSliderDblClick}
					class="w-full"
					class:accent-amber-500={sliderMode === 'btc'}
					class:accent-sky-400={sliderMode === 'date'}
					aria-label={sliderMode === 'btc' ? 'BTC amount' : 'Date'}
					tabindex={showStickyBar ? 0 : -1}
				/>
			</div>
			{#if sliderMode === 'btc'}
				{#if dayPrices}
					<span class="min-w-[4.5rem] whitespace-nowrap text-right font-mono text-xs text-zinc-200">
						{formatUsd($btcAmount * dayPrices.btc)}
					</span>
				{/if}
			{:else}
				<span class="min-w-[4.5rem] whitespace-nowrap text-right font-mono text-xs text-zinc-200">
					{formatDateReadout($selectedDate)}
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
				<picture>
					<source
						srcset="/header@1x.webp 1x, /header.webp 2x"
						type="image/webp"
					/>
					<img
						src="/header.jpg"
						alt="Bitcoin Weigh-In"
						width="960"
						height="340"
						fetchpriority="high"
						decoding="async"
						class="brand__mark"
					/>
				</picture>
				<h1 class="brand__h1">
					Bitcoin's purchasing power in physical commodities
				</h1>
				<p class="brand__subtitle">
					How much gold, silver, oil or plutonium does 1 BTC buy? Live ratios, daily, since 2013.
				</p>
			</a>
			<div class="header-pills">
				<PresetBar activePresetId={$activePreset} onSelect={handlePresetSelect} />
			</div>
		</header>
	</div>

	<div class="mx-auto mt-8 max-w-2xl px-4">
			<!-- Controls — two-row compact panel (~120px tall) -->
			<div class="controls-panel">
				<div class="controls-slider">
					<div
						class="slider-wrap"
						data-tooltip={sliderMode === 'btc' ? 'double-click to lock BTC amount and change date' : 'double-click to lock date and change BTC amount'}
					>
						<input
							type="range"
							min="0"
							max={SLIDER_STEPS}
							value={sliderPos}
							oninput={handleSliderInput}
							ondblclick={handleSliderDblClick}
							class="slider"
							class:accent-amber-500={sliderMode === 'btc'}
							class:accent-sky-400={sliderMode === 'date'}
							aria-label={sliderMode === 'btc' ? 'BTC amount' : 'Date'}
						/>
					</div>
					<div class="slider-range">
						{#if sliderMode === 'btc'}
							<span>1 sat</span>
							<span>21M</span>
						{:else}
							<span>{firstDate ? firstDate.slice(0, 4) : ''}</span>
							<span>Today</span>
						{/if}
					</div>
				</div>

				<div class="controls-value-row">
					<div class="value-block">
						{#if sliderMode === 'btc'}
							<div class="value-btc">{formatBtc($btcAmount)}</div>
							{#if dayPrices}
								<div class="value-context">
									{formatUsd($btcAmount * dayPrices.btc)} · {formatDateReadout($selectedDate)}
								</div>
							{/if}
						{:else}
							<div class="value-btc">{formatDateReadout($selectedDate)}</div>
							{#if dayPrices}
								<div class="value-context">
									{formatBtc(lockedBtcForDateMode)} locked · {formatUsd(lockedBtcForDateMode * dayPrices.btc)}
								</div>
							{:else}
								<div class="value-context">{formatBtc(lockedBtcForDateMode)} locked</div>
							{/if}
						{/if}
					</div>
					{#if sliderMode === 'date'}
						<div class="mode-badge">DATE</div>
					{/if}
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
			<NetworkWeightPanel />
			<!-- BitCubePanel hidden pending redesign — component in src/lib/components/BitCubePanel.svelte -->
			<!-- <BitCubePanel
				btcAmount={$btcAmount}
				circulatingSupply={dayPrices?.btc_supply ?? 19_923_600}
			/> -->
			{#each commodityAmounts as { commodity, amount }, i (commodity.id)}
				<LazyCommoditySection
					{commodity}
					{amount}
					btcAmount={$btcAmount}
					btcUsdPrice={dayPrices?.btc ?? 0}
					{prices}
					priority={i === 0}
				/>
			{/each}
		</div>

		<!--
			SEO + AI-bot surface. The visible copy intentionally mirrors the
			FAQPage JSON-LD verbatim — Google penalises FAQ structured data
			whose answers aren't visible on the page. Keep this block
			crawlable (no hidden display, no JS gate) and edit copy via
			$lib/seo/faqs.ts so the JSON-LD stays in lockstep.
		-->
		<section aria-labelledby="about-heading" class="seo-section">
			<div class="mx-auto max-w-3xl px-4 py-12 sm:py-16">
				<h2 id="about-heading" class="seo-section__h2">
					Bitcoin in things you can hold
				</h2>
				<p class="seo-section__p">
					<strong>Bitcoin Weigh-In</strong> answers a question that's harder than it looks: what
					does <em>one bitcoin</em> actually buy, expressed as something you could pick up off a
					table? The site renders a single BTC's purchasing power as physical commodities —
					gold, silver, plutonium-238, cocaine — at <em>true relative scale</em>, next to a
					constant 9-kg Shiba Inu so the eye has somewhere to land. Move the slider and the cube
					grows or shrinks; scrub the date and you can watch a bitcoin's weight in gold drift
					across thirteen years of market history.
				</p>
				<p class="seo-section__p">
					Under the hood is a public, daily-updated dataset of commodity prices in BTC going
					back to 2 January 2013, sourced from stooq and FRED with deterministic BTC supply
					computed from the protocol's halving schedule. The
					<a href="/data" class="seo-link">dataset is CC-BY-4.0</a> and ships as CSV, JSON,
					NDJSON and Parquet — useful if you're doing your own bitcoin-vs-commodities analysis.
					The <a href="/methodology" class="seo-link">methodology page</a> documents every
					source, every forward-fill rule, and the cross-validation pipeline that flags
					provider disagreements above 0.5%.
				</p>

				<h2 class="seo-section__h2">Per-commodity deep-dives</h2>
				<p class="seo-section__p">
					Each launch commodity has its own page with the live ratio, market context,
					and FAQ:
				</p>
				<ul class="seo-cards">
					<li>
						<a href="/btc/gold" class="seo-card">
							<span class="seo-card__title">BTC → Gold</span>
							<span class="seo-card__sub">How much gold does 1 BTC buy?</span>
						</a>
					</li>
					<li>
						<a href="/btc/silver" class="seo-card">
							<span class="seo-card__title">BTC → Silver</span>
							<span class="seo-card__sub">Troy ounces of silver per bitcoin.</span>
						</a>
					</li>
					<li>
						<a href="/btc/pu238" class="seo-card">
							<span class="seo-card__title">BTC → Plutonium-238</span>
							<span class="seo-card__sub">The radioisotope that powers spacecraft.</span>
						</a>
					</li>
					<li>
						<a href="/btc/cocaine" class="seo-card">
							<span class="seo-card__title">BTC → Cocaine</span>
							<span class="seo-card__sub">Wholesale, producer, retail tiers.</span>
						</a>
					</li>
				</ul>

				<h2 class="seo-section__h2">Free, citable, machine-readable</h2>
				<p class="seo-section__p">
					The full daily archive (BTC, gold, silver, platinum, copper, Brent crude,
					wheat, coffee — 2013-present) is published under
					<a
						href="https://creativecommons.org/licenses/by/4.0/"
						class="seo-link">Creative Commons CC-BY-4.0</a
					>
					at <a href="/data" class="seo-link">/data</a> in CSV, JSON, NDJSON, and
					Parquet. Cite as <em>Bitcoin Weigh-In Daily Commodity Price Dataset</em>;
					attribution is the only restriction. The
					<a href="/methodology" class="seo-link">methodology page</a> documents every
					source, every forward-fill rule, and the cross-validation pipeline. Browse
					historical purchasing power year-by-year at
					<a href="/snapshot" class="seo-link">/snapshot</a>.
				</p>

				<h2 class="seo-section__h2">Frequently asked questions</h2>
				<dl class="seo-faq">
					{#each HOMEPAGE_FAQS as faq (faq.question)}
						<dt class="seo-faq__q">{faq.question}</dt>
						<dd class="seo-faq__a">{faq.answer}</dd>
					{/each}
				</dl>
			</div>
		</section>
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
	.slider-wrap {
		position: relative;
		width: 100%;
	}
	.slider-wrap::after {
		content: attr(data-tooltip);
		position: absolute;
		bottom: calc(100% + 6px);
		left: 50%;
		transform: translateX(-50%) translateY(4px);
		background: #27272a; /* zinc-800 */
		color: #a1a1aa;
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-size: 11px;
		padding: 4px 8px;
		border-radius: 4px;
		white-space: nowrap;
		pointer-events: none;
		opacity: 0;
		transition: opacity 150ms ease, transform 150ms ease;
		border: 1px solid #3f3f46; /* zinc-700 */
		z-index: 10;
	}
	.slider-wrap:hover::after {
		opacity: 1;
		transform: translateX(-50%) translateY(0);
	}
	.slider-wrap--below::after {
		bottom: auto;
		top: calc(100% + 6px);
		transform: translateX(-50%) translateY(-4px);
	}
	.slider-wrap--below:hover::after {
		transform: translateX(-50%) translateY(0);
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
	.mode-badge {
		flex-shrink: 0;
		align-self: flex-end;
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: #71717a; /* zinc-500 */
		background: #27272a; /* zinc-800 */
		border: 1px solid #3f3f46; /* zinc-700 */
		border-radius: 4px;
		padding: 4px 7px;
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
	.brand__h1 {
		margin: 6px 0 0;
		font-size: 18px;
		font-weight: 600;
		line-height: 1.25;
		color: #f5f0e6;
		letter-spacing: -0.005em;
		text-wrap: balance;
	}
	@media (min-width: 768px) {
		.brand__h1 {
			font-size: 20px;
		}
	}
	.brand__subtitle {
		margin: 0;
		color: #9aa0a6;
		font-size: 14px;
		font-weight: 400;
		line-height: 1.35;
		text-wrap: balance;
	}
	.seo-section {
		border-top: 1px solid #27272a; /* zinc-800 */
		background: #09090b; /* zinc-950 */
	}
	.seo-section__h2 {
		font-size: 1.25rem;
		font-weight: 600;
		color: #f5f0e6;
		margin: 2rem 0 0.75rem;
		letter-spacing: -0.01em;
		text-wrap: balance;
	}
	.seo-section__h2:first-of-type {
		margin-top: 0;
	}
	.seo-section__p {
		font-size: 0.9375rem;
		line-height: 1.65;
		color: #a1a1aa; /* zinc-400 */
		margin: 0.6rem 0;
	}
	.seo-section__p strong {
		color: #e4e4e7; /* zinc-200 */
		font-weight: 600;
	}
	.seo-link {
		color: #f5f0e6;
		text-decoration: underline;
		text-decoration-color: #71717a;
		text-underline-offset: 2px;
	}
	.seo-link:hover {
		text-decoration-color: #f5f0e6;
	}
	.seo-cards {
		list-style: none;
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.6rem;
		margin: 0.5rem 0 0;
		padding: 0;
	}
	@media (min-width: 640px) {
		.seo-cards {
			grid-template-columns: 1fr 1fr;
		}
	}
	.seo-card {
		display: block;
		padding: 0.85rem 1rem;
		border: 1px solid #27272a; /* zinc-800 */
		border-radius: 6px;
		text-decoration: none;
		transition: border-color 150ms ease, background 150ms ease;
		background: #18181b; /* zinc-900 */
	}
	.seo-card:hover {
		border-color: #a16207; /* amber-700 */
		background: #1c1917;
	}
	.seo-card__title {
		display: block;
		color: #f5f0e6;
		font-weight: 600;
		font-size: 0.9375rem;
	}
	.seo-card__sub {
		display: block;
		margin-top: 0.15rem;
		color: #a1a1aa;
		font-size: 0.85rem;
	}
	.seo-faq {
		margin: 0.5rem 0 0;
	}
	.seo-faq__q {
		font-size: 0.9375rem;
		font-weight: 600;
		color: #e4e4e7;
		margin-top: 1.25rem;
		text-wrap: balance;
	}
	.seo-faq__a {
		margin: 0.35rem 0 0;
		font-size: 0.9rem;
		line-height: 1.6;
		color: #a1a1aa;
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
