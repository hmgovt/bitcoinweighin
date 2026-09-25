<!-- src/routes/clip/manhattan/+page.svelte -->
<script lang="ts">
	/**
	 * /clip/manhattan — the "cyber Manhattan" video clip, played on the real
	 * Manhattan stage. Not a page for people: scripts/clips/make-manhattan-clip.ts
	 * opens it at 540×960, calls window.__clipStart() once the map is ready,
	 * and screenshots it frame by frame on a virtual clock. The timeline is
	 * $lib/clips/manhattanClip.ts.
	 *
	 *   ?holder=<entity slug>   default strategy (src/lib/entity-holdings.json)
	 *   ?price=<BTC-USD>&date=<YYYY-MM-DD>   default: the dataset's last day
	 */
	import { onMount } from 'svelte';
	import LandStage from '$lib/scene/LandStage.svelte';
	import BrandMark from '$lib/components/brand/BrandMark.svelte';
	import holdings from '$lib/entity-holdings.json';
	import { BEATS, clipFrame } from '$lib/clips/manhattanClip.js';
	import { DEVELOPABLE_M2, landM2, LAND_VALUE_USD, LAND_VALUE_YEAR } from '$lib/manhattan.js';
	import { formatArea, formatBtc } from '$lib/format.js';

	let ready = $state(false);
	let t = $state(0);
	let holderSlug = $state('strategy');
	let price = $state(0);
	let date = $state('');

	const holder = $derived(holdings.entities.find((e) => e.slug === holderSlug) ?? holdings.entities.find((e) => e.slug === 'strategy')!);
	const f = $derived(clipFrame(t, holder.btc, price));
	const finalM2 = $derived(landM2(holder.btc, price));
	const finalFrame = $derived(clipFrame(BEATS.growEnd, holder.btc, price));
	const share = $derived(finalM2 / DEVELOPABLE_M2);
	const oneM2 = $derived(landM2(1, price));

	const both = (m2: number) => `${formatArea(m2, 'metric')} (${formatArea(m2, 'imperial')})`;
	const pct = (s: number) => `${s < 0.1 ? (s * 100).toFixed(1) : Math.round(s * 100)}%`;
	const possessive = (name: string) => (name.endsWith('s') ? `${name}’` : `${name}’s`);
	const dateLabel = $derived(
		date ? new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : ''
	);

	onMount(() => {
		const q = new URLSearchParams(location.search);
		holderSlug = q.get('holder') ?? 'strategy';
		const p = Number(q.get('price'));
		if (p > 0) {
			price = p;
			date = q.get('date') ?? '';
		} else {
			void fetch('/data/prices.json')
				.then((r) => r.json())
				.then((rows: Record<string, { btc_usd: number | null }>) => {
					const last = Object.keys(rows).sort().filter((d) => rows[d].btc_usd).pop()!;
					price = rows[last].btc_usd!;
					date = last;
				});
		}
		// The clip's clock: performance.now() from __clipStart(), which the
		// capture script drives virtually (one frame at a time).
		let t0: number | null = null;
		let raf = 0;
		const w = window as unknown as { __clipStart: () => void; __clipReady: () => boolean; __clipDuration: number };
		w.__clipStart = () => (t0 = performance.now());
		w.__clipReady = () => ready && price > 0;
		w.__clipDuration = BEATS.duration;
		const tick = () => {
			raf = requestAnimationFrame(tick);
			if (t0 !== null) t = (performance.now() - t0) / 1000;
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
</script>

<svelte:head>
	<title>Clip · Manhattan</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="clip">
	<div class="stage">
		<LandStage areaM2={price > 0 ? f.areaM2 : 0} frameM2={price > 0 ? f.frameM2 : DEVELOPABLE_M2} bind:ready />
	</div>

	<!-- Beat 1: the quote -->
	<div class="card quote" style:opacity={f.quote}>
		<p class="q-lead">Michael Saylor calls bitcoin</p>
		<p class="q-big">“cyber Manhattan.”</p>
		<p class="q-src">— CNBC, <i>Money Movers</i>, 16 Dec 2024</p>
	</div>

	<!-- Beat 2: the question, over the whole island -->
	<div class="top" style:opacity={f.question}>
		<p class="h">So how much of the <em>real</em> Manhattan does {possessive(holder.label)} bitcoin buy?</p>
	</div>

	<!-- Beat 3: one coin at the Battery -->
	<div class="top" style:opacity={f.oneBtc}>
		<p class="h"><span class="or">1 BTC</span> buys {both(oneM2)}</p>
		<p class="sub">of land at the Battery, Manhattan’s southern tip</p>
	</div>

	<!-- Beat 4: the climb -->
	<div class="counter" style:opacity={f.counter}>
		<div class="c-btc">{formatBtc(f.btc < 10 ? Math.round(f.btc * 100) / 100 : Math.round(f.btc))}</div>
		<div class="c-area">{both(f.areaM2)}</div>
		<div class="c-reach">{f.street ? `The Battery → ${f.street}` : 'At the Battery'}</div>
	</div>

	<!-- Beat 5: the answer -->
	<div class="top" style:opacity={f.result}>
		<p class="h">{possessive(holder.label)} {formatBtc(holder.btc)} buys <span class="or">{pct(share)}</span> of Manhattan’s land</p>
		<p class="sub">From the Battery to {finalFrame.street ?? 'the Battery'}. That’s it.</p>
	</div>

	<div class="footer" style:opacity={f.footer * (1 - f.endCard)}>
		BTC ${Math.round(price).toLocaleString('en-US')} · {dateLabel} · Land: ${(LAND_VALUE_USD / 1e12).toFixed(2)}T for the whole island
		({LAND_VALUE_YEAR}, Barr, Smith &amp; Kulkarni), spread evenly, illustrative · Map: NYC Open Data
	</div>

	<!-- Beat 6: the end card -->
	<div class="card end" style:opacity={f.endCard}>
		<BrandMark size={84} />
		<p class="e-url">bitcoinweighin.com</p>
		<p class="e-sub">Weigh any amount of bitcoin in gold, cash, plutonium… and Manhattan.</p>
	</div>
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
	.stage :global(.land-stage) {
		position: absolute;
		inset: 0;
		height: 100% !important;
		border-radius: 0 !important;
	}
	.stage :global(.land-credit) {
		display: none;
	}
	.card {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		text-align: center;
		padding: 0 44px;
		background: #0b0b0d;
		z-index: 3;
	}
	.card p {
		margin: 0;
	}
	.q-lead {
		font-size: 24px;
		font-weight: 500;
		color: #a1a1aa;
	}
	.q-big {
		font-size: 58px;
		font-weight: 700;
		letter-spacing: -0.03em;
		line-height: 1.05;
		margin: 16px 0 22px !important;
		color: #f7931a;
	}
	.q-src {
		font-size: 17px;
		color: #71717a;
	}
	.top {
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		padding: 64px 36px 90px;
		background: linear-gradient(#18181bf2 0%, #18181bcc 55%, #18181b00 100%);
		z-index: 2;
	}
	.top p {
		margin: 0;
	}
	.h {
		font-size: 34px;
		font-weight: 700;
		line-height: 1.15;
		letter-spacing: -0.02em;
		text-wrap: balance;
	}
	.h em {
		font-style: normal;
		color: #f7931a;
	}
	.or {
		color: #f7931a;
	}
	.sub {
		margin-top: 12px !important;
		font-size: 19px;
		font-weight: 500;
		color: #d4d4d8;
	}
	.counter {
		position: absolute;
		left: 24px;
		right: 24px;
		bottom: 96px;
		padding: 18px 22px;
		border-radius: 14px;
		background: #0b0b0de0;
		border: 1px solid #27272a;
		z-index: 2;
	}
	.c-btc {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 40px;
		font-weight: 600;
		letter-spacing: -0.02em;
		color: #f7931a;
		font-variant-numeric: tabular-nums;
	}
	.c-area {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 19px;
		color: #fafafa;
		margin-top: 6px;
		font-variant-numeric: tabular-nums;
	}
	.c-reach {
		font-size: 19px;
		font-weight: 600;
		color: #d4d4d8;
		margin-top: 6px;
	}
	.footer {
		position: absolute;
		left: 24px;
		right: 24px;
		bottom: 18px;
		padding: 8px 10px;
		border-radius: 8px;
		background: #0b0b0dc0;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 11px;
		line-height: 1.5;
		color: #a1a1aa;
		text-shadow: 0 1px 3px #000;
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
		max-width: 22em;
		text-wrap: balance;
	}
</style>
