import { describe, it, expect } from 'vitest';
import { getCommodity, LAUNCH_COMMODITIES, ALL_COMMODITIES } from '../src/lib/commodities.js';

describe('cash commodity', () => {
	it('is registered with the expected shape', () => {
		const cash = getCommodity('cash');
		expect(cash).toBeDefined();
		expect(cash?.displayName).toBe('Cash');
		expect(cash?.renderStyle).toBe('bill_stack');
		expect(cash?.unit).toBe('note');
		expect(cash?.unitMassGrams).toBe(1);
		expect(cash?.mvpLaunch).toBe(true);
		expect(cash?.pageOrder).toBe(5);
		expect(cash?.dataQuality).toBe('live');
	});

	it('is the 5th launch commodity, after cocaine', () => {
		expect(LAUNCH_COMMODITIES).toHaveLength(5);
		expect(LAUNCH_COMMODITIES[4].id).toBe('cash');
		expect(LAUNCH_COMMODITIES[3].id).toBe('cocaine');
	});

	it('is present in the full catalogue', () => {
		expect(ALL_COMMODITIES.some((c) => c.id === 'cash')).toBe(true);
	});
});
