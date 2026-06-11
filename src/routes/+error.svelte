<script lang="ts">
	import { page } from '$app/stores';
</script>

<svelte:head>
	<title>Page not found — Bitcoin Weigh-In</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="error-page">
	<h1>{$page.status === 404 ? 'Page not found' : `Error ${$page.status}`}</h1>
	<p class="message">
		{$page.status === 404
			? 'Nothing weighs in at this address.'
			: ($page.error?.message ?? 'Something went wrong.')}
	</p>
	<nav class="links">
		<a href="/">The visualiser</a>
		<a href="/btc/gold">Bitcoin → gold</a>
		<a href="/data">The dataset</a>
		<a href="/methodology">Methodology</a>
	</nav>
</div>

<style>
	.error-page {
		min-height: 60vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		text-align: center;
		padding: 48px 16px;
	}
	h1 {
		font-size: 1.5rem;
		font-weight: 600;
		color: #f5f0e6;
	}
	.message {
		color: #a1a1aa;
	}
	.links {
		display: flex;
		gap: 18px;
		flex-wrap: wrap;
		justify-content: center;
		margin-top: 12px;
	}
	.links a {
		color: #f59e0b;
		text-decoration: none;
		border-bottom: 1px solid rgba(245, 158, 11, 0.35);
	}
	.links a:hover {
		border-bottom-color: #f59e0b;
	}
</style>
