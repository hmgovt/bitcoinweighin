<script lang="ts">
	/**
	 * Homepage teaser for /power-law, styled as a pair with MiningStrip below
	 * it. All numbers and paths are computed at build time
	 * (src/lib/server/power-law-teaser.ts), so this is static markup.
	 */
	import type { PowerLawTeaser } from '$lib/server/power-law-teaser.js';

	let { teaser }: { teaser: PowerLawTeaser } = $props();

	const c = $derived(teaser.chart);
	const year = $derived(teaser.millionAt ? new Date(teaser.millionAt).getUTCFullYear() : null);

	const fmtMonth = (t: number) =>
		new Date(t).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
	function fmtUsd(v: number): string {
		if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
		return `$${Math.round(v).toLocaleString('en-US')}`;
	}
</script>

<a class="pl" href="/power-law" data-umami-event="home-power-law-strip">
	<div class="pl-copy">
		<p class="pl-eyebrow"><span>New</span> · Power-law model</p>
		<h2 class="pl-title">{year ? `$1 million by ${year}?` : '$1 million bitcoin?'}</h2>
		<p class="pl-body">
			Fit bitcoin's price to a power law plus two repeating waves, and the curve
			{#if teaser.millionAt}
				crosses <strong>$1M in {fmtMonth(teaser.millionAt)}</strong>{#if teaser.peak}, then peaks near
					<strong>{fmtUsd(teaser.peak.price)}</strong> in {fmtMonth(teaser.peak.t)}{/if}.
			{:else}
				keeps climbing.
			{/if}
			Latest close: <strong>{fmtUsd(teaser.latest.btc)}</strong>. Drag the model out to 2100
			and see where it goes.
		</p>
		<span class="pl-cta">Explore the model <span class="pl-arrow" aria-hidden="true">→</span></span>
		<p class="pl-fine">
			Curve fitting, not financial advice. Model by Stephen Perrenod, via @CaffeSatoshi.
		</p>
	</div>

	<div class="pl-media">
		<svg
			viewBox="0 0 {c.w} {c.h}"
			role="img"
			aria-label={teaser.millionAt
				? `Chart: bitcoin price history and the power-law model, which reaches $1 million in ${fmtMonth(teaser.millionAt)}`
				: 'Chart: bitcoin price history and the power-law model'}
		>
			<rect x={c.todayX} y="0" width={c.w - c.todayX} height={c.h - 18} class="pl-future" />
			<line x1="0" x2={c.w} y1={c.millionY} y2={c.millionY} class="pl-million" />
			<text x="6" y={c.millionY - 5} class="pl-label">$1M</text>
			<path d={c.trend} class="pl-trend" />
			<path d={c.actual} class="pl-actual" />
			<path d={c.forecast} class="pl-forecast" />
			{#if c.dot}
				<circle cx={c.dot.x} cy={c.dot.y} r="4.5" class="pl-dot" />
			{/if}
			{#each c.years as yr}
				<text x={yr.x} y={c.h - 4} text-anchor="middle" class="pl-label">{yr.label}</text>
			{/each}
		</svg>
		<div class="pl-legend" aria-hidden="true">
			<span><i class="k-actual"></i>BTC price</span>
			<span><i class="k-forecast"></i>Model</span>
			<span><i class="k-trend"></i>Power-law trend</span>
		</div>
	</div>
</a>

<style>
	/* Same card as MiningStrip so the two read as a pair; media on the right
	   to alternate with the miner card below. */
	.pl {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 20px;
		background: #09090b;
		border-radius: 12px;
		padding: 28px 24px;
		color: inherit;
		text-decoration: none;
	}
	@media (min-width: 768px) {
		.pl {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
			gap: 32px;
			align-items: center;
		}
	}
	.pl-media {
		background: #0e0e11;
		border-radius: 10px;
		box-shadow: 0 0 0 1px #27272a;
		padding: 14px 14px 10px;
	}
	.pl-media svg {
		display: block;
		width: 100%;
		height: auto;
	}
	.pl-future { fill: #18181b; }
	.pl-million { stroke: #fbbf24; stroke-width: 1; stroke-dasharray: 3 4; opacity: 0.7; }
	.pl-trend { fill: none; stroke: #9085e9; stroke-width: 1.25; opacity: 0.7; }
	.pl-actual { fill: none; stroke: #f97316; stroke-width: 1.75; stroke-linejoin: round; }
	.pl-forecast { fill: none; stroke: #34d399; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
	.pl-dot { fill: #fbbf24; stroke: #0e0e11; stroke-width: 2; }
	.pl-label {
		font: 9px 'JetBrains Mono', ui-monospace, monospace;
		fill: #71717a;
	}
	.pl-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
		margin-top: 8px;
		font: 10px/1.4 'JetBrains Mono', ui-monospace, monospace;
		color: #a1a1aa;
	}
	.pl-legend i {
		display: inline-block;
		width: 12px;
		height: 2px;
		margin-right: 6px;
		vertical-align: 3px;
	}
	.k-actual { background: #f97316; }
	.k-forecast { background: #34d399; }
	.k-trend { background: #9085e9; }
	.pl-eyebrow {
		font: 700 10px/1 'JetBrains Mono', ui-monospace, monospace;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #71717a;
		margin: 0 0 10px;
	}
	.pl-eyebrow span { color: #fbbf24; }
	.pl-title {
		font-family: 'Inter Tight', 'Inter', sans-serif;
		font-size: 30px;
		font-weight: 600;
		line-height: 1.1;
		letter-spacing: -0.02em;
		color: #f4f4f5;
		margin: 0;
		text-wrap: balance;
	}
	.pl-body { font-size: 14px; line-height: 1.55; color: #a1a1aa; margin: 10px 0 0; max-width: 46ch; }
	.pl-body strong { color: #e4e4e7; font-weight: 600; }
	.pl-cta {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		margin-top: 20px;
		font: 600 14px 'Inter Tight', 'Inter', sans-serif;
		color: #09090b;
		background: #fbbf24;
		border-radius: 8px;
		padding: 10px 16px;
	}
	.pl-fine {
		font: 10px/1.5 'JetBrains Mono', ui-monospace, monospace;
		color: #52525b;
		margin: 14px 0 0;
	}
	.pl-arrow { transition: transform 200ms ease; }
	.pl:hover .pl-arrow { transform: translateX(4px); }
	.pl:focus-visible { outline: 2px solid #fbbf24; outline-offset: 6px; border-radius: 12px; }
	@media (prefers-reduced-motion: reduce) {
		.pl-arrow { transition: none; }
	}
</style>
