<script lang="ts">
	/**
	 * The preset row under the BTC slider: amounts worth weighing, smallest
	 * to largest (entity-holdings.json is kept in that order), each with its
	 * size in compact BTC. The line beneath says who holds the selected
	 * amount, as of when, and where the figure comes from — the note and
	 * source that used to hide in a tooltip.
	 */
	import { ENTITIES, formatAsOfMonth, formatBtcForPill, type Entity } from '$lib/holdings.js';

	let {
		activePresetId,
		onSelect,
	}: {
		activePresetId: string | null;
		onSelect: (slug: string) => void;
	} = $props();

	/** Chip names where the data label carries its own number or an emoji. */
	const CHIP_NAME: Record<string, string> = {
		'make-it': 'Make it stack',
		'pizza-day': 'Pizza day',
	};

	function compactBtc(btc: number): string {
		if (btc >= 1e6) return `${+(btc / 1e6).toFixed(btc >= 1e7 ? 0 : 1)}M`;
		if (btc >= 1e5) return `${Math.round(btc / 1e3)}k`;
		if (btc >= 1e3) return `${+(btc / 1e3).toFixed(1)}k`;
		return String(btc);
	}

	function chipName(e: Entity): string {
		return CHIP_NAME[e.slug] ?? e.label;
	}
	/** The size, unless the name already is one ("1 BTC"). */
	function chipSize(e: Entity): string | null {
		return e.type === 'benchmark' ? null : compactBtc(e.btc);
	}

	const active = $derived(ENTITIES.find((e) => e.slug === activePresetId) ?? null);
</script>

<div class="presets">
	<div class="presets__row" role="group" aria-label="Weigh a famous amount">
		{#each ENTITIES as e (e.slug)}
			{@const size = chipSize(e)}
			<button
				type="button"
				class="chip"
				aria-pressed={activePresetId === e.slug}
				aria-label="{chipName(e)}: {formatBtcForPill(e.btc)}"
				onclick={() => onSelect(e.slug)}
			>
				<span class="chip__name">{chipName(e)}</span>
				{#if size}<span class="chip__size">{size}</span>{/if}
			</button>
		{/each}
	</div>
	<div class="presets__note" aria-live="polite">
		{#if active}
			<p class="presets__head">
				<strong>{active.label.replace(/^🍕\s*/, '')}</strong>
				<span>· {formatBtcForPill(active.btc)}{active.asOf ? ` as of ${formatAsOfMonth(active.asOf)}` : ''}</span>
				{#if active.source}
					<span>· <a href={active.source} target="_blank" rel="noopener">{active.sourceName ?? 'Source'}</a></span>
				{:else if active.sourceName}
					<span class="presets__src">· {active.sourceName}</span>
				{/if}
			</p>
			<p class="presets__body" title={active.note}>{active.note}</p>
		{:else}
			<p class="presets__head">Famous amounts, smallest to largest. Pick one to weigh it.</p>
		{/if}
	</div>
</div>

<style>
	.presets {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	/* Mobile: one swipeable row with an edge fade. */
	.presets__row {
		display: flex;
		gap: 6px;
		overflow-x: auto;
		scroll-snap-type: x proximity;
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
		padding: 2px 4px;
		mask-image: linear-gradient(to right, transparent 0, #000 12px, #000 calc(100% - 28px), transparent 100%);
	}
	.presets__row::-webkit-scrollbar {
		display: none;
	}
	/* Wider screens: every chip visible, wrapping as needed. */
	@media (min-width: 768px) {
		.presets__row {
			flex-wrap: wrap;
			overflow: visible;
			mask-image: none;
		}
	}

	.chip {
		scroll-snap-align: start;
		flex-shrink: 0;
		display: inline-flex;
		align-items: baseline;
		gap: 7px;
		height: 32px;
		padding: 0 12px;
		border: 1px solid #2a2a2f;
		border-radius: 999px;
		background: #121214;
		color: #e4e4e7;
		font: 500 13px/30px 'Inter Tight', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
		white-space: nowrap;
		cursor: pointer;
		transition: background-color 120ms ease-out, border-color 120ms ease-out, color 120ms ease-out;
	}
	.chip:hover {
		border-color: #3f3f46;
		background: #18181b;
	}
	.chip__size {
		font: 500 11.5px/30px 'JetBrains Mono', ui-monospace, monospace;
		font-variant-numeric: tabular-nums;
		color: #71717a;
	}
	.chip[aria-pressed='true'] {
		border-color: #f59e0b;
		background: rgba(245, 158, 11, 0.12);
		color: #fde68a;
	}
	.chip[aria-pressed='true'] .chip__size {
		color: #f59e0b;
	}
	.chip:focus-visible {
		outline: 2px solid #f59e0b;
		outline-offset: 2px;
	}

	.presets__note {
		margin: 0 4px;
		min-height: 18px;
		font-size: 12.5px;
		line-height: 1.5;
		color: #71717a;
	}
	.presets__note p {
		margin: 0;
		text-wrap: pretty;
	}
	.presets__body {
		color: #8b8b93;
	}
	@media (max-width: 767px) {
		/* The full note is in the title; two lines is plenty on a phone. */
		.presets__body {
			display: -webkit-box;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 2;
			line-clamp: 2;
			overflow: hidden;
		}
	}
	.presets__note strong {
		color: #d4d4d8;
		font-weight: 600;
	}
	.presets__note a,
	.presets__src {
		color: #a1a1aa;
	}
	.presets__note a {
		text-decoration: underline;
		text-decoration-color: #52525b;
		text-underline-offset: 2px;
	}
	.presets__note a:hover {
		color: #e4e4e7;
	}
</style>
