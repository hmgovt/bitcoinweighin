<script lang="ts">
	import { onMount } from 'svelte';
	import SiteHeader from '$lib/components/brand/SiteHeader.svelte';

	// Same key static/count.js reads. The only thing this site stores, and only
	// because the visitor asked.
	const NO_COUNT_KEY = 'bwi-no-count';

	let ready = $state(false);
	let noCount = $state(false);
	let browserSignal = $state(false);

	function readNoCount(): boolean {
		try {
			return localStorage.getItem(NO_COUNT_KEY) === '1';
		} catch {
			return false;
		}
	}

	onMount(() => {
		const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
		const win = window as Window & { doNotTrack?: string };
		browserSignal = nav.globalPrivacyControl === true || nav.doNotTrack === '1' || win.doNotTrack === '1';
		noCount = readNoCount();
		ready = true;
	});

	function toggle() {
		try {
			if (readNoCount()) localStorage.removeItem(NO_COUNT_KEY);
			else localStorage.setItem(NO_COUNT_KEY, '1');
		} catch {
			// storage blocked: nothing to remember
		}
		noCount = readNoCount();
		const ph = (window as Window & { posthog?: { opt_out_capturing?: () => void } }).posthog;
		if (noCount) ph?.opt_out_capturing?.();
	}
</script>

<svelte:head>
	<title>Privacy · Bitcoin Weigh-In</title>
	<meta
		name="description"
		content="What Bitcoin Weigh-In counts about visits, how it's kept anonymous and cookie-free, and how to opt out."
	/>
	<link rel="canonical" href="https://bitcoinweighin.com/privacy" />
</svelte:head>

<div class="privacy-page">
	<main class="mx-auto max-w-3xl px-4 py-8 text-zinc-800">
		<div class="mb-6 -mt-4"><SiteHeader tone="light" /></div>
		<header class="mb-8 border-b border-zinc-200 pb-6">
			<h1 class="text-2xl font-semibold tracking-tight">Privacy</h1>
			<p class="mt-2 text-sm text-zinc-600">
				This site has no accounts and sets no cookies. It counts visits anonymously so we can see
				which pages people read. This page says exactly what that means.
			</p>
		</header>

		<section id="counting" class="prose-section">
			<h2>Counting visits</h2>
			<p>
				We count visits with PostHog, on PostHog's servers in the EU (Frankfurt). For each page you
				open, it records the page's address, the site you came from, your browser, operating system
				and device type, your screen size, language and time zone, and roughly how long you stayed.
				It doesn't record what you type or click, and it never records your screen.
			</p>
			<p>
				It uses no cookies and keeps nothing on your device. To tell one day's visits apart,
				PostHog makes a one-way code from your IP address and browser, mixed with a secret that
				changes every day, then discards the IP address before anything is stored. The code can't be
				turned back into your IP address or linked across days, and we never see your IP address.
				We use the counts only as totals, never to identify, profile or advertise to anyone. They
				travel through this site's own address, so your browser doesn't contact PostHog directly.
			</p>
			<p>
				The site also uses two other cookie-free counters:
				<a href="https://www.cloudflare.com/web-analytics/" class="underline hover:no-underline"
					>Cloudflare Web Analytics</a
				>
				and <a href="https://umami.is/" class="underline hover:no-underline">Umami</a>. They load
				from those companies' own addresses and count page views in a similar anonymous way. The
				button and browser settings below apply to the PostHog count only; a content blocker stops
				all three.
			</p>
		</section>

		<section id="opt-out" class="prose-section">
			<h2>Not being counted</h2>
			<p>
				If your browser sends Global Privacy Control or Do Not Track, PostHog doesn't count your
				visit at all. Brave, DuckDuckGo and Firefox can send these, as can most privacy extensions.
				Or press the button below: this browser then keeps a note not to count you. That note is the
				only thing this site stores on your device, and only because you asked.
			</p>
			{#if ready}
				{#if browserSignal}
					<p class="status">Your browser is sending a do-not-track signal, so your visits aren't counted.</p>
				{/if}
				<p>
					<button type="button" class="no-count-btn" data-no-count onclick={toggle}>
						{noCount ? 'Count my visits again' : 'Don’t count my visits'}
					</button>
				</p>
				{#if noCount}
					<p class="status">Done. This browser won't be counted.</p>
				{/if}
			{/if}
		</section>

		<section id="other" class="prose-section">
			<h2>Other services on the page</h2>
			<p>
				The site is hosted on Cloudflare, which sees your IP address in order to deliver the page.
				If you sign up for the newsletter, the form is run by Beehiiv, which holds your email
				address under its own privacy policy. Tips go straight to the Lightning or bitcoin address
				shown; we don't learn who sent them.
			</p>
		</section>

		<section id="basis" class="prose-section">
			<h2>Why we're allowed to</h2>
			<p>
				Counting visits is a legitimate interest: knowing which pages help people, measured in a
				way that can't identify anyone. The counter reads basic details your browser shares, such as
				screen size, only to produce statistics that help us improve this site. UK law (the Data
				(Use and Access) Act 2025) allows that without asking first, as long as you can object
				easily, which is what the button and browser settings above are for. So there's no cookie
				banner.
			</p>
		</section>

		<section id="contact" class="prose-section">
			<h2>Questions</h2>
			<p>
				Email
				<a href="mailto:info@sortathing.com?subject=Privacy" class="underline hover:no-underline"
					>info@sortathing.com</a
				>. You can ask what we hold, or ask us to delete it, though the counts hold nothing that
				points to you. If you're unhappy with our answer, you can complain to the Information
				Commissioner's Office at
				<a href="https://ico.org.uk/make-a-complaint/" class="underline hover:no-underline"
					>ico.org.uk</a
				>.
			</p>
		</section>
	</main>
</div>

<style>
	.privacy-page {
		background: #fafafa;
		min-height: 100vh;
	}
	.prose-section {
		margin-bottom: 2.5rem;
	}
	.prose-section h2 {
		font-size: 1.125rem;
		font-weight: 600;
		margin-bottom: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid #e4e4e7;
		scroll-margin-top: 1rem;
	}
	.prose-section p {
		font-size: 0.9375rem;
		line-height: 1.6;
		margin: 0.6rem 0;
		color: #3f3f46;
	}
	.status {
		font-weight: 600;
	}
	.no-count-btn {
		border: 1px solid #a1a1aa;
		border-radius: 4px;
		padding: 0.4rem 0.9rem;
		font-size: 0.875rem;
		background: #fff;
		color: #18181b;
		cursor: pointer;
	}
	.no-count-btn:hover {
		background: #f4f4f5;
	}
</style>
