<script lang="ts">
	import { getPinnedPresets, getDrawerPresets, type Preset } from '$lib/presets.js';

	let {
		activePresetId,
		onSelect,
	}: {
		activePresetId: string | null;
		onSelect: (id: string) => void;
	} = $props();

	const pinned = getPinnedPresets();
	const drawer = getDrawerPresets();

	let drawerOpen = $state(false);

	const categoryColors: Record<string, string> = {
		denomination: 'border-zinc-500 text-zinc-300',
		history: 'border-orange-500/50 text-orange-300',
		entity: 'border-purple-500/50 text-purple-300',
		absurdity: 'border-red-500/50 text-red-300',
	};

	function pillClass(preset: Preset): string {
		const active = activePresetId === preset.id;
		const color = categoryColors[preset.category] || 'border-zinc-500 text-zinc-300';
		const base =
			'shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors cursor-pointer';
		if (active) {
			return `${base} bg-zinc-100 text-zinc-900 border-zinc-100 font-semibold`;
		}
		return `${base} ${color} hover:bg-zinc-800`;
	}
</script>

<div class="mb-4">
	<!-- Pinned presets — horizontal scroll -->
	<div class="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
		{#each pinned as preset (preset.id)}
			<button
				class={pillClass(preset)}
				title={preset.description}
				onclick={() => onSelect(preset.id)}
			>
				{preset.label}
			</button>
		{/each}
		<button
			class="shrink-0 whitespace-nowrap rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-500 hover:bg-zinc-800 transition-colors cursor-pointer"
			onclick={() => (drawerOpen = !drawerOpen)}
		>
			{drawerOpen ? 'Less' : 'More presets…'}
		</button>
	</div>

	<!-- Drawer -->
	{#if drawerOpen}
		<div class="mt-2 flex flex-wrap gap-2">
			{#each drawer as preset (preset.id)}
				<button
					class={pillClass(preset)}
					title={preset.description}
					onclick={() => onSelect(preset.id)}
				>
					{preset.label}
				</button>
			{/each}
		</div>
	{/if}
</div>
