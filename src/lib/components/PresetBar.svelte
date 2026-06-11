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
	/* Single scrollable row instead of a ragged multi-row wrap (pre-launch
	   review §1). Scrollbar hidden; edge fades signal overflow; pills
	   snap so a flick lands cleanly. */
	.preset-bar {
		display: flex;
		flex-wrap: nowrap;
		justify-content: flex-start;
		gap: 8px;
		overflow-x: auto;
		scroll-snap-type: x proximity;
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
		mask-image: linear-gradient(
			to right,
			transparent 0,
			#000 12px,
			#000 calc(100% - 12px),
			transparent 100%
		);
		padding: 2px 12px;
	}
	.preset-bar::-webkit-scrollbar {
		display: none;
	}

	.preset-pill {
		scroll-snap-align: start;
		flex-shrink: 0;
		white-space: nowrap;
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		padding: 8px 14px;
		border: 1px solid #3a3a3a;
		border-radius: 18px;
		background: transparent;
		color: #f5f0e6;
		font: 500 14px/1.2 inherit;
		cursor: pointer;
		transition:
			background-color 120ms ease-out,
			border-color 120ms ease-out;
	}
	.preset-pill:hover {
		border-color: #5a5a5a;
	}
	.preset-pill--active {
		background: rgba(245, 158, 11, 0.15); /* amber-500 @ 15% — brand orange */
		border-color: #f59e0b;
	}
	.preset-pill--active:hover {
		border-color: #f59e0b;
	}
	.preset-pill__label {
		display: block;
	}
	.preset-pill__subscript {
		display: block;
		margin-top: 2px;
		font-size: 11px;
		font-weight: 400;
		color: #7a7a7a;
		letter-spacing: 0;
	}

</style>
