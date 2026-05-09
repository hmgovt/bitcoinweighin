<script lang="ts">
	/**
	 * GeigerCrackle — Pu-238 audio toggle + visual click pulse.
	 *
	 * Hosts a `GeigerEngine` and gates audibility on three independent
	 * signals so audio never plays when the user can't see the panel:
	 *   1. user toggle              (audioEnabled store, persisted via ?audio=on)
	 *   2. panel in viewport        (IntersectionObserver on the parent panel element)
	 *   3. tab visible / focused    (Document Visibility API)
	 *
	 * Default OFF. AudioContext is constructed lazily on first toggle so
	 * we don't hit the browser autoplay policy. `prefers-reduced-motion`
	 * forces the toggle off and surfaces a hint that the preference was
	 * detected — same accessibility courtesy as our motion-sensitive
	 * users get elsewhere.
	 *
	 * The visual pulse listens for `geiger:click` window events the
	 * engine dispatches; sighted users with audio off still see the
	 * click pattern. The pulse fade is ~80 ms so at low rates each
	 * click is distinct, at high rates they blur into a steady glow —
	 * the same perceptual logic as the audio.
	 */

	import { onMount, onDestroy } from 'svelte';
	import { audioEnabled } from '$lib/stores/url.js';
	import { GeigerEngine, GEIGER_CLICK_EVENT, MASS_THRESHOLD_GRAMS } from './GeigerEngine.js';

	let {
		massGrams,
		panelElement,
	}: {
		massGrams: number;
		/**
		 * The Pu-238 panel <section> element. The IntersectionObserver
		 * watches this so the engine pauses when the panel scrolls out
		 * of view. Caller passes the bind:this reference.
		 */
		panelElement?: HTMLElement;
	} = $props();

	let engine: GeigerEngine | null = $state(null);
	let prefersReducedMotion = $state(false);
	let pulseEl: HTMLSpanElement | null = $state(null);
	let pulseAnimating = $state(false);
	let pulseResetTimeoutId: ReturnType<typeof setTimeout> | null = null;

	const enabled = $derived($audioEnabled);
	const belowThreshold = $derived(massGrams < MASS_THRESHOLD_GRAMS);

	function toggle() {
		if (prefersReducedMotion && !enabled) {
			// User explicitly opting in despite the preference — allow,
			// but no other surface tries to talk them out of it.
		}
		audioEnabled.update((v) => !v);
	}

	function onClickEvent() {
		// Restart the CSS pulse animation by toggling the class. ~80 ms
		// after each click, drop it so the next click can re-trigger.
		pulseAnimating = true;
		if (pulseResetTimeoutId !== null) clearTimeout(pulseResetTimeoutId);
		pulseResetTimeoutId = setTimeout(() => {
			pulseAnimating = false;
		}, 80);
	}

	onMount(() => {
		const reducedMotionMql = window.matchMedia('(prefers-reduced-motion: reduce)');
		prefersReducedMotion = reducedMotionMql.matches;
		const onReducedMotionChange = (e: MediaQueryListEvent) => {
			prefersReducedMotion = e.matches;
			if (e.matches && $audioEnabled) audioEnabled.set(false);
		};
		reducedMotionMql.addEventListener('change', onReducedMotionChange);

		// If the page loaded with audio=on URL but reduced-motion is set,
		// honour the preference and silence. The user can still toggle
		// back on explicitly afterwards.
		if (prefersReducedMotion && $audioEnabled) audioEnabled.set(false);

		engine = new GeigerEngine();

		// Visual click pulse — listens to engine-dispatched events.
		window.addEventListener(GEIGER_CLICK_EVENT, onClickEvent);

		// Tab visibility (background tabs go silent).
		const onVisibilityChange = () => {
			engine?.setTabVisible(document.visibilityState === 'visible');
		};
		document.addEventListener('visibilitychange', onVisibilityChange);
		engine.setTabVisible(document.visibilityState === 'visible');

		// Viewport observer — silences when the panel scrolls off-screen.
		// `panelElement` may not be available yet on the first effect tick
		// if the parent hasn't rendered; the $effect below re-runs when
		// it lands.
		let observer: IntersectionObserver | null = null;
		const observeFn = (el: HTMLElement | undefined) => {
			if (observer) observer.disconnect();
			if (!el) return;
			observer = new IntersectionObserver(
				(entries) => {
					for (const entry of entries) {
						engine?.setInViewport(entry.isIntersecting);
					}
				},
				// Threshold 0 with a small rootMargin: trigger as soon as
				// the panel enters / leaves viewport, not when it crosses
				// some percentage line.
				{ threshold: 0, rootMargin: '0px' }
			);
			observer.observe(el);
		};

		// Track panelElement reactively (it may bind after mount).
		$effect.root(() => {
			$effect(() => {
				observeFn(panelElement);
			});
		});

		return () => {
			reducedMotionMql.removeEventListener('change', onReducedMotionChange);
			window.removeEventListener(GEIGER_CLICK_EVENT, onClickEvent);
			document.removeEventListener('visibilitychange', onVisibilityChange);
			if (observer) observer.disconnect();
			if (pulseResetTimeoutId !== null) clearTimeout(pulseResetTimeoutId);
		};
	});

	onDestroy(() => {
		engine?.destroy();
		engine = null;
	});

	// Push state changes down into the engine when they happen.
	$effect(() => {
		engine?.setMass(massGrams);
	});
	$effect(() => {
		engine?.setEnabled(enabled);
	});
