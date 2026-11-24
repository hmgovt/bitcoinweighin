/**
 * Wed 25 Nov 2026: three posts, written to scripts/social/WRITING.md.
 * The 10,000 pizza coins in oil counted in supertankers, a NEW video: a tenth
 * of a bitcoin weighed in gold, silver and plutonium-238, and the US
 * government's seized bitcoin on Manhattan land against the White House
 * grounds. Third video of the week (Mon, Tue, Wed). Live figures. See lib.ts
 * for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, OZ, type Item } from './lib.ts';
import { landM2, DEVELOPABLE_M2, frontierStreet } from '../../../src/lib/manhattan.ts';

const OUT = 'output/slates/2026-11-25';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// The pizza coins in Brent against a VLCC supertanker: about 2 million barrels (EIA).
const VLCC_BBL = 2e6;
const pizza = presetBtc('pizza-day')!;
const pizzaBbl = pizza * P[close].brent_per_btc;

// A tenth of a coin in gold and silver. Quoted at the video's own close, so
// the text and the clip agree.
const VID = '2026-11-23';
const tenthG = 0.1 * P[VID].xau_per_btc * OZ;
const tenthKg = (0.1 * P[VID].xag_per_btc * OZ) / 1000;

// The US government's coins on Manhattan land against the White House grounds:
// about 18 acres (National Park Service).
const WH_ACRES = 18;
const govt = presetBtc('us-govt')!;
const govtM2 = landM2(govt, px);
const govtAcres = govtM2 / 4046.8564;

const SLATE: Item[] = [
	{ id: 'pizza-oil-supertankers', at: '2026-11-25T13:30:00Z', media: () => jpg(get('oil_p-pizza-day'), 'pizza-oil'),
		text: `In 2010, 10,000 bitcoin bought two pizzas.\n\nSwapped for Brent crude at ${closeWord}’s close: ${(pizzaBbl / 1e6).toFixed(1)} million barrels.\n\nA supertanker carries about 2 million. That’s ${(pizzaBbl / VLCC_BBL).toFixed(1)} supertankers, filled to the brim. Two pizzas, or a fleet?`,
		reply: `A very large crude carrier holds about 2 million barrels (EIA). Brent $${P[close].brent_usd.toFixed(2)} a barrel. Weigh any stack in oil:\n` + L('preset=pizza-day&commodity=oil') },
	{ id: 'tenth-metals-video', at: '2026-11-25T17:00:00Z', media: () => 'scripts/social/media/metals-tenth.mp4',
		text: `Most people will never own a whole bitcoin. So we weighed a tenth of one.\n\nAt ${weekday(VID)}’s close, 0.1 bitcoin is ${f0(tenthG)} grams of gold, or ${tenthKg.toFixed(1)} kilos of silver.\n\nAnd in plutonium-238, the metal that powers deep-space probes? Watch to the end.`,
		reply: 'Daily closes, our dataset. Weigh any amount, in any metal:\n' + L('btc=0.1&commodity=gold') },
	{ id: 'govt-manhattan-white-house', at: '2026-11-25T21:30:00Z', media: () => jpg(get('manhattan_p-us-govt'), 'govt-manhattan'),
		text: `The US government holds ${f0(govt)} bitcoin, most of it seized in criminal cases.\n\nSpent on Manhattan land at ${closeWord}’s close: ${f0(govtAcres)} acres, from the Battery to ${frontierStreet(govtM2) ?? 'the Battery'}.\n\nThe White House sits on 18 acres. Uncle Sam’s bitcoin buys about ${f0(govtAcres / WH_ACRES)} of those. Big haul, or small change?`,
		reply: `${((govtM2 / DEVELOPABLE_M2) * 100).toFixed(1)}% of the island. White House grounds: about 18 acres (National Park Service). Land at its 2014 value (Barr, Smith & Kulkarni), illustrative. Fill the island:\n` + L('preset=us-govt&commodity=manhattan') },
];

await run(SLATE, OUT, `Wed 25 Nov · close ${close} ($${f0(px)}), previous ${prev}`);
