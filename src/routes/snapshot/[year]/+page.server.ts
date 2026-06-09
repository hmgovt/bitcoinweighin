/**
 * /snapshot/[year] — historical purchasing-power snapshot for a single
 * calendar year. Prerenders one page per year of data coverage.
 */

import { error } from '@sveltejs/kit';
import type { EntryGenerator, PageServerLoad } from './$types';
import { listYears, summarizeYear } from '$lib/seo/snapshots.js';

export const prerender = true;

export const entries: EntryGenerator = () => {
	return listYears().map((y) => ({ year: String(y) }));
};

export const load: PageServerLoad = async ({ params }) => {
	const year = Number(params.year);
	if (!Number.isInteger(year)) throw error(404, 'Invalid year');
	const summary = summarizeYear(year);
	if (!summary) throw error(404, `No data for ${params.year}`);

	const allYears = listYears();
	const idx = allYears.indexOf(year);
	const prevYear = idx > 0 ? allYears[idx - 1] : null;
	const nextYear = idx < allYears.length - 1 ? allYears[idx + 1] : null;

	return { summary, prevYear, nextYear };
};
