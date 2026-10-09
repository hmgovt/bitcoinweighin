<!-- src/routes/clip/oil/+page.svelte -->
<script lang="ts">
	/**
	 * /clip/oil — "What does bitcoin buy in oil?", the long-form vertical
	 * video, played on the real oil stage. Not a page for people:
	 * scripts/clips/make-oil-clip.ts opens it at 540×960, calls
	 * window.__clipStart() once the stage is ready, and screenshots it frame
	 * by frame on a virtual clock. The timeline is $lib/clips/oilClip.ts.
	 *
	 *   ?date=<YYYY-MM-DD>   the close to use; default the latest in /prices.json
	 */
	import { onMount } from 'svelte';
	import OilStage from '$lib/scene/OilStage.svelte';
	import BrandMark from '$lib/components/brand/BrandMark.svelte';
	import holdings from '$lib/entity-holdings.json';
	import { BEATS, clipFrame, stopBtc, stopLitres, type OilClipInputs } from '$lib/clips/oilClip.js';
	import {
		DRUM_L,
		LITRES_PER_BARREL,
		LITRES_PER_GALLON,
		PRUDHOE_L,
		VLCC_L,
		formatBarrels,
		formatSpan,
		worldSeconds,
	} from '$lib/oil.js';
	import { formatNum } from '$lib/format.js';

	let ready = $state(false);
	let t = $state(0);
	let inputs = $state<OilClipInputs | null>(null);
	let date = $state('');

	const holder = (slug: string) => holdings.entities.find((e) => e.slug === slug)!.btc;

	const f = $derived(inputs ? clipFrame(t, inputs) : null);

	// ── Words ───────────────────────────────────────────────────────
	const n0 = (x: number) => Math.round(x).toLocaleString('en-US');
	const pct = (x: number) => `${x >= 0.1 ? Math.round(x * 100) : formatNum(x * 100)}%`;
	const usd = (x: number) => `$${x.toFixed(2)}`;
	const L = (key: Parameters<typeof stopLitres>[0], fuel: Parameters<typeof stopLitres>[1] = 'crude') =>
		inputs ? stopLitres(key, fuel, inputs) : 0;
	const span = (litres: number) => formatSpan(worldSeconds(litres));
	const tankers = (litres: number) =>
		litres < VLCC_L * 0.995 ? `${pct(litres / VLCC_L)} of a supertanker` : `${formatNum(litres / VLCC_L)} supertankers`;
	const dateLabel = (d: string, long = true) =>
		d
			? new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', {
					...(long ? { day: 'numeric' } : {}),
					month: 'short',
					year: 'numeric',
					timeZone: 'UTC',
				})
			: '';

	const words = $derived.by(() => {
		const i = inputs;
		if (!i) return null;
		const sat = L('sat') * 1000; // mL
		const one = L('one');
		const all = L('all');
		const prudhoe = all / PRUDHOE_L;
		const gas = L('gasoline', 'gasoline');
		const diesel = L('diesel', 'diesel');
		const crudePerL = i.brent / LITRES_PER_BARREL;
		const gasPerL = i.gasoline / LITRES_PER_GALLON;
		const peak = i.history.reduce((a, b) => (b.barrels > a.barrels ? b : a), i.history[0]);
		const first = i.history[0];
		const last = i.history[i.history.length - 1];
		return {
			sat: {
				h: `<span class="or">1 sat</span> buys ${formatNum(sat)} mL of crude oil`,
				sub: `About ${Math.round(sat / 0.05)} drops. A sat is a hundred-millionth of a bitcoin.`,
			},
			tank: {
				h: `<span class="or">${n0(stopBtc('tank', i) * 1e8)} sats</span> fill a car’s tank`,
				sub: `A 55-litre (14.5-gallon) tank of Brent crude, at ${usd(i.brent)} a barrel. (A car can’t burn crude. Hold that thought.)`,
			},
			one: {
				h: `<span class="or">1 bitcoin</span> buys ${formatBarrels(one / LITRES_PER_BARREL)}`,
				sub: `${n0(one / DRUM_L)} 55-gallon drums of crude. The world burns through it in ${span(one)}.`,
			},
			thousand: {
				h: `<span class="or">1,000 BTC</span>: ${tankers(L('thousand'))}`,
				sub: `A VLCC is 330 metres long and carries about 2 million barrels. The world burns this much in ${span(L('thousand'))}.`,
			},
			elSalvador: {
				h: `<span class="or">El Salvador’s ${n0(i.elSalvadorBtc)} BTC</span>: ${tankers(L('elSalvador'))}`,
				sub: `${formatBarrels(L('elSalvador') / LITRES_PER_BARREL)} of crude. The world burns it in ${span(L('elSalvador'))}.`,
			},
			strategy: {
				h: `<span class="or">Strategy’s ${n0(i.strategyBtc)} BTC</span>: ${pct(L('strategy') / PRUDHOE_L)} of Prudhoe Bay`,
				sub: `North America’s biggest oil field has produced 13.2 billion barrels since 1977. This is ${tankers(L('strategy'))}.`,
			},
			all: {
				h: `<span class="or">All 21 million bitcoin</span>: ${formatBarrels(all / LITRES_PER_BARREL)}`,
				sub: `${prudhoe >= 0.995 ? 'About all of Prudhoe Bay' : `${pct(prudhoe)} of Prudhoe Bay`}. The whole world burns it in ${span(all)}.`,
			},
			noCrude: {
				h: 'But you can’t put crude in a car.',
				sub: 'Back to 1 bitcoin. Brent is a wholesale price, before refining, shipping and tax.',
			},
			gasoline: {
				h: `At the pump, <span class="or">1 BTC</span> buys ${n0(gas / LITRES_PER_GALLON)} gallons of gasoline`,
				sub: `${n0(gas / DRUM_L)} drums, not ${n0(one / DRUM_L)}: a litre of gasoline costs ${(gasPerL / crudePerL).toFixed(1)}× a litre of crude.`,
			},
			diesel: {
				h: `…or <span class="or">${n0(diesel / LITRES_PER_GALLON)} gallons</span> of diesel`,
				sub: `Diesel is dearer: ${usd(i.diesel)} a gallon against ${usd(i.gasoline)} for gasoline. US averages, taxes in.`,
			},
			history: {
				h: `1 BTC in barrels of crude, <span class="or">2013 → today</span>`,
				sub: `${dateLabel(first.date, false)}: ${formatNum(first.barrels)} barrels, about a jerrycan. Peak: ${n0(peak.barrels)} in ${dateLabel(peak.date, false)}. Now: ${n0(last.barrels)}.`,
			},
		};
	});

	// ── The chart: barrels per BTC, log scale ───────────────────────
	const CW = 460;
	const CH = 250;
	const Y0 = 0.05;
	const Y1 = 5000;
	const yOf = (b: number) => CH - ((Math.log10(Math.max(b, Y0)) - Math.log10(Y0)) / (Math.log10(Y1) - Math.log10(Y0))) * CH;
	const chartPath = $derived.by(() => {
		const h = inputs?.history ?? [];
		if (h.length < 2) return '';
		return h.map((p, k) => `${k ? 'L' : 'M'}${((k / (h.length - 1)) * CW).toFixed(1)},${yOf(p.barrels).toFixed(1)}`).join('');
	});
	const chartDot = $derived.by(() => {
		const h = inputs?.history ?? [];
		if (!f || h.length < 2) return null;
		const x = f.historyProgress * (h.length - 1);
		const k = Math.min(h.length - 1, Math.round(x));
		return { x: (x / (h.length - 1)) * CW, y: yOf(h[k].barrels), barrels: h[k].barrels };
	});

	onMount(() => {
		const q = new URLSearchParams(location.search);
		void fetch('/prices.json')
			.then((r) => r.json())
			.then((rows: Record<string, Record<string, number>>) => {
				const dates = Object.keys(rows).sort();
				const want = q.get('date');
				const d = want && rows[want] ? want : [...dates].reverse().find((x) => rows[x].brent && rows[x].gasoline && rows[x].diesel)!;
				const day = rows[d];
				// Weekly points for the history line (plus the last day), enough for a 460-px chart.
				const history: { date: string; barrels: number }[] = [];
				dates
					.filter((x) => x <= d && rows[x].brent && rows[x].btc)
					.forEach((x, k, all) => {
						if (k % 7 === 0 || k === all.length - 1) history.push({ date: x, barrels: rows[x].btc / rows[x].brent });
					});
				date = d;
				inputs = {
					btcUsd: day.btc,
					brent: day.brent,
					gasoline: day.gasoline,
					diesel: day.diesel,
					elSalvadorBtc: holder('el-salvador'),
					strategyBtc: holder('strategy'),
					history,
				};
			});

		let t0: number | null = null;
		let raf = 0;
		const w = window as unknown as {
			__clipStart: () => void;
			__clipReady: () => boolean;
			__clipDuration: number;
			__clipOpaque: () => boolean;
		};
		w.__clipStart = () => (t0 = performance.now());
		w.__clipReady = () => ready && inputs !== null;
		w.__clipDuration = BEATS.duration;
		w.__clipOpaque = () => {
			if (t0 === null || !inputs) return false;
			const c = clipFrame((performance.now() - t0) / 1000, inputs);
			return c.hook >= 1 || c.endCard >= 1;
		};
		const tick = () => {
			raf = requestAnimationFrame(tick);
			if (t0 !== null) t = (performance.now() - t0) / 1000;
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
</script>

<svelte:head>
	<title>Clip · Oil</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="clip" class:history={f?.stop === 'history'}>
	<div class="stage">
		<OilStage litres={f?.litres ?? 0} bind:ready />
	</div>

	{#if f && words}
		<div class="top" style:opacity={f.headline}>
			<p class="h">{@html words[f.stop].h}</p>
			<p class="sub">{words[f.stop].sub}</p>
		</div>

		<div class="chart" style:opacity={f.chart}>
			<svg viewBox="-34 -14 {CW + 48} {CH + 40}" aria-hidden="true">
				{#each [0.1, 1, 10, 100, 1000] as g (g)}
					<line x1="0" x2={CW} y1={yOf(g)} y2={yOf(g)} class="grid" />
					<text x="-6" y={yOf(g) + 4} class="tick" text-anchor="end">{g >= 1 ? g.toLocaleString('en-US') : g}</text>
				{/each}
				<clipPath id="drawn"><rect x="-2" y="-20" width={(chartDot?.x ?? 0) + 2} height={CH + 40} /></clipPath>
				<path d={chartPath} class="line" clip-path="url(#drawn)" />
				{#if chartDot}
					<circle cx={chartDot.x} cy={chartDot.y} r="6" class="dot" />
				{/if}
				<text x="0" y={CH + 22} class="tick">2013</text>
				<text x={CW} y={CH + 22} class="tick" text-anchor="end">{date.slice(0, 4)}</text>
			</svg>
			<div class="c-read">
				<span class="c-date">{dateLabel(f.historyDate)}</span>
				<span class="c-bbl">{chartDot ? formatNum(chartDot.barrels) : ''} barrels</span>
			</div>
		</div>

		<div class="footer" style:opacity={f.footer}>
			BTC ${n0(inputs!.btcUsd)} · Brent {usd(inputs!.brent)}/bbl (FRED) · US pump: gasoline {usd(inputs!.gasoline)}, diesel
			{usd(inputs!.diesel)}/gal (EIA weekly) · {dateLabel(date)} close
		</div>

		<div class="card hook" style:opacity={f.hook}>
			<p class="k-lead">One bitcoin buys</p>
			<p class="k-big">{formatBarrels(stopLitres('one', 'crude', inputs!) / LITRES_PER_BARREL)} of oil</p>
			<p class="k-sub">So what does that look like? From one sat to all 21 million.</p>
		</div>

		<div class="card end" style:opacity={f.endCard}>
			<BrandMark size={84} />
			<p class="e-url">bitcoinweighin.com</p>
			<p class="e-sub">Weigh any amount of bitcoin in crude, diesel or gasoline. And gold, cash, Manhattan…</p>
		</div>
	{/if}
</div>

<style>
	:global(body) {
		background: #000;
		margin: 0;
	}
	.clip {
		position: fixed;
		inset: 0;
		z-index: 100;
		background: #18181b;
		overflow: hidden;
		font-family: 'Inter Tight', system-ui, sans-serif;
		color: #fafafa;
	}
	.stage,
	.stage :global(.oil-stage) {
		position: absolute;
		inset: 0;
		height: 100% !important;
		border-radius: 0 !important;
	}
	/* The stage's own caption says what the next headline says; its gauge moves below the stage's subject. */
	.stage :global(.oil-caption) {
		display: none;
	}
	.stage :global(.oil-gauge) {
		top: auto !important;
		bottom: 92px !important;
		left: 24px !important;
		width: 190px !important;
	}
	.history .stage :global(.oil-gauge) {
		display: none !important;
	}
	.card {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		text-align: center;
		padding: 0 40px;
		background: #0b0b0d;
		z-index: 3;
	}
	.card p {
		margin: 0;
	}
	.k-lead {
		font-size: 26px;
		font-weight: 500;
		color: #a1a1aa;
	}
	.k-big {
		font-size: 56px;
		font-weight: 800;
		letter-spacing: -0.03em;
		line-height: 1.04;
		margin: 14px 0 22px !important;
		color: #f7931a;
		text-wrap: balance;
	}
	.k-sub {
		font-size: 20px;
		color: #d4d4d8;
		max-width: 20em;
		text-wrap: balance;
	}
	.top {
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		padding: 60px 32px 90px;
		background: linear-gradient(#18181bf2 0%, #18181bd0 58%, #18181b00 100%);
		z-index: 2;
	}
	.top p {
		margin: 0;
	}
	.h {
		font-size: 34px;
		font-weight: 700;
		line-height: 1.14;
		letter-spacing: -0.02em;
		text-wrap: balance;
	}
	.h :global(.or) {
		color: #f7931a;
	}
	.sub {
		margin-top: 12px !important;
		font-size: 19px;
		font-weight: 500;
		line-height: 1.35;
		color: #d4d4d8;
		text-wrap: pretty;
	}
	.chart {
		position: absolute;
		left: 20px;
		right: 20px;
		bottom: 92px;
		padding: 16px 14px 12px;
		border-radius: 14px;
		background: #0b0b0de6;
		border: 1px solid #27272a;
		z-index: 2;
	}
	.chart svg {
		display: block;
		width: 100%;
		height: auto;
	}
	.grid {
		stroke: #27272a;
		stroke-width: 1;
	}
	.tick {
		font: 500 12px 'JetBrains Mono', ui-monospace, monospace;
		fill: #71717a;
	}
	.line {
		fill: none;
		stroke: #f7931a;
		stroke-width: 3;
		stroke-linejoin: round;
	}
	.dot {
		fill: #fafafa;
		stroke: #f7931a;
		stroke-width: 3;
	}
	.c-read {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-top: 8px;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-variant-numeric: tabular-nums;
	}
	.c-date {
		font-size: 17px;
		color: #a1a1aa;
	}
	.c-bbl {
		font-size: 26px;
		font-weight: 600;
		color: #f7931a;
	}
	.footer {
		position: absolute;
		left: 20px;
		right: 20px;
		bottom: 18px;
		padding: 8px 10px;
		border-radius: 8px;
		background: #0b0b0dc0;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 11px;
		line-height: 1.5;
		color: #a1a1aa;
		z-index: 2;
	}
	.e-url {
		margin-top: 22px !important;
		font-size: 36px;
		font-weight: 700;
		letter-spacing: -0.02em;
	}
	.e-sub {
		margin-top: 12px !important;
		font-size: 19px;
		color: #a1a1aa;
		max-width: 21em;
		text-wrap: balance;
	}
</style>
