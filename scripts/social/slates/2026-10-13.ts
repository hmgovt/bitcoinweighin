/**
 * Tue 13 Oct 2026: three posts, written to scripts/social/WRITING.md. Satoshi's
 * coins in gold against the UK's whole gold reserve (tribal), the US
 * government's coins on Manhattan (guess the street), and BlackRock's ETF in $1
 * bills against New York to London (guess first). Live figures. See lib.ts for
 * how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, OZ, type Item } from './lib.ts';
import { landM2, DEVELOPABLE_M2, frontierStreet } from '../../../src/lib/manhattan.ts';

const OUT = 'output/slates/2026-10-13';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// Satoshi's coins in gold against the UK's official reserve: 310.3 t (World Gold Council, end of 2025).
const sat = presetBtc('satoshi')!;
const satT = (sat * P[close].xau_per_btc * OZ) / 1e6;
const UK_T = 310.3;
const ukTimes = satT / UK_T;

// The US government's coins on Manhattan land.
const govt = presetBtc('us-govt')!;
const govtM2 = landM2(govt, px);
const govtPct = (govtM2 / DEVELOPABLE_M2) * 100;
const govtStreet = frontierStreet(govtM2) ?? 'the Battery';

// BlackRock's ETF in $1 bills (0.10922 mm a note) against New York to London (about 5,570 km).
const ibit = presetBtc('blackrock-ibit')!;
const ibitKm = (ibit * px * 0.10922) / 1e6;
const NY_LDN_KM = 5570;

const SLATE: Item[] = [
	{ id: 'satoshi-vs-uk-gold', at: '2026-10-13T13:30:00Z', media: () => jpg(get('gold_p-satoshi'), 'satoshi-gold'),
		text: `The UK holds ${UK_T} tonnes of gold.\n\nSatoshi’s ${f0(sat)} bitcoin, untouched for over 15 years, would buy ${f0(satT)} tonnes at ${closeWord}’s close.\n\nThat’s the UK’s whole reserve ${ukTimes.toFixed(1)} times over, owned by someone nobody can name.\n\nWhich would you rather hold?`,
		reply: 'UK reserve: World Gold Council, end of 2025. Weigh any stack in gold:\n' + L('preset=satoshi&commodity=gold') },
	{ id: 'govt-manhattan-street', at: '2026-10-13T17:00:00Z', media: () => jpg(get('manhattan_p-us-govt'), 'govt-manhattan'),
		text: `The US government holds ${f0(govt)} bitcoin.\n\nSpend it all on Manhattan land at ${closeWord}’s close, starting at the Battery and heading north.\n\nWhich street does it reach? Guess first.`,
		reply: `${govtStreet}: ${govtPct.toFixed(1)}% of the island. (2014 land value, spread evenly, illustrative.) Fill it with any stack:\n` + L('preset=us-govt&commodity=manhattan') },
	{ id: 'ibit-cash-london', at: '2026-10-13T21:30:00Z', media: () => jpg(get('cash_p-blackrock-ibit'), 'ibit-cash'),
		text: `BlackRock’s bitcoin ETF holds ${f0(ibit)} coins.\n\nChange them into $1 bills and lay the stack on its side, from New York toward London.\n\nDoes it make it across the Atlantic? Guess first.`,
		reply: (ibitKm >= NY_LDN_KM
			? `Yes: ${f0(ibitKm)} km of bills, and London is about ${f0(NY_LDN_KM)} km away. `
			: `No: ${f0(ibitKm)} km of bills, and London is about ${f0(NY_LDN_KM)} km away. `) + 'Stack any amount:\n' + L('preset=blackrock-ibit&commodity=cash') },
];

await run(SLATE, OUT, `Tue 13 Oct · close ${close} ($${f0(px)}), previous ${prev}`);
