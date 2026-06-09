<script lang="ts">
	import { breadcrumbJsonLd, webPageJsonLd } from '$lib/seo/jsonld.js';

	let { data } = $props();
	const s = data.summary;

	const url = `https://bitcoinweighin.com/snapshot/${s.year}`;
	const title = `Bitcoin in ${s.year}: BTC → Gold, Silver & USD Through the Year · Bitcoin Weigh-In`;
	const description = `What did 1 bitcoin buy in ${s.year}? BTC went from ${formatUsd(s.btcStart)} to ${formatUsd(s.btcEnd)} (${formatPct(s.btcChangePct)}) — see month-by-month closes against gold, silver, and USD.`;

	function formatUsd(n: number): string {
		if (n >= 1000) return '$' + Math.round(n).toLocaleString('en-US');
		if (n >= 1) return '$' + n.toFixed(2);
		return '$' + n.toFixed(4);
	}

	function formatTroyOz(n: number | null): string {
		if (n === null) return '—';
		if (n >= 1000) return Math.round(n).toLocaleString('en-US') + ' oz';
		if (n >= 1) return n.toFixed(2) + ' oz';
		return n.toPrecision(3) + ' oz';
	}

	function formatPct(n: number): string {
		const sign = n >= 0 ? '+' : '';
		return `${sign}${n.toFixed(1)}%`;
	}

	function formatMonth(yyyymm: string): string {
		const [y, m] = yyyymm.split('-');
		const months = [
			'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
			'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
		];
		return `${months[Number(m) - 1]} ${y}`;
	}
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={url} />
	{#if data.prevYear !== null}
		<link rel="prev" href={`https://bitcoinweighin.com/snapshot/${data.prevYear}`} />
	{/if}
	{#if data.nextYear !== null}
		<link rel="next" href={`https://bitcoinweighin.com/snapshot/${data.nextYear}`} />
	{/if}

	<meta property="og:type" content="article" />
	<meta property="og:site_name" content="Bitcoin Weigh-In" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />

	{@html `<script type="application/ld+json">${webPageJsonLd({ url, name: title, description })}</script>`}
	{@html `<script type="application/ld+json">${breadcrumbJsonLd([
		{ name: 'Home', url: 'https://bitcoinweighin.com/' },
		{ name: 'Snapshots', url: 'https://bitcoinweighin.com/snapshot' },
		{ name: String(s.year), url },
	])}</script>`}
</svelte:head>

<div class="snapshot-page">
	<main class="mx-auto max-w-3xl px-4 py-8 text-zinc-800">
		<nav aria-label="Breadcrumb" class="mb-4 text-xs text-zinc-500">
			<a href="/" class="hover:text-zinc-800 hover:underline">Home</a>
			<span class="mx-1">›</span>
			<a href="/snapshot" class="hover:text-zinc-800 hover:underline">Snapshots</a>
			<span class="mx-1">›</span>
			<span class="text-zinc-700">{s.year}</span>
		</nav>

		<header class="mb-8 border-b border-zinc-200 pb-6">
			<h1 class="text-2xl font-semibold tracking-tight">
				Bitcoin's purchasing power in {s.year}
			</h1>
			<p class="mt-2 text-sm text-zinc-600">
				BTC opened {s.year} at {formatUsd(s.btcStart)} and closed at
				{formatUsd(s.btcEnd)} (<strong
					class={s.btcChangePct >= 0 ? 'pos' : 'neg'}>{formatPct(s.btcChangePct)}</strong
				> on the year). Over {s.tradingDays} trading days, BTC ranged from
				{formatUsd(s.btcLow)} (low) to {formatUsd(s.btcHigh)} (high).
			</p>
		</header>

		<section class="mb-10">
			<h2 class="prose-h2">Bitcoin in commodities, {s.year} open vs close</h2>
			<dl class="endpoints">
				<div>
					<dt>1 BTC → gold</dt>
					<dd>{formatTroyOz(s.btcInGoldStart)} → {formatTroyOz(s.btcInGoldEnd)}</dd>
				</div>
				<div>
					<dt>1 BTC → silver</dt>
					<dd>{formatTroyOz(s.btcInSilverStart)} → {formatTroyOz(s.btcInSilverEnd)}</dd>
				</div>
				<div>
					<dt>BTC USD high / low</dt>
					<dd>{formatUsd(s.btcHigh)} / {formatUsd(s.btcLow)}</dd>
				</div>
			</dl>
		</section>

		<section class="mb-10">
			<h2 class="prose-h2">Month-by-month closes</h2>
			<p class="prose-p">
				Each row uses the last available trading day of the month for the
				BTC/USD, BTC/XAU, and BTC/XAG ratios.
			</p>
			<div class="overflow-x-auto">
				<table class="w-full border-collapse text-sm">
					<thead>
						<tr class="border-b border-zinc-300 text-left">
							<th class="py-2 pr-4 font-medium text-zinc-600">Month-end</th>
							<th class="py-2 pr-4 text-right font-medium text-zinc-600">
								BTC USD
							</th>
							<th class="py-2 pr-4 text-right font-medium text-zinc-600">
								1 BTC in gold
							</th>
							<th class="py-2 pr-4 text-right font-medium text-zinc-600">
								1 BTC in silver
							</th>
						</tr>
					</thead>
					<tbody>
						{#each s.months as m (m.month)}
							<tr class="border-b border-zinc-100">
								<td class="py-1.5 pr-4 text-zinc-700">{formatMonth(m.month)}</td>
								<td class="py-1.5 pr-4 text-right font-mono tabular-nums">
									{formatUsd(m.btcUsd)}
								</td>
								<td class="py-1.5 pr-4 text-right font-mono tabular-nums">
									{formatTroyOz(m.btcInGold)}
								</td>
								<td class="py-1.5 pr-4 text-right font-mono tabular-nums">
									{formatTroyOz(m.btcInSilver)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>

		<nav class="year-nav">
			{#if data.prevYear !== null}
				<a href={`/snapshot/${data.prevYear}`} class="year-nav__link">
					← {data.prevYear}
				</a>
			{:else}
				<span></span>
			{/if}
			<a href="/snapshot" class="year-nav__index">All years</a>
			{#if data.nextYear !== null}
				<a href={`/snapshot/${data.nextYear}`} class="year-nav__link">
					{data.nextYear} →
				</a>
			{:else}
				<span></span>
			{/if}
		</nav>

		<footer class="mt-12 border-t border-zinc-200 pt-6 text-sm text-zinc-600">
			<p>
				Numbers above come from the
				<a href="/data" class="underline hover:no-underline">free daily dataset</a>
				(CC-BY-4.0). See
				<a href="/methodology" class="underline hover:no-underline">/methodology</a>
				for source and forward-fill rules. For the live ratio today, open
				<a href="/" class="underline hover:no-underline">the homepage</a> or
				<a href="/btc/gold" class="underline hover:no-underline">/btc/gold</a>.
			</p>
		</footer>
	</main>
</div>

<style>
	.snapshot-page :global(body) {
		background: #fafafa;
	}
	.prose-h2 {
		font-size: 1.125rem;
		font-weight: 600;
		margin: 1rem 0 0.75rem;
		color: #18181b;
	}
	.prose-p {
		font-size: 0.9375rem;
		line-height: 1.6;
		margin: 0.5rem 0;
		color: #3f3f46;
	}
	.endpoints {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
		margin: 0;
	}
	@media (min-width: 640px) {
		.endpoints {
			grid-template-columns: 1fr 1fr 1fr;
		}
	}
	.endpoints > div {
		padding: 0.75rem 1rem;
		border: 1px solid #e4e4e7;
		border-radius: 6px;
		background: #ffffff;
	}
	.endpoints dt {
		font-size: 0.75rem;
		color: #71717a;
		margin-bottom: 0.2rem;
	}
	.endpoints dd {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: #18181b;
	}
	.pos {
		color: #15803d;
	}
	.neg {
		color: #b91c1c;
	}
	.year-nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		margin-top: 2rem;
		padding-top: 1rem;
		border-top: 1px solid #e4e4e7;
	}
	.year-nav__link {
		font-size: 0.9375rem;
		color: #3f3f46;
		text-decoration: none;
		font-weight: 600;
	}
	.year-nav__link:hover {
		color: #a16207;
	}
	.year-nav__index {
		font-size: 0.8125rem;
		color: #71717a;
		text-decoration: underline;
	}
</style>
