<!-- src/routes/clip/oil/+page.svelte -->
<script lang="ts">
	/**
	 * /clip/oil — "What does bitcoin buy in oil?", the vertical video for
	 * TikTok, Reels and Shorts, played on the real oil stage. Not a page for
	 * people: scripts/clips/make-oil-clip.ts opens it at 540×960, calls
	 * window.__clipStart() once the stage is ready, and screenshots it frame
	 * by frame on a virtual clock. The timeline is $lib/clips/oilClip.ts.
	 *
	 * Laid out for the apps' own chrome: captions sit in the upper-middle
	 * band, clear of the top tabs, the right-hand buttons and the bottom
	 * caption area; the stage fills the space below them.
	 *
	 *   ?date=<YYYY-MM-DD>   the close to use; default the latest in /prices.json
	 */
	import { onMount } from 'svelte';
	import OilStage from '$lib/scene/OilStage.svelte';
	import BrandMark from '$lib/components/brand/BrandMark.svelte';
	import holdings from '$lib/entity-holdings.json';
	import { BEATS, clipFrame, stopBtc, stopLitres, type OilClipInputs, type StopKey } from '$lib/clips/oilClip.js';
	import { DRUM_L, LITRES_PER_BARREL, LITRES_PER_GALLON, PRUDHOE_L, VLCC_L, formatSpan, worldSeconds } from '$lib/oil.js';
	import { formatNum } from '$lib/format.js';

	let ready = $state(false);
	let t = $state(0);
	let inputs = $state<OilClipInputs | null>(null);
	let date = $state('');
	/** The highest close in the daily data (not the chart's weekly samples). */
	let peak = $state<{ date: string; barrels: number } | null>(null);

	const holder = (slug: string) => holdings.entities.find((e) => e.slug === slug)!.btc;
	const f = $derived(inputs ? clipFrame(t, inputs) : null);

	// ── Words ───────────────────────────────────────────────────────
	const n0 = (x: number) => Math.round(x).toLocaleString('en-US');
	const pct = (x: number) => `${x >= 0.1 ? Math.round(x * 100) : formatNum(x * 100)}%`;
	const usd = (x: number) => `$${x.toFixed(2)}`;
	/** "13.7 BILLION", "5.09 MILLION", "652". */
	const big = (x: number) =>
		x >= 1e9 ? `${formatNum(x / 1e9)} BILLION` : x >= 1e6 ? `${formatNum(x / 1e6)} MILLION` : n0(x);
	const btcWords = (b: number) =>
		b < 0.01 ? `${n0(b * 1e8)} sats` : b < 10 ? `${b.toFixed(b < 1 ? 3 : 2)} BTC` : `${n0(b)} BTC`;
	const tankers = (L: number) => (L < VLCC_L * 0.995 ? `${pct(L / VLCC_L)} OF A SUPERTANKER` : `${formatNum(L / VLCC_L)} SUPERTANKERS`);
	const monthYear = (d: string) =>
		d ? new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
	const dayLabel = (d: string) =>
		d ? new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';

	type Caption = { kicker?: string; punch: string; small?: string };
	const captions = $derived.by((): Record<StopKey, Caption> | null => {
		const i = inputs;
		if (!i) return null;
		const L = (k: StopKey, fuel: 'crude' | 'gasoline' | 'diesel' = 'crude') => stopLitres(k, fuel, i);
		const one = L('one');
		const all = L('all');
		const prudhoe = all / PRUDHOE_L;
		const first = i.history[0];
		const last = i.history[i.history.length - 1];
		return {
			open: { kicker: 'All the bitcoin that will ever exist', punch: '= ONE OIL FIELD', small: 'Let’s check.' },
			sat: { kicker: '1 sat', punch: `= ${Math.round((L('sat') * 1000) / 0.05)} DROPS`, small: 'of crude oil. One sat is 0.00000001 bitcoin.' },
			tank: {
				kicker: `${n0(stopBtc('tank', i) * 1e8)} sats`,
				punch: '= A FULL TANK',
				small: '55 litres of crude. (Your car can’t burn crude. Hold that thought.)',
			},
			one: {
				kicker: '1 bitcoin',
				punch: `= ${n0(one / LITRES_PER_BARREL)} BARRELS`,
				small: `${n0(one / DRUM_L)} drums. The world burns it in ${formatSpan(worldSeconds(one))}.`,
			},
			thousand: { kicker: '1,000 bitcoin', punch: `= ${tankers(L('thousand'))}`, small: 'A 330-metre VLCC holds 2 million barrels.' },
			elSalvador: {
				kicker: `El Salvador’s ${n0(i.elSalvadorBtc)} BTC`,
				punch: `= ${tankers(L('elSalvador'))}`,
				small: `${formatNum(L('elSalvador') / LITRES_PER_BARREL / 1e6)} million barrels.`,
			},
			strategy: {
				kicker: `Strategy’s ${n0(i.strategyBtc)} BTC`,
				punch: `= ${pct(L('strategy') / PRUDHOE_L)} OF AN OIL FIELD`,
				small: 'Prudhoe Bay, North America’s biggest: 13.2 billion barrels since 1977.',
			},
			all: {
				kicker: 'All 21 million bitcoin',
				punch: `= ${big(all / LITRES_PER_BARREL)} BARRELS`,
				small: `${prudhoe >= 0.995 ? 'All of Prudhoe Bay' : `${pct(prudhoe)} of Prudhoe Bay`}. The world burns it in ${formatSpan(worldSeconds(all))}.`,
			},
			noCrude: { kicker: 'But', punch: 'YOU CAN’T PUT CRUDE IN A CAR', small: 'So: 1 bitcoin at the pump.' },
			gasoline: {
				kicker: '1 bitcoin at the pump',
				punch: `= ${n0(L('gasoline', 'gasoline') / LITRES_PER_GALLON)} GALLONS OF GAS`,
				small: `Not ${n0(one / LITRES_PER_GALLON)}: refining, shipping and tax.`,
			},
			diesel: {
				kicker: 'Or',
				punch: `${n0(L('diesel', 'diesel') / LITRES_PER_GALLON)} GALLONS OF DIESEL`,
				small: `Diesel ${usd(i.diesel)} a gallon. Gas ${usd(i.gasoline)}. US averages, taxes in.`,
			},
			history: {
				kicker: '1 bitcoin, in barrels',
				punch: '2013 → TODAY',
				small: `2013: ${formatNum(first.barrels)}, a jerrycan.${peak ? ` Peak, ${monthYear(peak.date)}: ${n0(peak.barrels)}.` : ''} Now: ${n0(last.barrels)}.`,
			},
			end: { punch: '' },
		};
	});
	const cap = $derived(f && captions ? captions[f.stop] : null);

	// ── The chart: barrels per BTC, log scale ───────────────────────
	const CW = 460;
	const CH = 230;
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
				const daily = dates.filter((x) => x <= d && rows[x].brent && rows[x].btc).map((x) => ({ date: x, barrels: rows[x].btc / rows[x].brent }));
				// Weekly points (plus the last day) draw the line; the peak comes from every day.
				const history = daily.filter((_, k) => k % 7 === 0 || k === daily.length - 1);
				peak = daily.reduce((a, b) => (b.barrels > a.barrels ? b : a), daily[0]);
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
		// Nothing here hides the stage completely: every frame renders.
		w.__clipOpaque = () => false;
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

