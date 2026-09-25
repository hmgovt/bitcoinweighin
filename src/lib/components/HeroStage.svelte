<script lang="ts">
	/**
	 * HeroStage — the one-stage hero: Au / Ag / Pu / Cocaine / Cash tabs over a
	 * single stage frame, with the active commodity's readout and context cards.
	 *
	 * The three cube metals share one live `LiveStage` (WebGL cube + Shiba,
	 * poster-first). Cocaine and Cash are custom tabs: selecting either unmounts
	 * LiveStage (tearing down the single WebGL context — we never run two) and
	 * renders a bespoke visual (`CocaineStage`'s or `BillStage`'s own
	 * WebGL scene) in the same frame, with a matching custom readout below.
	 * Switching back to a metal re-mounts LiveStage, which re-hydrates on the
	 * next interaction/idle.
	 *
	 * Tab order is locked: gold, silver, pu238, cocaine, cash.
	 */
	import type { Snippet } from 'svelte';
	import type { Commodity } from '$lib/commodities.js';
	import type { PriceData } from '$lib/prices.js';
	import { computeMassGrams } from '$lib/volume.js';
	import { computeDelta, type CommodityId as DeltaCommodityId, type DeltaObjectsFile } from '$lib/deltas.js';
	import deltaObjectsJson from '$lib/delta-objects.json';
	import LiveStage from '$lib/scene/LiveStage.svelte';
	import ReadoutStrip from './ReadoutStrip.svelte';
	import QuantityAnchorCard from './QuantityAnchorCard.svelte';
	import Pu238FactCard from './Pu238FactCard.svelte';
	import GeigerCrackle from './GeigerCrackle.svelte';
	import ShareButton from './ShareButton.svelte';
	import CocaineStage from '$lib/scene/CocaineStage.svelte';
	import CocaineReadout from './CocaineReadout.svelte';
	import QualityBadge from './QualityBadge.svelte';
	import BillStage from '$lib/scene/BillStage.svelte';
	import BillReadout from './BillReadout.svelte';
	import { computeCubeEdgeMm } from '$lib/volume.js';
	import { formatBtc, formatMass } from '$lib/format.js';
	import { system } from '$lib/stores/system.js';
	import { commodityAccent } from '$lib/accents.js';
	import {
		dropHeightM,
		fallTimeS,
		impactEnergyJ,
		formatDropLine,
		formatDuration,
		formatEnergy,
	} from '$lib/scene/drop.js';
	import type { ClipInfo } from '$lib/scene/clip.js';
	import { isSoundingMaterial, blowSentence, contactTimeS, peakForceN, formatForce } from '$lib/scene/impact-sound.js';

	const deltaObjects = deltaObjectsJson as unknown as DeltaObjectsFile;

	let {
		commodities,
		selectedId = $bindable('gold'),
		amounts,
		btcAmount,
		btcUsdPrice,
		prices,
		selectedDate = '',
		controls,
		held = false,
		dropSignal = 0,
		grabEnabled = true,
		ongrab,
	}: {
		/** Hero tabs in locked order: gold, silver, pu238, cocaine. */
		commodities: Commodity[];
		selectedId?: string;
		/** Commodity-unit amount per id (gold/silver troy oz, pu238/cocaine grams). */
		amounts: Record<string, number | null>;
		btcAmount: number;
		btcUsdPrice: number;
		prices: PriceData | null;
		/**
		 * Currently viewed date (YYYY-MM-DD), i.e. the page's `$selectedDate`.
		 * Drives the Daily Delta line: at the latest date it compares the last
		 * two archive days ("since yesterday's close"); scrubbed to an earlier
		 * date, it compares that date to its previous trading day ("since the
		 * previous close").
		 */
		selectedDate?: string;
		/** Slider/controls, rendered between the stage and the readout. The page
		 *  owns the slider (URL sync + preset tween); the hero owns its position. */
		controls?: Snippet;
		/** The page is holding the cube (slider drag / preset tween) — see LiveStage. */
		held?: boolean;
		/** Increment to drop the cube (typed amount, key jumps) — see LiveStage. */
		dropSignal?: number;
		/** Whether a cube drag resizes it (BTC mode only). */
		grabEnabled?: boolean;
		/** Direct manipulation of the cube, forwarded to the page. */
		ongrab?: (phase: 'start' | 'move' | 'end', ratio: number) => void;
	} = $props();

	const active = $derived(commodities.find((m) => m.id === selectedId) ?? commodities[0]);
	const amount = $derived(amounts[active.id] ?? 0);

	const isCocaine = $derived(active.id === 'cocaine');
	const isCash = $derived(active.id === 'cash');

	// True when the dog is staged to the foreground — LiveStage binds this and
	// the readout adds the honesty line. False in poster / fallback / cocaine.
	let staged = $state(false);
	// Same, for BillStage's own Shiba (Cash tab).
	let billStaged = $state(false);

	// Stage element for the Geiger IntersectionObserver gate.
	let stageEl: HTMLElement | undefined = $state();

	// LiveStage instance — undefined on the cocaine tab (no WebGL stage
	// mounted there). Used only to forward the Konami hook (brief §2.4).
	let liveStageEl: LiveStage | undefined = $state();

	/** Konami hook — forwards to LiveStage's own trigger. No-ops (silently)
	 *  when the stage isn't a live WebGL dog, e.g. the cocaine tab. Exposed
	 *  for the page's global keydown handler via `bind:this`. */
	export function triggerKonami(): void {
		liveStageEl?.triggerKonami();
	}

	const accent = $derived(commodityAccent(active.id));

	const isPu = $derived(active.glowScales === true);
	const showGeiger = $derived(active.geigerCrackle === true);
	const brandVoice = $derived(active.brandVoiceClarification);

	const massGrams = $derived(amount > 0 ? (computeMassGrams(amount, active) ?? 0) : 0);
	const massKg = $derived(massGrams / 1000);

	// ── The Drop — its line under the readout, and the clip's captions ────
	// Every figure comes from drop.ts (fall time, impact energy, bearing
	// pressure vs IBC Table 1806.2) on the live cube edge and mass.
	const isCube = $derived(active.renderStyle === 'cube' && !!active.densityGPerCm3);
	const edgeM = $derived(isCube && amount > 0 ? computeCubeEdgeMm(amount, active) / 1000 : 0);
	// …and the blow the floor takes: its duration and peak force (impact-sound.ts).
	const sounding = $derived(isCube && edgeM > 0 && isSoundingMaterial(active.id));
	const dropLine = $derived(
		isCube && edgeM > 0
			? formatDropLine({
					edge: edgeM,
					massGrams,
					densityGPerCm3: active.densityGPerCm3!,
					unit: $system,
				}) +
				(sounding && isSoundingMaterial(active.id)
					? ' ' + blowSentence(active.id, edgeM, active.densityGPerCm3!, $system)
					: '')
			: ''
	);

	function formatUsdShort(v: number): string {
		if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
		if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
		if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
		if (v >= 1) return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
		if (v > 0) return `$${v.toFixed(v >= 0.01 ? 2 : 6)}`;
		return '$0';
	}

	function formatDateLong(d: string): string {
		if (!d) return '';
		return new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			timeZone: 'UTC',
		});
	}

	const clipInfo = $derived.by((): ClipInfo | null => {
		if (!isCube || !(massGrams > 0) || !(edgeM > 0)) return null;
		const other = $system === 'imperial' ? 'metric' : 'imperial';
		const h = dropHeightM(edgeM);
		const name = active.displayName.toLowerCase();
		const params = new URLSearchParams();
		params.set('btc', String(btcAmount));
		if (selectedDate) params.set('date', selectedDate);
		params.set('commodity', active.id);
		const btcSlug = formatBtc(btcAmount).replace(/[^0-9a-z.]+/gi, '').toLowerCase();
		return {
			headline: `${formatBtc(btcAmount)} of ${name}`,
			massPrimary: formatMass(massGrams, $system),
			massSecondary: formatMass(massGrams, other),
			valueLine: [btcUsdPrice > 0 ? formatUsdShort(btcAmount * btcUsdPrice) : '', formatDateLong(selectedDate)]
				.filter(Boolean)
				.join(' · '),
			dropLine:
				`Falls ${formatDuration(fallTimeS(h))} · hits with ${formatEnergy(impactEnergyJ(massKg, h))}` +
				(isSoundingMaterial(active.id)
					? ` · peaks at ${formatForce(peakForceN(active.id, edgeM, active.densityGPerCm3!), $system)} for ${formatDuration(contactTimeS(active.id, edgeM, active.densityGPerCm3!))}`
					: ''),
			shareUrl: `https://bitcoinweighin.com/?${params.toString()}`,
			fileStem: `bitcoinweighin-${btcSlug}-${active.id}${selectedDate ? '-' + selectedDate : ''}`,
			accent,
		};
	});

	// ── "1 sat. Also: one Sat." (brief §2.1) ──────────────────────
	// The dog is named Sat. At exactly one satoshi the readout gets one quiet
	// line acknowledging it. `btcAmount` (not the active tab's `amount`) is
	// the page's raw slider value — the joke is about the unit, independent
	// of which commodity tab is open. Crisp float-tolerant definition: within
	// half a sat of 1e-8. A plain {#if} is enough — this only ever renders at
	// one exact slider position, so there's no layout to reserve against.
	const isOneSat = $derived(btcAmount > 0 && btcAmount <= 1.5e-8);

	// ── Daily Delta line ──────────────────────────────────────────
	// The bot's day-over-day reframe ("1 BTC put on a golf ball of gold
	// since yesterday's close"), ported to the homepage via src/lib/deltas.ts.
	// Always framed on 1 BTC — independent of the slider's current amount.
	const sortedDates = $derived(prices ? Object.keys(prices).sort() : []);

	const dailyDelta = $derived.by(() => {
		if (sortedDates.length < 2) return null; // initial SSR: only the latest day is inlined
		if (!(active.id in deltaObjects.pricing)) return null;

		const latest = sortedDates[sortedDates.length - 1];
		let prevIdx: number;
		let currIdx: number;
		let sincePhrase: string | undefined;

		if (!selectedDate || selectedDate === latest) {
			// Default view: the last two archive days, bot's original wording.
			prevIdx = sortedDates.length - 2;
			currIdx = sortedDates.length - 1;
			sincePhrase = undefined;
		} else {
			// Date-scrub mode: compare the scrubbed date to its previous
			// trading day in the archive, not literally "yesterday".
			const idx = sortedDates.indexOf(selectedDate);
			if (idx <= 0) return null; // scrubbed date not yet loaded, or no earlier day exists
			prevIdx = idx - 1;
			currIdx = idx;
			sincePhrase = 'the previous close';
		}

		const prevDate = sortedDates[prevIdx];
		const currDate = sortedDates[currIdx];
		const prevDay = prices?.[prevDate];
		const currDay = prices?.[currDate];
		if (!prevDay || !currDay) return null;

		return computeDelta(
			deltaObjects,
			active.id as DeltaCommodityId,
			{ date: prevDate, day: prevDay },
			{ date: currDate, day: currDay },
			sincePhrase ? { sincePhrase } : undefined
		);
	});

	/** Split "...since yesterday's close (+46 g)." into sentence / figure / trailing punctuation
	 *  so the parenthetical can render in tabular-nums without extra markup upstream. */
	const deltaCaptionParts = $derived.by(() => {
		const caption = dailyDelta?.caption ?? '';
		if (!caption) return null;
		const m = caption.match(/^(.*?)(\([^()]*\))([.!?]?)$/);
		if (!m) return { main: caption, figure: '', tail: '' };
		return { main: m[1], figure: m[2], tail: m[3] };
	});

	// The bot waits on data-commodity to confirm the deep-linked tab is active
	// AND rendered before screenshotting. For metals the LiveStage poster/canvas
	// satisfies that; for cocaine we only advertise the attr once the brick SVG
	// has actually mounted (bound below), so the card never captures a blank
	// frame mid-swap.
	// CocaineStage reports readiness itself (first frame + Sat resolved, or its
	// SVG fallback mounted), same contract as BillStage below.
	let cokeRendered = $state(false);
	let cokeStaged = $state(false);
	const brickReady = $derived(isCocaine && cokeRendered);
	// BillStage reports readiness itself (first frame rendered + Shiba
	// resolved) — gating on the frame div alone would advertise
	// data-commodity before the WebGL scene exists, and the bot's card
	// could capture a blank stage.
	let billRendered = $state(false);
	const billReady = $derived(isCash && billRendered);
	const dataCommodity = $derived(
		isCocaine ? (brickReady ? 'cocaine' : '') : isCash ? (billReady ? 'cash' : '') : selectedId
	);

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
					<span class="tab__dot" aria-hidden="true"></span>
					<span class="tab__full">{m.displayName}</span>
					{#if m.id === 'pu238'}<span class="tab__short" aria-hidden="true">Pu-238</span>{/if}
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
		<div class="brick-frame">
			<CocaineStage {massGrams} bind:staged={cokeStaged} bind:ready={cokeRendered} />
		</div>
	{:else if isCash}
		<div class="bill-frame">
			<BillStage noteCount={amount} btcUsd={btcUsdPrice} bind:staged={billStaged} bind:ready={billRendered} />
		</div>
	{:else}
		<LiveStage
			commodity={active}
			{amount}
			bind:staged
			bind:this={liveStageEl}
			{held}
			{dropSignal}
			{grabEnabled}
			{ongrab}
			{clipInfo}
			{accent}
		/>
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
			{#if cokeStaged}
				<p class="staging-line">Sat is standing nearer the camera — true perspective, not rescaled.</p>
			{/if}
		</div>
	{:else if isCash}
		<div class="readout-wrap">
			<BillReadout noteCount={amount} />
			<!--
				Daily Delta line — always in the DOM (reserves its line height) so
				the archive's async load-in doesn't shift layout; content fills in
				once >=2 dataset days are loaded. See src/lib/deltas.ts.
			-->
			<p class="delta-line">
				{#if deltaCaptionParts}
					{deltaCaptionParts.main}<span class="delta-figure">{deltaCaptionParts.figure}</span>{deltaCaptionParts.tail}
				{/if}
			</p>
			{#if billStaged}
				<!--
					Staging honesty line: when the dog walks to the foreground the
					apparent sizes come from real perspective (dog nearer the camera),
					not a fudge. Stated, per the methodology's staging-honesty rule.
				-->
				<p class="staging-line">Sat is standing nearer the camera — true perspective, not rescaled.</p>
			{/if}
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
			<!--
				Daily Delta line — always in the DOM (reserves its line height) so
				the archive's async load-in doesn't shift layout; content fills in
				once >=2 dataset days are loaded. See src/lib/deltas.ts.
			-->
			<p class="delta-line">
				{#if deltaCaptionParts}
					{deltaCaptionParts.main}<span class="delta-figure">{deltaCaptionParts.figure}</span>{deltaCaptionParts.tail}
				{/if}
			</p>
			{#if dropLine}
				<!--
					The Drop, stated: fall time, impact energy, bearing pressure and
					(past the clay allowance) the building-code comparison. Every
					figure derives from the live cube — see src/lib/scene/drop.ts.
				-->
				<p class="drop-line">{dropLine}</p>
			{/if}
			{#if isOneSat}
				<p class="sat-line">1 sat. Also: one Sat.</p>
			{/if}
			{#if staged}
				<!--
					Staging honesty line: when the dog walks to the foreground the
					apparent sizes come from real perspective (dog nearer the camera),
					not a fudge. Stated, per the methodology's staging-honesty rule.
				-->
				<p class="staging-line">Sat is standing nearer the camera — true perspective, not rescaled.</p>
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
		display: flex;
		gap: 2px;
		background: #111113;
		padding: 3px;
		border-radius: 10px;
		border: 1px solid #27272a;
		max-width: 100%;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.tabs::-webkit-scrollbar {
		display: none;
	}
	.tab {
		appearance: none;
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		gap: 7px;
		background: transparent;
		color: #a1a1aa;
		border: 1px solid transparent;
		border-radius: 7px;
		padding: 7px 13px;
		font-family: 'Inter Tight', -apple-system, system-ui, sans-serif;
		font-size: 14px;
		font-weight: 600;
		line-height: 1;
		white-space: nowrap;
		cursor: pointer;
		transition: color 120ms ease, border-color 120ms ease, background 120ms ease;
	}
	.tab__dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--accent);
		opacity: 0.45;
		transition: opacity 120ms ease, box-shadow 120ms ease;
	}
	.tab__short {
		display: none;
	}
	.tab:hover {
		color: #e4e4e7;
	}
	.tab:hover .tab__dot {
		opacity: 0.8;
	}
	.tab.on {
		color: #f5f0e6;
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
		background: color-mix(in srgb, var(--accent) 11%, #18181b);
	}
	.tab.on .tab__dot {
		opacity: 1;
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent);
	}
	.tab:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	@media (max-width: 520px) {
		.tab {
			padding: 7px 8px;
			gap: 5px;
			font-size: 13.5px;
		}
		.tab__dot {
			width: 6px;
			height: 6px;
		}
		.tab__full:has(+ .tab__short) {
			display: none;
		}
		.tab__short {
			display: inline;
		}
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

	.bill-frame {
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

	/* Daily Delta line — quiet, dry, matches the bot's own voice. Always
	   rendered (see markup) so its reserved line height never shifts layout
	   when the background archive fetch fills the caption in. */
	.delta-line {
		margin: 0;
		min-height: 18px;
		font-family: 'Inter Tight', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
		font-size: 12px;
		line-height: 1.5;
		color: #71717a; /* zinc-500 */
		letter-spacing: 0.005em;
	}
	.delta-figure {
		font-variant-numeric: tabular-nums;
		color: #a1a1aa; /* zinc-400 — a touch brighter, mirrors .metric-dim elsewhere */
	}

	/* "1 sat. Also: one Sat." — same quiet register as .delta-line; no
	   reserved min-height, since this only ever appears at one exact
	   slider position (see isOneSat above). */
	.sat-line {
		margin: 0;
		font-family: 'Inter Tight', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
		font-size: 12px;
		line-height: 1.5;
		color: #71717a; /* zinc-500 */
		letter-spacing: 0.005em;
	}

	/* The Drop line — same quiet register as the staging line. */
	.drop-line {
		margin: 0;
		font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
		font-size: 11px;
		line-height: 1.6;
		color: #71717a;
		letter-spacing: 0.01em;
		max-width: 760px;
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
