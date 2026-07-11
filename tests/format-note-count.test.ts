import { describe, it, expect } from 'vitest';
import { formatNoteCount } from '../src/lib/format.js';

describe('formatNoteCount', () => {
	it('zero and singular', () => {
		expect(formatNoteCount(0)).toBe('0 bills');
		expect(formatNoteCount(1)).toBe('1 bill');
	});

	it('grouped exact digits under 1 million', () => {
		expect(formatNoteCount(110)).toBe('110 bills');
		expect(formatNoteCount(110_000)).toBe('110,000 bills');
		expect(formatNoteCount(999_999)).toBe('999,999 bills');
	});

	it('abbreviated million/billion/trillion at and above 1 million', () => {
		expect(formatNoteCount(11_000_000)).toBe('11.00 million bills');
		expect(formatNoteCount(2_310_000_000_000)).toBe('2.31 trillion bills');
	});
});
