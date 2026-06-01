<script lang="ts">
	import { onMount } from 'svelte';
	import MiningGlobe from './MiningGlobe.svelte';
	import AsicSound from './AsicSound.svelte';
	import {
		fetchHashrateEH,
		computeNetworkWeight,
		TITANIC_TONNES,
		FLEET_AVG_KG,
		type NetworkWeightEstimate,
	} from '$lib/network-weight.js';
	import {
		SOLO_DEVICE_COUNT,
		SOLO_AVG_WEIGHT_KG,
		SOLO_HASHRATE_PH_S,
	} from '$lib/mining-clusters.js';

	let panelEl: HTMLElement | undefined = $state();
	let showSoloMiners = $state(false);
	let estimate = $state<NetworkWeightEstimate | null>(null);
	let loading = $state(true);

	onMount(async () => {
		const eh = await fetchHashrateEH();
		// Fallback to a recent known-good value if the API is unreachable.
		estimate = computeNetworkWeight(eh ?? 800);
		loading = false;
	});

	function formatTonnes(t: number): string {
		if (t >= 1_000_000) return (t / 1_000_000).toFixed(2) + 'M tonnes';
		if (t >= 1_000) return Math.round(t / 1000).toLocaleString('en-US') + 'k tonnes';
		return Math.round(t).toLocaleString('en-US') + ' tonnes';
	}

	function formatCount(n: number): string {
		if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
		if (n >= 1_000) return (n / 1_000).toFixed(0) + 'k';
		return n.toLocaleString('en-US');
	}

	const soloMassKg = $derived(SOLO_DEVICE_COUNT * SOLO_AVG_WEIGHT_KG);
	const soloMassTonnes = $derived(soloMassKg / 1000);

	const soloFractionPct = $derived(
		estimate ? ((soloMassTonnes / estimate.totalMassTonnes) * 100) : null
	);
</script>

