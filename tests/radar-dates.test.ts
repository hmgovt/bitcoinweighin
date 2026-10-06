import { describe, expect, it } from 'vitest';
import { datesIn } from '../scripts/radar/facts';

const CLOSE = '2026-10-05';

describe('datesIn', () => {
	it('reads month-first and day-first dates, with or without a suffix', () => {
		expect(datesIn('All that talk about an October 5 bottom, and the low was back on July 1.', CLOSE)).toEqual(['2026-10-05', '2026-07-01']);
		expect(datesIn('Since 1st July, and on the 17th of December', CLOSE)).toEqual(['2026-07-01', '2025-12-17']);
		expect(datesIn('Sept. 30 and Oct 2nd', CLOSE)).toEqual(['2026-09-30', '2026-10-02']);
	});
	it('takes a stated year, and otherwise the latest such date on or before the close', () => {
		expect(datesIn('On 22 May 2010 Laszlo paid 10,000 BTC', CLOSE)).toEqual(['2010-05-22']);
		expect(datesIn('December 17th', CLOSE)).toEqual(['2025-12-17']);
		expect(datesIn('Jan 3, 2009', CLOSE)).toEqual(['2009-01-03']);
	});
	it('skips the verb "may" and impossible days', () => {
		expect(datesIn('it may 5x from here', CLOSE)).toEqual([]);
		expect(datesIn('May 5 was the low', CLOSE)).toEqual(['2026-05-05']);
		expect(datesIn('March 40', CLOSE)).toEqual([]);
	});
	it('lists each date once', () => {
		expect(datesIn('July 1. Yes, July 1.', CLOSE)).toEqual(['2026-07-01']);
	});
});
