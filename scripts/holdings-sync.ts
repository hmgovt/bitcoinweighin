/**
 * Auto-sync entity holdings from public aggregators.
 *
 * Designed to run from the daily-update GH Action after fetch-daily.
 * Pulls fresh BTC figures from bitcointreasuries.net for the entities
 * listed in SYNC_MAP, applies sanity guards, and writes the result
 * back to src/lib/entity-holdings.json.
 *
 * Usage:
 *   npm run holdings:sync          # honour 25% sanity cap
 *   npm run holdings:sync -- --force   # bypass the cap (manual override)
 *
 * Exit code:
 *   0 if all targets either updated cleanly or were unchanged
 *   1 only if EVERY target failed (lets the workflow continue when a
 *     single source has a transient hiccup)
 */

import { fetchBitcointreasuries } from './holdings-sources/bitcointreasuries.js';
import {
	loadHoldings,
	saveHoldings,
	validateEntity,
	type Entity,
} from './holdings-shared.js';

const SANITY_DELTA_PCT = 25;

interface SyncTarget {
	slug: string;
	source: 'bitcointreasuries';
	path: string;
	sourceName: string;
}

const SYNC_MAP: SyncTarget[] = [
	{
		slug: 'strategy',
		source: 'bitcointreasuries',
		path: 'public-companies/strategy',
		sourceName: 'Bitcoin Treasuries (mirrors Strategy 8-K filings)',
	},
	{
		slug: 'blackrock-ibit',
		source: 'bitcointreasuries',
		path: 'etfs-and-exchanges/ishares-bitcoin-trust',
		sourceName: 'Bitcoin Treasuries (mirrors iShares daily holdings)',
	},
	{
		slug: 'us-govt',
		source: 'bitcointreasuries',
		path: 'governments/united-states',
		sourceName: 'Bitcoin Treasuries + Arkham Intelligence',
	},
	{
		slug: 'el-salvador',
		source: 'bitcointreasuries',
		path: 'governments/el-salvador',
		sourceName: 'Bitcoin Treasuries (mirrors El Salvador National Bitcoin Office)',
	},
];

function todayUtc(): string {
	const d = new Date();
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, '0');
	const day = String(d.getUTCDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

interface SyncOutcome {
	slug: string;
	status: 'updated' | 'unchanged' | 'skipped' | 'failed';
	from?: number;
	to?: number;
	reason?: string;
}

async function syncOne(target: SyncTarget, entity: Entity, force: boolean): Promise<SyncOutcome> {
	const fetched =
		target.source === 'bitcointreasuries'
			? await fetchBitcointreasuries(target.path)
			: null;

	if (!fetched) {
		return { slug: target.slug, status: 'failed', reason: 'fetch returned null' };
	}

	const prev = entity.btc;
	const next = fetched.btc;

	if (next === prev) {
		return { slug: target.slug, status: 'unchanged', from: prev, to: next };
	}

	// Sanity guard — refuse implausibly large single-day moves unless
	// --force is set. Catches selector breakage where the regex grabs
	// a tooltip/price number instead of the holdings figure.
	const deltaPct = Math.abs((next - prev) / prev) * 100;
	if (!force && deltaPct > SANITY_DELTA_PCT) {
		return {
			slug: target.slug,
			status: 'skipped',
			from: prev,
			to: next,
			reason: `${deltaPct.toFixed(1)}% move exceeds ${SANITY_DELTA_PCT}% cap (use --force to override)`,
		};
	}

	entity.btc = next;
	entity.asOf = todayUtc();
	entity.source = fetched.sourceUrl;
	entity.sourceName = target.sourceName;

	const problems = validateEntity(entity);
	if (problems.length > 0) {
		// Revert
		entity.btc = prev;
		return {
			slug: target.slug,
			status: 'failed',
			reason: `schema validation: ${problems.join('; ')}`,
		};
	}

	return { slug: target.slug, status: 'updated', from: prev, to: next };
}

function formatRow(o: SyncOutcome): string {
	const slug = o.slug.padEnd(16);
	if (o.status === 'failed' || o.status === 'skipped') {
		return `  ${o.status === 'failed' ? '✗' : '⏭'}  ${slug} ${o.reason ?? ''}`;
	}
	const from = o.from?.toLocaleString('en-US') ?? '?';
	const to = o.to?.toLocaleString('en-US') ?? '?';
	const marker = o.status === 'updated' ? '✓' : '·';
	return `  ${marker}  ${slug} ${from.padStart(10)} → ${to.padStart(10)} BTC`;
}

async function main() {
	const force = process.argv.includes('--force');
	const data = loadHoldings();
	const outcomes: SyncOutcome[] = [];

	console.log(`Syncing ${SYNC_MAP.length} entities from bitcointreasuries.net${force ? ' (--force)' : ''}\n`);

	for (const target of SYNC_MAP) {
		const entity = data.entities.find((e) => e.slug === target.slug);
		if (!entity) {
			outcomes.push({
				slug: target.slug,
				status: 'failed',
				reason: 'slug not present in entity-holdings.json',
			});
			continue;
		}
		const outcome = await syncOne(target, entity, force);
		outcomes.push(outcome);
		console.log(formatRow(outcome));
	}

	const updated = outcomes.filter((o) => o.status === 'updated').length;
	const failed = outcomes.filter((o) => o.status === 'failed').length;
	const skipped = outcomes.filter((o) => o.status === 'skipped').length;

	console.log(
		`\nSummary: ${updated} updated · ${outcomes.length - updated - failed - skipped} unchanged · ${skipped} skipped · ${failed} failed`
	);

	if (updated > 0) {
		saveHoldings(data);
		console.log(`Wrote ${updated} change(s) to entity-holdings.json`);
	}

	// Fail only when every target failed — partial success is still
	// useful and shouldn't break the daily workflow.
	if (failed === outcomes.length) {
		console.error('\nAll targets failed; exiting non-zero');
		process.exit(1);
	}
}

main().catch((err) => {
	console.error('holdings:sync crashed:', err);
	process.exit(1);
});
