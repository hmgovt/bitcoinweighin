<script lang="ts">
	import { onMount } from 'svelte';
	import { SPEEDS, type MiningController } from '$lib/mining/controller.svelte.js';
	import type { Level, View } from '$lib/mining/core-canvas.js';
	import { POOL_SHARE_BITS, SHARE_BITS } from '$lib/mining/pipeline.js';
	import { K, hex8 } from '$lib/mining/sha256.js';
	import { fmtSci, n0 } from '$lib/mining/format.js';

	let { ctl }: { ctl: MiningController } = $props();

	let wrap: HTMLElement | undefined = $state();
	let canvas: HTMLCanvasElement | undefined = $state();
	let section: HTMLElement | undefined = $state();
	let winEl: HTMLElement | undefined = $state();

	const TAGS = ['new', 'was A', 'was B', 'was C', 'new', 'was E', 'was F', 'was G'];
	const HINTS: Record<Level | 'registers', string> = {
		die: 'Click the outlined core to zoom in.',
		core: 'Click a stage to inspect it. Double-click or press Enter to zoom in, Esc to zoom out.',
		stage: 'Arrow keys step through stages. Esc zooms out.',
		registers: 'Click a stage, or use the arrow keys, to inspect it.',
	};

	// Everything that reads the pipeline goes through `ctl.rev`, which bumps once a frame when it changes.
	const pipe = $derived(ctl.pipe);
	const tpl = $derived.by(() => { void ctl.rev; return pipe.tpl; });
	const last = $derived.by(() => { void ctl.rev; return pipe.last; });
	const insp = $derived.by(() => {
		void ctl.rev;
		const s = ctl.sel;
		const tok = pipe.stations[s];
		const pass = s < 64 ? 1 : 2;
		const r = s % 64;
		if (!tok) return { s, pass, r, tok: null };
		const st = pass === 1 ? tok.s1 : tok.s2;
		const W = pass === 1 ? tok.w1 : tok.w2;
		const regs = Array.from({ length: 8 }, (_, k) => hex8(st[r * 8 + k]));
		let note: string;
		if (pass === 1 && r < 3) note = 'The nonce hasn’t entered yet, so every nonce in this job produces exactly these values. Real chips compute them once per job.';
		else if (pass === 1 && r === 3) note = `W[3] is the nonce, byte-swapped (0x${hex8(tok.w3)}). From this round on, every stage diverges.`;
		else if (pass === 2 && r === 0) note = 'Pass 2 hashes pass 1’s 32-byte result from SHA-256’s standard starting values. Bitcoin always hashes twice.';
		else if (pass === 2 && r === 60) note = 'After this round, register E holds what will become the hash’s top 32 bits. Many chips check here and skip rounds 62–64.';
		else if (r >= 16) note = `W[${r}] is expanded from earlier message words. Each clock, B–D and F–H shift down one place while A and E take fresh mixes of everything.`;
		else note = 'Each clock, B–D and F–H shift down one place while A and E take fresh mixes of everything.';
		return { s, pass, r, tok, regs, w: hex8(W[r]), k: hex8(K[r]), note, winner: tok.nonce === pipe.tracked };
	});
	const found = $derived.by(() => { void ctl.rev; return pipe.found; });
	const replayed = $derived.by(() => { void ctl.rev; return pipe.replayed; });
	const hasNext = $derived.by(() => { void ctl.rev; return pipe.hasNextTemplate; });
	const refillWait = $derived.by(() => { void ctl.rev; return pipe.last ? 0 : pipe.refillWait(); });
	const clock = $derived.by(() => { void ctl.rev; return pipe.clock; });
	const hint = $derived(ctl.view === 'registers' ? HINTS.registers : HINTS[ctl.level]);

	function zeroSplit(hex: string, zeros: number) { const zc = zeros >> 2; return [hex.slice(0, zc), hex.slice(zc)]; }

	function width() { return wrap?.clientWidth ?? 800; }
	function onCanvasClick(e: MouseEvent) {
		if (!canvas || !ctl.canvas) return;
		const r = canvas.getBoundingClientRect();
		const h = ctl.canvas.hit(e.clientX - r.left, e.clientY - r.top);
		if (h.die) ctl.zoomTo('core');
		else if (h.station !== undefined) ctl.select(h.station);
	}
	function onCanvasDbl(e: MouseEvent) {
		if (!canvas || !ctl.canvas || ctl.view !== 'silicon' || ctl.level !== 'core') return;
		const r = canvas.getBoundingClientRect();
		const h = ctl.canvas.hit(e.clientX - r.left, e.clientY - r.top);
		if (h.station !== undefined) { ctl.select(h.station); ctl.zoomTo('stage'); }
	}
	function onCanvasMove(e: MouseEvent) {
		if (!canvas || !ctl.canvas) return;
		if (ctl.view !== 'silicon') { canvas.style.cursor = 'crosshair'; return; }
		const r = canvas.getBoundingClientRect();
		const h = ctl.canvas.hit(e.clientX - r.left, e.clientY - r.top);
		canvas.style.cursor = h.die || h.station !== undefined ? 'pointer' : 'default';
	}
	function onKey(e: KeyboardEvent) {
		if (ctl.view === 'silicon' && ctl.canvas && !ctl.canvas.animating) {
			if (e.key === 'Escape' && ctl.level !== 'die') { e.preventDefault(); ctl.zoomTo(ctl.level === 'stage' ? 'core' : 'die'); return; }
			if (e.key === 'Enter' && ctl.level !== 'stage') { e.preventDefault(); ctl.zoomTo(ctl.level === 'die' ? 'core' : 'stage'); return; }
		}
		const cols = ctl.canvas?.cols ?? 16;
		const m = ({ ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols } as Record<string, number>)[e.key];
		if (m === undefined) return;
		e.preventDefault();
		ctl.select(ctl.sel + m);
	}
	function setView(v: View) { ctl.setView(v, width()); }

	onMount(() => {
		if (!canvas || !wrap || !section) return;
		ctl.attachCanvas(canvas, width());
		let w = width();
		const ro = new ResizeObserver(() => {
			const nw = width();
			if (nw === w) return;
			w = nw;
			ctl.canvas?.layout(nw);
		});
		ro.observe(wrap);
		const vis = new IntersectionObserver(([e]) => ctl.setCanvasVisible(e.isIntersecting), { rootMargin: '200px 0px' });
		vis.observe(canvas);
		const unzone = ctl.observeZone('pipeline', section);
		return () => { ro.disconnect(); vis.disconnect(); unzone(); };
	});

	$effect(() => {
		if (ctl.winTok && winEl) {
			const el = winEl;
			requestAnimationFrame(() => el.scrollIntoView({ block: 'nearest', behavior: ctl.reduced ? 'auto' : 'smooth' }));
		}
	});
