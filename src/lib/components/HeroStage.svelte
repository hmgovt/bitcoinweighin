<script lang="ts">
	/**
	 * HeroStage — the one-stage hero: Au / Ag / Pu / Cocaine tabs over a single
	 * stage frame, with the active commodity's readout and context cards.
	 *
	 * The three cube metals share one live `LiveStage` (WebGL cube + Shiba,
	 * poster-first). Cocaine is the 4th tab: selecting it unmounts LiveStage
	 * (tearing down the single WebGL context — we never run two) and renders the
	 * inline-SVG `CocaineBrickStack` in the same frame, with the cocaine pricing
	 * readout below. Switching back re-mounts LiveStage, which re-hydrates on the
	 * next interaction/idle.
	 *
	 * Tab order is locked: gold, silver, pu238, cocaine.
	 */
	import type { Snippet } from 'svelte';
	import type { Commodity } from '$lib/commodities.js';
	import type { PriceData } from '$lib/prices.js';
	import { computeMassGrams } from '$lib/volume.js';
	import LiveStage from '$lib/scene/LiveStage.svelte';
	import ReadoutStrip from './ReadoutStrip.svelte';
	import QuantityAnchorCard from './QuantityAnchorCard.svelte';
	import Pu238FactCard from './Pu238FactCard.svelte';
	import GeigerCrackle from './GeigerCrackle.svelte';
	import ShareButton from './ShareButton.svelte';
	import CocaineBrickStack from './CocaineBrickStack.svelte';
	import CocaineReadout from './CocaineReadout.svelte';
	import QualityBadge from './QualityBadge.svelte';

	let {
		commodities,
		selectedId = $bindable('gold'),
		amounts,
		btcAmount,
		btcUsdPrice,
		prices,
		controls,
	}: {
		/** Hero tabs in locked order: gold, silver, pu238, cocaine. */
		commodities: Commodity[];
		selectedId?: string;
		/** Commodity-unit amount per id (gold/silver troy oz, pu238/cocaine grams). */
		amounts: Record<string, number | null>;
		btcAmount: number;
		btcUsdPrice: number;
		prices: PriceData | null;
		/** Slider/controls, rendered between the stage and the readout. The page
		 *  owns the slider (URL sync + preset tween); the hero owns its position. */
		controls?: Snippet;
	} = $props();

	const active = $derived(commodities.find((m) => m.id === selectedId) ?? commodities[0]);
	const amount = $derived(amounts[active.id] ?? 0);

	const isCocaine = $derived(active.id === 'cocaine');

	// True when the dog is staged to the foreground — LiveStage binds this and
	// the readout adds the honesty line. False in poster / fallback / cocaine.
	let staged = $state(false);

	// Stage element for the Geiger IntersectionObserver gate.
	let stageEl: HTMLElement | undefined = $state();

	const accent = $derived(commodityAccent(active.id));
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

	const isPu = $derived(active.glowScales === true);
	const showGeiger = $derived(active.geigerCrackle === true);
	const brandVoice = $derived(active.brandVoiceClarification);

	const massGrams = $derived(amount > 0 ? (computeMassGrams(amount, active) ?? 0) : 0);
	const massKg = $derived(massGrams / 1000);

	// The bot waits on data-commodity to confirm the deep-linked tab is active
	// AND rendered before screenshotting. For metals the LiveStage poster/canvas
	// satisfies that; for cocaine we only advertise the attr once the brick SVG
	// has actually mounted (bound below), so the card never captures a blank
	// frame mid-swap.
	let brickEl: HTMLElement | undefined = $state();
	const brickReady = $derived(isCocaine && !!brickEl);
	const dataCommodity = $derived(isCocaine ? (brickReady ? 'cocaine' : '') : selectedId);

	// Pu-238 readout extras (mirrors CommoditySection's derivations).
	const meltWarning = $derived(isPu && massGrams >= 1000);
	const activityCi = $derived(
		active.specificActivityCiPerGram && massGrams
			? massGrams * active.specificActivityCiPerGram
			: 0
	);
	const dps = $derived(activityCi * 3.7e10); // 1 Ci = 3.7×10¹⁰ disintegrations/s

	function formatCi(ci: number): string {
		if (ci <= 0) return '0 Ci';
		if (ci >= 1e6) return `${(ci / 1e6).toFixed(2)} MCi`;
		if (ci >= 1e3) return `${(ci / 1e3).toFixed(2)} kCi`;
		if (ci >= 1) return `${ci.toFixed(0)} Ci`;
		if (ci >= 0.001) return `${(ci * 1000).toFixed(1)} mCi`;
		return `${ci.toExponential(1)} Ci`;
	}
	function dpsParts(d: number): { mantissa: string; exponent: number } | null {
		if (d <= 0) return null;
		const exponent = Math.floor(Math.log10(d));
		return { mantissa: (d / Math.pow(10, exponent)).toFixed(2), exponent };
	}
	const activityCiText = $derived(activityCi > 0 ? formatCi(activityCi) : null);
	const dpsBig = $derived(dpsParts(dps));

	function selectTab(id: string) {
		selectedId = id;
	}
	function onTabKey(e: KeyboardEvent, idx: number) {
		// Arrow-key roving within the radiogroup.
		if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
			e.preventDefault();
			selectTab(commodities[(idx + 1) % commodities.length].id);
		} else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
			e.preventDefault();
			selectTab(commodities[(idx - 1 + commodities.length) % commodities.length].id);
		}
	}
