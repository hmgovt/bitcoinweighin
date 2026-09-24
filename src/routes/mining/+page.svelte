<script lang="ts">
	import { onMount } from 'svelte';
	import { breadcrumbJsonLd, webPageJsonLd } from '$lib/seo/jsonld.js';
	import MiningDive from '$lib/components/mining/MiningDive.svelte';
	import HashCoreJob from '$lib/components/mining/HashCoreJob.svelte';
	import HashCoreInstrument from '$lib/components/mining/HashCoreInstrument.svelte';
	import HashCoreResults from '$lib/components/mining/HashCoreResults.svelte';
	import HashCoreRealtime from '$lib/components/mining/HashCoreRealtime.svelte';
	import { CLOCK_HZ, MiningController } from '$lib/mining/controller.svelte.js';
	import { fmtDur, n0 } from '$lib/mining/format.js';

	const PAGE_URL = 'https://bitcoinweighin.com/mining';
	const TITLE = 'Inside a Bitcoin Miner: How an ASIC Finds a Block';
	const DESCRIPTION =
		'Take a Bitcoin mining chip apart in 3D, from hashboard to silicon, then watch one SHA-256 hash core work through real block headers — and replay the moment a real block was found.';

	let ctl = $state<MiningController | null>(null);
	let coreSection: HTMLElement | undefined = $state();

	const speed = $derived(ctl?.speed ?? 4);
	const dilation = $derived(n0(CLOCK_HZ / speed));
	const dilationNote = $derived.by(() => {
		if (ctl && !ctl.playing) return 'Clock stopped. On the chip, one clock takes 2 ns.';
		let note = `One clock here takes ${fmtDur(1 / speed)}. On the chip it takes 2 ns.`;
		if (ctl?.soundOn && speed >= 60) note += ` With sound on, the ticks merge into a ${speed} Hz tone. The chip’s 500 MHz clock is 25,000 times higher than anyone can hear.`;
		return note;
	});

	function onHandoff() {
		coreSection?.scrollIntoView({ behavior: ctl?.reduced ? 'auto' : 'smooth', block: 'start' });
		ctl?.handoffFromDive();
	}

	onMount(() => {
		const c = new MiningController();
		ctl = c;
		c.start();
		// The page is dark edge to edge, including overscroll.
		const prev = document.body.style.background;
		document.body.style.background = '#0e0e10';
		return () => {
			c.destroy();
			document.body.style.background = prev;
		};
	});
</script>

<svelte:head>
	<title>{TITLE} · Bitcoin Weigh-In</title>
	<meta name="description" content={DESCRIPTION} />
	<link rel="canonical" href={PAGE_URL} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={PAGE_URL} />
	<meta property="og:title" content={TITLE} />
	<meta property="og:description" content={DESCRIPTION} />
	<meta property="og:image" content="https://bitcoinweighin.com/images/og-mining.jpg" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta name="twitter:card" content="summary_large_image" />
	{@html `<script type="application/ld+json">${webPageJsonLd({ url: PAGE_URL, name: `${TITLE} — Bitcoin Weigh-In`, description: DESCRIPTION })}</script>`}
	{@html `<script type="application/ld+json">${breadcrumbJsonLd([{ name: 'Home', url: 'https://bitcoinweighin.com/' }, { name: 'Mining', url: PAGE_URL }])}</script>`}
</svelte:head>

