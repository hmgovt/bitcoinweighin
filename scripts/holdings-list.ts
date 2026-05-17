/**
 * Pretty-print a table of entity holdings with age and a warning marker
 * on entries older than 30 days.
 *
 * Usage: npm run holdings:list
 */

import { loadHoldings, ageInDays, ageLabel, formatBtcAmount } from './holdings-shared.js';

const STALE_DAYS = 30;

function pad(s: string, n: number, right = false): string {
	if (s.length >= n) return s.slice(0, n);
	const filler = ' '.repeat(n - s.length);
	return right ? filler + s : s + filler;
}

function main() {
	const { entities } = loadHoldings();

	const labelCol = Math.max(...entities.map((e) => e.label.length), 'Entity'.length);
	const btcCol = Math.max(
		...entities.map((e) => formatBtcAmount(e.btc).length),
		'BTC'.length
	);
	const asOfCol = Math.max(...entities.map((e) => (e.asOf ?? '—').length), 'As of'.length);
	const ageCol = Math.max(
		...entities.map((e) => ageLabel(ageInDays(e.asOf)).length),
		'Age'.length
	);

	const header = [
		'  ',
		pad('Entity', labelCol),
		pad('BTC', btcCol, true),
		pad('As of', asOfCol),
		pad('Age', ageCol),
	].join('  ');

	const rule = [
		'  ',
		'─'.repeat(labelCol),
		'─'.repeat(btcCol),
		'─'.repeat(asOfCol),
		'─'.repeat(ageCol),
	].join('  ');

	console.log(header);
	console.log(rule);

	for (const e of entities) {
		const days = ageInDays(e.asOf);
		const stale = days !== null && days > STALE_DAYS;
		const marker = stale ? '⚠ ' : '  ';
		console.log(
			[
				marker,
				pad(e.label, labelCol),
				pad(formatBtcAmount(e.btc), btcCol, true),
				pad(e.asOf ?? '—', asOfCol),
				pad(ageLabel(days), ageCol),
			].join('  ')
		);
	}

	const staleCount = entities.filter((e) => {
		const d = ageInDays(e.asOf);
		return d !== null && d > STALE_DAYS;
	}).length;
	if (staleCount > 0) {
		console.log(
			`\n  ⚠  ${staleCount} entit${staleCount === 1 ? 'y' : 'ies'} older than ${STALE_DAYS} days. ` +
				`Refresh with: npm run holdings:update <slug> <btc>`
		);
	}
}

main();
