import { describe, it, expect } from 'vitest';
import {
	easeInOutQuad,
	playbackDurationMs,
	playbackIndexAt,
	milestonesCrossed,
	FULL_PLAYBACK_MS,
	MIN_PLAYBACK_MS,
	type Milestone,
} from '../src/lib/playback.js';

describe('easeInOutQuad', () => {
	it('starts at 0 and ends at 1', () => {
		expect(easeInOutQuad(0)).toBe(0);
		expect(easeInOutQuad(1)).toBe(1);
	});

	it('is exactly 0.5 at the midpoint (symmetric ease)', () => {
		expect(easeInOutQuad(0.5)).toBe(0.5);
	});

	it('clamps out-of-range input', () => {
		expect(easeInOutQuad(-1)).toBe(0);
		expect(easeInOutQuad(2)).toBe(1);
	});
});

describe('playbackDurationMs', () => {
	it('full range (start at index 0) returns the full duration', () => {
		expect(playbackDurationMs(100, 0)).toBe(FULL_PLAYBACK_MS);
	});

	it('mid-range start scales down proportionally to remaining fraction', () => {
		// 50 of 99 steps remain (endIdx=99, start=50) -> ~49.5% of full duration
		const d = playbackDurationMs(100, 50);
		expect(d).toBeCloseTo(FULL_PLAYBACK_MS * (49 / 99), 5);
		expect(d).toBeLessThan(FULL_PLAYBACK_MS);
	});

	it('near-the-end start floors at MIN_PLAYBACK_MS rather than vanishing', () => {
		const d = playbackDurationMs(1000, 998); // 1 of 999 steps remain
		expect(d).toBe(MIN_PLAYBACK_MS);
	});

	it('already at (or past) the last index returns 0 — nothing to play', () => {
		expect(playbackDurationMs(100, 99)).toBe(0);
		expect(playbackDurationMs(100, 150)).toBe(0);
	});

	it('a single-date archive returns 0', () => {
		expect(playbackDurationMs(1, 0)).toBe(0);
		expect(playbackDurationMs(0, 0)).toBe(0);
	});
});

describe('playbackIndexAt', () => {
	it('full range: starts at startIdx, ends at the last index', () => {
		expect(playbackIndexAt(0, 12_000, 100, 0)).toBe(0);
		expect(playbackIndexAt(12_000, 12_000, 100, 0)).toBe(99);
	});

	it('full range: midpoint of an eased sweep lands on the midpoint index', () => {
		expect(playbackIndexAt(6_000, 12_000, 100, 0)).toBe(50); // 0 + 99*0.5 = 49.5 -> round 50
	});

	it('mid-range start: sweeps from startIdx (not 0) to the last index', () => {
		expect(playbackIndexAt(0, 6_000, 100, 50)).toBe(50);
		expect(playbackIndexAt(6_000, 6_000, 100, 50)).toBe(99);
	});

	it('clamps elapsed time before 0 and after totalMs', () => {
		expect(playbackIndexAt(-500, 12_000, 100, 0)).toBe(0);
		expect(playbackIndexAt(50_000, 12_000, 100, 0)).toBe(99);
	});

	it('is monotonically non-decreasing as elapsed time increases', () => {
		let prev = -Infinity;
		for (let ms = 0; ms <= 12_000; ms += 137) {
			const idx = playbackIndexAt(ms, 12_000, 4933, 0);
			expect(idx).toBeGreaterThanOrEqual(prev);
			prev = idx;
		}
	});

	it('end-stop: once elapsed reaches totalMs, further elapsed never exceeds the last index', () => {
		const endIdx = 99;
		expect(playbackIndexAt(12_000, 12_000, 100, 0)).toBe(endIdx);
		expect(playbackIndexAt(100_000, 12_000, 100, 0)).toBe(endIdx);
	});

	it('a single-date archive stays at index 0', () => {
		expect(playbackIndexAt(0, 0, 1, 0)).toBe(0);
		expect(playbackIndexAt(500, 0, 1, 0)).toBe(0);
	});

	it('startIdx already at the end returns the end regardless of elapsed', () => {
		expect(playbackIndexAt(0, 0, 100, 99)).toBe(99);
	});
});

describe('milestonesCrossed', () => {
	const milestones: Milestone[] = [
		{ date: '2017-03-02', commodity: 'gold', label: '1 BTC = 1 ozt of gold', ozt: 1 },
		{ date: '2017-12-06', commodity: 'gold', label: '1 BTC = 10 ozt of gold', ozt: 10 },
		{ date: '2021-03-10', commodity: 'gold', label: '1 BTC = 1 kg of gold', ozt: 32.15 },
	];

	it('forward crossing: a jump that passes over one milestone finds it', () => {
		const crossed = milestonesCrossed('2017-01-01', '2017-06-01', milestones);
		expect(crossed.map((m) => m.date)).toEqual(['2017-03-02']);
	});

	it('backward crossing (scrubbing earlier in history) finds the same milestone', () => {
		const crossed = milestonesCrossed('2017-06-01', '2017-01-01', milestones);
		expect(crossed.map((m) => m.date)).toEqual(['2017-03-02']);
	});

	it('landing exactly on a milestone date counts as crossing it, both directions', () => {
		expect(milestonesCrossed('2017-01-01', '2017-03-02', milestones).map((m) => m.date)).toEqual([
			'2017-03-02',
		]);
		expect(milestonesCrossed('2017-06-01', '2017-03-02', milestones).map((m) => m.date)).toEqual([
			'2017-03-02',
		]);
	});

	it('multiple milestones in one jump: returns all, LAST element nearest currDate (forward)', () => {
		const crossed = milestonesCrossed('2017-01-01', '2021-06-01', milestones);
		expect(crossed.map((m) => m.date)).toEqual(['2017-03-02', '2017-12-06', '2021-03-10']);
		expect(crossed[crossed.length - 1].date).toBe('2021-03-10'); // display pick
	});

	it('multiple milestones in one jump backward: LAST element nearest currDate', () => {
		const crossed = milestonesCrossed('2021-06-01', '2017-01-01', milestones);
		expect(crossed.map((m) => m.date)).toEqual(['2021-03-10', '2017-12-06', '2017-03-02']);
		expect(crossed[crossed.length - 1].date).toBe('2017-03-02'); // display pick
	});

	it('no movement is never a crossing', () => {
		expect(milestonesCrossed('2017-03-02', '2017-03-02', milestones)).toEqual([]);
	});

	it('a milestone already stood on does not re-trigger on the next tick', () => {
		// Arrive exactly on the milestone...
		expect(milestonesCrossed('2017-01-01', '2017-03-02', milestones).length).toBe(1);
		// ...then move on: prevDate is now the milestone date itself.
		expect(milestonesCrossed('2017-03-02', '2017-03-03', milestones)).toEqual([]);
	});

	it('a jump that touches no milestone returns an empty array', () => {
		expect(milestonesCrossed('2013-01-01', '2013-06-01', milestones)).toEqual([]);
	});
});
