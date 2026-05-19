<script lang="ts">
	/**
	 * ReadoutStrip — primary continuity signal.
	 *
	 * Hero mass (Inter Tight 600) leads; a hairline rule separates the
	 * physical metrics from the USD/BTC valuation. Mass, volume, and
	 * cube-edge are all driven by the global `system` store; clicking
	 * either of the mass values (or the secondary metrics row) toggles
	 * imperial ↔ metric across every panel on the page.
	 */

	import type { Commodity } from '$lib/commodities.js';
	import type { TileState } from '$lib/volume.js';
	import {
		computeMassGrams,
		computeIntrinsicVolumeCm3,
		computeCubeEdgeMm,
		pickStage,
		computeTileState,
	} from '$lib/volume.js';
	import {
		formatMass,
		formatVolume,
		formatVolumeSolid,
		formatLength,
		formatCommodityAmount,
		unitLabel,
		formatBtc,
	} from '$lib/format.js';
	import { system, toggleSystem } from '$lib/stores/system.js';

	let {
		commodity,
		amount,
		btcAmount,
		btcUsdPrice = 0,
		meltWarning = false,
		eyebrow = 'You could carry',
		activityCi = null,
		activityDps = null,
		accent = '#d4a14a',
	}: {
		commodity: Commodity;
		amount: number;
		btcAmount: number;
		/** USD per BTC. Defaults to 0; CommoditySection plumbs the real value in Stage 4 §4. */
		btcUsdPrice?: number;
		/**
		 * Pu-238 only: when true, render an external melt-warning line
		 * 8 px below the mass row. CommoditySection sets this when
		 * massGrams ≥ 1 kg on a glow-scaling commodity.
		 */
		meltWarning?: boolean;
		/** Eyebrow copy: gold/silver/Pu say "You could carry"; cocaine, "You could buy". */
		eyebrow?: string;
		/** Pu-238 only: pre-formatted Curies string (e.g. "2.55 kCi"). */
		activityCi?: string | null;
		/** Pu-238 only: mantissa / exponent pair for disintegrations-per-sec. */
		activityDps?: { mantissa: string; exponent: number } | null;
		/** Commodity accent colour — used for the activity-Ci value on Pu-238. */
		accent?: string;
	} = $props();

	const isCubeMode = $derived(commodity.renderStyle === 'cube');

	// Stage logic only applies to progression-mode commodities (legacy path).
	const stage = $derived.by(() => (isCubeMode ? null : pickStage(amount, commodity)));
	const massGrams = $derived(amount > 0 ? computeMassGrams(amount, commodity) : null);
	const volumeCm3 = $derived(amount > 0 ? computeIntrinsicVolumeCm3(amount, commodity) : 0);

	const tileState: TileState | null = $derived.by(() => {
		if (!stage) return null;
		if ((stage.renderMode ?? 'scale') !== 'tile' || amount <= 0) return null;
		return computeTileState(amount, stage);
	});

	const countText = $derived.by(() => {
		if (!stage || !stage.countTemplate || amount <= 0) return null;

		const template = stage.countTemplate;
		if (template.includes('{bars}') && template.includes('{pallets}')) {
			const totalOz = amount;
			const barsCount = totalOz / 400;
			const palletsCount = totalOz / 9600;
			return template
				.replace('{bars}', formatCount(barsCount))
				.replace('{pallets}', formatCount(palletsCount));
		}
		const count = amount / stage.referenceAmount;
		return template.replace('{n}', formatCount(count));
	});

	function formatCount(n: number): string {
		if (n >= 100) return Math.round(n).toLocaleString('en-US');
		return n.toFixed(n >= 10 ? 1 : n >= 1 ? 1 : 2);
	}

	const cubeEdgeMetres = $derived(
		isCubeMode && amount > 0 ? computeCubeEdgeMm(amount, commodity) / 1000 : 0
	);
	const usdValue = $derived(btcAmount * btcUsdPrice);

	// Resolve primary / secondary off the global system store.
	const primarySys = $derived($system);
	const secondarySys = $derived($system === 'imperial' ? 'metric' : 'imperial');

	const primaryMass = $derived(
		massGrams !== null ? splitValueUnit(formatMass(massGrams, primarySys)) : null
	);
	const secondaryMass = $derived(
		massGrams !== null ? splitValueUnit(formatMass(massGrams, secondarySys)) : null
	);

	const primaryVolume = $derived(formatVolumeSolid(volumeCm3, primarySys));
	const secondaryVolume = $derived(formatVolumeSolid(volumeCm3, secondarySys));

	const primaryEdge = $derived(
		cubeEdgeMetres > 0 ? formatLength(cubeEdgeMetres, primarySys) : ''
	);
	const secondaryEdge = $derived(
		cubeEdgeMetres > 0 ? formatLength(cubeEdgeMetres, secondarySys) : ''
	);

	/** Split a "229.8 lb" / "0.14 troy oz" string into number and unit. */
	function splitValueUnit(s: string): { value: string; unit: string } {
		const m = s.match(/^([\d,.\-+]+(?:e[+-]?\d+)?)\s*(.*)$/i);
		if (!m) return { value: s, unit: '' };
		return { value: m[1], unit: m[2] };
	}

	function formatUsd(amount: number): string {
		if (amount >= 1e12) return `$${(amount / 1e12).toFixed(2)}T`;
		if (amount >= 1e9) return `$${(amount / 1e9).toFixed(2)}B`;
		if (amount >= 1e6) return `$${(amount / 1e6).toFixed(2)}M`;
		if (amount >= 1) return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
		if (amount > 0) return `$${amount.toFixed(2)}`;
		return '$0';
	}

	function onSwap(e: Event) {
		e.preventDefault();
		toggleSystem();
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggleSystem();
		}
	}
