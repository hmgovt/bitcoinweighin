import type { PageLoad } from './$types';
import type { DayPrices } from '$lib/prices.js';

export const prerender = true;

export const load: PageLoad = async ({ fetch }) => {
	const metaRes = await fetch('/meta.json');
	const meta = await metaRes.json();
	const lastDate = meta.dateRange.last as string;

	// Inline just the latest day's prices so the prerendered HTML can render
	// the cube + Shiba area at FCP, instead of waiting for /prices.json to
	// fetch + parse at runtime. The Shiba is the LCP element — moving it
	// into the static markup cuts LCP from ~5 s to FCP+epsilon.
	//
	// We fetch the tiny prices-latest.json (a single day's record, ~150 B)
	// rather than slicing the full prices.json — SvelteKit's load fetch
	// caches the full response into the prerendered HTML for hydration
	// rehydration, which would balloon the page from a few KB to ~830 KB.
	// The full archive still lazy-loads in onMount for slider historical
	// date access.
	const latestRes = await fetch('/prices-latest.json');
	const initialPrices = (await latestRes.json()) as Record<string, DayPrices>;

	return {
		firstDate: meta.dateRange.first as string,
		lastDate,
		initialPrices,
	};
};
