/**
 * Sun 1 Nov 2026: three posts, written to scripts/social/WRITING.md. October in
 * dollars for bitcoin, gold and silver (tribal, text only), what October did to
 * Strategy's slice of Manhattan, and the US government's coins in plutonium-238
 * counted in Voyagers (guess first). Live figures. See lib.ts for how to run it.
 *
 * US clocks go back today: 13:30, 17:00 and 21:30 UTC are 8:30am, noon and 4:30pm in New York.
 */
import { L, DATA, f0, images, loadPrices, presetBtc, run, weekday, type Item } from './lib.ts';
import { landM2, DEVELOPABLE_M2, LAND_YARDSTICKS, frontierStreet } from '../../../src/lib/manhattan.ts';
import { OG_COMMODITIES, computeAmount } from '../../../functions/_lib.ts';

const OUT = 'output/slates/2026-11-01';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// October: the last close of September against the latest close.
const SEP = '2026-09-30';
const chg = (k: 'btc_usd' | 'xau_usd' | 'xag_usd') => Math.round((P[close][k] / P[SEP][k] - 1) * 100);
const sign = (n: number) => (n > 0 ? `+${n}%` : n < 0 ? `−${-n}%` : 'flat');
const thru = close >= '2026-10-31' ? 'October' : `October to ${closeWord}`;

// Strategy's coins on Manhattan at the end of September against now.
const strategy = presetBtc('strategy')!;
const BLOCK_M2 = LAND_YARDSTICKS.find((y) => y.label === 'a Midtown block')!.m2;
const thenM2 = landM2(strategy, P[SEP].btc_usd), nowM2 = landM2(strategy, px);
const lostBlocks = (thenM2 - nowM2) / BLOCK_M2;

// The US government's coins in Pu-238 (illustrative price) against Voyager 1's ~13.5 kg (three RTGs).
const govt = presetBtc('us-govt')!;
const puKg = (computeAmount(govt, OG_COMMODITIES.pu238, { btc: px, xau: P[close].xau_usd, xag: P[close].xag_usd }) ?? 0) * (OG_COMMODITIES.pu238.unitMassGrams ?? 1) / 1000;
const voyagers = puKg / 13.5;

const SLATE: Item[] = [
	{ id: 'october-in-dollars', at: '2026-11-01T13:30:00Z',
		text: `${thru}, in dollars:\n\nBitcoin: ${sign(chg('btc_usd'))}\nGold: ${sign(chg('xau_usd'))}\nSilver: ${sign(chg('xag_usd'))}\n\nA red month for all three. Which one are you buying in November, if any?`,
		reply: 'Every daily close since 2013, free to download:\n' + DATA },
	{ id: 'strategy-october-manhattan', at: '2026-11-01T17:00:00Z', media: () => jpg(get('manhattan_p-strategy'), 'strategy-manhattan'),
		text: `On 30 September, Strategy’s ${f0(strategy)} bitcoin would have bought ${((thenM2 / DEVELOPABLE_M2) * 100).toFixed(1)}% of Manhattan.\n\nAt ${closeWord}’s close: ${((nowM2 / DEVELOPABLE_M2) * 100).toFixed(1)}%, Battery to ${frontierStreet(nowM2) ?? 'the Battery'}.\n\n${lostBlocks >= 0 ? `October cost Saylor about ${lostBlocks.toFixed(1)} Midtown blocks.` : `October won Saylor about ${(-lostBlocks).toFixed(1)} Midtown blocks.`} Buying the dip?`,
		reply: 'Land at its 2014 value ($1.74T), spread evenly, so it’s illustrative. Slide the date yourself:\n' + L('preset=strategy&commodity=manhattan') },
	{ id: 'govt-voyagers', at: '2026-11-01T21:30:00Z', media: () => jpg(get('pu238_p-us-govt'), 'govt-pu238'),
		text: `Voyager 1 left in 1977 with about 13.5 kg of plutonium-238 on board. It’s still sending data from beyond the Sun’s bubble.\n\nThe US government holds ${f0(govt)} bitcoin.\n\nIn plutonium-238, how many Voyagers could it fuel? Guess first.`,
		reply: `About ${f0(Math.round(voyagers / 10) * 10)}: ${(puKg / 1000).toFixed(1)} tonnes at ${closeWord}’s close. The price is illustrative (DOE and NASA estimates): there’s no open market. Weigh any stack:\n` + L('preset=us-govt&commodity=pu238') },
];

await run(SLATE, OUT, `Sun 1 Nov · close ${close} ($${f0(px)}), previous ${prev}`);
