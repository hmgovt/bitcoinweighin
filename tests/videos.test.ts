import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { VIDEOS, clock, isoDuration } from '../src/lib/videos.js';
import { getCommodity } from '../src/lib/commodities.js';

describe('the /videos catalogue', () => {
	it('formats durations', () => {
		expect(isoDuration(47)).toBe('PT47S');
		expect(isoDuration(125)).toBe('PT2M5S');
		expect(isoDuration(120)).toBe('PT2M');
		expect(clock(47)).toBe('0:47');
		expect(clock(125)).toBe('2:05');
	});

	it('every entry is complete: an 11-character YouTube ID, its poster on disk, a real tab', () => {
		const slugs = new Set<string>();
		for (const v of VIDEOS) {
			expect(v.youtubeId).toMatch(/^[A-Za-z0-9_-]{11}$/);
			expect(existsSync(`static/video/posters/${v.poster}`)).toBe(true);
			expect(getCommodity(v.commodity)?.mvpLaunch).toBe(true);
			expect(v.published).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(slugs.has(v.slug)).toBe(false);
			slugs.add(v.slug);
		}
	});

	it('is newest first', () => {
		const dates = VIDEOS.map((v) => v.published);
		expect(dates).toEqual([...dates].sort().reverse());
	});
});