<section class="nw-panel" bind:this={panelEl} aria-label="Bitcoin network physical weight">

	<div class="nw-header">
		<h2 class="nw-title">The Weight of the Network</h2>
		<p class="nw-subtitle">
			Every bitcoin transaction is secured by warehouses full of specialised hardware.
			This is what that hardware weighs.
		</p>
	</div>

	<div class="nw-layout">

		<!-- Globe -->
		<div class="nw-globe-col">
			<MiningGlobe {showSoloMiners} />
		</div>

		<!-- Stats -->
		<div class="nw-stats-col">

			{#if loading}
				<div class="nw-loading">Loading live hashrate…</div>
			{:else if estimate}

				<div class="stat-block">
					<div class="stat-label">Network hashrate</div>
					<div class="stat-value">{estimate.hashrateEH.toFixed(0)} EH/s</div>
				</div>

				<div class="stat-block">
					<div class="stat-label">Estimated ASICs</div>
					<div class="stat-value">{formatCount(estimate.asicCount)}</div>
					<div class="stat-sub">at ~{FLEET_AVG_KG} kg each</div>
				</div>

				<div class="stat-block stat-block--hero">
					<div class="stat-label">Total ASIC mass</div>
					<div class="stat-value stat-value--large">{formatTonnes(estimate.asicMassTonnes)}</div>
					<div class="stat-comparison">
						{#if estimate.titanicMultiple >= 1}
							≈ {estimate.titanicMultiple.toFixed(1)}× the Titanic
						{:else}
							≈ {(estimate.titanicMultiple * 100).toFixed(0)}% of the Titanic
						{/if}
						<span class="stat-titanic-note">({TITANIC_TONNES.toLocaleString()} tonnes)</span>
					</div>
				</div>

				<div class="stat-divider"></div>

				<!-- Solo miner section -->
				<div class="solo-section" class:solo-active={showSoloMiners}>
					<button
						class="solo-toggle"
						class:solo-toggle-on={showSoloMiners}
						onclick={() => { showSoloMiners = !showSoloMiners; }}
						type="button"
						aria-pressed={showSoloMiners}
					>
						<span class="solo-toggle-dot" aria-hidden="true"></span>
						Solo miners
					</button>

					{#if showSoloMiners}
						<div class="solo-stats">
							<div class="stat-block">
								<div class="stat-label">Solo hashrate</div>
								<div class="stat-value">~{SOLO_HASHRATE_PH_S} PH/s</div>
								<div class="stat-sub">CKPool Solo + other pools</div>
							</div>
							<div class="stat-block">
								<div class="stat-label">Estimated devices</div>
								<div class="stat-value">~{formatCount(SOLO_DEVICE_COUNT)}</div>
								<div class="stat-sub">Bitaxe, home ASICs, Nerdminers</div>
							</div>
							<div class="stat-block">
								<div class="stat-label">Solo mass</div>
								<div class="stat-value">{soloMassTonnes.toFixed(1)} tonnes</div>
								{#if soloFractionPct !== null}
									<div class="stat-sub solo-fraction">
										{soloFractionPct.toFixed(4)}% of total network mass
									</div>
								{/if}
							</div>
						</div>
					{/if}
				</div>

				<div class="stat-divider"></div>

			{/if}

			<!-- Audio toggle -->
			<div class="nw-audio-row">
				<AsicSound panelElement={panelEl} />
				<span class="nw-audio-hint">hear the miners</span>
			</div>

		</div>
	</div>

</section>

<style>
	.nw-panel {
		background: #09090b;
		border-radius: 12px;
		padding: 28px 24px;
		margin-bottom: 48px;
	}

	.nw-header {
		margin-bottom: 24px;
	}
	.nw-title {
		font-family: 'Inter Tight', 'Inter', sans-serif;
		font-size: 22px;
		font-weight: 600;
		color: #f4f4f5;
		margin: 0 0 6px 0;
		letter-spacing: -0.02em;
	}
	.nw-subtitle {
		font-size: 14px;
		color: #71717a;
		margin: 0;
		line-height: 1.5;
		max-width: 480px;
	}

	.nw-layout {
		display: flex;
		flex-direction: column;
		gap: 32px;
	}
	@media (min-width: 768px) {
		.nw-layout {
			flex-direction: row;
			align-items: flex-start;
			gap: 32px;
		}
		.nw-globe-col {
			flex: 1 1 0;
			min-width: 0;
			max-width: 50%;
		}
		.nw-stats-col {
			flex: 1 1 0;
			min-width: 0;
		}
	}

	.nw-loading {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 13px;
		color: #52525b;
		padding: 24px 0;
	}

	/* ── Stat blocks ── */
	.stat-block {
		margin-bottom: 18px;
	}
	.stat-block--hero {
		margin-bottom: 20px;
	}
	.stat-label {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #52525b;
		margin-bottom: 3px;
	}
	.stat-value {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-variant-numeric: tabular-nums;
		font-size: 18px;
		font-weight: 600;
		color: #f5f0e6;
		line-height: 1.2;
	}
	.stat-value--large {
		font-size: 26px;
		color: #fbbf24; /* amber */
	}
	.stat-sub {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 11px;
		color: #52525b;
		margin-top: 2px;
	}
	.stat-comparison {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 13px;
		color: #a1a1aa;
		margin-top: 4px;
	}
	.stat-titanic-note {
		display: block;
		font-size: 10px;
		color: #52525b;
		margin-top: 2px;
	}
	.stat-divider {
		height: 1px;
		background: #27272a;
		margin: 16px 0;
	}

	/* ── Solo miners toggle ── */
	.solo-toggle {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 5px 10px;
		background: transparent;
		border: 1px solid #3f3f46;
		border-radius: 4px;
		color: #a1a1aa;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 12px;
		cursor: pointer;
		transition: color 150ms, border-color 150ms, background 150ms;
		margin-bottom: 12px;
	}
	.solo-toggle:hover {
		color: #e4e4e7;
		border-color: #71717a;
	}
	.solo-toggle-on {
		color: #38bdf8;
		border-color: #0369a1;
		background: rgba(3, 105, 161, 0.15);
	}
	.solo-toggle-on:hover {
		color: #7dd3fc;
		border-color: #0284c7;
	}
	.solo-toggle-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #38bdf8;
		opacity: 0.5;
	}
	.solo-toggle-on .solo-toggle-dot {
		opacity: 1;
	}

	.solo-stats {
		padding-left: 4px;
	}
	.solo-fraction {
		color: #38bdf8 !important;
	}

	/* ── Audio row ── */
	.nw-audio-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.nw-audio-hint {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 11px;
		color: #3f3f46;
	}
</style>