<div class="mining">
	<div class="wrap">
		<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Bitcoin Weigh-In</a> <span aria-hidden="true">/</span> Mining</nav>

		<header class="hero">
			<h1>Inside a Bitcoin miner</h1>
			<p class="lede">
				Every bitcoin block is found by chips like this one, guessing, trillions of times a second. Take one apart,
				then watch a single hash core work through real block headers, slowed down far enough to see.
			</p>
		</header>

		<MiningDive {ctl} {onHandoff} />

		<section class="core-intro" bind:this={coreSection} aria-labelledby="core-h">
			<div>
				<p class="eyebrow">The simulation</p>
				<h2 id="core-h">One hash core</h2>
				<p class="lede">
					A mining chip tiles many of these side by side. Each one is a 128-stage conveyor: a nonce enters on the left, is
					mixed through 64 rounds of SHA-256, then 64 more, and falls out the end as a hash. Every stage is busy on every
					clock, so one finished hash exits per tick, and it's checked and thrown away as soon as it arrives.
				</p>
			</div>
			<aside class="dilation" aria-label="Time dilation">
				<div class="eyebrow">Slowed down by</div>
				<div class="big mono">{dilation}×</div>
				<div class="small">{dilationNote}</div>
			</aside>
		</section>

		{#if ctl}
			<HashCoreJob {ctl} />
			<HashCoreInstrument {ctl} />
			<HashCoreResults {ctl} />
			<HashCoreRealtime {ctl} />
		{:else}
			<div class="placeholder" aria-hidden="true"></div>
		{/if}

		<footer class="notes">
			<h2>How this page works</h2>
			<ul>
				<li>The headers are the real 80-byte headers of blocks 968,389 and 968,390, taken from mempool.space. Every hash on this page is computed in your browser, one SHA-256 round at a time, and the winning nonces reproduce the real block hashes.</li>
				<li>The clock is an assumption: 500 MHz, with a fully pipelined core finishing one double-SHA-256 per clock. Real chips differ in clock speed, core count and pipeline layout. The time-dilation figures scale with this number.</li>
				<li>Real chips cut work further. Rounds 1–3 of pass 1 don't depend on the nonce, so they're computed once per job. The hash's top 32 bits are already fixed after round 61 of pass 2, so many designs check there and skip the last three rounds.</li>
				<li>Both blocks' version fields have bits set inside the BIP 320 range (<code>0x1fffe000</code>), meaning the miner rolled version bits too. That changes block 1 and so the midstate. This page keeps the version fixed.</li>
				<li>The ~50-bit real share target is an estimate: an S21 at 234 TH/s submitting roughly one share every 5 seconds does about 2⁵⁰ hashes per share. The 8-bit share target here is only so you can see shares happen.</li>
				<li>Replay sets the counter 103 nonces before the real winning nonce. Every hash along the way is a real attempt on the real template, but the original miner didn't necessarily try those exact neighbours.</li>
				<li>The 3D model follows flip-chip packaging, which teardown analysis shows recent Bitmain chips use (<a href="https://www.techinsights.com/products/apq-2211-801" rel="noopener">TechInsights on the BM1366</a>). Bitmain publishes no datasheets, so dimensions, bump and ball counts, the board layout and the number of chips shown are illustrative. The heatsink that normally covers the chips is left off.</li>
				<li>The silicon view is a representative layout drawn from the logic, not traced from a real chip. What is real for every stage: which flip-flops exist, the bit each one holds, which bits flip on each clock, the switching activity of each logic block, and the K constant wired into it. Placement, proportions, core count and the die periphery are illustrative, and only the outlined core's glow comes from the simulation.</li>
				<li>Sound is off by default and synthesized in your browser; nothing is a recording. The fan is the same model as the <a href="/#hashweight">Hashweight</a> panel's. Everything after that comes from the simulation: a tick for every clock, a tone for every hash whose pitch comes from that hash's last bits, a chime for every share, and a hiss that follows the switching activity.</li>
			</ul>
			<p class="more">
				See what all of these machines weigh together in <a href="/#hashweight">Hashweight</a>, or how the rest of the site
				works on the <a href="/methodology">methodology page</a>.
			</p>
		</footer>
	</div>
</div>

<style>
	.mining {
		--ground: #0e0e10;
		--panel: #16161a;
		--panel-2: #1d1d22;
		--rule: #29292f;
		--rule-2: #3f3f46;
		--ink: #e7e5e4;
		--ink-2: #a1a1aa;
		--ink-3: #71717a;
		--gold: #d4a14a;
		--gold-ink: #eac37d;
		--gold-soft: rgba(212, 161, 74, 0.13);
		--steel: #8fb3c8;
		--steel-soft: rgba(143, 179, 200, 0.12);
		--sans: 'Inter Tight', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
		--mono: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
		color-scheme: dark;
		background: var(--ground);
		color: var(--ink);
		font-family: var(--sans);
		font-size: 14px;
		line-height: 1.5;
		min-height: 100vh;
	}
	.wrap { max-width: 1120px; margin-inline: auto; padding-inline: 20px; padding-block: 20px 72px; display: flex; flex-direction: column; gap: 44px; }
	.crumbs { font-size: 12.5px; color: var(--ink-3); margin-bottom: -24px; }
	.crumbs a { color: var(--ink-2); text-decoration: none; }
	.crumbs a:hover { color: var(--ink); text-decoration: underline; }
	h1 { font: 600 clamp(34px, 5.2vw, 50px)/1.02 var(--sans); letter-spacing: -0.025em; margin: 0; text-wrap: balance; }
	.lede { margin: 14px 0 0; max-width: 64ch; color: var(--ink-2); font-size: 16px; line-height: 1.55; }
	.core-intro { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px 48px; align-items: end; margin-bottom: -16px; }
	.core-intro h2 { font-size: 26px; }
	.core-intro .eyebrow { margin-bottom: 10px; }
	.dilation { text-align: right; border-left: 1px solid var(--rule); padding-left: 24px; }
	.dilation .big { font: 500 30px/1.1 var(--mono); font-variant-numeric: tabular-nums; margin-block: 8px 6px; }
	.dilation .small { font-size: 12px; color: var(--ink-3); max-width: 32ch; margin-left: auto; }
	.placeholder { min-height: 1400px; }
	.notes { border-top: 1px solid var(--rule); padding-top: 22px; }
	.notes h2 { font-size: 15px; }
	.notes ul { margin: 12px 0 0; padding-left: 18px; color: var(--ink-2); font-size: 13px; max-width: 78ch; display: flex; flex-direction: column; gap: 8px; list-style: disc; }
	.notes code { font: 12px var(--mono); color: var(--ink); }
	.notes a, .more a { color: var(--ink); text-underline-offset: 2px; text-decoration: underline; }
	.more { color: var(--ink-2); font-size: 13px; margin: 18px 0 0; }

	/* shared across the page's components */
	.mining :global(h2) { font: 600 20px/1.2 var(--sans); letter-spacing: -0.01em; text-wrap: balance; margin: 0; }
	.mining :global(.mono) { font-family: var(--mono); font-variant-numeric: tabular-nums; }
	.mining :global(.eyebrow) { font: 500 11px/1 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-3); margin: 0; }
	.mining :global(.btn) { font: 500 13px var(--sans); color: var(--ink); background: var(--panel-2); border: 1px solid var(--rule-2); border-radius: 6px; padding: 7px 12px; cursor: pointer; }
	.mining :global(.btn:hover:not(:disabled)) { border-color: var(--ink-3); }
	.mining :global(.btn:disabled) { color: var(--ink-3); cursor: default; opacity: 0.7; }
	.mining :global(.btn.primary) { background: var(--ink); color: var(--ground); border-color: var(--ink); min-width: 5.5em; }
	.mining :global(.btn.gold) { border-color: var(--gold); color: var(--gold-ink); background: var(--gold-soft); }
	.mining :global(.btn:focus-visible) { outline: 2px solid var(--steel); outline-offset: 2px; }
	.mining :global(.snd) { display: inline-flex; align-items: center; gap: 7px; }
	.mining :global(.snd .dot) { width: 7px; height: 7px; border-radius: 50%; background: var(--rule-2); }
	.mining :global(.snd[aria-pressed='true'] .dot) { background: var(--steel); box-shadow: 0 0 0 3px var(--steel-soft); }
	.mining :global(fieldset.seg) { border: 0; margin: 0; padding: 0; display: flex; align-items: center; gap: 2px; }
	.mining :global(fieldset.seg legend) { float: left; font-size: 12px; color: var(--ink-3); margin-right: 8px; padding: 0; }
	.mining :global(fieldset.seg input) { position: absolute; opacity: 0; width: 1px; height: 1px; }
	.mining :global(fieldset.seg label) { font: 12px var(--mono); color: var(--ink-2); padding: 6px 8px; border: 1px solid var(--rule); cursor: pointer; }
	.mining :global(fieldset.seg label:first-of-type) { border-radius: 6px 0 0 6px; }
	.mining :global(fieldset.seg label:last-of-type) { border-radius: 0 6px 6px 0; }
	.mining :global(fieldset.seg input:checked + label) { background: var(--ink-2); color: var(--ground); border-color: var(--ink-2); }
	.mining :global(fieldset.seg input:focus-visible + label) { outline: 2px solid var(--steel); outline-offset: 2px; }

	@media (max-width: 760px) {
		.core-intro { grid-template-columns: minmax(0, 1fr); }
		.dilation { text-align: left; border-left: 0; padding-left: 0; border-top: 1px solid var(--rule); padding-top: 14px; }
		.dilation .small { margin-left: 0; }
	}
</style>
