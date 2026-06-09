<script lang="ts">
	import {
		breadcrumbJsonLd,
		faqJsonLd,
		webPageJsonLd,
	} from '$lib/seo/jsonld.js';
	import CommodityPoster from '$lib/components/CommodityPoster.svelte';

	let { data } = $props();

	const canonicalUrl = `https://bitcoinweighin.com/btc/${data.commodityId}`;
	const homeUrl = 'https://bitcoinweighin.com/';
	const deeplinkHref = `/?commodity=${data.commodityId}`;
	const btcUsdFormatted =
		'$' + Math.round(data.btcUsd).toLocaleString('en-US') + ' USD';
	// Posters render for cube-mode commodities only (gold, silver, pu238).
	// Still-with-readout commodities (cocaine) keep the amber callout
	// because their homepage panel is a different visual idiom that
	// doesn't translate to a single sprite.
	const showPoster = data.renderStyle === 'cube' && data.amount !== null;
</script>

<svelte:head>
	<title>{data.title}</title>
	<meta name="description" content={data.metaDescription} />
	<link rel="canonical" href={canonicalUrl} />

	<meta property="og:type" content="article" />
	<meta property="og:site_name" content="Bitcoin Weigh-In" />
	<meta property="og:title" content={data.title} />
	<meta property="og:description" content={data.metaDescription} />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:image" content={`https://bitcoinweighin.com/og-image?btc=1&commodity=${data.commodityId}`} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={data.title} />
	<meta name="twitter:description" content={data.metaDescription} />
	<meta name="twitter:image" content={`https://bitcoinweighin.com/og-image?btc=1&commodity=${data.commodityId}`} />

	{@html `<script type="application/ld+json">${webPageJsonLd({ url: canonicalUrl, name: data.title, description: data.metaDescription })}</script>`}
	{@html `<script type="application/ld+json">${faqJsonLd(data.faqs)}</script>`}
	{@html `<script type="application/ld+json">${breadcrumbJsonLd([
		{ name: 'Home', url: homeUrl },
		{ name: `BTC → ${data.displayName}`, url: canonicalUrl },
	])}</script>`}
</svelte:head>

<div class="commodity-page">
	<main class="mx-auto max-w-3xl px-4 py-8 text-zinc-800">
		<nav aria-label="Breadcrumb" class="mb-4 text-xs text-zinc-500">
			<a href="/" class="hover:text-zinc-800 hover:underline">Home</a>
			<span class="mx-1">›</span>
			<span class="text-zinc-700">BTC → {data.displayName}</span>
		</nav>

		<header class="mb-8 border-b border-zinc-200 pb-6">
			<h1 class="text-2xl font-semibold tracking-tight">{data.h1}</h1>
			<div class="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
				<div class="text-3xl font-semibold tabular-nums tracking-tight text-amber-700">
					1 BTC ≈ {data.ratio}
				</div>
				<div class="text-sm text-zinc-500">
					at {btcUsdFormatted} · {data.date}
				</div>
			</div>
			{#if data.dataQuality === 'illustrative'}
				<p class="mt-3 text-sm text-zinc-600">
					<strong>Illustrative price.</strong> This commodity has no public spot market;
					the figure is a composite estimate sourced from public reports — see
					<a href="/methodology" class="underline hover:no-underline">/methodology</a>.
				</p>
			{/if}
		</header>

		{#each data.intro as paragraph (paragraph)}
			<p class="prose-p">{@html paragraph}</p>
		{/each}

		{#if showPoster}
			<div class="poster-wrap my-8">
				<CommodityPoster
					commodity={data.commodity}
					amount={data.amount ?? 0}
					btcUsdPrice={data.btcUsd}
				/>
				<p class="poster-cta">
					<a href={deeplinkHref} class="poster-cta__link"
						>Open the interactive viewer →</a
					>
					— scrub the slider from 1 sat to 21 M BTC, or drag the date back to
					2013 to see how the cube grows and shrinks across history.
				</p>
			</div>
		{:else}
			<div class="my-8 rounded border border-amber-200 bg-amber-50 p-4">
				<p class="text-sm">
					<strong>See it at scale.</strong>
					<a href={deeplinkHref} class="underline hover:no-underline"
						>Open the live visualisation</a
					> — the panel renders {data.displayName.toLowerCase()} at true relative
					scale next to a constant 9-kg Shiba Inu, with a slider scrubbing
					through BTC amounts from 1 sat to 21 M BTC.
				</p>
			</div>
		{/if}

		<h2 class="prose-h2">About {data.displayName.toLowerCase()} and bitcoin</h2>
		{#each data.context as paragraph (paragraph)}
			<p class="prose-p">{@html paragraph}</p>
		{/each}

		<h2 class="prose-h2">Frequently asked questions</h2>
		<dl class="prose-faq">
			{#each data.faqs as faq (faq.question)}
				<dt class="prose-faq__q">{faq.question}</dt>
				<dd class="prose-faq__a">{faq.answer}</dd>
			{/each}
		</dl>

		{#if data.relatedPages.length}
			<h2 class="prose-h2">Other commodities</h2>
			<ul class="related-list">
				{#each data.relatedPages as page (page.href)}
					{#if !page.href.endsWith(`/${data.commodityId}`)}
						<li>
							<a href={page.href} class="related-link">{page.label}</a>
						</li>
					{/if}
				{/each}
			</ul>
		{/if}

		<footer class="mt-12 border-t border-zinc-200 pt-6 text-sm text-zinc-600">
			<p>
				Source code and dataset:
				<a href="https://github.com/hmgovt/bitcoinweighin" class="underline hover:no-underline">
					github.com/hmgovt/bitcoinweighin
				</a>. Free dataset (CC-BY-4.0) at
				<a href="/data" class="underline hover:no-underline">/data</a>. Methodology at
				<a href="/methodology" class="underline hover:no-underline">/methodology</a>.
			</p>
		</footer>
	</main>
</div>

<style>
	.commodity-page :global(body) {
		background: #fafafa;
	}
	.poster-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}
	.poster-cta {
		margin: 0;
		font-size: 0.85rem;
		line-height: 1.5;
		color: #52525b;
	}
	.poster-cta__link {
		color: #a16207;
		text-decoration: underline;
		font-weight: 600;
	}
	.poster-cta__link:hover {
		color: #78350f;
	}
	.prose-h2 {
		font-size: 1.125rem;
		font-weight: 600;
		margin: 2rem 0 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid #e4e4e7;
		color: #18181b;
	}
	.prose-p {
		font-size: 0.9375rem;
		line-height: 1.65;
		margin: 0.6rem 0;
		color: #3f3f46;
	}
	.prose-p :global(strong) {
		color: #18181b;
	}
	.prose-faq {
		margin: 0.5rem 0 0;
	}
	.prose-faq__q {
		font-size: 0.9375rem;
		font-weight: 600;
		margin-top: 1.25rem;
		color: #18181b;
	}
	.prose-faq__a {
		margin: 0.35rem 0 0;
		font-size: 0.9rem;
		line-height: 1.6;
		color: #3f3f46;
	}
	.related-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 1rem 0 0;
		padding: 0;
		list-style: none;
	}
	.related-link {
		display: inline-block;
		padding: 0.35rem 0.75rem;
		border: 1px solid #d4d4d8;
		border-radius: 999px;
		font-size: 0.875rem;
		color: #3f3f46;
		text-decoration: none;
	}
	.related-link:hover {
		border-color: #a16207;
		color: #a16207;
	}
</style>
