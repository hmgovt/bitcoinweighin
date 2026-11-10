/**
 * Picking a source's value for a date, and revising recent rows once a
 * lagging source has caught up.
 *
 * FRED publishes Brent (DCOILBRENTEU) about a week late. On the day a row is
 * written, its Brent value is often the latest close FRED has, from days
 * earlier. The daily job therefore re-picks the last few weeks of Brent on
 * every run, and marks a row's field as forward-filled while the source has
 * nothing on or after that date.
 */

export type NdjsonRow = Record<string, unknown> & { date: string; forward_filled?: string[] };

export interface Revision {
	date: string;
	field: string;
	from: number | null;
	to: number;
}

/**
 * Pick the value for an exact date, or — if that date has no bar (weekend,
 * holiday, publication lag) — the most recent bar on or before it. ISO date
 * strings sort lexicographically, so string comparison is safe here.
 */
export function latestOnOrBefore(
	data: Map<string, number>,
	dateStr: string
): { value?: number; matchedDate?: string } {
	const exact = data.get(dateStr);
	if (exact !== undefined) return { value: exact, matchedDate: dateStr };

	let best: string | undefined;
	for (const d of data.keys()) {
		if (d <= dateStr && (best === undefined || d > best)) best = d;
	}
	return best !== undefined ? { value: data.get(best), matchedDate: best } : {};
}

/** Add or remove `field` in a row's forward_filled list, dropping the key when it empties. */
export function setFilled(row: NdjsonRow, field: string, filled: boolean) {
	const list = (row.forward_filled ?? []).filter((f) => f !== field);
	if (filled) list.push(field);
	if (list.length) row.forward_filled = list;
	else delete row.forward_filled;
}

/**
 * Re-pick `field` for every row dated `since` or later from fresh source data,
 * as if the source had been up to date when the row was written. A row dated
 * after the source's latest observation keeps that latest value and is marked
 * forward-filled for the field; the mark clears once the source publishes past
 * it. Mutates the rows; returns the value changes.
 */
export function reviseRows(
	rows: NdjsonRow[],
	field: string,
	data: Map<string, number>,
	since: string
): Revision[] {
	if (!data.size) return [];
	let latest = '';
	for (const d of data.keys()) if (d > latest) latest = d;
	const changes: Revision[] = [];
	for (const row of rows) {
		if (row.date < since) continue;
		const { value } = latestOnOrBefore(data, row.date);
		if (value === undefined) continue;
		const before = typeof row[field] === 'number' ? (row[field] as number) : null;
		if (before !== value) {
			row[field] = value;
			changes.push({ date: row.date, field, from: before, to: value });
		}
		setFilled(row, field, row.date > latest);
	}
	return changes;
}
