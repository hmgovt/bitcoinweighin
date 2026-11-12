/**
 * Fri 13 Nov 2026: three posts, written to scripts/social/WRITING.md.
 * All 21 million coins in gold against all of America's official gold
 * (tribal), the US government's coins on Manhattan (to Wall Street), and
 * BlackRock's bitcoin ETF in silver against BlackRock's own silver ETF. No
 * video: this week already has three (Mon, Tue, Wed). Live figures. See
 * lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, OZ, type Item } from './lib.ts';
import { landM2, DEVELOPABLE_M2, frontierStreet } from '../../../src/lib/manhattan.ts';

const OUT = 'output/slates/2026-11-13';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// All 21 million coins in gold against US official gold: 8,133.5 t (World Gold Council).
const US_GOLD_T = 8133.5;
const all = 21_000_000;
const allT = (all * P[close].xau_per_btc * OZ) / 1e6;
const usTimes = allT / US_GOLD_T;

// The US government's coins on Manhattan land, filled from the Battery north.
const govt = presetBtc('us-govt')!;
const govtM2 = landM2(govt, px);
const govtStreet = frontierStreet(govtM2) ?? 'the Battery';
const govtPct = (govtM2 / DEVELOPABLE_M2) * 100;

// BlackRock's bitcoin ETF in silver against BlackRock's silver ETF (iShares Silver Trust):
// about 498.3 million oz in trust on 26 Oct 2026 (iShares).
const SLV_MOZ = 498.3;
const ibit = presetBtc('blackrock-ibit')!;
const ibitMoz = (ibit * P[close].xag_per_btc) / 1e6;
const slvTimes = ibitMoz / SLV_MOZ;

const SLATE: Item[] = [
	{ id: 'all-btc-vs-us-gold', at: '2026-11-13T13:30:00Z', media: () => jpg(get('gold_p-market-cap'), 'all-gold'),
		text: `America holds 8,133 tonnes of gold, more than any other country.\n\nEvery bitcoin there will ever be, all 21 million, swapped for gold at ${closeWord}’s close: ${f0(Math.round(allT / 100) * 100)} tonnes.\n\n${usTimes >= 1 ? `Enough to buy all of America’s gold ${usTimes.toFixed(1)} times over.` : `${(usTimes * 100).toFixed(0)}% of America’s gold.`} Digital gold, or just digital?`,
		reply: 'US gold: 8,133.5 t (World Gold Council). Weigh all 21 million coins, or any stack:\n' + L('preset=market-cap&commodity=gold') },
	{ id: 'govt-manhattan-street', at: '2026-11-13T17:00:00Z', media: () => jpg(get('manhattan_p-us-govt'), 'govt-manhattan'),
		text: `The US government holds ${f0(govt)} bitcoin, mostly seized from criminals.\n\nSpent on Manhattan land at ${closeWord}’s close, from the Battery north, it gets as far as ${govtStreet}: ${govtPct.toFixed(1)}% of the island.\n\nA seized fortune that never leaves the Financial District. Rich, or not that rich?`,
		reply: `Land at its 2014 value (Barr, Smith & Kulkarni), spread evenly, so it’s illustrative. Fill it with any stack:\n` + L('preset=us-govt&commodity=manhattan') },
	{ id: 'ibit-vs-slv', at: '2026-11-13T21:30:00Z', media: () => jpg(get('silver_p-blackrock-ibit'), 'ibit-silver'),
		text: `BlackRock runs the biggest silver ETF: about ${f0(SLV_MOZ)} million ounces in its vaults.\n\nAnd the biggest bitcoin ETF. Its ${f0(ibit)} coins, swapped for silver at ${closeWord}’s close: ${(ibitMoz / 1000).toFixed(2)} billion ounces.\n\nAbout ${slvTimes.toFixed(1)} times the silver fund. Same firm. Which is the real store of value?`,
		reply: 'iShares Silver Trust: about 498.3 million oz on 26 Oct 2026 (iShares). Weigh any holder in silver:\n' + L('preset=blackrock-ibit&commodity=silver') },
];

await run(SLATE, OUT, `Fri 13 Nov · close ${close} ($${f0(px)}), previous ${prev}`);
