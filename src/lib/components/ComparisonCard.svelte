<script lang="ts">
	/**
	 * Text comparison card — shown when displayed size exceeds ~5 m
	 * or when tile mode hits its cap.
	 */

	let {
		massText,
		volumeText,
	}: {
		massText: string | null;
		volumeText: string | null;
	} = $props();

	const hasContent = $derived(massText !== null || volumeText !== null);
</script>

{#if hasContent}
	<div class="mt-3 rounded border border-zinc-700 bg-zinc-800/50 px-4 py-3">
		<div class="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
			For scale
		</div>
		{#if massText}
			<div class="text-sm text-zinc-300">≈ {massText}</div>
		{/if}
		{#if volumeText}
			<div class="text-sm text-zinc-400">{volumeText}</div>
		{/if}
	</div>
{/if}
