<script lang="ts">
	/**
	 * /videos — every Bitcoin Weigh-In video (src/lib/videos.ts). Each card
	 * shows our own poster and loads YouTube's privacy-enhanced player only
	 * when someone presses play, so the page stays light and sets no YouTube
	 * cookies until then. Shorts sit in a row of vertical cards; 16:9 videos
	 * in a column of wide ones.
	 */
	import SiteHeader from '$lib/components/brand/SiteHeader.svelte';
	import { breadcrumbJsonLd, webPageJsonLd } from '$lib/seo/jsonld.js';
	import { VIDEOS, clock, isoDuration, type Video } from '$lib/videos.js';

	const SITE = 'https://bitcoinweighin.com';
	const wide = VIDEOS.filter((v) => v.kind === 'video');
	const shorts = VIDEOS.filter((v) => v.kind === 'short');

	let playing = $state<string | null>(null);

	const embed = (v: Video) =>
		`https://www.youtube-nocookie.com/embed/${v.youtubeId}?autoplay=1&rel=0&playsinline=1&modestbranding=1`;
	const watch = (v: Video) =>
		v.kind === 'short' ? `https://www.youtube.com/shorts/${v.youtubeId}` : `https://www.youtube.com/watch?v=${v.youtubeId}`;
	const dateLabel = (d: string) =>
		new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

	const videoJsonLd = VIDEOS.map((v) =>
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'VideoObject',
			name: v.title,
			description: v.description,
			thumbnailUrl: `${SITE}/video/posters/${v.poster}`,
			uploadDate: v.published,
			duration: isoDuration(v.durationS),
			embedUrl: `https://www.youtube-nocookie.com/embed/${v.youtubeId}`,
			url: `${SITE}/videos#${v.slug}`,
			publisher: { '@type': 'Organization', name: 'Bitcoin Weigh-In', url: SITE },
		}).replace(/</g, '\\u003c')
	);
</script>

