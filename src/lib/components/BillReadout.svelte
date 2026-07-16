<!-- src/lib/components/BillReadout.svelte -->
<script lang="ts">
	/**
	 * BillReadout — the Cash tab's readout, shown under BillStage. Mirrors
	 * CocaineReadout's structure and the mass-first convention every other
	 * tab uses (see docs/handoff/14-cash.md, "Readout").
	 */
	import {
		BILL_WIDTH_MM,
		BILL_LENGTH_MM,
		BILL_THICKNESS_MM,
		BILL_MASS_G,
		selectBillTier,
		stackHeightMm,
		nearestHeightComparison,
		cubicGridDims,
		NOTES_PER_BUNDLE,
	} from '$lib/billStack.js';
	import { formatNoteCount, formatMassConsumer, formatLength } from '$lib/format.js';
	import { system, toggleSystem } from '$lib/stores/system.js';

	let { noteCount = 0 }: { noteCount?: number } = $props();

	const massGrams = $derived(noteCount * BILL_MASS_G);
	const tier = $derived(selectBillTier(noteCount));
	const heightM = $derived(stackHeightMm(noteCount) / 1000);
	const comparison = $derived(nearestHeightComparison(heightM));

	const tierLabel: Record<NonNullable<typeof tier>, string> = {
		loose: 'loose bills',
		strap: 'a strap of 100',
		bundle: 'bundles of 1,000',
		cube: 'a roughly-cubic bundle grid',
		pallet: 'a palletised field',
	};

	const bundleGridLabel = $derived.by(() => {
		if (tier !== 'bundle' && tier !== 'cube') return null;
		const bundleCount = Math.ceil(noteCount / NOTES_PER_BUNDLE);
		const grid = cubicGridDims(
			bundleCount,
			BILL_WIDTH_MM,
			BILL_LENGTH_MM,
			NOTES_PER_BUNDLE * BILL_THICKNESS_MM
		);
		return `${grid.colsX} x ${grid.colsZ} x ${grid.layersY} bundles`;
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
</script>

<div class="bill-readout">
	<div class="eyebrow">You could stack</div>

	{#if noteCount > 0}
		<div class="bill-count-row">{formatNoteCount(noteCount)}</div>

		<div
			class="bill-mass-row"
			role="button"
			tabindex="0"
			title="Click to switch units"
			onclick={onSwap}
			onkeydown={onSwapKey}
		>
			{formatMassConsumer(massGrams, $system)}
		</div>

		<div class="bill-secondary-row">
			{#if tier}
				{tierLabel[tier]}{bundleGridLabel ? ` · ${bundleGridLabel}` : ''}
			{/if}
		</div>

		<div class="bill-stack-row">
			As one stack: {formatLength(heightM, $system)}{comparison ? ` · ${comparison.text}` : ''}
		</div>
	{:else}
		<div class="bill-count-row bill-count-empty">—</div>
	{/if}

	<div class="bill-exactness-note">
		Priced exactly: one $1 note is worth $1. No market estimate.
	</div>

	<div class="bill-rule" aria-hidden="true"></div>

	<p class="sources-footer">
		U.S. Bureau of Engraving and Printing (note dimensions) ·
		<a href="/methodology" class="link">methodology</a> ·
		<a href="/data" class="link">dataset</a>
	</p>
</div>

<style>
	.bill-readout {
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
	.bill-count-row {
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-size: 40px;
		font-weight: 600;
		color: #fafafa;
		line-height: 1.1;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}
	.bill-count-empty {
		color: #52525b;
	}
	.bill-mass-row {
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-size: 22px;
		font-weight: 500;
		color: #a1a1aa;
		margin-top: 4px;
		cursor: pointer;
		align-self: flex-start;
	}
	.bill-secondary-row {
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-size: 13px;
		color: #71717a;
		margin-top: 10px;
	}
	.bill-stack-row {
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-size: 13px;
		color: #71717a;
		margin-top: 4px;
	}
	.bill-exactness-note {
		font-size: 12px;
		color: #71717a;
		margin: 16px 0 0;
		line-height: 1.5;
	}
	.bill-rule {
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
