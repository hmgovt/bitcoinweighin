import type { PriceData } from '$lib/prices.js';

export const prerender = true;

export async function load({ fetch }) {
	// During prerender, SvelteKit's fetch can access static assets
	// prices.json lives in the static/ dir (copied from public/ at build)
	const res = await fetch('/prices.json');
	const prices: PriceData = await res.json();
	const dates = Object.keys(prices).sort();
	return {
		prices,
		firstDate: dates[0],
		lastDate: dates[dates.length - 1],
	};
}
