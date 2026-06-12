<script lang="ts">
	/**
	 * CocaineReadout — the cocaine tab's readout, shown under the hero stage
	 * when the Cocaine tab is active (the place the metal tabs show their
	 * ReadoutStrip). Relocated verbatim from the retired standalone
	 * CommoditySection still-panel: "You could buy" mass readout, the
	 * slider-keyed denomination line, the three-tier pricing grid with its
	 * UNODC/DEA sources, the markup/purity note, and the provenance footer.
	 *
	 * Provenance is load-bearing — do not drop the sources or methodology/
	 * dataset links.
	 */
	import { COCAINE_PRICE_DATA } from '$lib/prices.js';
	import { formatMassConsumer } from '$lib/format.js';
	import { system, toggleSystem } from '$lib/stores/system.js';
	import { denomination } from './CocaineDenominationRow.helpers.js';
	import TieredPricingTable from './TieredPricingTable.svelte';

	let {
		massGrams,
		btcAmount,
		btcUsdPrice,
		accent = '#e8e0d2',
	}: {
		massGrams: number;
		btcAmount: number;
		btcUsdPrice: number;
		accent?: string;
	} = $props();

	const massKg = $derived(massGrams / 1000);
	const denominationText = $derived(denomination(massKg));

	const primarySys = $derived($system);
	const secondarySys = $derived($system === 'imperial' ? 'metric' : 'imperial');

	function splitValueUnit(s: string): { value: string; unit: string } {
		const m = s.match(/^([\d,.\-+]+(?:e[+-]?\d+)?)\s*(.*)$/i);
		if (!m) return { value: s, unit: '' };
		return { value: m[1], unit: m[2] };
	}

	const primary = $derived(
		massGrams > 0 ? splitValueUnit(formatMassConsumer(massGrams, primarySys)) : null
	);
	const secondary = $derived(
		massGrams > 0 ? splitValueUnit(formatMassConsumer(massGrams, secondarySys)) : null
	);

	function onSwap(e: Event) {
		e.preventDefault();
		toggleSystem();
	}
	function onSwapKey(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggleSystem();
		}
	}
</script>

<div class="cocaine-readout">
	<div class="eyebrow">You could buy</div>

	{#if primary && secondary}
		<div
			class="cocaine-mass-row"
			role="button"
			tabindex="0"
			title="Click to switch units"
			aria-label={`Switch to ${secondarySys} units`}
			onclick={onSwap}
			onkeydown={onSwapKey}
		>
			<span class="cocaine-mass-primary">
				<span class="cocaine-mass-primary-value">{primary.value}</span>
				<span class="cocaine-mass-primary-unit">{primary.unit}</span>
			</span>
			<span class="swap-hint" aria-hidden="true">⇄</span>
			<span class="cocaine-mass-secondary">
				<span class="cocaine-mass-secondary-value">{secondary.value}</span>
				<span class="cocaine-mass-secondary-unit">{secondary.unit}</span>
			</span>
		</div>
	{:else}
		<div class="cocaine-mass-empty">—</div>
	{/if}

	{#if denominationText}
		<div class="denomination-row">
			<span class="denomination-label">denomination</span>
			<span class="denomination-value">{denominationText}</span>
		</div>
	{/if}

	<div class="cocaine-rule" aria-hidden="true"></div>

	<TieredPricingTable
		commodityId="cocaine"
		currentBtc={btcAmount}
		priceData={COCAINE_PRICE_DATA}
		btcPriceUsd={btcUsdPrice}
		{accent}
	/>

	<p class="markup-note">
		<span class="markup-lead">Markup ~30–50× from producer to retail.</span>
		Most of cocaine's market value sits in trafficking and distribution,
		not production. Street figures reflect 30–50% purity; the
		pure-equivalent column standardises across tiers.
	</p>

	<p class="sources-footer">
		Wholesale: UNODC 2024 · Retail: DEA 2024 · Producer: UNODC 2024 ·
		<a href="/methodology" class="link">methodology</a> ·
		<a href="/data" class="link">dataset</a>
	</p>
</div>

<style>
	.cocaine-readout {
		display: flex;
		flex-direction: column;
		width: 100%;
		font-family: 'Inter Tight', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
		color: #e4e4e7;
	}

	.eyebrow {
		font-size: 10.5px;
		font-weight: 500;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: #52525b;
		margin-bottom: 14px;
	}

	.cocaine-mass-row {
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
	.cocaine-mass-row:focus-visible {
		box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.18);
	}
	.cocaine-mass-row:active {
		background: rgba(255, 255, 255, 0.04);
	}
	.cocaine-mass-primary {
		font-size: 52px;
		font-weight: 600;
		color: #fafafa;
		line-height: 1;
		letter-spacing: -0.025em;
		font-variant-numeric: tabular-nums lining-nums;
		white-space: nowrap;
	}
	.cocaine-mass-primary-unit {
		font-size: 26px;
		font-weight: 500;
		color: #a1a1aa;
		margin-left: 6px;
		letter-spacing: -0.012em;
	}
	.cocaine-mass-secondary {
		font-size: 26px;
		font-weight: 500;
		color: #71717a;
		line-height: 1;
		letter-spacing: -0.012em;
		font-variant-numeric: tabular-nums lining-nums;
		white-space: nowrap;
	}
	.cocaine-mass-secondary-unit {
		font-size: 15.6px;
		color: #52525b;
		margin-left: 4px;
	}
	.cocaine-mass-empty {
		font-size: 52px;
		font-weight: 600;
		color: #52525b;
		line-height: 1;
	}

	.swap-hint {
		font-size: 14px;
		color: #71717a;
		opacity: 0;
		transition: opacity 120ms ease;
		pointer-events: none;
		transform: translateY(-4px);
	}
	.cocaine-mass-row:hover .swap-hint,
	.cocaine-mass-row:focus-visible .swap-hint {
		opacity: 0.7;
	}
	.cocaine-mass-row:hover .cocaine-mass-secondary {
		color: #a1a1aa;
		text-decoration: underline dotted #3f3f46;
		text-underline-offset: 4px;
	}

	.denomination-row {
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-variant-numeric: tabular-nums;
		font-size: 13px;
		color: #71717a;
		letter-spacing: 0.01em;
		margin: 12px 0 0;
		line-height: 1.5;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 6px 10px;
	}
	.denomination-label {
		color: #52525b;
	}
	.denomination-value {
		color: #71717a;
	}

	.cocaine-rule {
		height: 1px;
		background: #27272a;
		margin: 14px 0;
	}

	.markup-note {
		font-size: 12px;
		font-weight: 400;
		color: #71717a;
		margin: 16px 0 0;
		line-height: 1.55;
		max-width: 640px;
		letter-spacing: 0.005em;
	}
	.markup-lead {
		color: #52525b;
	}

	.sources-footer {
		margin: 18px 0 0;
		padding-top: 12px;
		border-top: 1px solid #27272a;
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-size: 10.5px;
		color: #52525b;
		letter-spacing: 0.04em;
		line-height: 1.6;
	}
	.link {
		color: #71717a;
		text-decoration: underline;
	}
	.link:hover {
		color: #a1a1aa;
	}
</style>
