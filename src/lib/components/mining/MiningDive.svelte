<script lang="ts">
	/**
	 * The 3D dive at the top of /mining. three.js and the scene are loaded
	 * lazily, so nothing else on the site pays for them.
	 */
	import { onMount } from 'svelte';
	import type { MiningController } from '$lib/mining/controller.svelte.js';
	import { track } from '$lib/mining/controller.svelte.js';
	import type { DiveController } from '$lib/mining/dive-scene.js';

	let { ctl, onHandoff }: { ctl: MiningController | null; onHandoff: () => void } = $props();

	const BEATS = [
		{ name: 'Hashboard', title: 'One hashboard', text: 'An S21-class miner holds three of these boards, each carrying around a hundred identical chips under a heatsink (left off here). Every chip runs the pipeline this page shows, around the clock.' },
		{ name: 'Chip', title: 'One chip', text: 'From above, a chip is a small square circuit board, the substrate, with a polished slab of silicon on top. That mirror finish is the back of the die. The circuits are on its underside, facing the board.' },
		{ name: 'Exploded', title: 'Taken apart', text: 'Solder balls fix the package to the board. The substrate fans the die’s dense connections out to the wider ball grid. A tight grid of micro-bumps, sealed in epoxy underfill, carries power in and results out. The die sits on top, face-down. This is flip-chip packaging.' },
		{ name: 'Die face', title: 'The die, turned over', text: 'Turn the die over and the circuitry faces you. Almost all of it is hash cores: one design, copied across the die. The outlined core is the one simulated on this page, and its glow follows that pipeline’s real switching activity.' },
		{ name: 'Into the core', title: 'Into one core', text: 'Diving into the outlined core. It carries on in the simulation below.' },
	];

	let stage: HTMLElement | undefined = $state();
	let canvas: HTMLCanvasElement | undefined = $state();
	let labels: HTMLElement | undefined = $state();
	let fade: HTMLElement | undefined = $state();
	let beat = $state(0);
	let failed = $state(false);
	let autoplaying = $state(false);
	let dive: DiveController | null = null;
	let playTok = 0;

	function stopPlay() { playTok++; autoplaying = false; }

	async function playDive() {
		const tok = ++playTok;
		autoplaying = true;
		track('mining-dive-play');
		const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
		const hold = [2600, 4200, 5600, 5200];
		for (let i = 0; i < 4; i++) {
			dive?.goToBeat(i);
			await wait((ctl?.reduced ? 0 : 2100) + hold[i]);
			if (tok !== playTok) return;
		}
		dive?.goToBeat(4);
	}

	function pick(i: number) {
		stopPlay();
		dive?.goToBeat(i);
	}

	onMount(() => {
		let gone = false;
		import('$lib/mining/dive-scene.js')
			.then(({ createDiveScene }) => {
				if (gone || !stage || !canvas || !labels || !fade) return;
				try {
					dive = createDiveScene({
						stage, canvas, labels, fade,
						reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
						live: () => ({
							activity: ctl ? ctl.pipe.totalActivity().act : 0.45,
							clock: ctl ? ctl.pipe.clock : 0,
							pulse: ctl ? ctl.pulse(performance.now()) : 0.8,
						}),
						onBeat: (i, instant) => { beat = i; ctl?.sound.beat(i, instant); },
						onHandoff: () => { stopPlay(); onHandoff(); },
					});
				} catch {
					failed = true;
				}
			})
			.catch(() => { failed = true; });
		return () => {
			gone = true;
			stopPlay();
			dive?.destroy();
		};
	});

	$effect(() => {
		if (!ctl || !stage) return;
		return ctl.observeZone('dive', stage);
	});

	$effect(() => {
		// Dragging to orbit takes over from the autoplay.
		if (!canvas) return;
		const stop = () => { if (autoplaying) stopPlay(); };
		canvas.addEventListener('pointerdown', stop);
		return () => canvas?.removeEventListener('pointerdown', stop);
	});
</script>

