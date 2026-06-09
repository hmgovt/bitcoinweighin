/**
 * /snapshot — index of year-level historical purchasing-power snapshots.
 * Builds a summary card per year of data coverage.
 */

import type { PageServerLoad } from './$types';
import { listYears, summarizeYear } from '$lib/seo/snapshots.js';

export const prerender = true;

export const load: PageServerLoad = async () => {
	const years = listYears().reverse(); // newest first
	const summaries = years
		.map((y) => summarizeYear(y))
		.filter((s): s is NonNullable<typeof s> => s !== null);
	return { summaries };
};
