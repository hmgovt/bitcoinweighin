import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch('/meta.json');
	const meta = await res.json();
	return {
		firstDate: meta.dateRange.first as string,
		lastDate: meta.dateRange.last as string,
	};
};
