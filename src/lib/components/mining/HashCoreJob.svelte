<script lang="ts">
	import type { MiningController } from '$lib/mining/controller.svelte.js';
	import { hex8 } from '$lib/mining/sha256.js';
	import { fmtDur, n0 } from '$lib/mining/format.js';
	import { S21_HS } from '$lib/mining/controller.svelte.js';

	let { ctl }: { ctl: MiningController } = $props();

	const pipe = $derived(ctl.pipe);
	const tpl = $derived.by(() => { void ctl.rev; return pipe.tpl; });
	const verify = $derived(pipe.verify(tpl));
	const entering = $derived.by(() => { void ctl.rev; return pipe.stations[0]?.nonce ?? null; });
	const rolled = $derived((tpl.version & 0x1fffe000) !== 0);
	const time = $derived(new Date(tpl.time * 1000).toISOString().replace('T', ' ').replace('.000Z', ' UTC'));
</script>

<section class="job" aria-labelledby="job-h">
	<div class="sechead">
		<h3 id="job-h">The job</h3>
		<p>Block {n0(tpl.height)}'s real header, from mempool.space</p>
		<p class="verify" class:bad={!verify.ok}>
			{#if verify.ok}
				<b>Verified in your browser:</b> with its winning nonce, this header double-hashes to
				<span class="mono">{tpl.hash.slice(0, 22)}…{tpl.hash.slice(-6)}</span>, the real hash of block {n0(tpl.height)}.
			{:else}
				<b>Hash mismatch.</b> This page computed {verify.hex}, expected {tpl.hash}.
			{/if}
		</p>
	</div>
	<div class="bytes" aria-hidden="true">
		<div class="brackets">
			<div style="flex-grow:64"><span>Block 1 · 64 bytes → midstate, hashed once per job</span><i></i></div>
			<div style="flex-grow:16"><span>Block 2 · re-hashed for every nonce</span><i></i></div>
		</div>
		<div class="bar">
			<div class="seg" style="flex-grow:4">ver</div>
			<div class="seg" style="flex-grow:32">previous block hash</div>
			<div class="seg" style="flex-grow:28">merkle root</div>
			<div class="seg b2" style="flex-grow:4">mrkl</div>
			<div class="seg b2" style="flex-grow:4">time</div>
			<div class="seg b2" style="flex-grow:4">bits</div>
			<div class="seg b2 nonce" style="flex-grow:4">{entering !== null ? hex8(entering) : 'nonce'}</div>
		</div>
		<div class="bytescale"><span>byte 0</span><span>64</span><span>80</span></div>
	</div>
	<dl class="fields">
		<dt>Version</dt><dd>0x{hex8(tpl.version)}{#if rolled}<small>version-rolling bits set (BIP 320)</small>{/if}</dd>
		<dt>Previous block</dt><dd>{tpl.prev}</dd>
		<dt>Merkle root</dt><dd>{tpl.merkle}<small>commits to every transaction in the block</small></dd>
		<dt>Time</dt><dd>{time}</dd>
		<dt>Bits (target)</dt><dd>0x{hex8(tpl.bits)}<small>a block needs ≥ {tpl.targetZeros} leading zero bits · difficulty {(tpl.difficulty / 1e12).toFixed(2)} T</small></dd>
		<dt>Nonce entering</dt><dd>{#if entering !== null}0x{hex8(entering)}<small>{n0(entering)} of 4,294,967,296</small>{:else}—{/if}</dd>
		<dt>Midstate</dt><dd>{Array.from(tpl.midstate, hex8).join(' ')}<small>SHA-256 state after block 1, computed once and reused for every nonce</small></dd>
	</dl>
	<div class="gauge" aria-hidden="true"><i style="left:{entering !== null ? ((entering / 4294967296) * 100).toFixed(3) : 0}%"></i></div>
	<p class="gaugecap">
		The nonce is only 32 bits. At this page's clock, sweeping all 4.29 billion values would take {fmtDur(4294967296 / ctl.speed)}.
		An S21-class miner sweeps them in {fmtDur(4294967296 / S21_HS)}, about {n0(Math.round(S21_HS / 4294967296))} times a second, so real miners also roll the timestamp, version bits and extranonce.
	</p>
</section>

<style>
	.sechead { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 14px; margin-bottom: 18px; }
	.sechead h3 { margin: 0; font: 600 17px/1.2 var(--sans); }
	.sechead p { color: var(--ink-2); font-size: 13px; margin: 0; }
	.verify { font-size: 12px; color: var(--ink-3) !important; flex-basis: 100%; }
	.verify b { color: var(--ink-2); font-weight: 500; }
	.verify.bad b { color: #f87171; }
	.brackets, .bar { display: flex; gap: 2px; }
	.brackets > div { flex-basis: 0; min-width: 0; font-size: 11.5px; color: var(--ink-3); }
	.brackets > div span { display: block; padding-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.brackets > div i { display: block; height: 7px; border: 1px solid var(--rule-2); border-bottom: 0; }
	.bar { height: 34px; margin-top: 3px; }
	.seg { flex-basis: 0; min-width: 0; background: var(--panel-2); border: 1px solid var(--rule); font: 10.5px var(--mono); color: var(--ink-3); padding-inline: 5px; display: flex; align-items: center; overflow: hidden; white-space: nowrap; }
	.seg.b2 { background: #222228; color: var(--ink-2); }
	.seg.nonce { border-color: var(--ink-2); color: var(--ink); }
	.bytescale { display: flex; justify-content: space-between; font: 10px var(--mono); color: var(--ink-3); margin-top: 5px; }
	.bytescale span:nth-child(2) { margin-left: auto; margin-right: calc(20% - 12px); }
	.fields { display: grid; grid-template-columns: 9.5rem minmax(0, 1fr); gap: 7px 18px; margin: 22px 0 0; }
	.fields dt { color: var(--ink-3); font-size: 12.5px; }
	.fields dd { margin: 0; font: 12.5px/1.5 var(--mono); word-break: break-all; color: var(--ink); }
	.fields dd small { font: 12px var(--sans); color: var(--ink-3); word-break: normal; margin-left: 8px; }
	.gauge { position: relative; height: 4px; background: var(--panel-2); border-radius: 2px; margin: 10px 0 8px; max-width: 520px; }
	.gauge i { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--ink); }
	.gaugecap { font-size: 12px; color: var(--ink-3); max-width: 70ch; margin: 0; }
	@media (max-width: 520px) {
		.fields { grid-template-columns: minmax(0, 1fr); gap: 2px; }
		.fields dd { margin-bottom: 8px; }
		.brackets > div span { font-size: 10px; }
	}
</style>
