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

<div class="preset-bar">
	{#each ENTITIES as entity (entity.slug)}
		<button
			type="button"
			class={pillClass(entity)}
			title={entity.note}
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
	<button
		type="button"
		class="preset-pill preset-pill--placeholder"
		title="More entity presets coming in a future release."
		aria-label="More presets (placeholder)"
	>
		<span class="preset-pill__label">More presets…</span>
	</button>
</div>

<style>
	.preset-bar {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 8px;
	}

	.preset-pill {
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
		background: rgba(228, 228, 231, 0.12);
		border-color: #e4e4e7;
	}
	.preset-pill--placeholder {
		color: #71717a;
		cursor: default;
	}
	.preset-pill--placeholder:hover {
		border-color: #3a3a3a;
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

	@media (max-width: 767px) {
		.preset-bar {
			justify-content: flex-start;
		}
	}
</style>
