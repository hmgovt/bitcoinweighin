<!-- src/routes/clip/tanker/+page.svelte -->
<script lang="ts">
	/**
	 * /clip/tanker — "How many bitcoin fill a supertanker?", the one-question
	 * Short, on the real oil stage pinned to its tanker rung. Not a page for
	 * people: scripts/clips/make-oil-clip.ts --clip=tanker opens it, calls
	 * window.__clipStart() once the stage is ready, and screenshots it frame
	 * by frame on a virtual clock. The timeline is $lib/clips/tankerClip.ts.
	 *
	 *   ?date=<YYYY-MM-DD>   the close to use; default the latest with Brent
	 */
	import { onMount } from 'svelte';
	import OilStage from '$lib/scene/OilStage.svelte';
	import BrandMark from '$lib/components/brand/BrandMark.svelte';
	import holdings from '$lib/entity-holdings.json';
	import { TANKER_BEATS, tankerBtc, tankerFrame, litresOf, type TankerClipInputs } from '$lib/clips/tankerClip.js';
	import { VLCC_L } from '$lib/oil.js';
	import { formatNum } from '$lib/format.js';

	let ready = $state(false);
	let t = $state(0);
	let inputs = $state<TankerClipInputs | null>(null);
	let date = $state('');

	const f = $derived(inputs ? tankerFrame(t, inputs) : null);
	const n0 = (x: number) => Math.round(x).toLocaleString('en-US');
	const dayLabel = (d: string) =>
		d ? new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';

	onMount(() => {
		const q = new URLSearchParams(location.search);
		void fetch('/prices.json')
			.then((r) => r.json())
			.then((rows: Record<string, Record<string, number>>) => {
				const dates = Object.keys(rows).sort();
				const want = q.get('date');
				const d = want && rows[want]?.brent ? want : [...dates].reverse().find((x) => rows[x].brent && rows[x].btc)!;
				date = d;
				inputs = {
					btcUsd: rows[d].btc,
					brent: rows[d].brent,
					elSalvadorBtc: holdings.entities.find((e) => e.slug === 'el-salvador')!.btc,
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
		w.__clipDuration = TANKER_BEATS.duration;
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
	<title>Clip · Tanker</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="clip">
	<div class="stage">
		<OilStage litres={f?.litres ?? 0} rung="tanker" bind:ready />
	</div>

	{#if f && inputs}
		<!-- The question: on screen from frame 0, and again at the end so a replay loops. -->
		<div class="caps" style:opacity={f.question}>
			<p class="q">HOW MANY <span>BITCOIN</span><br />FILL A SUPERTANKER?</p>
			<p class="guess" style:opacity={f.counter > 0.05 || f.url > 0.05 ? 0 : 1}>Guess before it fills ⬇</p>
		</div>

		<div class="counter" style:opacity={f.counter}>
			<div class="c-btc">{n0(f.btc)} BTC</div>
			<div class="c-fill">{Math.min(100, Math.floor((f.litres / VLCC_L) * 100))}% full</div>
		</div>

		<div class="caps lower" style:opacity={f.answer}>
			<p class="kicker">2 million barrels of Brent</p>
			<p class="punch" style:transform="scale({f.pop})">= {n0(tankerBtc(inputs))} BITCOIN</p>
			<p class="small">${formatNum((tankerBtc(inputs) * inputs.btcUsd) / 1e6)} million. One 330-metre VLCC, full.</p>
		</div>

		<div class="caps lower" style:opacity={f.twist}>
			<p class="kicker">El Salvador’s {n0(inputs.elSalvadorBtc)} BTC</p>
			<p class="punch" style:transform="scale({f.pop})">= {formatNum(litresOf(inputs.elSalvadorBtc, inputs) / VLCC_L)} SUPERTANKERS</p>
			<p class="small">A country’s whole bitcoin reserve.</p>
		</div>

		<div class="url" style:opacity={f.url}>
			<BrandMark size={30} /> <span>bitcoinweighin.com</span>
			<p>BTC ${n0(inputs.btcUsd)} · Brent ${inputs.brent.toFixed(2)}/bbl (FRED) · {dayLabel(date)}</p>
		</div>

		<div class="flash" style:opacity={f.flash}></div>
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
	.stage {
		top: 22%;
	}
	.stage :global(.oil-caption),
	.stage :global(.oil-gauge) {
		display: none !important;
	}
	.caps,
	.counter {
		position: absolute;
		left: 28px;
		right: 64px;
		top: 64px;
		z-index: 2;
	}
	.caps p {
		margin: 0;
	}
	.q {
		font-size: 44px;
		font-weight: 900;
		line-height: 1.02;
		letter-spacing: -0.02em;
		text-shadow: 0 3px 18px #000a;
	}
	.q span {
		color: #f7931a;
	}
	.guess {
		margin-top: 12px !important;
		font-size: 22px;
		font-weight: 800;
		color: #d4d4d8;
	}
	/* While it fills, the counter sits under the question. */
	.counter {
		top: 186px;
		display: flex;
		align-items: baseline;
		gap: 16px;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-variant-numeric: tabular-nums;
	}
	.c-btc {
		font-size: 40px;
		font-weight: 700;
		color: #f7931a;
		letter-spacing: -0.02em;
	}
	.c-fill {
		font-size: 22px;
		font-weight: 600;
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
		font-size: 52px;
		font-weight: 900;
		line-height: 1;
		letter-spacing: -0.02em;
		text-wrap: balance;
		transform-origin: left center;
		text-shadow: 0 3px 18px #000a;
	}
	.small {
		margin-top: 10px !important;
		font-size: 18px;
		font-weight: 600;
		line-height: 1.3;
		color: #d4d4d8;
	}
	.url {
		position: absolute;
		left: 28px;
		right: 64px;
		top: 186px;
		z-index: 2;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		font-size: 24px;
		font-weight: 800;
	}
	.url p {
		flex-basis: 100%;
		margin: 2px 0 0;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 11px;
		font-weight: 400;
		color: #a1a1aa;
	}
	.flash {
		position: absolute;
		inset: 0;
		background: #fff;
		z-index: 4;
		pointer-events: none;
	}

	/* ── 16:9: the question in a left column, the tanker on the right. ── */
	@media (min-aspect-ratio: 1/1) {
		.stage {
			top: 0;
			left: 36%;
		}
		.caps,
		.counter,
		.url {
			left: 40px;
			right: auto;
			width: calc(36% - 64px);
			top: 34%;
			transform: translateY(-50%);
		}
		.counter,
		.url {
			top: 62%;
			flex-direction: column;
			align-items: flex-start;
			gap: 4px;
		}
		.lower {
			top: 50%;
		}
		.q {
			font-size: 36px;
		}
		.punch {
			font-size: 40px;
		}
		.kicker {
			font-size: 18px;
		}
		.small {
			font-size: 15px;
		}
	}
</style>