</script>

<div class="geiger" role="group" aria-label="Pu-238 Geiger audio">
	<button
		type="button"
		class="geiger-toggle"
		class:geiger-toggle-on={enabled}
		class:geiger-toggle-disabled={belowThreshold}
		onclick={toggle}
		aria-pressed={enabled}
		title={belowThreshold
			? 'Geiger audio inactive below 1 g of Pu-238'
			: enabled
				? 'Disable Geiger audio (synthesised, not a sample)'
				: 'Enable Geiger audio (synthesised, not a sample)'}
	>
		{#if enabled}
			<!-- Speaker — sound on -->
			<svg
				class="geiger-icon"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
				<path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
				<path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
			</svg>
		{:else}
			<!-- Speaker with slash — muted -->
			<svg
				class="geiger-icon"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
				<line x1="22" y1="9" x2="16" y2="15" />
				<line x1="16" y1="9" x2="22" y2="15" />
			</svg>
		{/if}
		<span class="geiger-label">{enabled ? 'Geiger on' : 'Geiger'}</span>
	</button>

	<span
		bind:this={pulseEl}
		class="geiger-pulse"
		class:geiger-pulse-active={pulseAnimating}
		aria-hidden="true"
	></span>

	{#if prefersReducedMotion}
		<span class="geiger-rmm-hint">(reduced-motion preference detected)</span>
	{/if}
</div>

<style>
	.geiger {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

	.geiger-toggle {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		background: transparent;
		border: 1px solid #3f3f46; /* zinc-700 */
		border-radius: 4px;
		color: #a1a1aa; /* zinc-400 */
		font-size: 0.75rem;
		line-height: 1;
		cursor: pointer;
		transition:
			color 150ms ease-out,
			border-color 150ms ease-out,
			background 150ms ease-out;
	}
	.geiger-toggle:hover {
		color: #e4e4e7; /* zinc-200 */
		border-color: #71717a; /* zinc-500 */
	}
	.geiger-toggle-on {
		color: #fbbf24; /* amber-400 */
		border-color: #92400e; /* amber-800 */
		background: rgba(146, 64, 14, 0.15);
	}
	.geiger-toggle-on:hover {
		color: #fcd34d; /* amber-300 */
		border-color: #b45309; /* amber-700 */
	}
	.geiger-toggle-disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.geiger-icon {
		width: 14px;
		height: 14px;
	}

	.geiger-label {
		font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
	}

	/*
	 * Visual click pulse — fades to ~0 over 80 ms after each click event.
	 * At low rates each click is distinct; at high rates the pulses
	 * overlap and the dot reads as a steady glow. Mirrors the audio
	 * perceptual logic: the merging-into-hiss point is the cue to
	 * leave the room.
	 */
	.geiger-pulse {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #fbbf24; /* amber-400 */
		opacity: 0;
		transition: opacity 80ms ease-out;
	}
	.geiger-pulse-active {
		opacity: 1;
		transition: none;
	}

	.geiger-rmm-hint {
		font-size: 0.6875rem;
		color: #71717a; /* zinc-500 */
		font-style: italic;
	}

	@media (prefers-reduced-motion: reduce) {
		.geiger-pulse,
		.geiger-toggle {
			transition: none;
		}
	}
</style>
