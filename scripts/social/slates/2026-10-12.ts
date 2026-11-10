/**
 * Mon 12 Oct 2026: three posts, written to scripts/social/WRITING.md. Strategy's
 * coins in silver against a year of the world's mines (do the math), one coin
 * in $1 bills against a giraffe (guess first), and SpaceX's coins in gold
 * against a Falcon 9 (guess first). Live figures. See lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, OZ, type Item } from './lib.ts';

const OUT = 'output/slates/2026-10-12';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// Strategy's coins in silver against world mine output: 819.7 million oz in
// 2024 (Silver Institute, World Silver Survey 2025), about 25,500 t.
const strategy = presetBtc('strategy')!;
const stratT = (strategy * P[close].xag_per_btc * OZ) / 1e6;
const MINED_T = (819.7e6 * OZ) / 1e6;
const months = Math.round((stratT / MINED_T) * 12);

// One coin in $1 bills (0.10922 mm a note) against the tallest giraffes (about 5.8 m).
const oneM = px * 0.10922e-3;
const GIRAFFE_M = 5.8;

// SpaceX's coins in gold against a Falcon 9 (22,800 kg to low Earth orbit, expendable; SpaceX's figure).
const spacex = presetBtc('spacex')!;
const spacexT = (spacex * P[close].xau_per_btc * OZ) / 1e6;
const F9_T = 22.8;

const SLATE: Item[] = [
	{ id: 'strategy-silver-mines', at: '2026-10-12T13:30:00Z', media: () => jpg(get('silver_p-strategy'), 'strategy-silver'),
		text: `Strategy holds ${f0(strategy)} bitcoin.\n\nSwapped for silver at ${closeWord}’s close: ${f0(Math.round(stratT / 100) * 100)} tonnes.\n\nEvery silver mine on Earth dug about ${f0(Math.round(MINED_T / 100) * 100)} tonnes in all of 2024.\n\nSo Saylor’s stack is ${months} months of the world’s silver. A case for silver, or for bitcoin?`,
		reply: 'Mine output: 819.7 million oz in 2024 (Silver Institute). Weigh any stack in silver:\n' + L('preset=strategy&commodity=silver') },
	{ id: 'one-coin-giraffe', at: '2026-10-12T17:00:00Z', media: () => jpg(get('cash_b-1'), 'one-coin-cash'),
		text: `One bitcoin, changed into $1 bills and stacked on the floor.\n\nWould it stand taller than a giraffe?\n\nGuess before you look.`,
		reply: `${oneM.toFixed(1)} m at ${closeWord}’s close. The tallest giraffes reach about ${GIRAFFE_M} m, so that’s ${oneM / GIRAFFE_M >= 1 ? 'a giraffe and then some' : 'short of one'}. Stack any amount:\n` + L('btc=1&commodity=cash') },
	{ id: 'spacex-falcon-gold', at: '2026-10-12T21:30:00Z', media: () => jpg(get('gold_p-spacex'), 'spacex-gold'),
		text: `SpaceX holds ${f0(spacex)} bitcoin.\n\nSwap it all for gold bars at ${closeWord}’s close.\n\nCould one Falcon 9 carry the lot to orbit? Guess first.`,
		reply: spacexT <= F9_T
			? `Yes. ${spacexT.toFixed(1)} tonnes of gold; a Falcon 9 lifts ${F9_T} t to low orbit (SpaceX’s figure). Weigh any stack:\n` + L('preset=spacex&commodity=gold')
			: `No. ${spacexT.toFixed(1)} tonnes of gold; a Falcon 9 lifts ${F9_T} t to low orbit (SpaceX’s figure). Weigh any stack:\n` + L('preset=spacex&commodity=gold') },
];

await run(SLATE, OUT, `Mon 12 Oct · close ${close} ($${f0(px)}), previous ${prev}`);