</script>

{#if amount > 0}
	{#if isCubeMode}
		<div class="readout-strip">
			<div class="eyebrow">{eyebrow}</div>

			{#if primaryMass && secondaryMass}
				<div
					class="mass-row"
					role="button"
					tabindex="0"
					title="Click to switch units"
					aria-label={`Switch to ${secondarySys} units`}
					onclick={onSwap}
					onkeydown={onKey}
				>
					<span class="mass-primary">
						<span class="mass-primary-value">{primaryMass.value}</span>
						<span class="mass-primary-unit">{primaryMass.unit}</span>
					</span>
					<span class="swap-hint" aria-hidden="true">⇄</span>
					<span class="mass-secondary">
						<span class="mass-secondary-value">{secondaryMass.value}</span>
						<span class="mass-secondary-unit">{secondaryMass.unit}</span>
					</span>
				</div>
			{/if}

			{#if meltWarning}
				<div class="melt-warning">
					⚠ Would melt itself in reality before this mass could be assembled.
				</div>
			{/if}

			{#if primaryMass}
				<div
					class="metrics-row"
					role="button"
					tabindex="0"
					title="Click to switch units"
					aria-label={`Switch to ${secondarySys} units`}
					onclick={onSwap}
					onkeydown={onKey}
				>
					<span class="metric">{primaryVolume}</span>
					<span class="metric-sep">·</span>
					<span class="metric metric-dim">{secondaryVolume}</span>
					{#if primaryEdge}
						<span class="metric-sep wide">·</span>
						<span class="metric-label">cube edge</span>
						<span class="metric">{primaryEdge}</span>
						<span class="metric-sep">·</span>
						<span class="metric metric-dim">{secondaryEdge}</span>
					{/if}
				</div>
			{/if}

			{#if activityCi}
				<div class="activity-row">
					<span class="activity-label">activity</span>
					<span class="activity-ci" style="color: {accent};">{activityCi}</span>
					<span class="metric-sep">·</span>
					{#if activityDps}
						<span class="activity-dps">
							{activityDps.mantissa} × 10<sup>{activityDps.exponent}</sup>
						</span>
					{:else}
						<span class="activity-dps">0</span>
					{/if}
					<span class="activity-label activity-dps-label">disintegrations / sec</span>
				</div>
			{/if}

			<div class="rule" aria-hidden="true"></div>

			<div class="value-row">
				<div class="usd">
					<span class="usd-value">{formatUsd(usdValue)}</span>
					<span class="usd-eyebrow">USD</span>
				</div>
				<div class="btc-equiv">
					<span class="btc-value">{formatBtc(btcAmount)}</span>
					<span class="btc-eq">=</span>
					<span class="btc-commodity"
						>{formatCommodityAmount(amount, unitLabel(commodity.unit))}</span
					>
				</div>
			</div>
		</div>
	{:else}
		<!-- Progression-mode readout: legacy shape preserved for non-launch commodities. -->
		<div class="readout-strip-legacy">
			<span class="readout-primary">
				{formatBtc(btcAmount)} = {formatCommodityAmount(amount, unitLabel(commodity.unit))}
			</span>
			{#if massGrams !== null}
				<span class="readout-metric">
					{formatMass(massGrams, primarySys)}
				</span>
			{/if}
			<span class="readout-metric">
				{formatVolume(volumeCm3, primarySys)}
			</span>
			{#if countText}
				<span class="readout-count">{countText}</span>
			{/if}
		</div>
	{/if}
{/if}

<style>
	.readout-strip {
		font-family: 'Inter Tight', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
		color: #e4e4e7;
		display: flex;
		flex-direction: column;
	}

	.eyebrow {
		font-family: 'Inter Tight', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
		font-size: 10.5px;
		font-weight: 500;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: #52525b; /* zinc-600 */
		margin-bottom: 14px;
	}

	/* ── Mass row (hero) ───────────────────────────────────────── */
	.mass-row {
		display: inline-flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 14px;
		cursor: pointer;
		user-select: none;
		align-self: flex-start;
		padding: 2px 4px;
		margin: -2px -4px;
		border-radius: 6px;
		transition: background 120ms ease;
		outline: none;
	}
	.mass-row:focus-visible {
		box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.18);
	}
	.mass-row:active {
		background: rgba(255, 255, 255, 0.04);
	}

	.mass-primary {
		font-size: 52px;
		font-weight: 600;
		color: #fafafa; /* zinc-50 */
		line-height: 1;
		letter-spacing: -0.025em;
		font-variant-numeric: tabular-nums lining-nums;
		white-space: nowrap;
	}
	.mass-primary-unit {
		font-size: 26px;
		font-weight: 500;
		color: #a1a1aa; /* zinc-400 */
		margin-left: 6px;
		letter-spacing: -0.012em;
	}

	.mass-secondary {
		font-size: 26px;
		font-weight: 500;
		color: #71717a; /* zinc-500 */
		line-height: 1;
		letter-spacing: -0.012em;
		font-variant-numeric: tabular-nums lining-nums;
		white-space: nowrap;
	}
	.mass-secondary-unit {
		font-size: 15.6px; /* 26 × 0.6 */
		color: #52525b; /* zinc-600 */
		margin-left: 4px;
	}

	.swap-hint {
		font-family: 'Inter Tight', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
		font-size: 14px;
		color: #71717a;
		opacity: 0;
		transition: opacity 120ms ease;
		pointer-events: none;
		transform: translateY(-4px);
	}
	.mass-row:hover .swap-hint,
	.mass-row:focus-visible .swap-hint {
		opacity: 0.7;
	}

	.mass-row:hover .mass-secondary {
		color: #a1a1aa;
		text-decoration: underline dotted #3f3f46;
		text-underline-offset: 4px;
	}

	/* ── Melt warning (Pu-238 ≥1 kg) ───────────────────────────── */
	.melt-warning {
		font-family: 'Inter Tight', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
		font-size: 13px;
		font-weight: 500;
		color: #7ed4ff; /* Cherenkov blue */
		letter-spacing: 0.01em;
		margin-top: 8px;
	}

	/* ── Secondary metrics (volume / edge) ─────────────────────── */
	.metrics-row {
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-variant-numeric: tabular-nums;
		font-size: 13px;
		color: #71717a; /* zinc-500 */
		letter-spacing: 0.01em;
		margin-top: 12px;
		cursor: pointer;
		user-select: none;
		align-self: flex-start;
		display: inline-flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 6px;
		outline: none;
	}
	.metrics-row:focus-visible {
		text-decoration: underline dotted #3f3f46;
		text-underline-offset: 3px;
	}

	.metric {
		color: #71717a;
	}
	.metric-dim {
		color: #52525b;
	}
	.metric-label {
		color: #52525b;
	}
	.metric-sep {
		color: #52525b;
		margin: 0 2px;
	}
	.metric-sep.wide {
		margin: 0 6px;
	}

	/* ── Pu-238 activity readout ───────────────────────────────── */
	.activity-row {
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-variant-numeric: tabular-nums;
		font-size: 13px;
		color: #a1a1aa; /* zinc-400 — for the dps mantissa */
		letter-spacing: 0.01em;
		margin-top: 4px;
		display: inline-flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 6px;
	}
	.activity-label {
		color: #52525b; /* zinc-600 */
	}
	.activity-dps-label {
		margin-left: 2px;
	}
	.activity-ci {
		font-weight: 500;
	}
	.activity-dps sup {
		font-size: 0.7em;
		line-height: 0;
		vertical-align: super;
	}

	/* ── Hairline rule ─────────────────────────────────────────── */
	.rule {
		height: 1px;
		background: #27272a; /* zinc-800 */
		margin: 14px 0;
	}

	/* ── USD + BTC value row ───────────────────────────────────── */
	.value-row {
		display: flex;
		align-items: baseline;
		gap: 18px;
		flex-wrap: wrap;
	}

	.usd {
		font-family: 'Inter Tight', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
		font-weight: 600;
		font-size: 28px;
		color: #e4e4e7; /* zinc-200 */
		letter-spacing: -0.012em;
		font-variant-numeric: tabular-nums lining-nums;
		white-space: nowrap;
	}
	.usd-eyebrow {
		font-size: 11px;
		color: #52525b;
		margin-left: 10px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		font-weight: 500;
	}

	.btc-equiv {
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-size: 13px;
		color: #fbbf24; /* amber-400 */
		opacity: 0.95;
		letter-spacing: 0.01em;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.btc-eq {
		color: #52525b;
		margin: 0 6px;
	}
	.btc-commodity {
		color: #fbbf24;
	}

	/* ── Legacy progression-mode (unused at launch) ────────────── */
	.readout-strip-legacy {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-variant-numeric: tabular-nums;
		font-size: 0.875rem;
		line-height: 1.5;
		color: #d4d4d8;
	}
	.readout-primary {
		color: #fbbf24;
	}
	.readout-metric {
		color: #a1a1aa;
	}
	.readout-count {
		color: #9ca3af;
		font-style: italic;
	}
</style>
