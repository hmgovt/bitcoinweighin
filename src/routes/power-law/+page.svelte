<script lang="ts">
	import { onMount } from 'svelte';
	import { breadcrumbJsonLd, webPageJsonLd } from '$lib/seo/jsonld.js';
	import {
		evaluate,
		forecastPeaks,
		LAMBDA_1,
		LAMBDA_2,
		FIT_YEARS,
		type ModelValues,
	} from '$lib/power-law.js';

	let { data } = $props();

	const title = 'Bitcoin Power Law & Log-Periodic Oscillations · Bitcoin Weigh-In';
	const description =
		'BTC/USD plotted against the Dacoinminster and Perrenod power laws, with two log-periodic oscillations fitted to the last five years. Extend the model out to 2100.';
	const url = 'https://bitcoinweighin.com/power-law';

	// ── Horizon ──────────────────────────────────────────────────────
	const MIN_YEAR = 2030;
	const MAX_YEAR = 2100;
	const DEFAULT_YEAR = 2032;
	const PRESETS = [2030, 2035, 2040, 2050, 2075, 2100];
	let endYear = $state(DEFAULT_YEAR);

	onMount(() => {
		const q = Number(new URLSearchParams(location.search).get('to'));
		if (Number.isInteger(q) && q >= MIN_YEAR && q <= MAX_YEAR) endYear = q;
	});

	function setYear(y: number) {
		endYear = Math.max(MIN_YEAR, Math.min(MAX_YEAR, Math.round(y)));
		const u = new URL(location.href);
		if (endYear === DEFAULT_YEAR) u.searchParams.delete('to');
		else u.searchParams.set('to', String(endYear));
		history.replaceState(history.state, '', u);
	}

	// ── Series ───────────────────────────────────────────────────────
	type Key = 'btc' | keyof ModelValues;
	interface SeriesDef {
		key: Key;
		label: string;
		short: string;
		color: string;
		width: number;
		dash?: string;
	}
	// Colour follows the entity and never changes when others are toggled.
	const SERIES: SeriesDef[] = [
		{ key: 'btc', label: 'Bitcoin actual price', short: 'BTC', color: 'var(--s-btc)', width: 2 },
		{ key: 'combined', label: 'Combined model', short: 'Combined', color: 'var(--s-combined)', width: 2.5 },
		{ key: 'perrenod', label: 'Perrenod global power law', short: 'Perrenod', color: 'var(--s-perrenod)', width: 1.75 },
		{ key: 'dacoinminster', label: 'Dacoinminster power law', short: 'Dacoinminster', color: 'var(--s-dacoin)', width: 1.75 },
		{ key: 'oscillation1', label: `Oscillation 1 (λ = ${LAMBDA_1})`, short: 'Osc 1', color: 'var(--s-osc1)', width: 1.5 },
		{ key: 'oscillation2', label: `Oscillation 2 (λ = ${LAMBDA_2})`, short: 'Osc 2', color: 'var(--s-osc2)', width: 1.5 },
		{ key: 'average', label: 'Average of three models', short: 'Average', color: 'var(--s-avg)', width: 1.75, dash: '6 4' },
	];
	let visible = $state<Record<Key, boolean>>({
		btc: true,
		combined: true,
		perrenod: true,
		dacoinminster: true,
		oscillation1: false,
		oscillation2: false,
		average: false,
	});
	const shown = $derived(SERIES.filter((s) => visible[s.key]));

	// ── Model samples (weekly, first close → end of horizon) ─────────
	const WEEK = 7 * 86_400_000;
	const t0 = $derived(data.actual[0][0]);
	const t1 = $derived(Date.UTC(endYear, 11, 31));

	const model = $derived.by(() => {
		const out: { t: number; v: ModelValues }[] = [];
		for (let t = t0; t <= t1; t += WEEK) out.push({ t, v: evaluate(t, data.coefficients) });
		out.push({ t: t1, v: evaluate(t1, data.coefficients) });
		return out;
	});

	const peaks = $derived(forecastPeaks(data.fitEnd, t1, data.coefficients));

	// Label a peak only when it clears the last labelled one horizontally;
	// the rest keep their dot and appear in the table below the chart.
	const labelledPeaks = $derived.by(() => {
		const out = new Set<number>();
		let lastX = -Infinity;
		for (const pk of peaks) {
			const px = x(pk.t);
			if (px - lastX >= 72) {
				out.add(pk.t);
				lastX = px;
			}
		}
		return out;
	});

	// ── Scales ───────────────────────────────────────────────────────
	let width = $state(860);
	const W = $derived(Math.max(320, width));
	const H = $derived(W < 560 ? 340 : 480);
	const PAD = $derived({ l: W < 560 ? 44 : 56, r: W < 560 ? 12 : 104, t: 16, b: 28 });
	const IW = $derived(W - PAD.l - PAD.r);
	const IH = $derived(H - PAD.t - PAD.b);

	const yDomain = $derived.by(() => {
		let lo = Infinity;
		let hi = -Infinity;
		const take = (v: number) => {
			if (v > 0 && Number.isFinite(v)) {
				lo = Math.min(lo, v);
				hi = Math.max(hi, v);
			}
		};
		if (visible.btc) for (const [, v] of data.actual) take(v);
		for (const s of shown) {
			if (s.key === 'btc') continue;
			for (const m of model) take(m.v[s.key as keyof ModelValues]);
		}
		if (!Number.isFinite(lo)) {
			lo = 1;
			hi = 1e6;
		}
		// Extra top headroom in log space so the two-line peak labels fit.
		const span = Math.log10(hi) - Math.log10(lo);
		return [Math.log10(lo) - 0.1, Math.log10(hi) + 0.15 + span * 0.06];
	});

	const x = (t: number) => PAD.l + ((t - t0) / (t1 - t0)) * IW;
	const y = (v: number) =>
		PAD.t + IH - ((Math.log10(v) - yDomain[0]) / (yDomain[1] - yDomain[0])) * IH;

	function path(pts: [number, number][]): string {
		let d = '';
		for (const [t, v] of pts) {
			if (!(v > 0)) continue;
			d += `${d ? 'L' : 'M'}${x(t).toFixed(1)},${y(v).toFixed(1)}`;
		}
		return d;
	}

	const paths = $derived(
		shown.map((s) => ({
			s,
			d:
				s.key === 'btc'
					? path(data.actual)
					: path(model.map((m) => [m.t, m.v[s.key as keyof ModelValues]] as [number, number])),
		}))
	);

	// Direct labels at the right edge, nudged apart so they don't collide.
	const endLabels = $derived.by(() => {
		if (W < 560) return [];
		const items = shown.map((s) => {
			const v =
				s.key === 'btc' ? data.latest.btc : model[model.length - 1].v[s.key as keyof ModelValues];
			const xx = s.key === 'btc' ? x(data.latest.t) : x(t1);
			return { s, x: xx, y: y(v), ly: y(v) };
		});
		const sorted = [...items].sort((a, b) => a.ly - b.ly);
		for (let i = 1; i < sorted.length; i++) {
			if (sorted[i].ly - sorted[i - 1].ly < 13) sorted[i].ly = sorted[i - 1].ly + 13;
		}
		return items.filter((i) => i.s.key !== 'btc');
	});

	const yTicks = $derived.by(() => {
		const out: number[] = [];
		const step = yDomain[1] - yDomain[0] > 9 ? 2 : 1;
		for (let e = Math.ceil(yDomain[0]); e <= Math.floor(yDomain[1]); e += step) out.push(e);
		return out;
	});

	const xTicks = $derived.by(() => {
		const y0 = new Date(t0).getUTCFullYear() + 1;
		const span = endYear - y0;
		const narrow = W < 560;
		const step =
			span > 60 ? (narrow ? 20 : 10) : span > 30 ? (narrow ? 10 : 5) : narrow ? 4 : 2;
		const out: number[] = [];
		for (let yr = Math.ceil(y0 / step) * step; yr <= endYear; yr += step) out.push(yr);
		return out;
	});

	// ── Formatting ───────────────────────────────────────────────────
	function fmtUsd(v: number): string {
		if (v >= 1e12) return `$${(v / 1e12).toPrecision(3)}T`;
		if (v >= 1e9) return `$${(v / 1e9).toPrecision(3)}B`;
		if (v >= 1e6) return `$${(v / 1e6).toPrecision(3)}M`;
		if (v >= 1e4) return `$${Math.round(v / 1e3)}k`;
		if (v >= 100) return `$${Math.round(v).toLocaleString('en-US')}`;
		return `$${v.toPrecision(3)}`;
	}
	function fmtTick(e: number): string {
		return fmtUsd(10 ** e).replace(/\.0+(?=[kMBT]|$)/, '');
	}
	const fmtDate = (t: number) =>
		new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
	const fmtFull = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;

	// ── Hover ────────────────────────────────────────────────────────
	let svgEl: SVGSVGElement | undefined = $state();
	let hoverT = $state<number | null>(null);

	function onMove(e: PointerEvent) {
		if (!svgEl) return;
		const r = svgEl.getBoundingClientRect();
		const px = ((e.clientX - r.left) / r.width) * W;
		const f = (px - PAD.l) / IW;
		if (f < 0 || f > 1) {
			hoverT = null;
			return;
		}
		hoverT = t0 + f * (t1 - t0);
	}

	const hover = $derived.by(() => {
		if (hoverT === null) return null;
		const t = Date.UTC(
			new Date(hoverT).getUTCFullYear(),
			new Date(hoverT).getUTCMonth(),
			new Date(hoverT).getUTCDate()
		);
		const m = evaluate(t, data.coefficients);
		let btc: number | null = null;
		if (t <= data.latest.t) {
			let best = data.actual[0];
			for (const p of data.actual) if (Math.abs(p[0] - t) < Math.abs(best[0] - t)) best = p;
			btc = best[1];
		}
		const rows = shown
			.map((s) => ({ s, v: s.key === 'btc' ? btc : m[s.key as keyof ModelValues] }))
			.filter((r): r is { s: SeriesDef; v: number } => r.v !== null);
		return { t, x: x(t), rows };
	});

	const fitStartX = $derived(x(data.fitStart));
	const fitEndX = $derived(x(data.fitEnd));
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
	<meta property="og:image" content="https://bitcoinweighin.com/og-image" />
	<meta name="twitter:card" content="summary_large_image" />
	{@html `<script type="application/ld+json">${webPageJsonLd({ url, name: title, description })}</script>`}
	{@html `<script type="application/ld+json">${breadcrumbJsonLd([
		{ name: 'Home', url: 'https://bitcoinweighin.com/' },
		{ name: 'Power law', url },
	])}</script>`}