</script>

<section class="instrument" bind:this={section} aria-label="Hash core simulation">
	<div class="controls">
		<button class="btn primary" type="button" disabled={found} onclick={() => ctl.setPlaying(!ctl.playing)}>{ctl.playing ? 'Pause' : 'Play'}</button>
		<button class="btn" type="button" disabled={found} onclick={() => ctl.step()}>Step one clock</button>
		<fieldset class="seg">
			<legend>Clock</legend>
			{#each SPEEDS as s, i}
				<input type="radio" name="mining-speed" id="mining-speed-{s}" checked={ctl.speedIdx === i} onchange={() => ctl.setSpeed(i)} />
				<label for="mining-speed-{s}">{s >= 1000 ? '1k' : s}/s</label>
			{/each}
		</fieldset>
		<span class="clockread"><span class="led" class:on={ctl.playing && (ctl.speed > 15 || clock % 2 === 0)}></span>clock {n0(clock)}</span>
		<button class="btn snd" type="button" aria-pressed={ctl.soundOn} onclick={() => ctl.setSound(!ctl.soundOn)}><span class="dot"></span>Sound</button>
		<span class="spacer"></span>
		<button class="btn gold" type="button" disabled={found || replayed} onclick={() => ctl.replay()} data-umami-event="mining-replay-click">
			{found ? `Block ${n0(tpl.height)} found` : replayed ? 'Replaying…' : 'Replay the real find'}
		</button>
		<button class="btn" type="button" disabled={!hasNext} title={hasNext ? undefined : 'No newer block is loaded yet.'} onclick={() => ctl.cleanJobs()}>New block: clean_jobs</button>
	</div>
	<div class="viewbar">
		<fieldset class="seg">
			<legend>View</legend>
			<input type="radio" name="mining-view" id="mining-view-silicon" checked={ctl.view === 'silicon'} onchange={() => setView('silicon')} />
			<label for="mining-view-silicon">Silicon</label>
			<input type="radio" name="mining-view" id="mining-view-registers" checked={ctl.view === 'registers'} onchange={() => setView('registers')} />
			<label for="mining-view-registers">Registers</label>
		</fieldset>
		{#if ctl.view === 'silicon'}
			<fieldset class="seg">
				<legend>Zoom</legend>
				{#each [['die', 'Die'], ['core', 'Core'], ['stage', `Stage ${ctl.sel + 1}`]] as [lv, label]}
					<input type="radio" name="mining-zoom" id="mining-zoom-{lv}" checked={ctl.level === lv} onchange={() => ctl.zoomTo(lv as Level)} />
					<label for="mining-zoom-{lv}">{label}</label>
				{/each}
			</fieldset>
		{/if}
		<span class="hint">{hint}</span>
	</div>
	<p class="status" aria-live="polite">{ctl.status}</p>
	<div class="pipewrap" bind:this={wrap}>
		<canvas
			bind:this={canvas}
			tabindex="0"
			aria-label={ctl.view === 'silicon'
				? 'Representative silicon layout of the hash core, zoomable from die to core to a single stage. Flip-flops glow when their bit flips on this clock. Arrow keys move between stages, Enter zooms in, Escape zooms out.'
				: 'Pipeline of 128 stages. Each column is one stage holding one nonce in flight; its eight bands are SHA-256 registers A to H. Click or use arrow keys to inspect a stage.'}
			onclick={onCanvasClick}
			ondblclick={onCanvasDbl}
			onmousemove={onCanvasMove}
			onkeydown={onKey}
		></canvas>
	</div>
	<div class="lower">
		<div>
			<span class="eyebrow">Station inspector</span>
			<div class="insp-title">Stage {insp.s + 1} of 128 · pass {insp.pass}, round {insp.r + 1}</div>
			{#if !insp.tok}
				<p class="insp-note">Empty. The pipeline is refilling after clean_jobs, so nothing has reached this stage yet.</p>
			{:else}
				<div class="insp-sub">holding nonce 0x{hex8(insp.tok.nonce)}{insp.winner ? ' · the winning nonce' : ''}</div>
				<div class="regs">
					{#each insp.regs ?? [] as v, k}
						<div class="reg" class:new={k === 0 || k === 4}>
							<div class="k"><span>{'ABCDEFGH'[k]}</span><span>{TAGS[k]}</span></div>
							<div class="v">{v}</div>
						</div>
					{/each}
				</div>
				<div class="insp-w"><span>W[{insp.r}] = {insp.w}</span><span>K[{insp.r}] = {insp.k}</span></div>
				<p class="insp-note">{insp.note}</p>
			{/if}
		</div>
		<div>
			{#if !last}
				<div class="cmp-head"><span class="eyebrow">Comparator</span><span class="chip wait">idle</span></div>
				<p class="cmp-note">Nothing to check. The pipeline is refilling, and the first result arrives in {refillWait} clock{refillWait === 1 ? '' : 's'}.</p>
			{:else}
				{@const [z, rest] = zeroSplit(last.tok.hex, last.tok.zeros)}
				<div class="cmp-head"><span class="eyebrow">Comparator · last result</span><span class="chip {last.v}">{last.v}</span></div>
				<div class="cmp-z"><span class="big">{last.tok.zeros}</span><span>leading zero bits</span></div>
				<div class="cmp-hash"><span class="z">{z}</span>{rest}</div>
				<ul class="thr">
					<li class:pass={last.tok.zeros >= SHARE_BITS}><span class="m">{last.tok.zeros >= SHARE_BITS ? '✓' : '·'}</span><span>Demo share · ≥ {SHARE_BITS} bits</span><span class="odds">1 in 256</span></li>
					<li class:pass={last.tok.zeros >= POOL_SHARE_BITS}><span class="m">{last.tok.zeros >= POOL_SHARE_BITS ? '✓' : '·'}</span><span>Real pool share · ≈ {POOL_SHARE_BITS} bits</span><span class="odds">1 in {fmtSci(2 ** POOL_SHARE_BITS)}</span></li>
					<li class="blk" class:pass={last.v === 'block'}><span class="m">{last.v === 'block' ? '✓' : '·'}</span><span>Block {n0(tpl.height)} · ≥ {tpl.targetZeros} bits, under target</span><span class="odds">1 in {fmtSci(tpl.expected)}</span></li>
				</ul>
				<p class="cmp-note">{last.v === 'block' ? 'The nonce is latched and sent off-chip.' : 'Then it’s gone. The core keeps nothing: not the hash, and not how close it came.'}</p>
			{/if}
		</div>
	</div>
</section>

{#if ctl.winTok}
	<section class="win" bind:this={winEl} aria-live="polite">
		<span class="eyebrow">Block found</span>
		<h2>Nonce 0x{hex8(ctl.winTok.nonce)} cleared the target, and on the chip it looked exactly like every failure.</h2>
		<p>Its hash has {ctl.winTok.zeros} leading zero bits. Block {n0(tpl.height)} needed at least {tpl.targetZeros}, and a value under the target.</p>
		<ol class="steps">
			<li class="done"><div><b>The comparator's output goes high.</b><span>One bit, for one clock. <span class="where">this core</span></span></div></li>
			<li class="done"><div><b>The chip latches the 32-bit nonce into its result buffer.</b><span>Only the nonce, not the hash. Nothing else it tried was ever kept. <span class="where">this chip</span></span></div></li>
			<li><div><b>The control board reads it over a serial link and sends it to the pool, like any other share.</b></div></li>
			<li><div><b>The pool sees it also clears the network target, builds the block and broadcasts it.</b></div></li>
			<li class="act">
				<div>
					<b>Within seconds every miner on earth gets clean_jobs and throws away everything in flight.</b>
					<button class="btn gold" type="button" disabled={!hasNext} onclick={() => ctl.cleanJobs()}>
						{hasNext ? 'Send clean_jobs to this core' : 'No newer block is loaded yet'}
					</button>
				</div>
			</li>
		</ol>
	</section>
{/if}

<style>
	.instrument { background: var(--panel); border: 1px solid var(--rule); border-radius: 10px; padding: 16px 18px 20px; display: flex; flex-direction: column; gap: 14px; scroll-margin-top: 16px; }
	.controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; }
	.viewbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; }
	.hint { font-size: 12px; color: var(--ink-3); }
	.spacer { flex: 1; }
	.clockread { display: flex; align-items: center; gap: 8px; font: 12px var(--mono); color: var(--ink-3); font-variant-numeric: tabular-nums; }
	.led { width: 8px; height: 8px; border-radius: 50%; background: var(--rule-2); }
	.led.on { background: var(--ink); }
	.status { font-size: 13px; color: var(--ink-2); min-height: 1.5em; max-width: 90ch; margin: 0; }
	.pipewrap { width: 100%; }
	.pipewrap canvas { display: block; }
	.pipewrap canvas:focus-visible { outline: 2px solid var(--steel); outline-offset: 2px; }
	.lower { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 16px; }
	.lower > div { border-top: 1px solid var(--rule); padding-top: 14px; }
	.lower .eyebrow { margin-bottom: 10px; display: block; }
	.insp-title { font: 500 15px var(--sans); }
	.insp-sub { font: 12px var(--mono); color: var(--ink-3); margin-top: 3px; word-break: break-all; }
	.regs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin-top: 12px; }
	.reg { border: 1px solid var(--rule); border-radius: 5px; padding: 6px 8px; }
	.reg .k { display: flex; justify-content: space-between; font-size: 11px; color: var(--ink-3); }
	.reg .v { font: 12.5px var(--mono); color: var(--ink-3); margin-top: 2px; }
	.reg.new { border-color: var(--ink-3); }
	.reg.new .v { color: var(--ink); }
	.insp-w { font: 12px var(--mono); color: var(--ink-2); margin-top: 10px; display: flex; flex-wrap: wrap; gap: 4px 18px; }
	.insp-note { font-size: 12.5px; color: var(--ink-2); margin: 8px 0 0; max-width: 70ch; }
	.cmp-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
	.cmp-head .eyebrow { margin: 0; }
	.chip { font: 500 11px var(--mono); letter-spacing: 0.06em; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; border: 1px solid transparent; }
	.chip.discard { color: var(--ink-3); border-color: var(--rule); }
	.chip.share { color: var(--steel); border-color: var(--steel); background: var(--steel-soft); }
	.chip.block { color: var(--ground); background: var(--gold); }
	.chip.wait { color: var(--ink-3); }
	.cmp-z { display: flex; align-items: baseline; gap: 10px; margin-top: 10px; color: var(--ink-2); font-size: 13px; }
	.cmp-z .big { font: 500 40px/1 var(--mono); color: var(--ink); }
	.cmp-hash { font: 11.5px/1.5 var(--mono); color: var(--ink-3); word-break: break-all; margin-top: 8px; }
	.cmp-hash .z { color: var(--ink); }
	.thr { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; }
	.thr li { display: grid; grid-template-columns: 1.2em minmax(0, 1fr) auto; gap: 8px; color: var(--ink-3); }
	.thr .odds { font: 11.5px var(--mono); }
	.thr li.pass { color: var(--ink); }
	.thr li.pass .m { color: var(--steel); }
	.thr li.pass.blk, .thr li.pass.blk .m { color: var(--gold-ink); }
	.cmp-note { font-size: 12px; color: var(--ink-3); margin: 10px 0 0; }

	.win { border: 1px solid var(--gold); border-radius: 10px; padding: 22px 22px 24px; background: linear-gradient(180deg, var(--gold-soft), transparent 70%); }
	.win .eyebrow { color: var(--gold-ink); margin-bottom: 10px; display: block; }
	.win h2 { font-size: 22px; max-width: 36ch; margin: 0; }
	.win > p { color: var(--ink-2); margin: 8px 0 0; }
	.steps { margin: 20px 0 0; padding: 0; list-style: none; counter-reset: s; display: flex; flex-direction: column; gap: 12px; max-width: 78ch; }
	.steps li { counter-increment: s; display: grid; grid-template-columns: 1.8em minmax(0, 1fr); gap: 4px 10px; color: var(--ink-3); }
	.steps li::before { content: counter(s); font: 500 12px/1.6 var(--mono); color: var(--rule-2); }
	.steps li.done { color: var(--ink); }
	.steps li.done::before { color: var(--gold-ink); }
	.steps li b { font-weight: 500; }
	.steps .where { font: 11px var(--mono); color: var(--ink-3); margin-left: 6px; letter-spacing: 0.04em; }
	.steps li.act { color: var(--ink-2); }
	.steps li > div { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }

	@media (max-width: 760px) { .lower { grid-template-columns: minmax(0, 1fr); } }
	@media (max-width: 520px) {
		.instrument { padding: 12px 12px 16px; }
		.regs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	}
</style>
