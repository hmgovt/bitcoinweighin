<script lang="ts">
	/**
	 * AsicSound — ASIC fan-noise toggle.
	 *
	 * Three-state cycle: OFF → SOLO → NETWORK → OFF.
	 * Lazy AudioContext; gated by viewport + tab visibility (same pattern
	 * as GeigerCrackle). Panel element passed in for IntersectionObserver.
	 */

	import { onMount, onDestroy } from 'svelte';
	import { AsicSoundEngine, type AsicMode } from './AsicSoundEngine.js';

	let {
		panelElement,
	}: {
		panelElement?: HTMLElement;
	} = $props();

	let engine: AsicSoundEngine | null = $state(null);
	let mode = $state<AsicMode>('off');
	let prefersReducedMotion = $state(false);

	const labels: Record<AsicMode, string> = {
		off:     'Miners: off',
		solo:    'Miners: solo',
		network: 'Miners: network',
	};

	function cycle() {
		if (prefersReducedMotion && mode === 'off') return;
		const next: AsicMode = mode === 'off' ? 'solo' : mode === 'solo' ? 'network' : 'off';
		mode = next;
		engine?.setMode(next);
	}

	onMount(() => {
		const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
		prefersReducedMotion = mql.matches;
		const onMqlChange = (e: MediaQueryListEvent) => {
			prefersReducedMotion = e.matches;
			if (e.matches && mode !== 'off') {
				mode = 'off';
				engine?.setMode('off');
			}
		};
		mql.addEventListener('change', onMqlChange);

		engine = new AsicSoundEngine();

		const onVisibilityChange = () => {
			engine?.setTabVisible(document.visibilityState === 'visible');
		};
		document.addEventListener('visibilitychange', onVisibilityChange);
		engine.setTabVisible(document.visibilityState === 'visible');

		let observer: IntersectionObserver | null = null;
		const observe = (el: HTMLElement | undefined) => {
			observer?.disconnect();
			if (!el) return;
			observer = new IntersectionObserver(
				(entries) => { for (const e of entries) engine?.setInViewport(e.isIntersecting); },
				{ threshold: 0 }
			);
			observer.observe(el);
		};

		$effect.root(() => { $effect(() => { observe(panelElement); }); });

		return () => {
			mql.removeEventListener('change', onMqlChange);
			document.removeEventListener('visibilitychange', onVisibilityChange);
			observer?.disconnect();
		};
	});

	onDestroy(() => {
		engine?.destroy();
		engine = null;
	});
</script>

<div class="asic-sound" role="group" aria-label="ASIC miner audio">
	<button
		type="button"
		class="asic-toggle"
		class:mode-solo={mode === 'solo'}
		class:mode-network={mode === 'network'}
		onclick={cycle}
		aria-label={labels[mode]}
		title="Cycle through: off → solo miner → full network → off"
		disabled={prefersReducedMotion && mode === 'off'}
	>
		<!-- Speaker icon -->
		{#if mode === 'off'}
			<svg class="asic-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
				<line x1="22" y1="9" x2="16" y2="15" />
				<line x1="16" y1="9" x2="22" y2="15" />
			</svg>
		{:else if mode === 'solo'}
			<svg class="asic-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
				<path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
			</svg>
		{:else}
			<svg class="asic-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
				<path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
				<path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
			</svg>
		{/if}
		<span class="asic-label">{labels[mode]}</span>
	</button>
	{#if prefersReducedMotion}
		<span class="asic-rmm-hint">(reduced-motion detected)</span>
	{/if}
</div>

<style>
	.asic-sound {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	.asic-toggle {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		background: transparent;
		border: 1px solid #3f3f46;
		border-radius: 4px;
		color: #a1a1aa;
		font-size: 0.75rem;
		line-height: 1;
		cursor: pointer;
		transition: color 150ms ease-out, border-color 150ms ease-out, background 150ms ease-out;
	}
	.asic-toggle:hover {
		color: #e4e4e7;
		border-color: #71717a;
	}
	.asic-toggle:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.mode-solo {
		color: #38bdf8;
		border-color: #0369a1;
		background: rgba(3, 105, 161, 0.15);
	}
	.mode-solo:hover {
		color: #7dd3fc;
		border-color: #0284c7;
	}
	.mode-network {
		color: #fbbf24;
		border-color: #92400e;
		background: rgba(146, 64, 14, 0.15);
	}
	.mode-network:hover {
		color: #fcd34d;
		border-color: #b45309;
	}
	.asic-icon {
		width: 14px;
		height: 14px;
	}
	.asic-label {
		font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
	}
	.asic-rmm-hint {
		font-size: 0.6875rem;
		color: #71717a;
		font-style: italic;
	}
</style>