</svelte:head>

<div class="pl-page">
	<main class="mx-auto max-w-5xl px-4 py-8 text-zinc-800">
		<nav aria-label="Breadcrumb" class="mb-4 text-xs text-zinc-500">
			<a href="/" class="hover:text-zinc-800 hover:underline">Home</a>
			<span class="mx-1">›</span>
			<span class="text-zinc-700">Power law</span>
		</nav>

		<header class="mb-6 border-b border-zinc-200 pb-6">
			<h1 class="text-2xl font-semibold tracking-tight">
				Bitcoin: power laws and log-periodic oscillations
			</h1>
			<p class="mt-2 max-w-3xl text-sm text-zinc-600">
				BTC/USD on a log scale against two published power-law trend lines, plus two log-periodic
				waves least-squares fitted to the last {FIT_YEARS} years of prices. The fit is recomputed
				with every daily data update. Drag the slider to run the curves out past 2030.
			</p>
		</header>

		<section class="stats" aria-label="Model summary">
			<div class="stat">
				<div class="stat__label">Latest close · {fmtDate(data.latest.t)}</div>
				<div class="stat__value">{fmtFull(data.latest.btc)}</div>
			</div>
			<div class="stat">
				<div class="stat__label">Combined model, 2029–30 peak</div>
				<div class="stat__value">{fmtFull(data.notebookPeak.price)}</div>
				<div class="stat__sub">{fmtDate(data.notebookPeak.t)}</div>
			</div>
			<div class="stat">
				<div class="stat__label">Combined model at end of {endYear}</div>
				<div class="stat__value">{fmtUsd(model[model.length - 1].v.combined)}</div>
				<div class="stat__sub">Perrenod baseline {fmtUsd(model[model.length - 1].v.perrenod)}</div>
			</div>
		</section>

		<div class="controls">
			<label class="horizon">
				<span class="horizon__label">Extend to <strong>{endYear}</strong></span>
				<input
					type="range"
					min={MIN_YEAR}
					max={MAX_YEAR}
					step="1"
					value={endYear}
					oninput={(e) => setYear(Number(e.currentTarget.value))}
					aria-label="Forecast horizon end year"
				/>
			</label>
			<div class="presets" role="group" aria-label="Horizon presets">
				{#each PRESETS as p}
					<button
						type="button"
						class:active={endYear === p}
						aria-pressed={endYear === p}
						onclick={() => setYear(p)}>{p}</button
					>
				{/each}
			</div>
		</div>

		<div class="legend" role="group" aria-label="Toggle series">
			{#each SERIES as s}
				<button
					type="button"
					class="legend__item"
					class:off={!visible[s.key]}
					aria-pressed={visible[s.key]}
					onclick={() => (visible[s.key] = !visible[s.key])}
				>
					<svg width="22" height="10" aria-hidden="true">
						<line x1="1" y1="5" x2="21" y2="5" stroke={s.color} stroke-width="2.5" stroke-dasharray={s.dash ?? ''} stroke-linecap="round" />
					</svg>
					{s.label}
				</button>
			{/each}
		</div>

		<div class="chart" bind:clientWidth={width}>
			<svg
				bind:this={svgEl}
				viewBox="0 0 {W} {H}"
				width={W}
				height={H}
				role="img"
				aria-label="Bitcoin price versus power-law and oscillation models, log scale, through {endYear}"
				onpointermove={onMove}
				onpointerleave={() => (hoverT = null)}
			>
				<!-- forecast region -->
				<rect x={fitEndX} y={PAD.t} width={Math.max(0, PAD.l + IW - fitEndX)} height={IH} fill="var(--forecast)" />
				<text x={fitEndX + 6} y={PAD.t + 12} class="axis-text">forecast →</text>

				<!-- grid -->
				{#each yTicks as e}
					<line x1={PAD.l} x2={PAD.l + IW} y1={y(10 ** e)} y2={y(10 ** e)} stroke="var(--grid)" />
					<text x={PAD.l - 6} y={y(10 ** e) + 4} text-anchor="end" class="axis-text">{fmtTick(e)}</text>
				{/each}
				{#each xTicks as yr}
					{@const xx = x(Date.UTC(yr, 0, 1))}
					<line x1={xx} x2={xx} y1={PAD.t + IH} y2={PAD.t + IH + 4} stroke="var(--axis)" />
					<text x={xx} y={H - 8} text-anchor="middle" class="axis-text">{yr}</text>
				{/each}
				<line x1={PAD.l} x2={PAD.l + IW} y1={PAD.t + IH} y2={PAD.t + IH} stroke="var(--axis)" />

				<!-- fit window -->
				<line x1={fitStartX} x2={fitStartX} y1={PAD.t} y2={PAD.t + IH} stroke="var(--axis)" stroke-dasharray="2 3" />
				<line x1={fitEndX} x2={fitEndX} y1={PAD.t} y2={PAD.t + IH} stroke="var(--axis)" stroke-dasharray="2 3" />
				<text x={(fitStartX + fitEndX) / 2} y={PAD.t + IH - 6} text-anchor="middle" class="axis-text">fit window</text>

				<!-- series -->
				<g fill="none" stroke-linejoin="round" stroke-linecap="round">
					{#each paths as { s, d } (s.key)}
						<path {d} stroke={s.color} stroke-width={s.width} stroke-dasharray={s.dash ?? ''} />
					{/each}
				</g>

				<!-- forecast peaks of the combined curve -->
				{#if visible.combined}
					{#each peaks as pk}
						{@const px = x(pk.t)}
						{@const py = y(pk.price)}
						<circle cx={px} cy={py} r="4.5" fill="var(--peak)" stroke="var(--surface)" stroke-width="2" />
						{#if labelledPeaks.has(pk.t)}
							<text x={px} y={py - 18} text-anchor="middle" class="peak-text">{fmtUsd(pk.price)}</text>
							<text x={px} y={py - 7} text-anchor="middle" class="peak-sub">{new Date(pk.t).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })}</text>
						{/if}
					{/each}
				{/if}

				<!-- direct labels -->
				{#each endLabels as l (l.s.key)}
					<text x={PAD.l + IW + 6} y={l.ly + 4} class="end-label">{l.s.short}</text>
				{/each}

				<!-- hover -->
				{#if hover}
					<line x1={hover.x} x2={hover.x} y1={PAD.t} y2={PAD.t + IH} stroke="var(--text-2)" stroke-width="1" />
					{#each hover.rows as r}
						<circle cx={hover.x} cy={y(r.v)} r="4" fill={r.s.color} stroke="var(--surface)" stroke-width="2" />
					{/each}
				{/if}
			</svg>

			{#if hover}
				<div
					class="tooltip"
					style="left: {(hover.x / W) * 100}%; transform: translateX({hover.x > W / 2 ? 'calc(-100% - 12px)' : '12px'});"
				>
					<div class="tooltip__date">{fmtDate(hover.t)}{hover.t > data.fitEnd ? ' · model' : ''}</div>
					{#each [...hover.rows].sort((a, b) => b.v - a.v) as r}
						<div class="tooltip__row">
							<span class="swatch" style="background: {r.s.color}"></span>
							<span class="tooltip__name">{r.s.short}</span>
							<span class="tooltip__val">{fmtUsd(r.v)}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		{#if peaks.length}
			<details class="peaks">
				<summary>Combined-model peaks through {endYear} ({peaks.length})</summary>
				<table>
					<thead><tr><th>Date</th><th>Combined model</th><th>vs Perrenod baseline</th></tr></thead>
					<tbody>
						{#each peaks as pk}
							{@const base = evaluate(pk.t, data.coefficients).perrenod}
							<tr>
								<td>{fmtDate(pk.t)}</td>
								<td>{fmtFull(pk.price)}</td>
								<td>{(pk.price / base).toFixed(2)}×</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</details>
		{/if}

		<section class="notes">
			<h2>How the model works</h2>
			<p>
				Two power laws in Bitcoin's age give the trend. <strong>Dacoinminster</strong>:
				price = 4.42×10<sup>−17</sup> × days<sup>5.6</sup>, with days counted from the genesis block
				(3 Jan 2009). <strong>Perrenod</strong>: price = 0.00688 × years<sup>5.848</sup>.
			</p>
			<p>
				On top of the Perrenod line sit two log-periodic waves, cos/sin(ω ln t) with
				ω = 2π / ln λ, for λ₁ = {LAMBDA_1} and λ₂ = {LAMBDA_2}. Each cycle is λ times longer than
				the one before, so the swings stretch out as Bitcoin ages. Their amplitudes and phases come
				from an ordinary least-squares fit of log₁₀(price ÷ Perrenod) over {fmtDate(data.fitStart)}
				to {fmtDate(data.fitEnd)}. "Combined" applies both waves; "Average" is the mean of Oscillation
				1, Oscillation 2 and Combined.
			</p>
			<p class="caveat">
				This is curve fitting, not a prediction, and it is not financial advice. The waves are fitted
				to five years of data and then extrapolated, often for decades. Small changes to the fit window
				move the forecast peaks by months and by large amounts of money. A power law can't keep going
				forever either: by 2100 the Perrenod line alone passes {fmtUsd(evaluate(Date.UTC(2100, 11, 31), data.coefficients).perrenod)}
				per coin.
			</p>
			<p class="text-xs text-zinc-500">
				Prices from the <a href="/data" class="underline hover:no-underline">Bitcoin Weigh-In dataset</a>.
				Adapted from a community notebook.
			</p>
		</section>
	</main>
</div>

<style>
	.pl-page {
		--surface: #fcfcfb;
		--text-1: #0b0b0b;
		--text-2: #52514e;
		--grid: #ecebe7;
		--axis: #a3a29c;
		--forecast: #f4f3ef;
		--peak: #e34948;
		--s-btc: #eb6834;
		--s-combined: #1baf7a;
		--s-perrenod: #6250d6;
		--s-dacoin: #2a78d6;
		--s-osc1: #e87ba4;
		--s-osc2: #eda100;
		--s-avg: #008300;
	}
	.pl-page :global(body) {
		background: #fafafa;
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.75rem;
		margin-bottom: 1.25rem;
	}
	.stat {
		border: 1px solid #e4e4e7;
		background: var(--surface);
		padding: 0.75rem 1rem;
	}
	.stat__label {
		font-size: 0.75rem;
		color: var(--text-2);
	}
	.stat__value {
		font-size: 1.5rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--text-1);
	}
	.stat__sub {
		font-size: 0.75rem;
		color: var(--text-2);
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 1.25rem;
		margin-bottom: 0.75rem;
	}
	.horizon {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex: 1 1 260px;
		font-size: 0.875rem;
	}
	.horizon__label {
		white-space: nowrap;
		min-width: 8.5rem;
	}
	.horizon input {
		flex: 1;
		accent-color: var(--s-combined);
	}
	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}
	.presets button {
		font-size: 0.75rem;
		padding: 0.25rem 0.6rem;
		border: 1px solid #d4d4d8;
		background: white;
		color: var(--text-2);
		font-variant-numeric: tabular-nums;
	}
	.presets button.active {
		background: var(--text-1);
		border-color: var(--text-1);
		color: white;
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.5rem;
		margin-bottom: 0.5rem;
	}
	.legend__item {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.75rem;
		color: var(--text-1);
		padding: 0.2rem 0.4rem;
		border: 1px solid transparent;
	}
	.legend__item:hover {
		border-color: #e4e4e7;
	}
	.legend__item.off {
		color: #a1a1aa;
	}
	.legend__item.off svg {
		opacity: 0.3;
	}
	.chart {
		position: relative;
		background: var(--surface);
		border: 1px solid #e4e4e7;
		touch-action: pan-y;
	}
	.chart svg {
		display: block;
		width: 100%;
		height: auto;
	}
	.axis-text {
		font-size: 11px;
		fill: var(--text-2);
		font-variant-numeric: tabular-nums;
	}
	.end-label {
		font-size: 11px;
		fill: var(--text-2);
	}
	.peak-text {
		font-size: 11px;
		font-weight: 600;
		fill: var(--text-1);
		paint-order: stroke;
		stroke: var(--surface);
		stroke-width: 3px;
	}
	.peak-sub {
		font-size: 10px;
		fill: var(--text-2);
		paint-order: stroke;
		stroke: var(--surface);
		stroke-width: 3px;
	}
	.tooltip {
		position: absolute;
		top: 12px;
		pointer-events: none;
		background: white;
		border: 1px solid #e4e4e7;
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.08);
		padding: 0.5rem 0.65rem;
		font-size: 0.75rem;
		min-width: 170px;
	}
	.tooltip__date {
		color: var(--text-2);
		margin-bottom: 0.25rem;
	}
	.tooltip__row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.tooltip__name {
		flex: 1;
		color: var(--text-1);
	}
	.tooltip__val {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		color: var(--text-1);
	}
	.swatch {
		width: 8px;
		height: 8px;
		border-radius: 2px;
	}
	.peaks {
		margin-top: 1rem;
		font-size: 0.875rem;
	}
	.peaks summary {
		cursor: pointer;
		color: var(--text-2);
	}
	.peaks table {
		margin-top: 0.5rem;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}
	.peaks th,
	.peaks td {
		text-align: left;
		padding: 0.25rem 1.25rem 0.25rem 0;
		border-bottom: 1px solid #e4e4e7;
	}
	.peaks th {
		font-weight: 500;
		color: var(--text-2);
	}
	.notes {
		margin-top: 2rem;
		max-width: 48rem;
		font-size: 0.9rem;
		line-height: 1.6;
	}
	.notes h2 {
		font-size: 1.1rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
	}
	.notes p {
		margin-bottom: 0.75rem;
	}
	.caveat {
		border-left: 3px solid #eda100;
		padding-left: 0.75rem;
		color: var(--text-2);
	}
</style>
