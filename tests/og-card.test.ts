import { describe, it, expect } from 'vitest';
import { artLeft, cardDescription, cardKey, cardModel, cardTitle, nearestArt, presetBtc, sig3, bigSize } from '../functions/_card.js';

// The 28 Sep 2026 close, as static/prices.json carries it.
const day = { btc: 83_514.23, xau: 4_131.94, xag: 60.921 };
const q = (commodity: string, btc: number, preset?: string) => cardModel({ commodity, btc, preset, date: '2026-09-28', day });

describe('link card — numbers and words', () => {
	it('formats to three significant figures', () => {
		expect(sig3(20.2119)).toBe('20.2');
		expect(sig3(1370.9)).toBe('1,371');
		expect(sig3(0.0632)).toBe('0.0632');
		expect(sig3(3.19)).toBe('3.19');
	});

	it('weighs 1 BTC in gold: ounces, and a cube a few centimetres across', () => {
		const m = q('gold', 1);
		expect(m.eyebrow).toBe('1 bitcoin');
		expect(`${m.big}${m.unit}`).toBe('20.2 oz');
		expect(m.mid).toBe('of gold');
		expect(m.subs[0]).toBe('A cube 3.19 cm across.');
		expect(m.theme).toBe('metal');
	});

	it('names holders in plain words and switches to tonnes, with Fort Knox', () => {
		const m = q('gold', presetBtc('satoshi')!, 'satoshi');
		expect(m.eyebrow).toBe('Satoshi’s untouched coins');
		expect(`${m.big}${m.unit}`).toBe('689 t');
		expect(m.subs).toContain('15% of Fort Knox.');
		expect(q('manhattan', presetBtc('strategy')!, 'strategy').eyebrow).toBe('The biggest company stack');
	});

	it('reads the whole supply of $1 bills against the Moon', () => {
		const m = q('cash', 21_000_000, 'market-cap');
		expect(m.theme).toBe('space');
		expect(m.big).toBe('HALFWAY');
		expect(m.fine).toMatch(/\$167,595 a coin/);
		const one = q('cash', 1);
		expect(one.theme).toBe('floor');
		expect(one.big).toBe('83,514');
		expect(one.mid).toBe('one-dollar bills');
	});

	it('gives Manhattan as area, then as a share with its cross street, then all of it', () => {
		const one = q('manhattan', 1);
		expect(`${one.big}${one.unit}`).toBe('16.7 sq ft');
		const s = q('manhattan', presetBtc('strategy')!, 'strategy');
		expect(`${s.big}${s.unit}`).toBe('4.1%');
		expect(s.subs[0]).toBe('The Battery → Fulton Street.');
		expect(q('manhattan', 21_000_000, 'market-cap').big).toBe('ALL');
	});

	it('labels the illustrative prices', () => {
		expect(q('cocaine', 1).fine).toMatch(/illustrative/);
		expect(`${q('cocaine', 1).big}${q('cocaine', 1).unit}`).toBe('2.78 kg');
		expect(q('pu238', 1).fine).toMatch(/Illustrative/);
	});

	it('picks the art rung nearest the amount, on a log scale', () => {
		expect(nearestArt('gold', 628)).toBe('gold/1p00e3.jpg'); // 628 g: 1 kg beats 316 g
		expect(nearestArt('gold', 200)).toBe('gold/316.jpg');
		expect(nearestArt('nope', 1)).toBeNull();
	});

	it('places the art so its subject sits right of the text and inside the card', () => {
		// Centred in the window right of the text.
		expect(artLeft({ theme: 'metal', artX: [523, 858] })).toBe(180);
		// Wide subjects keep their right edge (where Sat sits) in frame.
		expect(artLeft({ theme: 'floor', artX: [100, 1077] })).toBe(103);
		// Never so far left that the art's right edge shows, nor so far right that its left edge does.
		expect(artLeft({ theme: 'floor', artX: [0, 1197] })).toBe(0);
		expect(artLeft({ theme: 'floor', artX: [100, 300] })).toBeLessThanOrEqual(432);
		// The map and the Moon fill their frames; they stay put.
		expect(artLeft({ theme: 'land', artX: [0, 600] })).toBe(260);
		expect(artLeft({ theme: 'metal' })).toBe(230);
	});

	it('sizes the big number to fit, and titles the page for the link', () => {
		expect(bigSize('20.2 oz')).toBeLessThanOrEqual(176);
		expect(bigSize('1,234,567')).toBeGreaterThanOrEqual(96);
		expect(cardTitle({ commodity: 'manhattan', btc: 1 })).toBe('1 bitcoin, weighed in Manhattan · Bitcoin Weigh-In');
	});

	it('describes the link in words that need no prices', () => {
		const d = cardDescription({ commodity: 'cash', btc: 21_000_000, preset: 'market-cap' });
		expect(d.startsWith('All 21 million bitcoin, weighed in $1 bills')).toBe(true);
		// No amounts or prices, so a cached page never shows a stale one.
		expect(cardDescription({ commodity: 'gold', btc: 1 })).not.toMatch(/\$\d|\boz\b|\d,\d/);
	});

	it('names pre-rendered card files by commodity, holder or amount, and date', () => {
		expect(cardKey({ commodity: 'cash', btc: 1 })).toBe('cash_b-1');
		expect(cardKey({ commodity: 'manhattan', preset: 'strategy', btc: 640_031 })).toBe('manhattan_p-strategy');
		expect(cardKey({ commodity: 'gold', btc: 0.0001, date: '2013-09-30' })).toBe('gold_b-0p0001_2013-09-30');
		// Unknown commodity or holder, bad amount or date: the safe defaults.
		expect(cardKey({ commodity: 'lava', preset: 'nobody', btc: -3, date: 'soon' })).toBe('gold_b-1');
		// The same number written two ways is the same card.
		expect(cardKey({ commodity: 'gold', btc: parseFloat('0.50') })).toBe(cardKey({ commodity: 'gold', btc: 0.5 }));
	});
});
