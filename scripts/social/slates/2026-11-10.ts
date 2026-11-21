/**
 * Tue 10 Nov 2026: three posts, written to scripts/social/WRITING.md.
 * BlackRock's ETF coins in gold counted in days of the world's mines, a NEW
 * video: Strategy's coins filling Manhattan land from the Battery north, and
 * one bitcoin in silver weighed in kilos (could you carry it?). Second video
 * of the week (Mon, Tue). Live figures. See lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, OZ, type Item } from './lib.ts';
import { landM2, DEVELOPABLE_M2, frontierStreet } from '../../../src/lib/manhattan.ts';

const OUT = 'output/slates/2026-11-10';
const { P, close, prev, card } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// BlackRock's ETF coins in gold against world mine output: 3,672 t in 2025 (World Gold Council).
const MINED_T = 3672;
const ibit = presetBtc('blackrock-ibit')!;
const ibitCard = card('gold', ibit, 'blackrock-ibit');
const ibitT = (ibit * P[close].xau_per_btc * OZ) / 1e6;
const mineDays = (ibitT / MINED_T) * 365;

// Strategy's coins on Manhattan land, filled from the Battery north.
// Quoted at the video's own close (8 Nov), so the text and the clip agree.
const VID = '2026-11-08';
const strategy = presetBtc('strategy')!;
const stratM2 = landM2(strategy, P[VID].btc_usd);
const stratStreet = frontierStreet(stratM2) ?? 'the Battery';
const stratPct = (stratM2 / DEVELOPABLE_M2) * 100;

// One bitcoin in silver, in kilos, against a 23 kg checked bag.
const one = card('silver', 1);
const oneKg = (P[close].xag_per_btc * OZ) / 1000;

const SLATE: Item[] = [
	{ id: 'ibit-gold-mine-days', at: '2026-11-10T13:30:00Z', media: () => jpg(get('gold_p-blackrock-ibit'), 'ibit-gold'),
		text: `BlackRock’s bitcoin ETF holds ${f0(ibit)} coins.\n\nSwapped for gold at ${closeWord}’s close: ${ibitCard.big} tonnes.\n\nThe world’s gold mines dig that up in about ${mineDays.toFixed(0)} days. Big pile, or small one?`,
		reply: 'World mine output: 3,672 t in 2025 (World Gold Council). Weigh any holder in gold:\n' + L('preset=blackrock-ibit&commodity=gold') },
	{ id: 'strategy-manhattan-video', at: '2026-11-10T17:00:00Z', media: () => 'scripts/social/media/manhattan-strategy.mp4',
		text: `Strategy holds ${f0(strategy)} bitcoin, the biggest pile any company owns.\n\nWe spent it on Manhattan land at ${weekday(VID)}’s close, from the Battery north, lot by lot.\n\nIt stops at ${stratStreet}: ${stratPct.toFixed(1)}% of the island.`,
		reply: 'Land at its 2014 value (Barr, Smith & Kulkarni), spread evenly, so it’s illustrative. Fill the island with any stack:\n' + L('preset=strategy&commodity=manhattan') },
	{ id: 'one-coin-silver-kilos', at: '2026-11-10T21:30:00Z', media: () => jpg(get('silver_b-1'), 'one-coin-silver'),
		text: `One bitcoin, swapped for silver at ${closeWord}’s close: ${one.big} ounces.\n\nThat’s ${oneKg.toFixed(0)} kilos of metal, ${oneKg >= 46 ? `more than two full` : `nearly two full`} 23 kg suitcases.\n\nCould you carry one bitcoin home?`,
		reply: `${one.big} troy oz at 31.1 g each, at $${P[close].xag_usd.toFixed(2)} an ounce. Weigh any amount in silver:\n` + L('btc=1&commodity=silver') },
];

await run(SLATE, OUT, `Tue 10 Nov · close ${close} ($${f0(px)}), previous ${prev}`);
