<script lang="ts">
	import type { Commodity } from '$lib/commodities.js';
	import { computeMassGrams } from '$lib/volume.js';
	import { COCAINE_PRICE_DATA, type PriceData } from '$lib/prices.js';
	import { formatMassConsumer } from '$lib/format.js';
	import { system, toggleSystem } from '$lib/stores/system.js';
	import QualityBadge from './QualityBadge.svelte';
	import PhysicalRep from './PhysicalRep.svelte';
	import ReadoutStrip from './ReadoutStrip.svelte';
	import QuantityAnchorCard from './QuantityAnchorCard.svelte';
	import Pu238FactCard from './Pu238FactCard.svelte';
	import StillPanel from './StillPanel.svelte';
	import CocaineDenominationRow from './CocaineDenominationRow.svelte';
	import TieredPricingTable from './TieredPricingTable.svelte';
	import GeigerCrackle from './GeigerCrackle.svelte';
	import ShareButton from './ShareButton.svelte';

	let {
		commodity,
		amount,
		btcAmount,
		btcUsdPrice,
		prices,
	}: {
		commodity: Commodity;
		amount: number | null;
		btcAmount: number;
		btcUsdPrice: number;
		prices: PriceData | null;
	} = $props();

	const safeAmount = $derived(amount ?? 0);

	// Bound on mount; passed to GeigerCrackle so its IntersectionObserver
	// can gate audio on this exact panel being visible.
	let panelEl: HTMLElement | undefined = $state();

	// Brand-voice clarification persists on Pu-238 panels.
	const brandVoice = $derived(commodity.brandVoiceClarification);

	const massGrams = $derived(safeAmount > 0 ? computeMassGrams(safeAmount, commodity) : 0);
	const massKg = $derived((massGrams ?? 0) / 1000);

	const showAnchorCard = $derived(
		commodity.renderStyle === 'cube' && Boolean(commodity.quantityAnchorsKey)
	);
	const showPu238Fact = $derived(commodity.glowScales === true);
	const showGeiger = $derived(commodity.geigerCrackle === true);
	const isStill = $derived(commodity.renderStyle === 'still_with_readout');

	// Commodity accent — gold #d4a14a, silver #c5cdd6, pu238 Cherenkov #7ed4ff,
	// cocaine bone #e8e0d2. Anything else falls back to gold (defensive default).
	const accent = $derived(commodityAccent(commodity.id));
	const eyebrow = $derived(commodity.id === 'cocaine' ? 'You could buy' : 'You could carry');

	function commodityAccent(id: string): string {
		switch (id) {
			case 'gold':
				return '#d4a14a';
			case 'silver':
				return '#c5cdd6';
			case 'pu238':
				return '#7ed4ff';
			case 'cocaine':
				return '#e8e0d2';
			default:
				return '#d4a14a';
		}
	}

	// Pu-238 readout extras. Threshold matches CubeGlowOverlay.helpers.ts —
	// massGrams ≥ 1000 g (1 kg) is the "would self-melt in reality" line.
	const meltWarning = $derived(showPu238Fact && (massGrams ?? 0) >= 1000);
	const activityCi = $derived(
		commodity.specificActivityCiPerGram && massGrams
			? massGrams * commodity.specificActivityCiPerGram
			: 0
	);
	// 1 Ci = 3.7 × 10¹⁰ disintegrations per second.
	const dps = $derived(activityCi * 3.7e10);

	function formatCi(ci: number): string {
		if (ci <= 0) return '0 Ci';
		if (ci >= 1e6) return `${(ci / 1e6).toFixed(2)} MCi`;
		if (ci >= 1e3) return `${(ci / 1e3).toFixed(2)} kCi`;
		if (ci >= 1) return `${ci.toFixed(0)} Ci`;
		if (ci >= 0.001) return `${(ci * 1000).toFixed(1)} mCi`;
		return `${ci.toExponential(1)} Ci`;
	}

	/** Split a positive number into a (mantissa, exponent) pair for ×10ⁿ rendering. */
	function dpsParts(d: number): { mantissa: string; exponent: number } | null {
		if (d <= 0) return null;
		const exponent = Math.floor(Math.log10(d));
		const mantissa = (d / Math.pow(10, exponent)).toFixed(2);
		return { mantissa, exponent };
	}

	const activityCiText = $derived(activityCi > 0 ? formatCi(activityCi) : null);
	const dpsBig = $derived(dpsParts(dps));

	const cocaineImagePath = '/sprites/cocaine/cocaine-lab.webp';

	// Resolve primary/secondary mass strings for the cocaine readout.
	const primarySys = $derived($system);
	const secondarySys = $derived($system === 'imperial' ? 'metric' : 'imperial');

	function splitValueUnit(s: string): { value: string; unit: string } {
		const m = s.match(/^([\d,.\-+]+(?:e[+-]?\d+)?)\s*(.*)$/i);
		if (!m) return { value: s, unit: '' };
		return { value: m[1], unit: m[2] };
	}

	const cocainePrimary = $derived(
		massGrams > 0 ? splitValueUnit(formatMassConsumer(massGrams, primarySys)) : null
	);
	const cocaineSecondary = $derived(
		massGrams > 0 ? splitValueUnit(formatMassConsumer(massGrams, secondarySys)) : null
	);

	function onCocaineSwap(e: Event) {
		e.preventDefault();
		toggleSystem();
	}

	function onCocaineSwapKey(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggleSystem();
		}
	}
