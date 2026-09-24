<script lang="ts">
	/**
	 * The homepage's way into /mining, at the foot of the Hashweight panel:
	 * a silent loop of a chip coming apart, and a live count of the hashes the
	 * network has tried since the strip came into view.
	 *
	 * The clip only loads once the strip nears the viewport, plays only while
	 * it's on screen, and is replaced by its poster for reduced motion or
	 * Save-Data.
	 */
	import { onMount } from 'svelte';
	import { fmtBig } from '$lib/mining/format.js';

	let { hashrateEH }: { hashrateEH: number | null } = $props();

	let el: HTMLElement | undefined = $state();
	let video: HTMLVideoElement | undefined = $state();
	let loadVideo = $state(false);
	let hashes = $state(0);

	onMount(() => {
		if (!el) return;
		const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
		const still = matchMedia('(prefers-reduced-motion: reduce)').matches || conn?.saveData === true;
		let started = 0;
		let timer = 0;
		const near = new IntersectionObserver(([e]) => {
			if (!e.isIntersecting) return;
			near.disconnect();
			if (!still) loadVideo = true;
		}, { rootMargin: '400px 0px' });
		const onScreen = new IntersectionObserver(([e]) => {
			if (e.isIntersecting) {
				if (!started) {
					started = performance.now();
					timer = window.setInterval(() => {
						hashes = (hashrateEH ?? 800) * 1e18 * ((performance.now() - started) / 1000);
					}, 100);
				}
				void video?.play().catch(() => {});
			} else video?.pause();
		}, { threshold: 0.25 });
		near.observe(el);
		onScreen.observe(el);
		return () => { near.disconnect(); onScreen.disconnect(); clearInterval(timer); };
	});
</script>

<a class="ms" href="/mining" bind:this={el} data-umami-event="home-mining-strip">
	<div class="ms-media" aria-hidden="true">
		{#if loadVideo}
			<video bind:this={video} src="/video/mining-loop.mp4" poster="/images/mining-loop-poster.jpg" muted loop playsinline autoplay preload="auto"></video>
		{:else}
			<img src="/images/mining-loop-poster.jpg" alt="" loading="lazy" decoding="async" width="960" height="540" />
		{/if}
		<span class="ms-badge">3D · interactive</span>
	</div>
	<div class="ms-copy">
		<p class="ms-eyebrow"><span>New</span> · Inside a miner</p>
		<h3 class="ms-title">Now step inside one of those machines</h3>
		<p class="ms-body">
			Take a mining chip apart down to the silicon, then watch one hash core check real block headers,
			one SHA-256 round at a time, until it finds a real block.
		</p>
		<div class="ms-live">
			<div class="ms-num">{hashes > 0 ? fmtBig(hashes) : '0'}</div>
			<div class="ms-live-label">
				<span class="ms-dot" aria-hidden="true"></span>hashes tried by the network since this came into view. One of them will win the next block.
			</div>
		</div>
		<span class="ms-cta">Go inside a miner <span class="ms-arrow" aria-hidden="true">→</span></span>
	</div>
</a>

<style>
	.ms {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 20px;
		margin-top: 32px;
		padding-top: 28px;
		border-top: 1px solid #27272a;
		color: inherit;
		text-decoration: none;
	}
	@media (min-width: 768px) {
		.ms { grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 32px; align-items: center; }
	}
	.ms-media {
		position: relative;
		aspect-ratio: 16 / 9;
		border-radius: 10px;
		overflow: hidden;
		background: #0e0e11;
		box-shadow: 0 0 0 1px #27272a;
	}
	.ms-media video,
	.ms-media img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		transition: transform 600ms cubic-bezier(0.2, 0.7, 0.2, 1);
	}
	.ms:hover .ms-media video,
	.ms:hover .ms-media img { transform: scale(1.03); }
	.ms-media::after {
		content: '';
		position: absolute;
		inset: 0;
		background: radial-gradient(120% 90% at 50% 40%, transparent 55%, rgba(9, 9, 11, 0.55));
		pointer-events: none;
	}
	.ms-badge {
		position: absolute;
		left: 12px;
		top: 12px;
		z-index: 1;
		font: 700 10px/1 'JetBrains Mono', ui-monospace, monospace;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #e4e4e7;
		background: rgba(9, 9, 11, 0.72);
		border: 1px solid #3f3f46;
		border-radius: 4px;
		padding: 5px 7px;
	}
	.ms-eyebrow {
		font: 700 10px/1 'JetBrains Mono', ui-monospace, monospace;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #71717a;
		margin: 0 0 10px;
	}
	.ms-eyebrow span { color: #fbbf24; }
	.ms-title {
		font-family: 'Inter Tight', 'Inter', sans-serif;
		font-size: 24px;
		font-weight: 600;
		line-height: 1.15;
		letter-spacing: -0.02em;
		color: #f4f4f5;
		margin: 0;
		text-wrap: balance;
	}
	.ms-body { font-size: 14px; line-height: 1.55; color: #a1a1aa; margin: 10px 0 0; max-width: 46ch; }
	.ms-live { margin-top: 18px; }
	.ms-num {
		font: 600 26px/1.15 'JetBrains Mono', ui-monospace, monospace;
		font-variant-numeric: tabular-nums;
		color: #fbbf24;
	}
	.ms-live-label {
		font: 11px/1.5 'JetBrains Mono', ui-monospace, monospace;
		color: #71717a;
		margin-top: 4px;
		max-width: 48ch;
	}
	.ms-dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #fbbf24;
		margin-right: 7px;
		vertical-align: 1px;
		animation: ms-pulse 1.6s ease-in-out infinite;
	}
	@keyframes ms-pulse { 50% { opacity: 0.25; } }
	.ms-cta {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		margin-top: 20px;
		font: 600 14px 'Inter Tight', 'Inter', sans-serif;
		color: #09090b;
		background: #fbbf24;
		border-radius: 8px;
		padding: 10px 16px;
	}
	.ms-arrow { transition: transform 200ms ease; }
	.ms:hover .ms-arrow { transform: translateX(4px); }
	.ms:focus-visible { outline: 2px solid #fbbf24; outline-offset: 6px; border-radius: 12px; }
	@media (prefers-reduced-motion: reduce) {
		.ms-dot { animation: none; }
		.ms-media video, .ms-media img, .ms-arrow { transition: none; }
	}
</style>
