<script lang="ts">
	import { onMount } from 'svelte';
	import type { MiningController } from '$lib/mining/controller.svelte.js';
	import { POOL_SHARE_BITS, SHARE_BITS } from '$lib/mining/pipeline.js';
	import { drawHistogram } from '$lib/mining/histogram.js';
	import { hex8 } from '$lib/mining/sha256.js';
	import { n0 } from '$lib/mining/format.js';

	let { ctl }: { ctl: MiningController } = $props();

	const pipe = $derived(ctl.pipe);
	let histWrap: HTMLElement | undefined = $state();
	let hist: HTMLCanvasElement | undefined = $state();
	let width = $state(0);
	let visible = $state(true);

	const stats = $derived.by(() => {
		void ctl.rev;
		return { total: pipe.total, shares: pipe.shares, maxZeros: pipe.maxZeros, target: pipe.tpl.targetZeros, tape: pipe.tape.slice() };
	});

	$effect(() => {
		void ctl.rev;
		if (!hist || !width || !visible) return;
		drawHistogram(hist, width, { counts: pipe.counts, total: pipe.total, shareBits: SHARE_BITS, poolBits: POOL_SHARE_BITS, targetZeros: pipe.tpl.targetZeros });
	});

	onMount(() => {
		if (!histWrap) return;
		const ro = new ResizeObserver(() => { width = histWrap?.clientWidth ?? 0; });
		ro.observe(histWrap);
		const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: '200px 0px' });
		io.observe(histWrap);
		return () => { ro.disconnect(); io.disconnect(); };
	});
</script>

<section class="results">
	<div>
		<h3>Every hash so far, by leading zero bits</h3>
		<div bind:this={histWrap}>
			<canvas bind:this={hist} aria-label="Histogram of leading zero bits across all hashes checked so far, on a log scale, against the share and block thresholds."></canvas>
		</div>
		<p class="histnote">
			<b>{n0(stats.total)}</b> hashes checked · <b>{n0(stats.shares)}</b> demo shares · the most zeros so far is <b>{stats.maxZeros}</b> bits, against {stats.target} for a block.
			Each extra bit halves the odds, and no hash is ever close: {stats.maxZeros} bits tells you nothing about the next one. The dashed line is what perfectly random output predicts. Log scale; the x axis is leading zero bits.
		</p>
	</div>
	<div>
		<h3>Comparator output, newest first</h3>
		<div class="thead"><span>nonce</span><span>hash</span><span>bits</span><span>verdict</span></div>
		<div class="tape">
			{#each stats.tape as row}
				{#if row.divider}
					<div class="trow div">{row.text}</div>
				{:else}
					<div class="trow {row.v}">
						<span>{hex8(row.nonce)}</span>
						<span class="th"><span class="z">{row.hex.slice(0, row.zeros >> 2)}</span>{row.hex.slice(row.zeros >> 2)}</span>
						<span class="tz">{row.zeros}</span>
						<span class="tv">{row.v === 'block' ? 'BLOCK' : row.v}</span>
					</div>
				{/if}
			{/each}
		</div>
	</div>
</section>

<style>
	.results { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 32px; }
	h3 { font: 500 13px/1.3 var(--sans); color: var(--ink-2); margin: 0 0 12px; }
	canvas { display: block; }
	.histnote { font-size: 12.5px; color: var(--ink-3); margin: 10px 0 0; max-width: 64ch; }
	.histnote b { color: var(--ink-2); font-weight: 500; }
	.tape { min-height: 330px; }
	.trow, .thead { display: grid; grid-template-columns: 6.2em minmax(0, 1fr) 2.4em 5.2em; gap: 10px; align-items: center; }
	.trow { font: 12px var(--mono); padding: 5px 0; border-bottom: 1px solid var(--rule); color: var(--ink-3); font-variant-numeric: tabular-nums; }
	.th { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.th .z { color: var(--ink); }
	.tz { text-align: right; color: var(--ink-2); }
	.tv { text-align: right; }
	.trow.share .tv, .trow.share .tz { color: var(--steel); }
	.trow.block, .trow.block .tv, .trow.block .tz, .trow.block .z { color: var(--gold-ink); }
	.trow.div { display: block; font: italic 11.5px var(--sans); color: var(--ink-3); padding: 7px 0; }
	.thead { font-size: 11px; color: var(--ink-3); padding-bottom: 6px; border-bottom: 1px solid var(--rule-2); }
	.thead span:nth-child(n + 3) { text-align: right; }
	@media (max-width: 860px) { .results { grid-template-columns: minmax(0, 1fr); } }
	@media (max-width: 520px) { .trow, .thead { grid-template-columns: 5.6em minmax(0, 1fr) 2em 4.6em; gap: 6px; } }
</style>
