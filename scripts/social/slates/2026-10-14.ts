/**
 * Wed 14 Oct 2026: three posts, written to scripts/social/WRITING.md. Strategy's
 * coins in plutonium-238 against America's production target (do the math),
 * the inside-a-miner video again with a new opening, and one coin in silver
 * against an airline's checked-bag limit (guess first). Live figures. See
 * lib.ts for how to run it.
 */
import { L, SITE, f0, images, loadPrices, presetBtc, run, weekday, OZ, type Item } from './lib.ts';
import { OG_COMMODITIES, computeAmount } from '../../../functions/_lib.ts';

const OUT = 'output/slates/2026-10-14';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;
const UTM = 'utm_source=x&utm_medium=first_reply&utm_campaign=launch';

// Strategy's coins in Pu-238 (illustrative price) against the DOE/NASA target
// of 1.5 kg of new Pu-238 a year (Pu-238 Supply Project; GAO-17-673).
const strategy = presetBtc('strategy')!;
const puKg = (computeAmount(strategy, OG_COMMODITIES.pu238, { btc: px, xau: P[close].xau_usd, xag: P[close].xag_usd }) ?? 0) * (OG_COMMODITIES.pu238.unitMassGrams ?? 1) / 1000;
const TARGET_KG = 1.5;
const years = puKg / TARGET_KG;

// One coin in silver against a 23 kg checked bag (the usual economy limit, 50 lb).
const silverKg = (P[close].xag_per_btc * OZ) / 1000;
const BAG_KG = 23;

const SLATE: Item[] = [
	{ id: 'strategy-plutonium', at: '2026-10-14T13:30:00Z', media: () => jpg(get('pu238_p-strategy'), 'strategy-pu238'),
		text: `America aims to make 1.5 kg of new plutonium-238 a year, the fuel that powers NASA’s deep-space probes.\n\nStrategy’s ${f0(strategy)} bitcoin would buy ${f0(Math.round(puKg / 100) * 100)} kg of it at ${closeWord}’s close.\n\nThat’s about ${f0(Math.round(years / 100) * 100)} years of production. Who’s selling?`,
		reply: 'The price is illustrative (DOE and NASA estimates): there’s no open market. Target: DOE’s Pu-238 Supply Project. Weigh any stack:\n' + L('preset=strategy&commodity=pu238') },
	{ id: 'mining-dive-again', at: '2026-10-14T17:00:00Z', media: () => 'scripts/social/media/mining-dive.mp4',
		text: `Every 10 minutes, machines like this race to guess one number.\n\nThis one is a die smaller than your fingernail, trying a trillion guesses a second.\n\nWe opened one up and followed a real winning guess all the way in.`,
		reply: `Take the chip apart yourself and watch a real block get found, round by round:\n${SITE}/mining?${UTM}` },
	{ id: 'one-coin-silver-bag', at: '2026-10-14T21:30:00Z', media: () => jpg(get('silver_b-1'), 'one-coin-silver'),
		text: `One bitcoin, swapped for silver bars.\n\nCould you check it in as one suitcase on a flight (23 kg limit)?\n\nGuess first.`,
		reply: (silverKg > BAG_KG
			? `No: ${silverKg.toFixed(1)} kg at ${closeWord}’s close. That’s ${Math.ceil(silverKg / BAG_KG)} bags. In gold it fits in a pocket. `
			: `Yes: ${silverKg.toFixed(1)} kg at ${closeWord}’s close. `) + 'Weigh any amount:\n' + L('btc=1&commodity=silver') },
];

await run(SLATE, OUT, `Wed 14 Oct · close ${close} ($${f0(px)}), previous ${prev}`);
