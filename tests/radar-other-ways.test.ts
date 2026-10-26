import { describe, expect, it } from 'vitest';
import { onTopic } from '../scripts/radar/angles';
import { otherWays, postFacts } from '../scripts/radar/facts';
import { checkOption, isGeneric } from '../scripts/radar/validate';

describe('otherWays', () => {
	it('weighs a sum in Brent, cocaine at wholesale, and paper money', () => {
		const s = otherWays(89e6, 115.22);
		expect(s).toContain('772,000 barrels of Brent');
		expect(s).toContain('38.6% of one supertanker');
		expect(s).toContain('2.97 tonnes of cocaine at US wholesale');
		expect(s).toContain('890 kg of $100 bills');
		expect(s).toContain('89 tonnes of $1 bills stacked 9.72 km high');
	});
	it('counts years of world cocaine output once a sum passes one', () => {
		expect(otherWays(40e12, 115.22)).toContain('360 years of the world');
	});
});

describe('postFacts', () => {
	it('adds the other-ways line only when it has a Brent price', () => {
		expect(postFacts('Strategy bought $89 million').some((l) => l.includes('-other]'))).toBe(false);
		expect(postFacts('Strategy bought $89 million', 115.22).some((l) => l.startsWith('[post-usd-89000000-other]'))).toBe(true);
	});
});

describe('onTopic', () => {
	it('lets the gold crowd and news desks through on oil and debt', () => {
		expect(onTopic('Brent crude just hit $120 a barrel', 'news')).toBe(true);
		expect(onTopic('The national debt passed $38 trillion', 'gold-macro')).toBe(true);
		expect(onTopic('Brent crude just hit $120 a barrel', 'voices')).toBe(false);
		expect(onTopic('Great weekend at the lake', 'news')).toBe(false);
	});
});

describe('the new sticks in a draft', () => {
	const facts = [`[holder-strategy-other] Strategy's 848,517 BTC in other things: ${otherWays(848_517 * 80_388, 115.22)}.`, '[oil-flip] about 149,063 BTC a day, 331× the ~450 new bitcoin mined each day.'];
	it('passes a supertanker reply built from the holder line', () => {
		const r = checkOption({ text: 'Strategy’s coins would fill 296 supertankers with Brent. The world would burn the lot in under six days.' }, facts, [], [], 'We now hold 848,517 BTC');
		expect(r).toEqual({ ok: true, problems: [] });
	});
	it('refuses the oil flip alone under a post about something else', () => {
		expect(isGeneric('The world burns about 149,063 BTC of oil a day.', facts, 'Sberbank approved as custodian')).toBe(true);
		expect(isGeneric('The world burns about 149,063 BTC of oil a day.', facts, 'OPEC cuts output again')).toBe(false);
	});
});