<svelte:head>
	<title>Videos: Bitcoin, Weighed in Real Things · Bitcoin Weigh-In</title>
	<meta
		name="description"
		content="Short videos of what bitcoin buys, drawn to true scale from real closing prices: oil fields, Manhattan, plutonium-238, gold and more."
	/>
	<link rel="canonical" href="{SITE}/videos" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="{SITE}/videos" />
	<meta property="og:title" content="Videos: Bitcoin, weighed in real things" />
	<meta property="og:description" content="What bitcoin buys, drawn to true scale from real closing prices." />
	<meta property="og:image" content="{SITE}/og-image" />
	<meta name="twitter:card" content="summary_large_image" />
	{@html `<script type="application/ld+json">${webPageJsonLd({ url: `${SITE}/videos`, name: 'Videos — Bitcoin Weigh-In', description: 'What bitcoin buys, drawn to true scale from real closing prices.' })}</script>`}
	{@html `<script type="application/ld+json">${breadcrumbJsonLd([{ name: 'Home', url: `${SITE}/` }, { name: 'Videos', url: `${SITE}/videos` }])}</script>`}
	{#each videoJsonLd as ld (ld)}
		{@html `<script type="application/ld+json">${ld}</script>`}
	{/each}
</svelte:head>

<div class="ground">
<div class="page">
	<SiteHeader current="videos" />

	<header class="intro">
		<h1>Videos</h1>
		<p>
			What bitcoin buys, drawn to true scale from real closing prices. Every number is checkable on the
			site, and every video is free to share with a credit to bitcoinweighin.com.
		</p>
	</header>

	{#if VIDEOS.length === 0}
		<p class="empty">The first videos are on their way.</p>
	{/if}

	{#if shorts.length}
		<section aria-labelledby="shorts-h">
			<h2 id="shorts-h">Shorts</h2>
			<ul class="shorts">
				{#each shorts as v (v.slug)}
					<li id={v.slug} class="card">
						<div class="frame tall">
							{#if playing === v.slug}
								<iframe
									src={embed(v)}
									title={v.title}
									allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
									allowfullscreen
								></iframe>
							{:else}
								<button type="button" class="poster" onclick={() => (playing = v.slug)} aria-label="Play: {v.title}">
									<img src="/video/posters/{v.poster}" alt="" loading="lazy" width="360" height="640" />
									<span class="play" aria-hidden="true"></span>
									<span class="dur">{clock(v.durationS)}</span>
								</button>
							{/if}
						</div>
						<h3>{v.title}</h3>
						<p class="desc">{v.description}</p>
						<p class="meta">
							{dateLabel(v.published)} ·
							<a href={watch(v)} rel="noopener" target="_blank">YouTube</a> ·
							<a href="/?commodity={v.commodity}">Try it</a>
						</p>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if wide.length}
		<section aria-labelledby="videos-h">
			<h2 id="videos-h">Videos</h2>
			<ul class="wide">
				{#each wide as v (v.slug)}
					<li id={v.slug} class="card">
						<div class="frame">
							{#if playing === v.slug}
								<iframe
									src={embed(v)}
									title={v.title}
									allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
									allowfullscreen
								></iframe>
							{:else}
								<button type="button" class="poster" onclick={() => (playing = v.slug)} aria-label="Play: {v.title}">
									<img src="/video/posters/{v.poster}" alt="" loading="lazy" width="1280" height="720" />
									<span class="play" aria-hidden="true"></span>
									<span class="dur">{clock(v.durationS)}</span>
								</button>
							{/if}
						</div>
						<h3>{v.title}</h3>
						<p class="desc">{v.description}</p>
						<p class="meta">
							{dateLabel(v.published)} ·
							<a href={watch(v)} rel="noopener" target="_blank">YouTube</a> ·
							<a href="/?commodity={v.commodity}">Try it</a>
						</p>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
</div>

<style>
	.ground {
		min-height: 100vh;
		background: #0e0e10;
	}
	.page {
		max-width: 1100px;
		margin: 0 auto;
		padding: 0 16px 64px;
		color: #e4e4e7;
		font-family: 'Inter Tight', -apple-system, system-ui, sans-serif;
	}
	.intro {
		margin: 24px 0 28px;
		max-width: 62ch;
	}
	h1 {
		margin: 0;
		font-size: 30px;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: #fafafa;
	}
	.intro p {
		margin: 10px 0 0;
		color: #a1a1aa;
		line-height: 1.5;
	}
	h2 {
		margin: 28px 0 14px;
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: #71717a;
	}
	.empty {
		color: #a1a1aa;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 22px;
	}
	.shorts {
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
	}
	.wide {
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 480px), 1fr));
	}
	.frame {
		position: relative;
		aspect-ratio: 16 / 9;
		border-radius: 12px;
		overflow: hidden;
		background: #111113;
		border: 1px solid #27272a;
	}
	.frame.tall {
		aspect-ratio: 9 / 16;
	}
	.frame iframe,
	.poster {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
	}
	.poster {
		padding: 0;
		background: none;
		cursor: pointer;
	}
	.poster img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.play {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 68px;
		height: 68px;
		margin: -34px 0 0 -34px;
		border-radius: 50%;
		background: #f7931ae6;
		box-shadow: 0 6px 24px #000a;
		transition: transform 120ms ease;
	}
	.play::after {
		content: '';
		position: absolute;
		left: 27px;
		top: 21px;
		border-style: solid;
		border-width: 13px 0 13px 21px;
		border-color: transparent transparent transparent #0b0b0d;
	}
	/* Posters carry their headline up top: keep the button off it. */
	.tall .play {
		top: 82%;
	}
	.poster:hover .play,
	.poster:focus-visible .play {
		transform: scale(1.08);
	}
	.poster:focus-visible {
		outline: 3px solid #f7931a;
		outline-offset: -3px;
	}
	.dur {
		position: absolute;
		right: 8px;
		bottom: 8px;
		padding: 2px 7px;
		border-radius: 6px;
		background: #000c;
		font: 600 12px/1.4 'JetBrains Mono', ui-monospace, monospace;
		color: #fafafa;
	}
	h3 {
		margin: 12px 0 0;
		font-size: 17px;
		font-weight: 700;
		line-height: 1.25;
		color: #fafafa;
	}
	.desc {
		margin: 6px 0 0;
		font-size: 14px;
		line-height: 1.45;
		color: #a1a1aa;
	}
	.meta {
		margin: 8px 0 0;
		font: 500 12px/1.5 'JetBrains Mono', ui-monospace, monospace;
		color: #71717a;
	}
	.meta a {
		color: #a1a1aa;
		text-decoration: underline;
	}
	.meta a:hover {
		color: #f7931a;
	}
</style>
