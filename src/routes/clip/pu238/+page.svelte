<!-- src/routes/clip/pu238/+page.svelte -->
<script lang="ts">
	/**
	 * /clip/pu238 — "What does bitcoin buy in plutonium-238?", the vertical
	 * video (and, in a landscape window, its 16:9 cut), played on the real
	 * hero stage. Not a page for people: scripts/clips/make-oil-clip.ts
	 * --clip=pu238 captures it frame by frame on a virtual clock. The
	 * timeline is $lib/clips/puClip.ts.
	 *
	 * The cube is held while the amount climbs (it grows in a frozen shot)
	 * and released on arrival, so every stop lands with the stage's real
	 * Drop; hard cuts fire a drop through dropSignal.
	 */
	import { onMount } from 'svelte';
	import LiveStage from '$lib/scene/LiveStage.svelte';
	import BrandMark from '$lib/components/brand/BrandMark.svelte';
	import holdings from '$lib/entity-holdings.json';
	import illustrative from '$lib/illustrative-prices.json';
	import { getCommodity } from '$lib/commodities.js';
	import { PU238_ANNUAL_PRODUCTION_G, PU238_OXIDE_W_PER_GRAM } from '$lib/components/Pu238FactCard.helpers.js';
	import { PU_DURATION, PU_STOPS, VOYAGER_G, btcFor, puFrame, stopGrams, type PuClipInputs, type PuStopKey } from '$lib/clips/puClip.js';
	import { formatNum } from '$lib/format.js';

	const pu = getCommodity('pu238')!;
	let t = $state(0);
	let inputs = $state<PuClipInputs | null>(null);
	let date = $state('');
	let started = $state(false);

	const f = $derived(inputs ? puFrame(t, inputs) : null);
	// Hard cuts drop the cube: count the cut arrivals passed.
	const dropSignal = $derived(started ? PU_STOPS.filter((s) => s.cut && s.at <= t).length : 0);

	const n0 = (x: number) => Math.round(x).toLocaleString('en-US');
	const tonnes = (g: number) => `${formatNum(g / 1e6)} TONNES`;
	const watts = (w: number) =>
		w >= 1e6 ? `${formatNum(w / 1e6)} megawatts` : w >= 1e3 ? `${formatNum(w / 1e3)} kilowatts` : `${Math.round(w)} watts`;
	const edge = (g: number) => {
		const cm = Math.cbrt(g / (pu.densityGPerCm3 ?? 11.46));
		return cm >= 100 ? `${formatNum(cm / 100)}-metre` : `${formatNum(cm)} cm`;
	};
	/** "164 nanograms", "3.2 micrograms", "0.8 milligrams". */
	const tiny = (g: number) =>
		g < 1e-6 ? `${n0(g * 1e9)} nanograms` : g < 1e-3 ? `${formatNum(g * 1e6)} micrograms` : `${formatNum(g * 1e3)} milligrams`;
	const years = (g: number) => n0(g / PU238_ANNUAL_PRODUCTION_G);
	const dayLabel = (d: string) =>
		d ? new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';

	type Caption = { kicker?: string; punch: string; small?: string };
	const captions = $derived.by((): Record<PuStopKey, Caption> | null => {
		const i = inputs;
		if (!i) return null;
		const g = (k: PuStopKey) => stopGrams(k, i);
		return {
			open: { punch: '' },
			sat: { kicker: '1 sat', punch: '= A SPECK', small: `${tiny(g('sat'))} of plutonium-238 fuel. Magnified to be seen at all.` },
			one: {
				kicker: '1 bitcoin',
				punch: `= ${formatNum(g('one'))} GRAMS`,
				small: `A ${edge(g('one'))} cube giving off ${watts(g('one') * PU238_OXIDE_W_PER_GRAM)} of heat. For decades.`,
			},
			year: {
				kicker: `${n0(btcFor(g('year'), i))} bitcoin`,
				punch: '= A YEAR OF AMERICA’S SUPPLY',
				small: 'Oak Ridge aims to make about 1.5 kg a year. Nobody else sells it.',
			},
			voyager: {
				kicker: `${n0(btcFor(VOYAGER_G, i))} bitcoin`,
				punch: '= VOYAGER 1’S POWER SOURCE',
				small: 'Three 4.5 kg power units, launched in 1977. Still running after 49 years.',
			},
			strategy: {
				kicker: `Strategy’s ${n0(i.strategyBtc)} BTC`,
				punch: `= ${tonnes(g('strategy'))}`,
				small: `${years(g('strategy'))} years of US production, giving off ${watts(g('strategy') * PU238_OXIDE_W_PER_GRAM)}.`,
			},
			all: {
				kicker: 'All 21 million bitcoin',
				punch: `= ${tonnes(g('all'))}`,
				small: `${years(g('all'))} years of US production: a ${edge(g('all'))} cube giving off ${watts(g('all') * PU238_OXIDE_W_PER_GRAM)}. Too hot for the screen to show.`,
			},
			twist: {
				kicker: 'But',
				punch: 'PLUTONIUM-238 HAS NO MARKET',
				small: `$${n0(i.usdPerGram)}/g is a DOE/NASA material estimate. At the programme’s full cost (~$${n0(i.programUsdPerGram)}/g), 1 bitcoin buys ${formatNum(g('twist'))} g.`,
			},
			end: { punch: '' },
		};
	});
	const cap = $derived(f && captions ? captions[f.stop] : null);

	onMount(() => {
		const priceInfo = illustrative.pu238 as { pricePerUnit: number; fullyLoadedProgramCostPerGram: number };
		void fetch('/prices.json')
			.then((r) => r.json())
			.then((rows: Record<string, Record<string, number>>) => {
				const d = Object.keys(rows).sort().filter((x) => rows[x].btc).pop()!;
				date = d;
				inputs = {
					btcUsd: rows[d].btc,
					usdPerGram: priceInfo.pricePerUnit,
					programUsdPerGram: priceInfo.fullyLoadedProgramCostPerGram,
					strategyBtc: holdings.entities.find((e) => e.slug === 'strategy')!.btc,
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
		w.__clipStart = () => {
			t0 = performance.now();
			started = true;
		};
		// Ready once the stage's canvas has survived its first frame and Sat has loaded.
		w.__clipReady = () => inputs !== null && !!document.querySelector('.live-stage canvas[data-fx]');
		w.__clipDuration = PU_DURATION;
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
	<title>Clip · Plutonium-238</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="clip">
	<div class="stage">
		<LiveStage commodity={pu} amount={f?.grams ?? 1} held={f?.held ?? false} {dropSignal} grabEnabled={false} accent="#7ed4ff" capture />
	</div>

	{#if f && cap && inputs}
		{#if f.stop === 'open'}
			<div class="caps open">
				<p class="kicker-big">Voyager 1 is 25 billion km away.<br />This keeps it alive:</p>
				<p class="punch huge" style:opacity={t >= 0.7 ? 1 : 0} style:transform="scale({t >= 0.7 ? 1 + 0.25 * Math.max(0, 1 - (t - 0.7) / 0.2) : 1})">
					= {n0(btcFor(VOYAGER_G, inputs))} BITCOIN
				</p>
				<p class="small" style:opacity={t >= 1.2 ? 1 : 0}>of plutonium-238. Now, what does one sat buy?</p>
			</div>
		{:else if f.stop !== 'end'}
			<div class="caps" style:opacity={f.caption}>
				{#if cap.kicker}<p class="kicker">{cap.kicker}</p>{/if}
				<p class="punch" style:transform="scale({f.pop})">{cap.punch}</p>
				{#if cap.small}<p class="small">{cap.small}</p>{/if}
			</div>
		{/if}

		<div class="counter" style:opacity={f.counter}>
			<div class="c-btc">{formatNum(btcFor(f.grams, inputs))} BTC</div>
			<div class="c-g">{f.grams >= 1e6 ? `${formatNum(f.grams / 1e6)} t` : f.grams >= 1000 ? `${formatNum(f.grams / 1000)} kg` : `${formatNum(f.grams)} g`} · {watts(f.watts)}</div>
		</div>

		<div class="flash" style:opacity={f.flash}></div>

		<div class="cta" style:opacity={f.cta}>
			<p class="cta-big">WEIGH YOUR BITCOIN</p>
			<div class="cta-url"><BrandMark size={44} /> <span>bitcoinweighin.com</span></div>
			<p class="cta-src">
				BTC ${n0(inputs.btcUsd)} ({dayLabel(date)} close) · Pu-238 ~${n0(inputs.usdPerGram)}/g, DOE/NASA estimate, illustrative ·
				drawn as PuO₂ fuel, 11.46 g/cm³
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
	.stage :global(.live-stage) {
		position: absolute !important;
		inset: 0 !important;
		width: 100% !important;
		height: 100% !important;
		max-width: none !important;
		margin: 0 !important;
		border-radius: 0 !important;
		border: 0 !important;
	}
	/* The stage's own buttons, hints and labels aren't part of the video. */
	.stage :global(:is(.stage-buttons, button, [role='button'], .hud, .hint, .caption, .chips, .loupe-label, .cube-caption, .edge-label, .dragnote, .corner)) {
		display: none !important;
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
	.open {
		top: 60px;
	}
	.kicker {
		font-size: 22px;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #7ed4ff;
	}
	.kicker-big {
		font-size: 34px;
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
		margin-top: 12px !important;
		font-size: 58px;
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
	.counter {
		top: 92px;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-variant-numeric: tabular-nums;
	}
	.c-btc {
		font-size: 40px;
		font-weight: 700;
		color: #f7931a;
		letter-spacing: -0.02em;
	}
	.c-g {
		margin-top: 6px;
		font-size: 22px;
		font-weight: 600;
		color: #7ed4ff;
	}
	.flash {
		position: absolute;
		inset: 0;
		background: #fff;
		z-index: 4;
		pointer-events: none;
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

	/* ── 16:9: captions in a left column, the stage on the right. ── */
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
			font-size: 40px;
		}
		.huge {
			font-size: 50px;
		}
		.kicker-big {
			font-size: 30px;
		}
		.small {
			font-size: 15px;
		}
		.cta-big {
			font-size: 40px;
		}
	}
</style>