</script>

<section
	bind:this={panelEl}
	id={commodity.id}
	class="mb-8 rounded-lg bg-zinc-900 p-4 sm:p-6"
>
	<div class="mb-3 flex flex-wrap items-center gap-2">
		<h2 class="text-lg font-semibold text-zinc-100">{commodity.displayName}</h2>
		<QualityBadge quality={commodity.dataQuality} />
		{#if showGeiger}
			<!--
				Geiger toggle lives in the panel header, not the global header.
				Audio is local to this panel and silenced whenever the panel
				scrolls out of viewport / tab is hidden / mass drops below 1 g.
			-->
			<div class="ml-auto">
				<GeigerCrackle massGrams={massGrams ?? 0} panelElement={panelEl} />
			</div>
		{/if}
	</div>

	{#if isStill}
		<!--
			Still-with-readout panel (cocaine). Image carries register; the
			children slot below is the entire dynamic readout. No Shiba, no
			Y-axis, no quantity-anchor card.
		-->
		<StillPanel
			commodityId={commodity.id}
			imagePath={cocaineImagePath}
			currentBtc={btcAmount}
		>
			<div class="cocaine-readout">
				<div class="eyebrow">{eyebrow}</div>

				{#if cocainePrimary && cocaineSecondary}
					<div
						class="cocaine-mass-row"
						role="button"
						tabindex="0"
						title="Click to switch units"
						aria-label={`Switch to ${secondarySys} units`}
						onclick={onCocaineSwap}
						onkeydown={onCocaineSwapKey}
					>
						<span class="cocaine-mass-primary">
							<span class="cocaine-mass-primary-value">{cocainePrimary.value}</span>
							<span class="cocaine-mass-primary-unit">{cocainePrimary.unit}</span>
						</span>
						<span class="swap-hint" aria-hidden="true">⇄</span>
						<span class="cocaine-mass-secondary">
							<span class="cocaine-mass-secondary-value">{cocaineSecondary.value}</span>
							<span class="cocaine-mass-secondary-unit">{cocaineSecondary.unit}</span>
						</span>
					</div>
				{:else}
					<div class="cocaine-mass-empty">—</div>
				{/if}

				<!-- Slider-keyed denomination row. -->
				<CocaineDenominationRow currentMassKg={massKg} />

				<div class="cocaine-rule" aria-hidden="true"></div>

				<!-- Three-tier pricing grid. -->
				<TieredPricingTable
					commodityId={commodity.id}
					currentBtc={btcAmount}
					priceData={COCAINE_PRICE_DATA}
					btcPriceUsd={btcUsdPrice}
					{accent}
				/>

				<!-- Markup + purity note. -->
				<p class="markup-note">
					<span class="markup-lead">Markup ~30–50× from producer to retail.</span>
					Most of cocaine's market value sits in trafficking and distribution,
					not production. Street figures reflect 30–50% purity; the
					pure-equivalent column standardises across tiers.
				</p>

				<!-- Persistent source attribution. -->
				<p class="sources-footer">
					Wholesale: UNODC 2024 · Retail: DEA 2024 · Producer: UNODC 2024 ·
					<a href="/methodology" class="link">methodology</a> ·
					<a href="/data" class="link">dataset</a>
				</p>
			</div>
		</StillPanel>
	{:else}
		{#if brandVoice}
			<!--
				Pu-238 brand-voice clarification sits ABOVE the eyebrow with a
				small uppercase NOTE label. Cherenkov-blue body; no italic.
			-->
			<div class="brand-voice" style="color: {accent};">
				<span class="brand-voice-label">Note</span>
				<span class="brand-voice-body">{brandVoice}</span>
			</div>
		{/if}

		<!-- Physical representation scene -->
		<div class="mb-4 rounded bg-zinc-800">
			<PhysicalRep {commodity} amount={safeAmount} />
		</div>

		<!-- Readout strip: hero mass + secondary metrics + USD/BTC -->
		<ReadoutStrip
			{commodity}
			amount={safeAmount}
			{btcAmount}
			{btcUsdPrice}
			{meltWarning}
			{eyebrow}
			{accent}
			activityCi={showPu238Fact ? activityCiText : null}
			activityDps={showPu238Fact ? dpsBig : null}
		/>

		<!-- Contextual fact card (cube-mode commodities only) -->
		{#if showAnchorCard}
			<div class="card-wrap">
				<QuantityAnchorCard
					commodityId={commodity.id}
					currentMassKg={massKg}
					{accent}
					eyebrow="For scale"
				/>
			</div>
		{:else if showPu238Fact}
			<div class="card-wrap">
				<Pu238FactCard currentMassGrams={massGrams ?? 0} {accent} />
			</div>
		{/if}

		{#if showPu238Fact}
			<p class="sources-footer">
				DOE Office of Nuclear Energy · NASA Planetary Science · The Planetary Society ·
				Cassini OIG (1997, escalated) ·
				<a href="/methodology" class="link">methodology</a> ·
				<a href="/data" class="link">dataset</a>
			</p>
		{/if}

		<div class="panel-actions">
			<ShareButton {prices} {commodity} />
		</div>
	{/if}
</section>

<style>
	/* ── Pu-238 brand-voice clarification ──────────────────────── */
	.brand-voice {
		font-family: 'Inter Tight', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
		font-weight: 400;
		font-size: 13px;
		opacity: 0.85;
		letter-spacing: 0.005em;
		line-height: 1.5;
		margin-bottom: 16px;
		max-width: 640px;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 10px;
	}
	.brand-voice-label {
		font-size: 9.5px;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: #52525b; /* zinc-600 */
		font-weight: 500;
	}
	.brand-voice-body {
		flex: 1 1 auto;
	}

	/* ── Shared card spacing ───────────────────────────────────── */
	.card-wrap {
		margin-top: 22px;
	}

	/* ── Per-panel share action ────────────────────────────────── */
	.panel-actions {
		display: flex;
		justify-content: flex-end;
		margin-top: 18px;
	}

	/* ── Cocaine still-panel readout ───────────────────────────── */
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

	.cocaine-rule {
		height: 1px;
		background: #27272a;
		margin: 14px 0;
	}

	.markup-note {
		font-family: 'Inter Tight', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
		font-size: 12px;
		font-weight: 400;
		color: #71717a; /* zinc-500 */
		margin: 16px 0 0;
		line-height: 1.55;
		max-width: 640px;
		letter-spacing: 0.005em;
	}
	.markup-lead {
		color: #52525b; /* zinc-600 */
	}

	/* ── Shared sources footer ─────────────────────────────────── */
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