</script>

<!-- data-commodity is a stable hook for the X-bot card renderer (scripts/bot/make-card.ts) — it waits on it to confirm the deep-linked tab is active and rendered before screenshotting. -->
<section class="hero-stage" data-commodity={dataCommodity} bind:this={stageEl} aria-label="Live commodity visualiser">
	<div class="hero-top">
		<div class="tabs" role="radiogroup" aria-label="Commodity">
			{#each commodities as m, i (m.id)}
				<button
					type="button"
					role="radio"
					aria-checked={m.id === selectedId}
					class="tab"
					class:on={m.id === selectedId}
					style:--accent={commodityAccent(m.id)}
					tabindex={m.id === selectedId ? 0 : -1}
					onclick={() => selectTab(m.id)}
					onkeydown={(e) => onTabKey(e, i)}
				>
					{m.displayName}
				</button>
			{/each}
		</div>
		{#if isCocaine}
			<div class="badge-slot">
				<QualityBadge quality={active.dataQuality} />
			</div>
		{:else if showGeiger}
			<div class="geiger-slot">
				<GeigerCrackle massGrams={massGrams} panelElement={stageEl} />
			</div>
		{/if}
	</div>

	{#if isCocaine}
		<!--
			Cocaine: the single WebGL stage is unmounted (no LiveStage in the
			tree), so there is never a second GL context. The inline-SVG brick
			stack fills the same frame; brickReady flips once it mounts so the
			bot's data-commodity attr only advertises a rendered frame.
		-->
		<div class="brick-frame" bind:this={brickEl}>
			<CocaineBrickStack {massGrams} />
		</div>
	{:else}
		<LiveStage commodity={active} {amount} bind:staged />
	{/if}

	{#if controls}
		<div class="controls-slot">{@render controls()}</div>
	{/if}

	{#if brandVoice}
		<div class="brand-voice" style="color: {accent};">
			<span class="brand-voice-label">Note</span>
			<span class="brand-voice-body">{brandVoice}</span>
		</div>
	{/if}

	{#if isCocaine}
		<div class="readout-wrap">
			<CocaineReadout {massGrams} {btcAmount} {btcUsdPrice} {accent} />
		</div>
	{:else}
		<div class="readout-wrap">
			<ReadoutStrip
				commodity={active}
				{amount}
				{btcAmount}
				{btcUsdPrice}
				{meltWarning}
				eyebrow="You could carry"
				{accent}
				activityCi={isPu ? activityCiText : null}
				activityDps={isPu ? dpsBig : null}
			/>
			{#if staged}
				<!--
					Staging honesty line: when the dog walks to the foreground the
					apparent sizes come from real perspective (dog nearer the camera),
					not a fudge. Stated, per the methodology's staging-honesty rule.
				-->
				<p class="staging-line">Shiba standing nearer the camera — true perspective, not rescaled.</p>
			{/if}
		</div>

		{#if isPu}
			<div class="card-wrap">
				<Pu238FactCard currentMassGrams={massGrams} {accent} />
			</div>
			<p class="sources-footer">
				DOE Office of Nuclear Energy · NASA Planetary Science · The Planetary Society ·
				Cassini OIG (1997, escalated) ·
				<a href="/methodology" class="link">methodology</a> ·
				<a href="/data" class="link">dataset</a>
			</p>
		{:else}
			<div class="card-wrap">
				<QuantityAnchorCard commodityId={active.id} currentMassKg={massKg} {accent} eyebrow="For scale" />
			</div>
		{/if}
	{/if}

	<div class="panel-actions">
		<ShareButton {prices} commodity={active} />
	</div>
</section>

<style>
	.hero-stage {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.hero-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

	.tabs {
		display: inline-flex;
		gap: 6px;
		background: #18181b;
		padding: 4px;
		border-radius: 8px;
		border: 1px solid #27272a;
		flex-wrap: wrap;
	}
	.tab {
		appearance: none;
		background: transparent;
		color: #a1a1aa;
		border: 1px solid transparent;
		border-radius: 6px;
		padding: 6px 14px;
		font-family: 'Inter Tight', -apple-system, system-ui, sans-serif;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: color 120ms ease, border-color 120ms ease, background 120ms ease;
	}
	.tab:hover {
		color: #e4e4e7;
	}
	.tab.on {
		color: var(--accent);
		border-color: color-mix(in srgb, var(--accent) 55%, transparent);
		background: color-mix(in srgb, var(--accent) 10%, transparent);
	}
	.tab:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.geiger-slot {
		margin-left: auto;
	}
	.badge-slot {
		margin-left: auto;
		display: flex;
		align-items: center;
	}

	.brick-frame {
		width: 100%;
	}

	/* Pu-238 brand-voice clarification (mirrors CommoditySection). */
	.brand-voice {
		font-family: 'Inter Tight', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
		font-weight: 400;
		font-size: 13px;
		opacity: 0.85;
		letter-spacing: 0.005em;
		line-height: 1.5;
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
		color: #52525b;
		font-weight: 500;
	}
	.brand-voice-body {
		flex: 1 1 auto;
	}

	.readout-wrap {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.staging-line {
		margin: 0;
		font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
		font-size: 11px;
		color: #71717a;
		letter-spacing: 0.01em;
	}

	.card-wrap {
		margin-top: 8px;
	}

	.panel-actions {
		display: flex;
		justify-content: flex-end;
	}

	.sources-footer {
		margin: 6px 0 0;
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
