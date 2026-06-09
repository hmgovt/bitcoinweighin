<script lang="ts">
	import { breadcrumbJsonLd, webPageJsonLd } from '$lib/seo/jsonld.js';

	let { data } = $props();

	const title =
		'Bitcoin Purchasing Power, Year by Year (2013–present) · Bitcoin Weigh-In';
	const description =
		"Yearly snapshots of how much gold, silver, and oil one bitcoin bought, from 2013 to today. Sourced from the public Bitcoin Weigh-In commodity price dataset.";
	const url = 'https://bitcoinweighin.com/snapshot';

	function fmtUsd(n: number): string {
		if (n >= 1000) return '$' + Math.round(n).toLocaleString('en-US');
		return '$' + n.toFixed(2);
	}

	function fmtTroyOz(n: number | null): string {
		if (n === null) return '—';
		if (n >= 1000) return Math.round(n).toLocaleString('en-US') + ' oz';
		if (n >= 1) return n.toFixed(2) + ' oz';
		return n.toPrecision(3) + ' oz';
	}

	function fmtPct(n: number): string {
		const sign = n >= 0 ? '+' : '';
		return `${sign}${n.toFixed(1)}%`;
	}
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={url} />

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Bitcoin Weigh-In" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />

	{@html `<script type="application/ld+json">${webPageJsonLd({ url, name: title, description })}</script>`}
	{@html `<script type="application/ld+json">${breadcrumbJsonLd([
		{ name: 'Home', url: 'https://bitcoinweighin.com/' },
		{ name: 'Snapshots', url },
	])}</script>`}
</svelte:head>

<div class="snapshot-page">
	<main class="mx-auto max-w-3xl px-4 py-8 text-zinc-800">
		<nav aria-label="Breadcrumb" class="mb-4 text-xs text-zinc-500">
			<a href="/" class="hover:text-zinc-800 hover:underline">Home</a>
			<span class="mx-1">›</span>
			<span class="text-zinc-700">Snapshots</span>
		</nav>

		<header class="mb-8 border-b border-zinc-200 pb-6">
			<h1 class="text-2xl font-semibold tracking-tight">
				Bitcoin purchasing power, year by year
			</h1>
			<p class="mt-2 text-sm text-zinc-600">
				What did one bitcoin buy in 2013? In 2017? In 2021? Each year card below
				summarises BTC's USD endpoints and how many troy ounces of gold and silver
				one BTC bought at year-open and year-close. Sourced from the
				<a href="/data" class="underline hover:no-underline">public dataset</a>.
			</p>
		</header>

		<ul class="year-grid">
			{#each data.summaries as s (s.year)}
				<li>
					<a href={`/snapshot/${s.year}`} class="year-card">
						<div class="year-card__year">{s.year}</div>
						<dl class="year-card__stats">
							<div>
								<dt>BTC start → end</dt>
								<dd>{fmtUsd(s.btcStart)} → {fmtUsd(s.btcEnd)}</dd>
								<dd class="year-card__change" class:up={s.btcChangePct >= 0}>
									{fmtPct(s.btcChangePct)}
								</dd>
							</div>
							<div>
								<dt>1 BTC in gold</dt>
								<dd>{fmtTroyOz(s.btcInGoldStart)} → {fmtTroyOz(s.btcInGoldEnd)}</dd>
							</div>
							<div>
								<dt>1 BTC in silver</dt>
								<dd>{fmtTroyOz(s.btcInSilverStart)} → {fmtTroyOz(s.btcInSilverEnd)}</dd>
							</div>
						</dl>
					</a>
				</li>
			{/each}
		</ul>

		<footer class="mt-12 border-t border-zinc-200 pt-6 text-sm text-zinc-600">
			<p>
				Want the underlying numbers? The
				<a href="/data" class="underline hover:no-underline">full daily archive</a>
				is published under CC-BY-4.0 in CSV, JSON, NDJSON, and Parquet.
				<a href="/methodology" class="underline hover:no-underline">/methodology</a>
				documents source, forward-fill, and cross-validation.
			</p>
		</footer>
	</main>
</div>

<style>
	.snapshot-page :global(body) {
		background: #fafafa;
	}
	.year-grid {
		list-style: none;
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
		margin: 0;
		padding: 0;
	}
	@media (min-width: 640px) {
		.year-grid {
			grid-template-columns: 1fr 1fr;
		}
	}
	.year-card {
		display: block;
		padding: 1rem 1.25rem;
		border: 1px solid #e4e4e7;
		border-radius: 8px;
		background: #ffffff;
		text-decoration: none;
		color: #18181b;
		transition: border-color 150ms, transform 150ms;
	}
	.year-card:hover {
		border-color: #a16207;
		transform: translateY(-1px);
	}
	.year-card__year {
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: #18181b;
	}
	.year-card__stats {
		margin: 0.5rem 0 0;
		font-size: 0.8125rem;
		color: #3f3f46;
	}
	.year-card__stats > div {
		margin-top: 0.4rem;
	}
	.year-card__stats dt {
		color: #71717a;
		font-size: 0.75rem;
		margin-bottom: 0.1rem;
	}
	.year-card__stats dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
	}
	.year-card__change {
		font-weight: 600;
		color: #b91c1c;
	}
	.year-card__change.up {
		color: #15803d;
	}
</style>
