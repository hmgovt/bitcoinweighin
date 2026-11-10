<!-- src/routes/clip/manhattan-long/+page.svelte -->
<script lang="ts">
	/**
	 * /clip/manhattan-long — the long "cyber Manhattan" cut for TikTok, played
	 * on the real Manhattan stage. Not a page for people: captured by
	 * scripts/clips/make-manhattan-clip.ts --cut=long at 540×960 on a virtual
	 * clock. The timeline and every line of copy are
	 * $lib/clips/manhattanLongClip.ts. Text stays out of TikTok's own UI: the
	 * top 80 px (tabs), the bottom 240 px (caption) and the right 60 px
	 * (buttons) of the 540×960 frame.
	 *
	 *   ?price=<BTC-USD>&date=<YYYY-MM-DD>&supply=<BTC mined>   default: the dataset's last day
	 */
	import { onMount } from 'svelte';
	import LandStage from '$lib/scene/LandStage.svelte';
	import holdings from '$lib/entity-holdings.json';
	import { beats, longFrame, DURATION, type Stacks } from '$lib/clips/manhattanLongClip.js';
	import { DEVELOPABLE_M2, LAND_VALUE_USD, LAND_VALUE_YEAR } from '$lib/manhattan.js';
	import { formatArea, formatBtc } from '$lib/format.js';

	let ready = $state(false);
	let t = $state(0);
	let price = $state(0);
	let supply = $state(0);
	let date = $state('');

	const held = (slug: string) => holdings.entities.find((e) => e.slug === slug)?.btc ?? 0;
	const stacks = $derived<Stacks>({
		price,
		mined: supply,
		usGov: held('us-govt'),
		blackrock: held('blackrock-ibit'),
		strategy: held('strategy'),
		satoshi: held('satoshi'),
	});
	const B = $derived(price > 0 && supply > 0 ? beats(stacks) : []);
	const f = $derived(B.length ? longFrame(t, B, price) : null);
	const b = $derived(f ? B[f.beat] : null);

	const both = (m2: number) => `${formatArea(m2, 'metric')} (${formatArea(m2, 'imperial')})`;
	// The copy is ours (manhattanLongClip.ts), never a visitor's: percentages go orange.
	const hi = (s: string) => s.replace(/(\d[\d.,]*%)/g, '<span class="or">$1</span>');
	const dateLabel = $derived(
		date ? new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : ''
	);

	onMount(() => {
		const q = new URLSearchParams(location.search);
		const p = Number(q.get('price'));
		const s = Number(q.get('supply'));
		if (p > 0 && s > 0) {
			price = p;
			supply = s;
			date = q.get('date') ?? '';
		} else {
			void fetch('/data/prices.json')
				.then((r) => r.json())
				.then((rows: Record<string, { btc_usd: number | null; btc_supply: number | null }>) => {
					const last = Object.keys(rows).sort().filter((d) => rows[d].btc_usd).pop()!;
					price = rows[last].btc_usd!;
					supply = rows[last].btc_supply!;
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
		w.__clipReady = () => ready && price > 0 && supply > 0;
		w.__clipDuration = DURATION;
		// No full-screen cards: the map is always in shot.
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
	<title>Clip · Manhattan, long</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="clip">
	<div class="stage">
		<LandStage areaM2={f ? f.areaM2 : 0} frameM2={f ? f.frameM2 : DEVELOPABLE_M2} bind:ready />
	</div>

	{#if f && b}
		<div class="top" style:opacity={f.block}>
			<p class="eyebrow">{b.eyebrow}</p>
			<div class="heads">
				<p class="h" style:opacity={f.head}>{@html hi(b.head)}</p>
				{#if b.headAfter}
					<p class="h after" style:opacity={f.headAfter}>{@html hi(b.headAfter)}</p>
				{/if}
			</div>
			{#if b.result}
				<p class="result" style:opacity={f.result}>{@html hi(b.result)}</p>
			{/if}
			{#if b.sub}
				<p class="sub" style:opacity={f.sub}>{b.sub.text}</p>
			{/if}
		</div>

		<div class="counter">
			<div class="c-btc">{formatBtc(f.btc < 10 ? Math.round(f.btc * 100) / 100 : Math.round(f.btc))}</div>
			<div class="c-area">{both(f.areaM2)}</div>
			<div class="c-reach">{f.street ? `The Battery → ${f.street}` : 'At the Battery'}</div>
			<div class="fine">
				BTC ${Math.round(price).toLocaleString('en-US')} · {dateLabel} · land ${(LAND_VALUE_USD / 1e12).toFixed(2)}T ({LAND_VALUE_YEAR}),
				spread evenly, illustrative · bitcoinweighin.com
			</div>
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
	/* The map's canvas runs 160 px above the frame, so it centres 80 px high
	   and the whole island clears the counter, with no gap at the bottom. */
	.stage {
		position: absolute;
		inset: -160px 0 0 0;
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
	.top {
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		padding: 88px 70px 70px 30px;
		background: linear-gradient(#18181bf5 0%, #18181bd9 60%, #18181b00 100%);
		z-index: 2;
	}
	.top p {
		margin: 0;
	}
	.eyebrow {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 15px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #f7931a;
	}
	.heads {
		display: grid;
		margin-top: 8px;
	}
	.heads > .h {
		grid-area: 1 / 1;
	}
	.h {
		font-size: 40px;
		font-weight: 800;
		line-height: 1.08;
		letter-spacing: -0.03em;
		text-wrap: balance;
	}
	.result {
		margin-top: 12px !important;
		font-size: 25px;
		font-weight: 700;
		line-height: 1.2;
		letter-spacing: -0.015em;
		text-wrap: balance;
	}
	.sub {
		margin-top: 8px !important;
		font-size: 19px;
		font-weight: 600;
		color: #d4d4d8;
	}
	.top :global(.or) {
		color: #f7931a;
	}
	.counter {
		position: absolute;
		left: 24px;
		right: 70px;
		bottom: 252px;
		padding: 10px 16px 9px;
		border-radius: 14px;
		background: #0b0b0de6;
		border: 1px solid #27272a;
		z-index: 2;
	}
	.c-btc {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 30px;
		font-weight: 600;
		letter-spacing: -0.02em;
		color: #f7931a;
		font-variant-numeric: tabular-nums;
	}
	.c-area {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 15px;
		margin-top: 2px;
		font-variant-numeric: tabular-nums;
	}
	.c-reach {
		font-size: 16px;
		font-weight: 600;
		color: #d4d4d8;
		margin-top: 2px;
	}
	.fine {
		margin-top: 6px;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 9px;
		line-height: 1.45;
		color: #a1a1aa;
	}
</style>
