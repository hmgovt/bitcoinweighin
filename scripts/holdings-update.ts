/**
 * Update a single entity's btc value, refresh asOf to today (UTC), and
 * optionally update the source URL. Validates schema before writing.
 *
 * Usage:
 *   npm run holdings:update <slug> <btc> [--source <url>]
 *
 * Examples:
 *   npm run holdings:update strategy 825000
 *   npm run holdings:update el-salvador 7700 --source https://bitcoin.gob.sv/holdings
 */

import { loadHoldings, saveHoldings, validateEntity } from './holdings-shared.js';

function parseArgs(argv: string[]): {
	slug: string;
	btc: number;
	source: string | null;
} {
	const positional: string[] = [];
	let source: string | null = null;
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--source') {
			source = argv[++i] ?? null;
		} else {
			positional.push(a);
		}
	}
	if (positional.length !== 2) {
		console.error('Usage: npm run holdings:update <slug> <btc> [--source <url>]');
		process.exit(2);
	}
	const slug = positional[0];
	const btc = parseFloat(positional[1]);
	if (!isFinite(btc) || btc <= 0) {
		console.error(`btc must be a positive number; got "${positional[1]}"`);
		process.exit(2);
	}
	return { slug, btc, source };
}

function todayUtc(): string {
	const d = new Date();
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, '0');
	const day = String(d.getUTCDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

function main() {
	const { slug, btc, source } = parseArgs(process.argv.slice(2));
	const data = loadHoldings();

	const entity = data.entities.find((e) => e.slug === slug);
	if (!entity) {
		console.error(`No entity with slug "${slug}".`);
		console.error(`Known slugs: ${data.entities.map((e) => e.slug).join(', ')}`);
		process.exit(1);
	}

	const prevBtc = entity.btc;
	const prevAsOf = entity.asOf;
	entity.btc = btc;
	entity.asOf = todayUtc();
	if (source) entity.source = source;

	const problems = validateEntity(entity);
	if (problems.length > 0) {
		console.error(`Validation failed for ${slug}:`);
		for (const p of problems) console.error(`  - ${p}`);
		process.exit(1);
	}

	saveHoldings(data);

	const delta = btc - prevBtc;
	const sign = delta >= 0 ? '+' : '';
	console.log(
		`Updated ${slug}: ${prevBtc.toLocaleString('en-US')} → ${btc.toLocaleString('en-US')} BTC ` +
			`(${sign}${delta.toLocaleString('en-US', { maximumFractionDigits: 2 })})`
	);
	console.log(`  asOf: ${prevAsOf ?? 'null'} → ${entity.asOf}`);
	if (source) console.log(`  source: ${source}`);
	console.log('');
	console.log('Suggested commit message:');
	console.log(
		`  chore(holdings): refresh ${slug} to ${btc.toLocaleString('en-US')} BTC (${entity.asOf})`
	);
}

main();