<section class="dive" aria-labelledby="dive-title">
	<div class="stage3d" bind:this={stage}>
		<canvas bind:this={canvas} hidden={failed} aria-label="3D model of a mining chip on a hashboard. Use the steps below to take it apart, or drag to orbit."></canvas>
		<div class="labels" bind:this={labels} aria-hidden="true"></div>
		<p class="eyebrow corner">From hashboard to hash core</p>
		{#if !failed}<p class="dragnote">Drag to orbit</p>{/if}
		<button
			class="btn snd"
			type="button"
			aria-pressed={ctl?.soundOn ?? false}
			disabled={!ctl}
			onclick={() => ctl?.setSound(!ctl.soundOn)}
		><span class="dot"></span>Sound</button>
		<div class="fade3d" bind:this={fade}></div>
		{#if failed}
			<p class="glfail">This browser couldn't start WebGL, so the 3D model can't be shown. Everything below works without it.</p>
		{/if}
	</div>
	<div class="divebar">
		<ol class="beats">
			{#each BEATS as b, i}
				<li>
					<button type="button" aria-pressed={beat === i} disabled={failed} onclick={() => pick(i)}>
						<span class="n">{i + 1}</span>{b.name}
					</button>
				</li>
			{/each}
		</ol>
		<button class="btn gold" type="button" disabled={failed} onclick={() => (autoplaying ? stopPlay() : playDive())}>
			{autoplaying ? 'Stop' : 'Play the dive'}
		</button>
	</div>
	<div class="beatcap" aria-live="polite">
		<h2 id="dive-title">{BEATS[beat].title}</h2>
		<p>{BEATS[beat].text}</p>
	</div>
</section>

<style>
	.dive { display: flex; flex-direction: column; gap: 14px; }
	.stage3d { position: relative; height: clamp(380px, 54vw, 620px); border-radius: 12px; overflow: hidden; border: 1px solid var(--rule); background: #0e0e11; }
	.stage3d canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: pan-y; cursor: grab; }
	.stage3d canvas:active { cursor: grabbing; }
	.corner { position: absolute; left: 16px; top: 15px; pointer-events: none; margin: 0; }
	.dragnote { position: absolute; right: 14px; bottom: 12px; font-size: 11.5px; color: var(--ink-3); pointer-events: none; margin: 0; }
	.stage3d .snd { position: absolute; top: 9px; right: 10px; font-size: 12px; padding: 5px 10px; background: rgba(22, 22, 26, 0.82); }
	.labels { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
	.labels :global(.lab) { position: absolute; left: 0; top: 0; opacity: 0; transition: opacity 0.35s; will-change: transform; }
	.labels :global(.lab.on) { opacity: 1; }
	.labels :global(.lab i) { position: absolute; width: 5px; height: 5px; left: -2.5px; top: -2.5px; border-radius: 50%; background: var(--ink); box-shadow: 0 0 0 3px rgba(14, 14, 17, 0.55); }
	.labels :global(.lab span) { position: absolute; left: 0; bottom: 3px; border-left: 1px solid rgba(231, 229, 228, 0.5); padding: 0 0 20px 8px; white-space: nowrap; font: 500 12.5px/1.3 var(--sans); color: var(--ink); text-shadow: 0 1px 10px #000, 0 0 2px #000; }
	.labels :global(.lab span small) { display: block; font: 400 11.5px/1.35 var(--sans); color: var(--ink-2); }
	.labels :global(.lab.l span) { left: auto; right: 0; border-left: 0; border-right: 1px solid rgba(231, 229, 228, 0.5); padding: 0 8px 20px 0; text-align: right; }
	.fade3d { position: absolute; inset: 0; background: #0e0e11; opacity: 0; transition: opacity 0.45s; pointer-events: none; }
	.fade3d:global(.on) { opacity: 1; }
	.glfail { position: absolute; inset: 0; display: grid; place-items: center; padding: 24px; text-align: center; color: var(--ink-2); margin: 0; }
	.divebar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 16px; }
	.beats { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px; }
	.beats button { font: 500 12.5px var(--sans); color: var(--ink-3); background: none; border: 1px solid var(--rule); border-radius: 6px; padding: 6px 10px; cursor: pointer; display: flex; gap: 7px; align-items: baseline; }
	.beats button .n { font: 500 11px var(--mono); }
	.beats button:hover:not(:disabled) { color: var(--ink-2); border-color: var(--rule-2); }
	.beats button[aria-pressed='true'] { color: var(--ink); border-color: var(--ink-3); background: var(--panel-2); }
	.beats button:focus-visible { outline: 2px solid var(--steel); outline-offset: 2px; }
	.beatcap h2 { margin: 0; }
	.beatcap p { color: var(--ink-2); max-width: 72ch; margin: 6px 0 0; }
	@media (max-width: 640px) {
		.labels :global(.lab span small) { display: none; }
		.labels :global(.lab span) { font-size: 11.5px; padding-bottom: 14px; }
	}
</style>
