import { describe, it, expect } from 'vitest';
import { beats, longFrame, DURATION, pct } from '../src/lib/clips/manhattanLongClip.js';
import { DEVELOPABLE_M2 } from '../src/lib/manhattan.js';

// The 6 Oct 2026 close and that day's stacks.
const s = { price: 85528.21361756268, mined: 19980750, usGov: 328372, blackrock: 806037, strategy: 848000, satoshi: 1096354 };
const B = beats(s);

describe('manhattan long clip', () => {
	it('opens on the payoff, fully shown in frame one', () => {
		const f = longFrame(0, B, s.price);
		expect(B[f.beat].id).toBe('hook');
		expect(f.block).toBe(1);
		expect(f.btc).toBe(s.mined);
		expect(f.frameM2).toBe(DEVELOPABLE_M2);
		expect(B[0].head).toBe('buys 98% of Manhattan.');
	});

	it('ends on its opening frame, so it loops', () => {
		const a = longFrame(0, B, s.price);
		const z = longFrame(DURATION, B, s.price);
		const last = B[z.beat];
		expect(z.btc).toBe(a.btc);
		expect(z.street).toBe(a.street);
		expect(z.frameM2).toBe(a.frameM2);
		expect(last.eyebrow).toBe(B[0].eyebrow);
		expect(last.headAfter).toBe(B[0].head);
		expect(z.headAfter).toBe(1);
		expect(z.block).toBe(1);
		expect(z.result + z.sub + a.result + a.sub).toBe(0);
	});

	it('runs over a minute, with a new stack at least every 9 seconds', () => {
		expect(DURATION).toBeGreaterThan(60);
		for (let i = 1; i < B.length; i++) expect(B[i].t0 - B[i - 1].t0).toBeLessThanOrEqual(9);
	});

	it('climbs to each stack and holds it', () => {
		for (const b of B.filter((x) => x.climb)) expect(longFrame(b.climb![1] + 0.01, B, s.price).btc).toBeCloseTo(b.btc, 6);
		expect(longFrame(5, B, s.price).btc).toBeCloseTo(1, 9);
	});

	it('says only what the numbers say', () => {
		const line = (id: string) => B.find((b) => b.id === id)!;
		expect(line('one').head).toBe('17 sq ft at the Battery.');
		expect(line('pizza').result).toBe('Today: a whole Midtown block.');
		expect(line('usgov').result).toBe('1.6% of Manhattan. Battery to Wall Street.');
		expect(line('strategy').result).toBe('4.2%. Strategy wins by 4½ Midtown blocks.');
		expect(line('satoshi').result).toBe('5.4% of Manhattan. Battery to Chambers Street.');
		expect(line('mined').sub!.text).toBe('At $87,100 a coin: the whole island.');
		// If the order flips, so does the claim.
		const flipped = beats({ ...s, blackrock: 900_000 }).find((b) => b.id === 'strategy')!;
		expect(flipped.result).toMatch(/BlackRock wins by/);
	});

	it('formats shares to a decimal below 10%', () => {
		expect(pct(0.0396)).toBe('4.0%');
		expect(pct(0.982)).toBe('98%');
	});
});