<div class="clip" class:gauge={f?.stop === 'sat' || f?.stop === 'tank'}>
	<div class="stage">
		<OilStage litres={f?.litres ?? 0} zoom={f?.zoom ?? 1} bind:ready />
	</div>

	{#if f && cap}
		{#if f.stop === 'open'}
			<!-- The hook: on screen from frame 0; the answer punches in at 0.7 s. -->
			<div class="caps open">
				<p class="kicker-big">All the bitcoin<br />that will ever exist</p>
				<p class="punch huge" style:opacity={t >= 0.7 ? 1 : 0} style:transform="scale({t >= 0.7 ? 1 + 0.25 * Math.max(0, 1 - (t - 0.7) / 0.2) : 1})">
					= ONE OIL FIELD
				</p>
				<p class="small" style:opacity={t >= 1.3 ? 1 : 0}>Let’s check.</p>
			</div>
		{:else if f.stop !== 'end'}
			<div class="caps" style:opacity={f.caption}>
				{#if cap.kicker}<p class="kicker">{cap.kicker}</p>{/if}
				<p class="punch" style:transform="scale({f.pop})">{cap.punch}</p>
				{#if cap.small}<p class="small">{cap.small}</p>{/if}
			</div>
		{/if}

		<!-- The running counter while the amount climbs between stops. -->
		<div class="counter" style:opacity={f.counter}>
			<div class="c-btc">{btcWords(f.btc)}</div>
			<div class="c-bbl">
				{f.fuel === 'crude'
					? `${big(f.litres / LITRES_PER_BARREL)} barrels`
					: `${n0(f.litres / LITRES_PER_GALLON)} gal of ${f.fuel === 'gasoline' ? 'gas' : 'diesel'}`}
			</div>
		</div>

		<div class="chart" style:opacity={f.chart}>
			<svg viewBox="-50 -14 {CW + 62} {CH + 40}" aria-hidden="true">
				{#each [0.1, 1, 10, 100, 1000] as g (g)}
					<line x1="0" x2={CW} y1={yOf(g)} y2={yOf(g)} class="grid" />
					<text x="-8" y={yOf(g) + 4} class="tick" text-anchor="end">{g >= 1 ? g.toLocaleString('en-US') : g}</text>
				{/each}
				<clipPath id="drawn"><rect x="-2" y="-20" width={(chartDot?.x ?? 0) + 2} height={CH + 40} /></clipPath>
				<path d={chartPath} class="line" clip-path="url(#drawn)" />
				{#if chartDot}
					<circle cx={chartDot.x} cy={chartDot.y} r="7" class="dot" />
				{/if}
				<text x="0" y={CH + 22} class="tick">2013</text>
				<text x={CW} y={CH + 22} class="tick" text-anchor="end">{date.slice(0, 4)}</text>
			</svg>
			<div class="c-read">
				<span class="c-date">{dayLabel(f.historyDate)}</span>
				<span class="c-val">{chartDot ? formatNum(chartDot.barrels) : ''} barrels</span>
			</div>
		</div>

		<div class="flash" style:opacity={f.flash}></div>

		<!-- The close: over the field again, so a replay loops into the opening. -->
		<div class="cta" style:opacity={f.cta}>
			<p class="cta-big">WEIGH YOUR BITCOIN</p>
			<div class="cta-url"><BrandMark size={44} /> <span>bitcoinweighin.com</span></div>
			<p class="cta-src">
				BTC ${n0(inputs!.btcUsd)} · Brent {usd(inputs!.brent)}/bbl (FRED) · US pump prices (EIA) · {dayLabel(date)} close
			</p>
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
	/* The stage fills the frame below the caption band. */
	.stage,
	.stage :global(.oil-stage) {
		position: absolute;
		inset: 0;
		height: 100% !important;
		border-radius: 0 !important;
	}
	.stage {
		top: 24%;
	}
	.stage :global(.oil-caption) {
		display: none !important;
	}
	.stage :global(.oil-gauge) {
		display: none !important;
	}
	/* The fuel gauge only for the car: under the captions, left, clear of the apps' buttons. */
	.gauge .stage :global(.oil-gauge) {
		display: block !important;
		top: 8px !important;
		left: 22px !important;
		width: 200px !important;
	}
	.caps {
		position: absolute;
		left: 28px;
		right: 64px;
		top: 70px;
		z-index: 2;
		text-align: left;
	}
	.caps p {
		margin: 0;
	}
	.kicker {
		font-size: 22px;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #f7931a;
	}
	.punch {
		margin-top: 4px !important;
		font-size: 44px;
		font-weight: 900;
		line-height: 1;
		letter-spacing: -0.02em;
		text-wrap: balance;
		transform-origin: left center;
		text-shadow: 0 3px 18px #000a;
	}
	.small {
		margin-top: 10px !important;
		font-size: 17px;
		font-weight: 600;
		line-height: 1.3;
		color: #d4d4d8;
		text-wrap: pretty;
	}
	.open {
		top: 60px;
	}
	.kicker-big {
		font-size: 34px;
		font-weight: 900;
		line-height: 1.05;
		letter-spacing: -0.01em;
		text-transform: uppercase;
	}
	.huge {
		margin-top: 12px !important;
		font-size: 58px;
		color: #f7931a;
	}
	.counter {
		position: absolute;
		left: 28px;
		right: 64px;
		top: 92px;
		z-index: 2;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-variant-numeric: tabular-nums;
	}
	.c-btc {
		font-size: 40px;
		font-weight: 700;
		color: #f7931a;
		letter-spacing: -0.02em;
	}
	.c-bbl {
		margin-top: 6px;
		font-size: 24px;
		font-weight: 600;
		color: #fafafa;
	}
	.chart {
		position: absolute;
		left: 18px;
		right: 56px;
		top: 300px;
		padding: 14px 12px 10px;
		border-radius: 14px;
		background: #0b0b0de8;
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
		font: 500 13px 'JetBrains Mono', ui-monospace, monospace;
		fill: #71717a;
	}
	.line {
		fill: none;
		stroke: #f7931a;
		stroke-width: 3.5;
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
		margin-top: 6px;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-variant-numeric: tabular-nums;
	}
	.c-date {
		font-size: 16px;
		color: #a1a1aa;
	}
	.c-val {
		font-size: 26px;
		font-weight: 700;
		color: #f7931a;
	}
	.flash {
		position: absolute;
		inset: 0;
		background: #fff;
		z-index: 4;
		pointer-events: none;
	}
	.cta {
		position: absolute;
		left: 28px;
		right: 64px;
		top: 70px;
		z-index: 2;
	}
	.cta p {
		margin: 0;
	}
	.cta-big {
		font-size: 50px;
		font-weight: 900;
		line-height: 1;
		letter-spacing: -0.02em;
		color: #f7931a;
	}
	.cta-url {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 14px;
		font-size: 28px;
		font-weight: 800;
	}
	.cta-src {
		margin-top: 12px !important;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 11px;
		line-height: 1.5;
		color: #a1a1aa;
	}
</style>
