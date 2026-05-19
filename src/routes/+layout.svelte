<script>
	import '../app.css';
	import TipJar from '$lib/components/TipJar.svelte';
	let { children } = $props();
</script>

{@render children()}
<TipJar />
