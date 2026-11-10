<script lang="ts">
	/**
	 * The site bar: the Bitcoin Weigh-In lockup (cast-weight mark + stacked
	 * name) on the left, the site's sections on the right.
	 */
	import BrandMark from './BrandMark.svelte';

	let {
		current = null,
		tone = 'dark',
	}: {
		/** Which section this page is, for aria-current. */
		current?: 'mining' | 'data' | 'methodology' | null;
		/** The page ground: the visualiser and /mining are dark, the reference pages light. */
		tone?: 'dark' | 'light';
	} = $props();

	const LINKS = [
		{ id: 'mining', href: '/mining', label: 'Inside a miner', short: 'Miner' },
		{ id: 'hashweight', href: '/#hashweight', label: 'Hashweight', short: null },
		{ id: 'data', href: '/data', label: 'Data', short: 'Data' },
		{ id: 'methodology', href: '/methodology', label: 'Methodology', short: 'Method' },
	] as const;
</script>

<header class="bar" class:bar--light={tone === 'light'}>
	<a href="/" class="lockup" aria-label="Bitcoin Weigh-In — home">
		<BrandMark size={40} class="lockup__mark" />
		<span class="lockup__name" aria-hidden="true">
			<span class="lockup__btc">Bitcoin</span>
			<span class="lockup__wi">Weigh-In</span>
		</span>
	</a>

	<nav class="nav" aria-label="Site">
		{#each LINKS as l (l.id)}
			<a
				href={l.href}
				class="nav__link"
				class:nav__link--wide-only={!l.short}
				aria-current={current === l.id ? 'page' : undefined}
			>
				<span class="nav__full">{l.label}</span>
				{#if l.short}<span class="nav__short" aria-hidden="true">{l.short}</span>{/if}
			</a>
		{/each}
	</nav>
</header>

<style>
	.bar {
		--bar-ink: #f5f0e6;
		--bar-ink-2: #a1a1aa;
		--bar-hover: #18181b;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		min-height: 56px;
	}
	.lockup {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		color: inherit;
		text-decoration: none;
		flex-shrink: 0;
		border-radius: 6px;
	}
	.lockup:focus-visible {
		outline: 2px solid #f7931a;
		outline-offset: 4px;
	}
	.lockup :global(.lockup__mark) {
		display: block;
		transition: transform 260ms cubic-bezier(0.3, 1.6, 0.5, 1);
	}
	/* A small drop on hover — the mark is a weight, after all. */
	.lockup:hover :global(.lockup__mark) {
		transform: translateY(2px);
	}
	/* Two words, one weight: BITCOIN is spaced out to WEIGH-IN's width. */
	.lockup__name {
		display: flex;
		flex-direction: column;
		font: 900 19px/0.86 'Inter Tight', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
		text-transform: uppercase;
	}
	.lockup__btc {
		color: #f7931a;
		letter-spacing: 0.1335em;
		margin-right: -0.1335em;
	}
	.bar--light {
		--bar-ink: #18181b;
		--bar-ink-2: #52525b;
		--bar-hover: #f4f4f5;
	}
	.lockup__wi {
		color: var(--bar-ink);
	}

	.nav {
		display: flex;
		align-items: center;
		gap: 2px;
		min-width: 0;
	}
	.nav__link {
		font: 500 13.5px/1 'Inter Tight', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
		color: var(--bar-ink-2);
		text-decoration: none;
		padding: 8px 10px;
		border-radius: 6px;
		white-space: nowrap;
		transition: color 120ms ease, background 120ms ease;
	}
	.nav__link:hover {
		color: var(--bar-ink);
		background: var(--bar-hover);
	}
	.nav__link[aria-current='page'] {
		color: var(--bar-ink);
	}
	.nav__link:focus-visible {
		outline: 2px solid #f7931a;
		outline-offset: 1px;
	}
	.nav__short {
		display: none;
	}

	@media (max-width: 720px) {
		.nav__link--wide-only {
			display: none;
		}
		.nav__full {
			display: none;
		}
		.nav__short {
			display: inline;
		}
		.nav__link {
			padding: 8px 7px;
			font-size: 13px;
		}
	}
	@media (max-width: 380px) {
		.lockup__name {
			font-size: 17px;
		}
		.nav__link {
			padding: 8px 5px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.lockup :global(.lockup__mark) {
			transition: none;
		}
	}
</style>
