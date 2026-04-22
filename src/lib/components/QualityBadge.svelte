<script lang="ts">
	let { quality }: { quality: string } = $props();
</script>

{#if quality === 'illustrative'}
	<span class="rounded bg-amber-900/50 px-1.5 py-0.5 text-xs text-amber-300"
		>Illustrative price</span
	>
{:else if quality === 'indicative'}
	<span class="rounded bg-blue-900/50 px-1.5 py-0.5 text-xs text-blue-300">Indicative</span>
{:else if quality === 'historical'}
	<span class="rounded bg-zinc-700 px-1.5 py-0.5 text-xs text-zinc-400">Historical</span>
{/if}
