import { describe, it, expect } from 'vitest';
import {
	selectAnchor,
	selectImpossibilityBand,
	type QuantityAnchor,
} from '../src/lib/components/QuantityAnchorCard.helpers.js';

const anchors: QuantityAnchor[] = [
	{ id: 'a', quantityKg: 1, displayName: 'A', description: '', priority: 1 },
	{ id: 'b', quantityKg: 10, displayName: 'B', description: '', priority: 2 },
	{ id: 'c', quantityKg: 10.5, displayName: 'C', description: '', priority: 2 },
	{ id: 'd', quantityKg: 100, displayName: 'D', description: '', priority: 1 },
];

describe('selectAnchor', () => {
	it('returns null when no anchor is within ±10%', () => {
		expect(selectAnchor(anchors, 50)).toBeNull();
	});

	it('returns null for empty anchor list', () => {
		expect(selectAnchor([], 1)).toBeNull();
	});

	it('returns null for non-positive current mass', () => {
		expect(selectAnchor(anchors, 0)).toBeNull();
		expect(selectAnchor(anchors, -1)).toBeNull();
	});

	it('selects exact-match anchor', () => {
		expect(selectAnchor(anchors, 1)?.id).toBe('a');
	});

	it('selects within ±9% of an anchor', () => {
		expect(selectAnchor(anchors, 1.09)?.id).toBe('a');
		expect(selectAnchor(anchors, 0.91)?.id).toBe('a');
	});

	it('does not select beyond ±11%', () => {
		// |1 - 1.11| / 1 = 0.11 → out of range
		expect(selectAnchor(anchors, 1.11)).toBeNull();
		// |1 - 0.89| / 1 = 0.11 → out of range
		expect(selectAnchor(anchors, 0.89)).toBeNull();
	});

	it('priority 1 beats priority 2 even if priority 2 is closer', () => {
		const list: QuantityAnchor[] = [
			{ id: 'p1', quantityKg: 1.05, displayName: 'P1', description: '', priority: 1 },
			{ id: 'p2', quantityKg: 1.0, displayName: 'P2', description: '', priority: 2 },
		];
		// Both within ±10% of 1.0; priority 1 wins despite being further in mass
		expect(selectAnchor(list, 1.0)?.id).toBe('p1');
	});

	it('two equal-priority matches resolve by ascending mass', () => {
		// b (10 kg) and c (10.5 kg), both priority 2, both in range of 10.25
		expect(selectAnchor(anchors, 10.25)?.id).toBe('b');
	});

	it('does not mutate the input list', () => {
		const before = anchors.map((a) => a.id).join(',');
		selectAnchor(anchors, 10.25);
		const after = anchors.map((a) => a.id).join(',');
		expect(after).toBe(before);
	});
});

describe('selectImpossibilityBand', () => {
	// terminal anchor here is 'd' at 100 kg
	it('returns null for empty anchor list', () => {
		expect(selectImpossibilityBand([], 1000)).toBeNull();
	});

	it('returns null for non-positive current mass', () => {
		expect(selectImpossibilityBand(anchors, 0)).toBeNull();
		expect(selectImpossibilityBand(anchors, -1)).toBeNull();
	});

	it('returns null at exactly the terminal anchor mass', () => {
		expect(selectImpossibilityBand(anchors, 100)).toBeNull();
	});

	it('returns null just below the terminal anchor mass (normal band still applies)', () => {
		expect(selectImpossibilityBand(anchors, 99)).toBeNull();
	});

	it('fires just above the terminal anchor mass', () => {
		const band = selectImpossibilityBand(anchors, 100.01);
		expect(band).not.toBeNull();
		expect(band?.anchor.id).toBe('d');
		expect(band?.multiple).toBeCloseTo(1.0001, 4);
	});

	it('computes the multiple against the largest anchor, not the closest one', () => {
		// terminal anchor is 'd' (100 kg), even though 'c' (10.5 kg) is
		// numerically closer in the list — the terminal band always
		// compares against the single largest anchor for the commodity.
		const band = selectImpossibilityBand(anchors, 470);
		expect(band?.anchor.id).toBe('d');
		expect(band?.multiple).toBeCloseTo(4.7, 5);
	});

	it('picks the single largest anchor as terminal regardless of list order', () => {
		const shuffled: QuantityAnchor[] = [anchors[3], anchors[0], anchors[2], anchors[1]];
		const band = selectImpossibilityBand(shuffled, 1000);
		expect(band?.anchor.id).toBe('d');
		expect(band?.multiple).toBeCloseTo(10, 5);
	});

	it('matches the real gold anchor set: fires past all gold ever mined with the correct multiple', () => {
		const goldAnchors: QuantityAnchor[] = [
			{
				id: 'all_gold_mined',
				quantityKg: 213_000_000,
				displayName: '≈ all gold ever mined',
				description: '',
				priority: 1,
				impossibilityVerb: 'mined',
			},
		];
		expect(selectImpossibilityBand(goldAnchors, 213_000_000)).toBeNull();
		const band = selectImpossibilityBand(goldAnchors, 213_000_000 * 4.7);
		expect(band?.multiple).toBeCloseTo(4.7, 5);
		expect(band?.anchor.impossibilityVerb).toBe('mined');
	});
});
