import { describe, it, expect } from 'vitest';
import {
	selectAnchor,
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
