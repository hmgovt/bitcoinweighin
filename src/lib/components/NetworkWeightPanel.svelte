<script lang="ts">
	/**
	 * Hashweight — what the machines securing Bitcoin weigh, now and since
	 * 2014. The live hashrate and its full history (mempool.space) run
	 * through the cohort fleet model (src/lib/hashweight/fleet.ts); the
	 * result is drawn as one cube of machines at true scale (the scene),
	 * scrubbable through time (the timeline), with the numbers beside it.
	 * The globe below shows where the machines run.
	 *
	 * Everything loads once the panel nears the viewport; the frame keeps
	 * its size meanwhile, so nothing shifts when the numbers land.
	 */
	import { onMount } from 'svelte';
	import type MiningGlobeType from './MiningGlobe.svelte';
	import AsicSound from './AsicSound.svelte';
	import HashweightScene from './hashweight/HashweightScene.svelte';
	import HashweightTimeline from './hashweight/HashweightTimeline.svelte';
	import {
		fetchHashrateEH,
		fetchHashrateHistory,
		computeNetworkWeight,
		NODE_COUNT,
		NODE_AVG_KG,
	} from '$lib/network-weight.js';
	import {
		MACHINES,
		fleetHistory,
		fleetAt,
		btcSupplyAt,
		cubeEdgeM,
		machineM3,
		TITANIC_T,
		type FleetPoint,
	} from '$lib/hashweight/fleet.js';
	import { SOLO_DEVICE_COUNT, SOLO_AVG_WEIGHT_KG, SOLO_HASHRATE_PH_S } from '$lib/mining-clusters.js';
	import { system } from '$lib/stores/system.js';
	import { formatNum } from '$lib/format.js';

	/** Mirrors the /mining strip's offline fallback. */
	const HASHRATE_FALLBACK_EH = 800;
	const SHORT_TONS_PER_TONNE = 1.10231;
	const PLAY_MS = 12_000;

	let panelEl: HTMLElement | undefined = $state();
	let globeColEl: HTMLElement | undefined = $state();
	let MiningGlobe: typeof MiningGlobeType | null = $state(null);
	let showSoloMiners = $state(false);

	let series = $state<FleetPoint[]>([]);
	let liveEh = $state<number | null>(null);
	let loaded = $state(false);
	let historyFailed = $state(false);

	/** Chosen date (null = now), and a hover preview on top of it. */
	let chosen = $state<number | null>(null);
	let preview = $state<number | null>(null);
	let playing = $state(false);
	let playTs = $state<number | null>(null);
	let reduced = $state(false);

	onMount(() => {
		reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (!panelEl) return;
		const io = new IntersectionObserver(
			(entries) => {
				if (!entries.some((e) => e.isIntersecting)) return;
				io.disconnect();
				void load();
				import('./MiningGlobe.svelte').then((m) => (MiningGlobe = m.default));
			},
			{ rootMargin: '500px 0px' }
		);
		io.observe(panelEl);
		return () => {
			io.disconnect();
			cancelAnimationFrame(playRaf);
		};
	});

	async function load() {
		const [eh, history] = await Promise.all([fetchHashrateEH(), fetchHashrateHistory()]);
		liveEh = eh;
		if (history.length > 1) {
			const pts = [...history];
			// Today's live reading, if it's newer than the history's last point.
			if (eh && Date.now() - pts[pts.length - 1].ts > 86_400_000) pts.push({ ts: Date.now(), eh });
			series = fleetHistory(pts);
		} else {
			historyFailed = true;
		}
		loaded = true;
	}

	// ── What's on screen ────────────────────────────────────────
	const shownTs = $derived(playing ? playTs : (preview ?? chosen));
	const isNow = $derived(shownTs === null);

	/** Without a history: today only, from the fixed fleet average. */
	const fallbackPoint = $derived.by((): FleetPoint | null => {
		if (series.length || !loaded) return null;
		const est = computeNetworkWeight(liveEh ?? HASHRATE_FALLBACK_EH);
		const s19 = MACHINES.find((m) => m.id === 's19pro')!;
		return {
			ts: Date.now(),
			eh: est.hashrateEH,
			capacityEh: est.hashrateEH,
			machines: est.asicCount,
			massKg: est.asicMassKg,
			volumeM3: est.asicCount * machineM3(s19),
			mix: {},
		};
	});

	const pt = $derived.by((): FleetPoint | null => {
		if (!series.length) return fallbackPoint;
		const p = shownTs === null ? series[series.length - 1] : fleetAt(series, shownTs);
		if (!p) return null;
		// "Now" reads the live hashrate; the fleet behind it is the model's.
		return shownTs === null && liveEh ? { ...p, eh: liveEh } : p;
	});

	const massT = $derived(pt ? pt.massKg / 1000 : 0);
	const edge = $derived(pt ? cubeEdgeM(pt.volumeM3) : 0);
	const perBtcKg = $derived(pt ? pt.massKg / btcSupplyAt(pt.ts) : 0);
	const titanics = $derived(massT / TITANIC_T);

	/** Machine face (as stacked) of the biggest share of the fleet. */
	const tileMm = $derived.by((): [number, number] => {
		const top = pt ? Object.entries(pt.mix).sort((a, b) => b[1] - a[1])[0]?.[0] : undefined;
		const m = MACHINES.find((x) => x.id === top) ?? MACHINES.find((x) => x.id === 's19pro')!;
		return [m.mm[1], m.mm[2]];
	});

	/** Fleet mix by machine count, largest first. */
	const mix = $derived.by(() => {
		if (!pt || !pt.machines) return [];
		return MACHINES.filter((m) => pt.mix[m.id])
			.map((m) => ({
				id: m.id,
				name: m.name.replace('Antminer ', ''),
				share: (pt.mix[m.id] * 1e6) / m.ths / pt.machines,
			}))
			.filter((x) => x.share >= 0.005)
			.sort((a, b) => b.share - a.share);
	});

	// ── Formatting ──────────────────────────────────────────────
	function sig3(n: number): number {
		if (!(n > 0)) return 0;
		const p = 10 ** (Math.floor(Math.log10(n)) - 2);
		return Math.round(n / p) * p;
	}
	const massBig = $derived(
		$system === 'imperial' ? sig3(massT * SHORT_TONS_PER_TONNE).toLocaleString('en-US') : sig3(massT).toLocaleString('en-US')
	);
	const massUnit = $derived($system === 'imperial' ? 'short tons' : 'tonnes');
	const massOther = $derived(
		$system === 'imperial' ? `${sig3(massT).toLocaleString('en-US')} tonnes` : `${sig3(massT * SHORT_TONS_PER_TONNE).toLocaleString('en-US')} short tons`
	);
	const machinesLabel = $derived.by(() => {
		const n = pt?.machines ?? 0;
		if (n >= 1e6) return { big: formatNum(+(n / 1e6).toFixed(2)), unit: 'million' };
		if (n >= 1e3) return { big: formatNum(Math.round(n / 1e3)), unit: 'thousand' };
		return { big: formatNum(Math.round(n)), unit: '' };
	});
	const perBtcLabel = $derived(
		$system === 'imperial' ? `${formatNum(+(perBtcKg * 2.20462).toFixed(perBtcKg < 1 ? 2 : 1))} lb` : `${formatNum(+perBtcKg.toFixed(perBtcKg < 1 ? 2 : 1))} kg`
	);
	const dateLabel = $derived(
		pt && !isNow ? new Date(pt.ts).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : 'Now'
	);
	const nodesT = (NODE_COUNT * NODE_AVG_KG) / 1000;
	const soloT = (SOLO_DEVICE_COUNT * SOLO_AVG_WEIGHT_KG) / 1000;

	// ── Play: sweep 2014 → now ──────────────────────────────────
	let playRaf = 0;
	function togglePlay() {
		if (playing) {
			stopPlay();
			return;
		}
		if (series.length < 2) return;
		const a = series[0].ts;
		const b = series[series.length - 1].ts;
		const start = performance.now();
		playing = true;
		chosen = null;
		const step = (now: number) => {
			const k = Math.min(1, (now - start) / PLAY_MS);
			const eased = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
			playTs = a + (b - a) * eased;
			if (k < 1) playRaf = requestAnimationFrame(step);
			else stopPlay();
		};
		playRaf = requestAnimationFrame(step);
	}
	function stopPlay() {
		cancelAnimationFrame(playRaf);
		playing = false;
		playTs = null;
	}
	function onchange(ts: number | null) {
		stopPlay();
		chosen = ts;
	}
	function onpreview(ts: number | null) {
		if (!playing) preview = ts;
	}
