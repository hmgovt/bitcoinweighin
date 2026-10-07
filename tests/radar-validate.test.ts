import { describe, expect, it } from 'vitest';
import { checkOption, evalExpr, isGeneric, numbersIn } from '../scripts/radar/validate';

const FACTS = [
	'[holder-strategy] Strategy holds 847,666 BTC, worth $71.7 billion: 537 tonnes of gold.',
	'[ref-reserves] Official gold reserves: United Kingdom 310 t.',
	'[post-usd-40000000000000] $40 trillion in $1 bills stacks 4,368,800 km high, 11.4× the distance to the Moon.',
	'[moon] every $1,676 on the price adds 1% (3,844 km).',
];
const LINK = 'https://bitcoinweighin.com/?preset=strategy&commodity=gold';

describe('numbersIn', () => {
	it('applies scale words; keeps the bare figure only for lone letters', () => {
		const v = numbersIn('$40 trillion and 21M coins, 4.4 million km').map((n) => n.value);
		expect(v).toContain(4e13);
		expect(v).toContain(2.1e7);
		expect(v).toContain(4.4e6);
		expect(v).not.toContain(4.4);
		expect(numbersIn('a stack 9.23 m tall').map((n) => n.value)).toContain(9.23);
	});
	it('ignores links, handles and fact ids', () => {
		expect(numbersIn('see https://x.com/a/status/123 @user99 [post-price-87000]')).toEqual([]);
	});
});

describe('checkOption', () => {
	it('passes sourced and rounded figures', () => {
		const r = checkOption({ text: 'That stack would buy about 538 tonnes of gold. Each $1,676 adds 1%, about 3,800 km.', link: LINK }, FACTS, [LINK]);
		expect(r).toEqual({ ok: true, problems: [] });
	});
	it('catches a made-up figure', () => {
		const r = checkOption({ text: 'Strategy’s coins would buy 900 tonnes of gold.' }, FACTS, []);
		expect(r.ok).toBe(false);
		expect(r.problems[0]).toMatch(/900 has no source/);
	});
	it('accepts a worked step built from sourced numbers', () => {
		const r = checkOption({ text: 'About 538 tonnes of gold: 1.7× the UK’s whole reserve.', derived: [{ value: 1.73, expr: '537 / 310' }] }, FACTS, []);
		expect(r.ok).toBe(true);
	});
	it('rejects a worked step that uses an unsourced number or lies about its result', () => {
		expect(checkOption({ text: 'It is 2.5× bigger, honestly.', derived: [{ value: 2.5, expr: '537 / 215' }] }, FACTS, []).ok).toBe(false);
		expect(checkOption({ text: 'It is 2.5× bigger, honestly.', derived: [{ value: 2.5, expr: '537 / 310' }] }, FACTS, []).ok).toBe(false);
	});
	it('rejects hashtags, foreign links, long text and repeats', () => {
		expect(checkOption({ text: 'Gold is fun to weigh #bitcoin #gold' }, FACTS, []).problems).toContain('has a hashtag');
		expect(checkOption({ text: 'Weigh it yourself, it is fun.', link: 'https://evil.example' }, FACTS, [LINK]).problems).toContain('link is not one of ours');
		expect(checkOption({ text: 'x'.repeat(270), link: LINK }, FACTS, [LINK]).ok).toBe(false);
		expect(checkOption({ text: 'Weigh it yourself, it is fun.' }, FACTS, [], ['weigh it yourself — it is fun!']).problems).toContain('repeats a recent reply');
	});
});

describe('evalExpr', () => {
	it('does plain arithmetic only', () => {
		expect(evalExpr('537 / 310')).toBeCloseTo(1.732, 3);
		expect(evalExpr('4,368,800 / 384,400')).toBeCloseTo(11.37, 2);
		expect(evalExpr('process.exit()')).toBeNull();
	});
});

describe('scaled numbers', () => {
	it('does not let a bare figure vouch for a scaled one', () => {
		const facts = [...FACTS, 'El Salvador: 4.93 tonnes of gold.'];
		expect(checkOption({ text: 'It would stack 4.9 million km high.' }, facts, []).ok).toBe(false);
		expect(checkOption({ text: 'It would stack 4.4 million km high.' }, facts, []).ok).toBe(true);
	});
});

describe('isGeneric', () => {
	const SHEET = [
		'[close] Latest daily close: 2026-10-06. 1 BTC = $85,528; gold $4,148/oz.',
		'[gold-1] 1 BTC buys 20.6 oz of gold (641 g): a cube 3.2 cm across.',
		'[cash-1] 1 BTC in $1 bills: 85,528 bills, a stack 9.34 m tall. 85.5 kg of paper.',
		'[all-21m] All 21,000,000 bitcoin at $85,528 are worth $1.8 trillion.',
		'[gold-in-btc-russia] Russia\'s ~2,330 t of official gold is worth $312 billion: about 3.65 million BTC, 17.4% of all 21,000,000 bitcoin.',
	];
	const CUSTODY = 'Russia\'s largest bank Sberbank officially approved as crypto custodian.';
	it('refuses a reply that only says what one coin weighs, under a post about something else', () => {
		expect(isGeneric('One bitcoin of gold is a 3.2 cm cube, 641 g. In $1 bills, 85,528 notes, 9.3 m tall.', SHEET, CUSTODY)).toBe(true);
	});
	it('keeps a reply about the post\'s subject', () => {
		expect(isGeneric('Russia\'s 2,330 tonnes of gold would buy about 3.65 million bitcoin: 17.4% of all there will ever be.', SHEET, CUSTODY)).toBe(false);
	});
	it('keeps one-coin figures under a post about that commodity', () => {
		expect(isGeneric('1 BTC buys 20.6 oz of gold, a 3.2 cm cube.', SHEET, 'Gold just hit a record against the dollar')).toBe(false);
	});
	it('treats everyday prices as one-coin figures, fine only under posts about them', () => {
		const sheet = [...SHEET, '[everyday-house] Median price of a new US house: $410,700 (Q2 2026). In bitcoin: 4.80 BTC.'];
		const reply = 'A median new US house is 4.80 BTC.';
		expect(isGeneric(reply, sheet, CUSTODY)).toBe(true);
		expect(isGeneric(reply, sheet, 'US home prices hit another record')).toBe(false);
	});
	it('ignores replies with no figures', () => {
		expect(isGeneric('Not your keys, not your coins.', SHEET, CUSTODY)).toBe(false);
	});
});
