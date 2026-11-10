<script lang="ts">
	import { onMount } from 'svelte';
	import { CLOCK_HZ, S21_HS, type MiningController } from '$lib/mining/controller.svelte.js';
	import { fmtBig, n0 } from '$lib/mining/format.js';

	let { ctl }: { ctl: MiningController } = $props();

	let elapsed = $state(0);
	const shown = $derived.by(() => { void ctl.rev; return ctl.pipe.total; });
	const net = $derived.by(() => { void ctl.rev; return ctl.pipe.tpl.expected / 600; });

	onMount(() => {
		const id = setInterval(() => { elapsed = (performance.now() - ctl.t0) / 1000; }, 100);
		return () => clearInterval(id);
	});
</script>

<section class="realtime" aria-labelledby="rt-h">
	<h2 id="rt-h">Meanwhile, at real speed</h2>
	<p>Since you opened this page <span class="mono">{Math.floor(elapsed / 60)}:{String(Math.floor(elapsed % 60)).padStart(2, '0')}</span> ago:</p>
	<div class="stats">
		<div class="stat"><div class="l">This page has shown you</div><div class="v">{n0(shown)}</div><div class="s">hashes</div></div>
		<div class="stat"><div class="l">This core, running at 500 MHz</div><div class="v">{fmtBig(elapsed * CLOCK_HZ)}</div><div class="s">hashes</div></div>
		<div class="stat"><div class="l">One S21-class miner, 234 TH/s</div><div class="v">{n0(Math.floor((elapsed * S21_HS) / 4294967296))}</div><div class="s">sweeps through all 4.29 billion nonces</div></div>
		<div class="stat"><div class="l">The whole network, ≈ {Math.round(net / 1e18)} EH/s</div><div class="v">{fmtBig(elapsed * net)}</div><div class="s">hashes, {(elapsed / 6).toFixed(1)}% of one block's expected work</div></div>
	</div>
</section>

<style>
	h2 { margin: 0; }
	.realtime > p { color: var(--ink-2); margin: 6px 0 0; }
	.stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 18px; }
	.stat { padding: 2px 18px 4px; border-left: 1px solid var(--rule); }
	.stat:first-child { border-left: 0; padding-left: 0; }
	.l { font-size: 12px; color: var(--ink-3); }
	.v { font: 500 21px/1.25 var(--mono); margin-top: 6px; font-variant-numeric: tabular-nums; }
	.s { font-size: 12px; color: var(--ink-3); margin-top: 4px; }
	@media (max-width: 860px) {
		.stats { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 18px; }
		.stat:nth-child(3) { border-left: 0; padding-left: 0; }
	}
	@media (max-width: 520px) {
		.stats { grid-template-columns: minmax(0, 1fr); }
		.stat { border-left: 0; padding-left: 0; }
	}
</style>
