/**
 * Build-time data for the homepage that has to read files on disk.
 * Merged into the universal load in +page.ts.
 */

import type { PageServerLoad } from './$types';
import { buildPowerLawTeaser } from '$lib/server/power-law-teaser.js';

export const prerender = true;

export const load: PageServerLoad = async () => ({
	powerLawTeaser: buildPowerLawTeaser(),
});
