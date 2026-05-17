/**
 * Entity holdings — single source of truth for the homepage preset pills.
 *
 * Data lives in src/lib/entity-holdings.json. The maintenance scripts
 * under scripts/holdings-*.ts read and write the same file; this module
 * is the build-time TypeScript view onto it.
 */

import holdingsData from './entity-holdings.json';

export type EntityType =
	| 'benchmark'
	| 'meme'
	| 'nation-state'
	| 'corporate'
	| 'etf'
	| 'individual'
	| 'supply';

export interface Entity {
	slug: string;
	label: string;
	btc: number;
	asOf: string | null;
	type: EntityType;
	source: string | null;
	sourceName: string | null;
	note: string;
}

export const ENTITIES: Entity[] = (holdingsData as { entities: Entity[] }).entities;

export function getEntity(slug: string): Entity | undefined {
	return ENTITIES.find((e) => e.slug === slug);
}

/** "May 2026" from an ISO date string. Empty string for null asOf. */
export function formatAsOfMonth(asOf: string | null): string {
	if (!asOf) return '';
	const d = new Date(asOf + 'T00:00:00Z');
	return d.toLocaleDateString('en-US', {
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC',
	});
}

/** "818,869 BTC" — for the subscript line under a pill label. */
export function formatBtcForPill(btc: number): string {
	if (btc >= 1) {
		return btc.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' BTC';
	}
	return btc + ' BTC';
}
