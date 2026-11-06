/**
 * Sun 11 Oct 2026: three posts, written to scripts/social/WRITING.md. The Moon
 * ride again (all 21 million coins in $1 bills, video) with a new question, El
 * Salvador's bitcoin as one gold cube (guess first), and BlackRock's ETF on
 * Manhattan land. Live figures. See lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, type Item } from './lib.ts';
import { landM2, DEVELOPABLE_M2, frontierStreet } from '../../../src/lib/manhattan.ts';

const OUT = 'output/slates/2026-10-11';
const { P, close, prev, card } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// All 21 million coins in $1 bills (0.10922 mm a note) against the Moon (384,400 km).
const moonPct = (21e6 * px * 0.10922e-6) / 384_400 * 100;
const moonPrice = Math.round(384_400 / 0.10922e-6 / 21e6);

// El Salvador's coins as one gold cube.
const sv = presetBtc('el-salvador')!;
const svGold = card('gold', sv, 'el-salvador');
const svEdgeCm = Math.cbrt((sv * P[close].xau_per_btc * 31.1035) / 19.3);

// BlackRock's ETF on Manhattan land.
const ibit = presetBtc('blackrock-ibit')!;
const ibitM2 = landM2(ibit, px);
const ibitPct = (ibitM2 / DEVELOPABLE_M2) * 100;
const ibitStreet = frontierStreet(ibitM2) ?? 'the Battery';

const SLATE: Item[] = [
	{ id: 'moon-ride-again', at: '2026-10-11T13:30:00Z', media: () => 'scripts/social/media/ride-market-cap.mp4',
		text: `Every bitcoin there will ever be, stacked in $1 bills.\n\nAt ${closeWord}’s close the stack gets ${moonPct.toFixed(1)}% of the way to the Moon.\n\nAt $${f0(moonPrice)} a coin, it lands. Which comes first: that, or the next crewed Moon landing?`,
		reply: 'Every note true to scale, 0.11 mm thick. Ride it yourself (it starts by itself):\n' + L('preset=market-cap&commodity=cash&ride=play') },
	{ id: 'el-salvador-gold', at: '2026-10-11T17:00:00Z', media: () => jpg(get('gold_p-el-salvador'), 'el-salvador-gold'),
		text: `El Salvador holds ${f0(sv)} bitcoin.\n\nSwapped for gold at ${closeWord}’s close and cast as one cube, how wide would it be?\n\nGuess before you look.`,
		reply: `${f0(svEdgeCm)} cm across: ${svGold.big}${svGold.unit.trim() === 't' ? ' tonnes' : svGold.unit} of gold. Weigh any country’s stack:\n` + L('preset=el-salvador&commodity=gold') },
	{ id: 'ibit-manhattan', at: '2026-10-11T21:30:00Z', media: () => jpg(get('manhattan_p-blackrock-ibit'), 'ibit-manhattan'),
		text: `BlackRock’s bitcoin ETF holds ${f0(ibit)} coins.\n\nSpent on Manhattan land at ${closeWord}’s close, it buys every lot from the Battery to ${ibitStreet}: ${ibitPct.toFixed(1)}% of the island.\n\nWhich block would you keep?`,
		reply: 'Land at its 2014 value ($1.74T), spread evenly, so it’s illustrative. Fill the island with any stack:\n' + L('preset=blackrock-ibit&commodity=manhattan') },
];

await run(SLATE, OUT, `Sun 11 Oct · close ${close} ($${f0(px)}), previous ${prev}`);
