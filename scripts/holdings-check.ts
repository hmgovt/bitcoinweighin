/**
 * Validate entity-holdings.json schema and emit age warnings for entries
 * older than 90 days. Non-blocking: exits 0 even when warnings are present
 * (CI surfaces the warnings; humans decide whether to refresh).
 *
 * Exits non-zero only on hard schema problems (missing field, bad type,
 * non-null asOf with no source/sourceName).
 *
 * Usage: npm run holdings:check
 */

import { loadHoldings, validateEntity, ageInDays } from './holdings-shared.js';

const WARN_DAYS = 90;

function main() {
	let data;
	try {
		data = loadHoldings();
	} catch (err) {
		console.error(`entity-holdings.json failed to load: ${(err as Error).message}`);
		process.exit(1);
	}

	let hardErrors = 0;
	let warnings = 0;

	const seenSlugs = new Set<string>();
	for (const e of data.entities) {
		if (seenSlugs.has(e.slug)) {
			console.error(`✗ duplicate slug: ${e.slug}`);
			hardErrors += 1;
			continue;
		}
		seenSlugs.add(e.slug);

		const problems = validateEntity(e);
		if (problems.length > 0) {
			console.error(`✗ ${e.slug || '(unnamed)'}:`);
			for (const p of problems) console.error(`    ${p}`);
			hardErrors += problems.length;
		}

		const days = ageInDays(e.asOf);
		if (days !== null && days > WARN_DAYS) {
			console.warn(`⚠ ${e.slug}: asOf ${e.asOf} is ${days} days old (refresh suggested)`);
			warnings += 1;
		}
	}

	if (hardErrors > 0) {
		console.error(`\n${hardErrors} schema error${hardErrors === 1 ? '' : 's'} — please fix.`);
		process.exit(1);
	}

	console.log(
		`✓ ${data.entities.length} entities; schema ok` +
			(warnings > 0 ? ` (${warnings} age warning${warnings === 1 ? '' : 's'})` : '')
	);
}

main();