</script>

<section id="hashweight" class="hw" bind:this={panelEl} aria-labelledby="hw-h">
	<header class="hw-head">
		<p class="eyebrow"><span class="dot" aria-hidden="true"></span>Hashweight · live</p>
		<h2 id="hw-h">What the machines securing Bitcoin weigh</h2>
		<p class="lede">
			Millions of mining machines run flat out to keep Bitcoin honest. Stack every one of them in a single pile and this
			is what you'd get, drawn to scale, from 2014 to today.
		</p>
	</header>

	<div class="frame">
		<div class="frame-bar">
			<span class="frame-title"><span class="wide">The whole fleet, stacked&nbsp;·&nbsp;</span><strong>{dateLabel}</strong></span>
			<AsicSound panelElement={panelEl} />
		</div>

		<div class="stage" aria-busy={!loaded}>
			{#if pt}
				<HashweightScene edgeM={edge} machines={pt.machines} {tileMm} />
			{:else}
				<div class="stage-wait">Weighing the network…</div>
			{/if}
		</div>

		<div class="stats">
			<div class="stat stat--hero">
				<div class="k">Weight</div>
				<div class="v v--gold">{pt ? massBig : '—'} <span class="u">{massUnit}</span></div>
				<div class="sub">{pt ? `${massOther} · ±30%` : ' '}</div>
			</div>
			<div class="stat">
				<div class="k">Machines</div>
				<div class="v">{pt ? machinesLabel.big : '—'} <span class="u">{machinesLabel.unit}</span></div>
				{#if mix.length}
					<div class="mix" aria-label="Fleet mix">
						{#each mix as m (m.id)}
							<span class="mix-seg mix-seg--{m.id}" style:flex-grow={m.share} title="{m.name}: {Math.round(m.share * 100)}%"></span>
						{/each}
					</div>
					<div class="sub">
						{#each mix.slice(0, 3) as m, i (m.id)}{i ? ' · ' : ''}{Math.round(m.share * 100)}% {m.name}{/each}
					</div>
				{:else}
					<div class="sub">{pt ? 'fixed fleet average' : ' '}</div>
				{/if}
			</div>
			<div class="stat">
				<div class="k">Hashrate</div>
				<div class="v">{pt ? formatNum(+pt.eh.toFixed(pt.eh < 10 ? 2 : 0)) : '—'} <span class="u">EH/s</span></div>
				<div class="sub">
					{#if pt && pt.capacityEh > pt.eh * 1.08}installed ≈ {formatNum(Math.round(pt.capacityEh))} EH/s{:else if pt}{isNow ? '7-day average' : 'weekly average'}{:else}&nbsp;{/if}
				</div>
			</div>
			<div class="stat">
				<div class="k">For scale</div>
				<div class="v v--sm">
					{#if !pt}—{:else if titanics < 1}{Math.max(1, Math.round(titanics * 100))}% <span class="u">of the Titanic</span>{:else}{formatNum(+titanics.toFixed(titanics < 10 ? 1 : 0))}× <span class="u">the Titanic</span>{/if}
				</div>
				<div class="sub">{pt ? `${perBtcLabel} for every bitcoin in existence` : ' '}</div>
			</div>
		</div>

		<div class="timeline">
			<div class="tl-bar">
				{#if !reduced && series.length > 1}
					<button type="button" class="btn" onclick={togglePlay} aria-pressed={playing}>
						{playing ? '❚❚ Pause' : '▶ Play 2014 → now'}
					</button>
				{/if}
				{#if chosen !== null && !playing}
					<button type="button" class="btn btn--ghost" onclick={() => onchange(null)}>Back to now</button>
				{/if}
				<span class="tl-hint">
					{#if series.length > 1}Fleet weight since 2014 · hover or drag to travel in time{:else if historyFailed}History unavailable — today's estimate uses a fixed fleet average{:else}&nbsp;{/if}
				</span>
			</div>
			{#if series.length > 1}
				<HashweightTimeline {series} value={chosen} {onchange} {onpreview} />
			{:else}
				<div class="tl-wait" aria-hidden="true"></div>
			{/if}
		</div>
	</div>

	<div class="below">
		<div class="card card--globe">
			<div class="card-head">
				<div>
					<p class="eyebrow">Where they run</p>
					<h3>Big industrial sites, flare gas, hydro, and a long tail at home</h3>
				</div>
				<button type="button" class="btn" class:btn--on={showSoloMiners} aria-pressed={showSoloMiners} onclick={() => (showSoloMiners = !showSoloMiners)}>
					<span class="solo-dot" aria-hidden="true"></span>Solo miners
				</button>
			</div>
			<div class="globe" bind:this={globeColEl}>
				{#if MiningGlobe}
					<MiningGlobe {showSoloMiners} />
				{:else}
					<div class="globe-wait" aria-hidden="true"></div>
				{/if}
			</div>
			{#if showSoloMiners}
				<p class="solo-note">
					About {formatNum(SOLO_DEVICE_COUNT)} home devices (Bitaxes, old S9s, Nerdminers) mine alone for the whole
					block, ~{SOLO_HASHRATE_PH_S} PH/s between them. Together they weigh about {formatNum(Math.round(soloT))}
					tonnes{massT ? `, ${((soloT / massT) * 100).toFixed(3)}% of the fleet` : ''}.
				</p>
			{/if}
		</div>

		<div class="card card--notes">
			<p class="eyebrow">How it's weighed</p>
			<ul>
				<li>
					Hashrate from <a href="https://mempool.space/mining" rel="noopener">mempool.space</a>, back to 2014. Hashrate alone
					doesn't give a weight: 1 EH/s took about 870,000 machines in 2015 and about 3,700 today.
				</li>
				<li>
					So each rise in hashrate is built from the newest Antminer on sale at the time, runs for five years, then is
					replaced by that day's newest. Machines switched off in a dip still count: they still weigh.
				</li>
				<li>
					Weights and sizes are from Bitmain's spec sheets, with the separate power supply the S5–S9 era needed. The pile
					packs every case edge to edge; ~{formatNum(Math.round(nodesT))} tonnes of full nodes are left out.
				</li>
				<li>Other makers, mixed fleets and slow retirements all blur it: read every figure as ±30%.</li>
			</ul>
			<a class="more" href="/methodology#hashweight">The full method →</a>
		</div>
	</div>
</section>

<style>
	.hw {
		--ground: #0e0e10;
		--panel: #111114;
		--rule: #26262b;
		--ink: #f5f0e6;
		--ink-2: #a1a1aa;
		--ink-3: #71717a;
		--gold: #d4a14a;
		--gold-ink: #eac37d;
		--steel: #8fb3c8;
		--mono: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
		--sans: 'Inter Tight', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
		display: flex;
		flex-direction: column;
		gap: 18px;
		margin-bottom: 48px;
		color: var(--ink);
	}

	.hw-head h2 {
		margin: 0;
		font: 600 clamp(26px, 3.6vw, 36px)/1.06 var(--sans);
		letter-spacing: -0.028em;
		text-wrap: balance;
	}
	.eyebrow {
		margin: 0 0 10px;
		font: 500 11px/1 var(--mono);
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ink-3);
	}
	.dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		margin-right: 8px;
		border-radius: 50%;
		background: #4ade80;
		vertical-align: 1px;
		box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.14);
	}
	.lede {
		margin: 12px 0 0;
		max-width: 62ch;
		font-size: 15px;
		line-height: 1.55;
		color: var(--ink-2);
	}

	.frame {
		border: 1px solid var(--rule);
		border-radius: 14px;
		background: var(--panel);
		overflow: hidden;
	}
	.frame-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 14px;
		border-bottom: 1px solid var(--rule);
	}
	.frame-title {
		font: 500 11px/1.3 var(--mono);
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-3);
	}
	.frame-bar :global(.asic-label) {
		white-space: nowrap;
	}
	.frame-title strong {
		color: var(--gold-ink);
		font-weight: 600;
	}
	.stage {
		min-height: 250px;
	}
	.stage-wait {
		display: grid;
		place-items: center;
		height: clamp(250px, 44vw, 460px);
		font: 12px var(--mono);
		color: var(--ink-3);
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		border-top: 1px solid var(--rule);
	}
	.stat {
		padding: 14px 16px 15px;
		border-left: 1px solid var(--rule);
		min-width: 0;
	}
	.stat:first-child {
		border-left: 0;
	}
	.k {
		font: 500 10.5px/1 var(--mono);
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ink-3);
	}
	.v {
		margin-top: 9px;
		font: 600 24px/1.05 var(--mono);
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
		white-space: nowrap;
	}
	.v--gold {
		font-size: 30px;
		color: var(--gold);
	}
	.v--sm {
		font-size: 22px;
	}
	.u {
		font: 500 12px var(--sans);
		letter-spacing: 0;
		color: var(--ink-2);
	}
	/* Fixed at two lines, so scrubbing never moves the timeline under the pointer. */
	.sub {
		margin-top: 6px;
		font: 11px/1.4 var(--mono);
		color: var(--ink-3);
		height: 2.8em;
		overflow: hidden;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}
	.mix {
		display: flex;
		gap: 2px;
		height: 5px;
		margin-top: 10px;
		border-radius: 3px;
		overflow: hidden;
	}
	.mix-seg {
		flex-basis: 0;
		background: #3f4a55;
	}
	.mix-seg--s21xp { background: #cfe0ea; }
	.mix-seg--s21 { background: #8fb3c8; }
	.mix-seg--s19xp { background: #6b8a9c; }
	.mix-seg--s19pro { background: #4f6778; }
	.mix-seg--s17 { background: #3b4d5a; }
	.mix-seg--s9 { background: #d4a14a; }
	.mix-seg--s7 { background: #a07a38; }
	.mix-seg--s5 { background: #6e5428; }

	.timeline {
		border-top: 1px solid var(--rule);
		padding: 12px 14px 10px;
	}
	.tl-bar {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		margin-bottom: 8px;
	}
	.tl-hint {
		font: 11px var(--mono);
		color: var(--ink-3);
	}
	.tl-wait {
		height: 132px;
	}
	.btn {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font: 500 12.5px/1 var(--sans);
		color: var(--ink);
		background: #1b1b1f;
		border: 1px solid #3f3f46;
		border-radius: 7px;
		padding: 7px 11px;
		cursor: pointer;
		white-space: nowrap;
	}
	.btn:hover {
		border-color: var(--ink-3);
	}
	.btn[aria-pressed='true'] {
		border-color: var(--gold);
		color: var(--gold-ink);
		background: rgba(212, 161, 74, 0.12);
	}
	.btn--ghost {
		background: none;
	}
	.btn:focus-visible {
		outline: 2px solid var(--steel);
		outline-offset: 2px;
	}

	.below {
		display: grid;
		grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
		gap: 14px;
	}
	.card {
		border: 1px solid var(--rule);
		border-radius: 14px;
		background: var(--panel);
		padding: 16px 18px 18px;
		min-width: 0;
	}
	.card-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
	}
	.card h3 {
		margin: 0;
		font: 600 16px/1.3 var(--sans);
		letter-spacing: -0.01em;
		text-wrap: balance;
		max-width: 30ch;
	}
	.solo-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #38bdf8;
	}
	.btn--on {
		border-color: #0284c7;
		color: #7dd3fc;
		background: rgba(3, 105, 161, 0.16);
	}
	.globe {
		max-width: 400px;
		margin: 12px auto 0;
	}
	.globe-wait {
		width: 100%;
		max-width: 480px;
		aspect-ratio: 1;
		margin: 0 auto;
		border-radius: 50%;
		background: radial-gradient(circle at 35% 35%, #1e3a5f, #0a1628);
	}
	.solo-note {
		margin: 12px 0 0;
		font-size: 13px;
		line-height: 1.5;
		color: #7dd3fc;
	}
	.card--notes ul {
		margin: 4px 0 0;
		padding-left: 16px;
		display: flex;
		flex-direction: column;
		gap: 9px;
		font-size: 13px;
		line-height: 1.5;
		color: var(--ink-2);
		list-style: disc;
	}
	.card--notes a {
		color: var(--ink);
		text-underline-offset: 2px;
	}
	.more {
		display: inline-block;
		margin-top: 14px;
		font: 500 13px var(--sans);
	}

	@media (max-width: 860px) {
		.stats {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.stat:nth-child(3) {
			border-left: 0;
		}
		.stat:nth-child(n + 3) {
			border-top: 1px solid var(--rule);
		}
		.below {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	@media (max-width: 520px) {
		.frame-title .wide {
			display: none;
		}
	}
	@media (max-width: 420px) {
		.v {
			font-size: 20px;
		}
		.v--gold {
			font-size: 24px;
		}
		.stat {
			padding: 12px 12px 13px;
		}
	}
</style>
