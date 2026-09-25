<!-- src/lib/components/LandReadout.svelte -->
<script lang="ts">
	/**
	 * LandReadout — the Manhattan tab's readout, under LandStage: the area,
	 * a yardstick or share of the island, and how far up the island it
	 * reaches when filled from the Battery. Valuation in $lib/manhattan.ts.
	 */
	import {
		DEVELOPABLE_M2,
		LAND_VALUE_USD,
		LAND_VALUE_YEAR,
		USD_PER_M2,
		nearestYardstick,
		frontierStreet,
		PATCH_MAX_M2,
	} from '$lib/manhattan.js';
	import { formatArea, formatMultiple } from '$lib/format.js';
	import { system, toggleSystem } from '$lib/stores/system.js';

	let { m2 = 0, accent = '#f7931a' }: { m2?: number; accent?: string } = $props();

	const share = $derived(m2 / DEVELOPABLE_M2);
	const yardstick = $derived(nearestYardstick(m2));
	const street = $derived(frontierStreet(m2));

	const compare = $derived.by(() => {
		if (!(m2 > 0)) return '';
		if (share >= 0.01) {
			const pct = share * 100;
			return share >= 1
				? `all of Manhattan's developable land${share > 1.005 ? `, with ${formatArea(m2 - DEVELOPABLE_M2, $system)} to spare` : ''}`
				: `${pct < 10 ? pct.toFixed(1) : Math.round(pct)}% of all Manhattan's developable land`;
		}
		if (!yardstick) return 'less than a doormat';
		return yardstick.multiple < 1.05
			? `about ${yardstick.label}`
			: `about ${formatMultiple(yardstick.multiple)} ${yardstick.label}`;
	});

	const reach = $derived.by(() => {
		if (!(m2 > 0)) return '';
		if (m2 < PATCH_MAX_M2) return 'A patch of open ground at the Battery, the island’s southern tip.';
		if (share >= 1) return 'Every lot from the Battery to Inwood, and the outer islands.';
		if (!street) return 'Lots at the island’s southern tip, around the Battery.';
		return `Every lot from the Battery to ${street}.`;
	});

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

	const perSqft = Math.round(USD_PER_M2 * 0.09290304);
	const trillions = (LAND_VALUE_USD / 1e12).toFixed(2);
</script>

<div class="land-readout" style:--accent={accent}>
	<div class="eyebrow">You could buy</div>

	{#if m2 > 0}
		<div
			class="land-area"
			role="button"
			tabindex="0"
			title="Click to switch units"
			onclick={onSwap}
			onkeydown={onSwapKey}
		>
			{formatArea(m2, $system)}
		</div>
		<div class="land-of">of Manhattan land · {compare}</div>
		<div class="land-reach">{reach}</div>
	{:else}
		<div class="land-area land-empty">—</div>
	{/if}

	<div class="land-note">
		Priced as land, not buildings: all of Manhattan’s developable ground was worth about
		${trillions} trillion in {LAND_VALUE_YEAR} — about ${perSqft.toLocaleString('en-US')} a square foot
		spread evenly. An illustrative figure from a published study, not a market quote.
	</div>

	<div class="land-rule" aria-hidden="true"></div>

	<p class="sources-footer">
		Barr, Smith &amp; Kulkarni (2018) · NYC Open Data (tax lots, buildings) ·
		<a href="/methodology#manhattan" class="link">methodology</a>
	</p>
</div>

<style>
	.land-readout {
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
	.land-area {
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-size: 40px;
		font-weight: 600;
		color: #fafafa;
		line-height: 1.1;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
		cursor: pointer;
		align-self: flex-start;
	}
	.land-empty {
		color: #52525b;
		cursor: default;
	}
	.land-of {
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-size: 14px;
		color: #a1a1aa;
		margin-top: 6px;
	}
	.land-reach {
		font-size: 15px;
		font-weight: 600;
		color: var(--accent);
		margin-top: 10px;
	}
	.land-note {
		font-size: 12px;
		color: #71717a;
		margin: 16px 0 0;
		line-height: 1.5;
		max-width: 60ch;
	}
	.land-rule {
		height: 1px;
		background: #27272a;
		margin: 14px 0;
	}
	.sources-footer {
		margin: 0;
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
