/**
 * playback.ts — pure pacing maths for the date-mode ▶ play button (delight
 * brief §1.4a) and crossing-detection for dataset-derived milestone markers
 * (§1.4c). No DOM, no stores, no timers: the page drives an rAF loop and
 * calls `playbackIndexAt` each frame, and calls `milestonesCrossed` whenever
 * `selectedDate` moves (by playback OR by manual scrubbing) to decide
 * whether to show a milestone caption.
 */

export interface Milestone {
	date: string;
	commodity: string;
	label: string;
	ozt: number;
}

/** Same easing as the page's own preset tween (`tweenSceneBtc` in
 *  +page.svelte) — the played sweep and a preset dolly should feel like the
 *  same physics engine. Clamps `k` to [0, 1] so callers don't need to. */
export function easeInOutQuad(k: number): number {
	const t = Math.min(Math.max(k, 0), 1);
	return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Full-range playback duration target (brief §1.4a: "over ~12 s"). */
export const FULL_PLAYBACK_MS = 12_000;
/** Floor so a play press one day from the end still animates visibly
 *  instead of resolving in a single frame. */
export const MIN_PLAYBACK_MS = 600;

/**
 * Duration for a sweep starting at `startIdx` (of `dateCount` dates) to the
 * last date. Scaled proportionally to the fraction of the array still ahead
 * of `startIdx`, so the EASED PACE (dates per second) stays roughly constant
 * regardless of where playback starts — a press two days from the end
 * settles in well under a second rather than crawling for the full 12 s
 * `FULL_PLAYBACK_MS` a first-date start would take (brief: "sweep from the
 * CURRENT date to the end", no separate duration given, so this is the
 * documented choice: same pace, not same wall-clock time).
 */
export function playbackDurationMs(
	dateCount: number,
	startIdx: number,
	fullMs: number = FULL_PLAYBACK_MS,
	minMs: number = MIN_PLAYBACK_MS
): number {
	const endIdx = dateCount - 1;
	if (dateCount <= 1 || startIdx >= endIdx) return 0;
	const fraction = (endIdx - startIdx) / endIdx;
	return Math.max(minMs, fullMs * fraction);
}

/**
 * The dataset-array index playback should sit at `elapsedMs` into a sweep of
 * `totalMs`, starting at `startIdx` and running to the last index
 * (`dateCount - 1`). Eased over the INDEX (not the date's numeric value) —
 * dataset days are ~daily/uniform, so index-space easing reads as smooth
 * motion without the log/linear distortion the BTC-amount tween has to
 * account for.
 *
 * Clamped and monotonic: elapsedMs <= 0 returns startIdx, elapsedMs >=
 * totalMs returns the last index, and increasing elapsedMs never decreases
 * the returned index.
 */
export function playbackIndexAt(
	elapsedMs: number,
	totalMs: number,
	dateCount: number,
	startIdx: number
): number {
	const endIdx = Math.max(0, dateCount - 1);
	const clampedStart = Math.min(Math.max(startIdx, 0), endIdx);
	if (endIdx <= clampedStart || totalMs <= 0) return endIdx;
	const k = easeInOutQuad(elapsedMs / totalMs);
	const idx = clampedStart + (endIdx - clampedStart) * k;
	return Math.round(Math.min(endIdx, Math.max(clampedStart, idx)));
}

/**
 * Which milestones (if any) were crossed moving from `prevDate` to
 * `currDate` — in either direction, including landing exactly on one.
 * Returned IN THE ORDER ENCOUNTERED while travelling from prev to curr, so
 * the LAST element is always the milestone nearest `currDate` — the correct
 * pick when a single jump (a big scrub, or two rAF frames skipping several
 * dataset days) crosses more than one (brief: "multiple in one jump — pick
 * the LAST crossed for display").
 *
 * A milestone sitting exactly on `prevDate` does not re-trigger: the
 * interval is open at the "already there" end and closed at the "just
 * arrived" end, in the direction of travel.
 */
export function milestonesCrossed(
	prevDate: string,
	currDate: string,
	milestones: Milestone[]
): Milestone[] {
	if (!prevDate || !currDate || prevDate === currDate) return [];
	const forward = currDate > prevDate;
	const crossed = milestones.filter((m) =>
		forward ? m.date > prevDate && m.date <= currDate : m.date >= currDate && m.date < prevDate
	);
	crossed.sort((a, b) => (forward ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
	return crossed;
}
