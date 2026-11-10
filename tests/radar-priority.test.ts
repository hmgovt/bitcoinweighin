import { describe, expect, it } from 'vitest';
import { isHot, rank } from '../scripts/radar/sweep';

describe('priority accounts', () => {
	it('count as taking off at half the usual heat, with the same likes floor', () => {
		expect(isHot(0.2, 50, false, 0.3, 20)).toBe(false);
		expect(isHot(0.2, 50, true, 0.3, 20)).toBe(true);
		expect(isHot(0.14, 50, true, 0.3, 20)).toBe(false);
		expect(isHot(5, 10, true, 0.3, 20)).toBe(false);
	});
	it('rank ahead of others at the same heat', () => {
		expect(rank(0.5, true)).toBeGreaterThan(rank(0.5, false));
		expect(rank(0.5, true)).toBeLessThan(rank(1.5, false));
	});
});
