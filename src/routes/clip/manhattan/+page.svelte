<!-- src/routes/clip/manhattan/+page.svelte -->
<script lang="ts">
	/**
	 * /clip/manhattan — the "cyber Manhattan" video, played on the real
	 * Manhattan stage, vertical (or 16:9 in a landscape window). Not a page
	 * for people: scripts/clips/make-manhattan-clip.ts opens it, calls
	 * window.__clipStart() once the map is ready, and screenshots it frame by
	 * frame on a virtual clock. The timeline is $lib/clips/manhattanClip.ts.
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
	const holderM2 = $derived(landM2(holder.btc, price));
	const holderFrame = $derived(clipFrame(BEATS.growEnd, holder.btc, price));
	const allShare = $derived(landM2(21_000_000, price) / DEVELOPABLE_M2);

	const both = (m2: number) => `${formatArea(m2, 'imperial')} (${formatArea(m2, 'metric')})`;
	const pct = (s: number) => `${s < 0.1 ? (s * 100).toFixed(1) : Math.round(s * 100)}%`;
	const possessive = (name: string) => (name.endsWith('s') ? `${name}’` : `${name}’s`);
	const n0 = (x: number) => Math.round(x).toLocaleString('en-US');
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
		let t0: number | null = null;
		let raf = 0;
		const w = window as unknown as {
			__clipStart: () => void;
			__clipReady: () => boolean;
			__clipDuration: number;
			__clipOpaque: () => boolean;
		};
		w.__clipStart = () => (t0 = performance.now());
		w.__clipReady = () => ready && price > 0;
		w.__clipDuration = BEATS.duration;
		// Nothing covers the map completely any more: every frame renders.
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
	<title>Clip · Manhattan</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="clip">
	<div class="stage">
		<LandStage areaM2={price > 0 ? f.areaM2 : 0} frameM2={price > 0 ? f.frameM2 : DEVELOPABLE_M2} bind:ready />
	</div>

	{#if price > 0}
		<!-- The open: on screen from frame 0, over the island with the holder's land lit. -->
		<div class="caps" style:opacity={f.open}>
			<p class="kicker-big">Michael Saylor calls bitcoin</p>
			<p class="punch huge" style:opacity={t >= 0.6 ? 1 : 0} style:transform="scale({t >= 0.6 ? 1 + 0.25 * Math.max(0, 1 - (t - 0.6) / 0.2) : 1})">
				“CYBER MANHATTAN”
			</p>
			<p class="small" style:opacity={t >= 1.2 ? 1 : 0}>So how much of the <em>real</em> one does bitcoin buy?</p>
		</div>

		<div class="caps" style:opacity={f.oneBtc}>
			<p class="kicker">1 bitcoin</p>
			<p class="punch" style:transform="scale({f.pop})">= {formatArea(landM2(1, price), 'imperial').toUpperCase()}</p>
			<p class="small">of land at the Battery, Manhattan’s southern tip. ({formatArea(landM2(1, price), 'metric')})</p>
		</div>

		<div class="counter" style:opacity={Math.min(1, f.counter)}>
			<div class="c-btc">{formatBtc(f.btc < 10 ? Math.round(f.btc * 100) / 100 : Math.round(f.btc))}</div>
			<div class="c-area">{both(f.areaM2)}</div>
			<div class="c-reach">{f.street ? `The Battery → ${f.street}` : 'At the Battery'}</div>
		</div>

		<div class="caps" style:opacity={f.result}>
			<p class="kicker">{possessive(holder.label)} {n0(holder.btc)} BTC</p>
			<p class="punch" style:transform="scale({f.pop})">= {pct(holderM2 / DEVELOPABLE_M2)} OF MANHATTAN</p>
			<p class="small">The Battery → {holderFrame.street ?? 'the Battery'}. That’s it.</p>
		</div>

		<div class="caps" style:opacity={f.all}>
			<p class="kicker">All 21 million bitcoin</p>
			<p class="punch" style:transform="scale({f.pop})">
				= {allShare >= 0.995 ? 'ALL OF MANHATTAN' : `${pct(allShare)} OF MANHATTAN`}
			</p>
			<p class="small">The land only: ${(LAND_VALUE_USD / 1e12).toFixed(2)} trillion for the whole island ({LAND_VALUE_YEAR} estimate). The buildings would cost far more.</p>
		</div>

		<div class="cta" style:opacity={f.endCard}>
			<p class="cta-big">WEIGH YOUR BITCOIN</p>
			<div class="cta-url"><BrandMark size={44} /> <span>bitcoinweighin.com</span></div>
			<p class="cta-src">
				BTC ${n0(price)} · {dateLabel} close · Land: Barr, Smith &amp; Kulkarni ({LAND_VALUE_YEAR}), spread evenly, illustrative ·
				Quote: CNBC, 16 Dec 2024 · Map: NYC Open Data
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
	.stage {
		position: absolute;
		inset: 0;
		top: 24%;
	}
	.stage :global(.land-stage) {
		position: absolute;
		inset: 0;
		height: 100% !important;
		border-radius: 0 !important;
	}
	.stage :global(.land-credit) {
		display: none;
	}
	.caps,
	.counter,
	.cta {
		position: absolute;
		left: 28px;
		right: 64px;
		top: 70px;
		z-index: 2;
	}
	.caps p,
	.cta p {
		margin: 0;
	}
	.kicker {
		font-size: 22px;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #f7931a;
	}
	.kicker-big {
		font-size: 32px;
		font-weight: 900;
		line-height: 1.05;
		text-transform: uppercase;
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
	.huge {
		margin-top: 10px !important;
		font-size: 56px;
		color: #f7931a;
	}
	.small {
		margin-top: 10px !important;
		font-size: 17px;
		font-weight: 600;
		line-height: 1.3;
		color: #d4d4d8;
		text-wrap: pretty;
	}
	.small em {
		font-style: normal;
		color: #f7931a;
	}
	.counter {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-variant-numeric: tabular-nums;
	}
	.counter .c-btc {
		font-size: 40px;
		font-weight: 700;
		color: #f7931a;
		letter-spacing: -0.02em;
	}
	.c-area {
		margin-top: 6px;
		font-size: 19px;
		color: #fafafa;
	}
	.c-reach {
		margin-top: 6px;
		font-family: 'Inter Tight', system-ui, sans-serif;
		font-size: 19px;
		font-weight: 700;
		color: #d4d4d8;
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

	/* ── 16:9: captions in a left column, the map on the right. ── */
	@media (min-aspect-ratio: 1/1) {
		.stage {
			top: 0;
			left: 36%;
		}
		.caps,
		.counter,
		.cta {
			left: 40px;
			right: auto;
			width: calc(36% - 64px);
			top: 50%;
			transform: translateY(-50%);
		}
		.kicker {
			font-size: 18px;
		}
		.punch {
			font-size: 38px;
		}
		.huge {
			font-size: 46px;
		}
		.kicker-big {
			font-size: 26px;
		}
		.small {
			font-size: 15px;
		}
		.cta-big {
			font-size: 40px;
		}
	}
</style>
