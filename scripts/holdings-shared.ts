/**
 * Shared helpers for the holdings:list / holdings:update / holdings:check scripts.
 * All three operate on src/lib/entity-holdings.json.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
export const HOLDINGS_PATH = join(__dirname, '..', 'src', 'lib', 'entity-holdings.json');

export type EntityType = 'benchmark' | 'meme' | 'nation-state' | 'corporate' | 'etf' | 'individual' | 'supply';

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

export interface HoldingsFile {
	entities: Entity[];
}

const VALID_TYPES: EntityType[] = [
	'benchmark',
	'meme',
	'nation-state',
	'corporate',
	'etf',
	'individual',
	'supply',
];

export function loadHoldings(): HoldingsFile {
	const raw = readFileSync(HOLDINGS_PATH, 'utf-8');
	const data = JSON.parse(raw) as HoldingsFile;
	if (!Array.isArray(data.entities)) {
		throw new Error('entity-holdings.json: missing "entities" array');
	}
	return data;
}

export function saveHoldings(data: HoldingsFile) {
	writeFileSync(HOLDINGS_PATH, JSON.stringify(data, null, 2) + '\n');
}

/**
 * Validate a single entity. Returns a list of human-readable problems
 * (empty if the entity is valid).
 */
export function validateEntity(e: Entity): string[] {
	const problems: string[] = [];
	if (!e.slug || typeof e.slug !== 'string') problems.push('slug is required');
	if (!e.label || typeof e.label !== 'string') problems.push('label is required');
	if (typeof e.btc !== 'number' || !isFinite(e.btc) || e.btc <= 0) {
		problems.push('btc must be a positive number');
	}
	if (!VALID_TYPES.includes(e.type)) {
		problems.push(`type must be one of: ${VALID_TYPES.join(', ')}`);
	}
	if (e.asOf !== null && !/^\d{4}-\d{2}-\d{2}$/.test(e.asOf)) {
		problems.push('asOf must be null or an ISO date (YYYY-MM-DD)');
	}
	if (e.asOf !== null) {
		// Live entities must carry provenance.
		if (!e.source || !e.sourceName) {
			problems.push('entities with a non-null asOf must have both source and sourceName');
		}
	}
	if (typeof e.note !== 'string') problems.push('note is required (use empty string if no note)');
	return problems;
}

/**
 * Days between an ISO date and today (UTC). Returns null for null asOf.
 */
export function ageInDays(asOf: string | null): number | null {
	if (!asOf) return null;
	const then = new Date(asOf + 'T00:00:00Z').getTime();
	const now = Date.UTC(
		new Date().getUTCFullYear(),
		new Date().getUTCMonth(),
		new Date().getUTCDate()
	);
	return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

export function ageLabel(days: number | null): string {
	if (days === null) return '—';
	if (days === 0) return 'today';
	if (days === 1) return '1 day';
	if (days < 30) return `${days} days`;
	if (days < 60) return '~1 month';
	const months = Math.round(days / 30);
	if (months < 12) return `~${months} months`;
	const years = Math.round(days / 365);
	return years === 1 ? '~1 year' : `~${years} years`;
}

export function formatBtcAmount(btc: number): string {
	if (btc >= 1_000_000) return btc.toLocaleString('en-US', { maximumFractionDigits: 0 });
	if (btc >= 1) return btc.toLocaleString('en-US', { maximumFractionDigits: 2 });
	return btc.toString();
}
