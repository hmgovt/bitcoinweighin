<script lang="ts">
	import { ENTITIES, formatAsOfMonth, formatBtcForPill, type Entity } from '$lib/holdings.js';

	let {
		activePresetId,
		onSelect,
	}: {
		activePresetId: string | null;
		onSelect: (slug: string) => void;
	} = $props();

	function pillClass(entity: Entity): string {
		const active = activePresetId === entity.slug;
		const base = 'preset-pill';
		return active ? `${base} preset-pill--active` : base;
	}
</script>

<div class="preset-bar" role="group" aria-label="BTC amount presets">
	{#each ENTITIES as entity (entity.slug)}
		<button
			type="button"
			class={pillClass(entity)}
			title={entity.note}
			aria-pressed={activePresetId === entity.slug}
			onclick={() => onSelect(entity.slug)}
		>
			<span class="preset-pill__label">{entity.label}</span>
			{#if entity.asOf}
				<span class="preset-pill__subscript">
					{formatBtcForPill(entity.btc)} · {formatAsOfMonth(entity.asOf)}
				</span>
			{/if}
		</button>
	{/each}
</div>

<style>
	/*
	 * Desktop (≥768px): pills wrap into rows so all 10 are visible.
	 * Mobile (<768px): single swipeable row with edge-fade affordance.
	 */

	/* Mobile default — single scrollable row */
	.preset-bar {
		display: flex;
		flex-wrap: nowrap;
		gap: 6px;
		overflow-x: auto;
		scroll-snap-type: x proximity;
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
		mask-image: linear-gradient(
			to right,
			transparent 0,
			#000 16px,
			#000 calc(100% - 24px),
			transparent 100%
		);
		padding: 2px 4px;
	}
	.preset-bar::-webkit-scrollbar {
		display: none;
	}

	/* Desktop — wrap pills, no overflow */
	@media (min-width: 768px) {
		.preset-bar {
			flex-wrap: wrap;
			overflow-x: visible;
			mask-image: none;
			gap: 6px;
			padding: 0;
			align-content: flex-start;
		}
	}

	.preset-pill {
		/* Mobile: don't shrink so pills stay touchable */
		scroll-snap-align: start;
		flex-shrink: 0;
		white-space: nowrap;
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		/* Fixed height so subscript/non-subscript pills stay the same size */
		min-height: 52px;
		padding: 0 14px;
		border: 1px solid #27272a; /* zinc-800 */
		border-radius: 20px;
		background: #18181b; /* zinc-900 */
		color: #f5f0e6;
		font: 500 13px/1.2 inherit;
		cursor: pointer;
		transition:
			background-color 120ms ease-out,
			border-color 120ms ease-out;
	}
	.preset-pill:hover {
		background: #1f1f23;
		border-color: #3f3f46; /* zinc-700 */
	}
	.preset-pill--active {
		background: rgba(245, 158, 11, 0.12);
		border-color: #f59e0b; /* amber-500 */
	}
	.preset-pill--active:hover {
		background: rgba(245, 158, 11, 0.18);
		border-color: #f59e0b;
	}
	.preset-pill__label {
		display: block;
	}
	.preset-pill__subscript {
		display: block;
		margin-top: 3px;
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-size: 10px;
		font-weight: 400;
		color: #52525b; /* zinc-600 */
		letter-spacing: 0;
		line-height: 1.2;
	}
	/* Active pill subscript slightly brighter */
	.preset-pill--active .preset-pill__subscript {
		color: #a16207; /* amber-700 */
	}
</style>
