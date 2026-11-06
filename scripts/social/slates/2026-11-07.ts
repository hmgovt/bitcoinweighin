/**
 * Sat 7 Nov 2026: three posts, written to scripts/social/WRITING.md. SpaceX's
 * coins in $1 bills against the edge of space, all 21 million
 * coins in Brent against everything Prudhoe Bay has ever produced (tribal), and
 * the US government's coins in silver against a year of the world's mines.
 * No video: this week already has three (Mon, Wed, Thu). Live figures. See
 * lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, OZ, type Item } from './lib.ts';
import { PRUDHOE_BARRELS } from '../../../src/lib/oil.ts';

const OUT = 'output/slates/2026-11-07';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// SpaceX's coins in $1 bills (0.10922 mm a note) against the Kármán line (100 km) and the space station (~408 km).
const KARMAN_KM = 100, ISS_KM = 408;
const spacex = presetBtc('spacex')!;
const spacexKm = (spacex * px * 0.10922) / 1e6;

// All 21 million coins in Brent against Prudhoe Bay's lifetime output: about 13.2 billion barrels, 1977–2024
// (BP Prudhoe Bay Royalty Trust, 10-K for FY2024).
const all = 21_000_000;
const allBbl = all * P[close].brent_per_btc;
const prudhoePct = (allBbl / PRUDHOE_BARRELS) * 100;

// The US government's coins in silver against world mine output: about 26,000 t in 2025 (USGS).
const MINES_T = 26_000;
const govt = presetBtc('us-govt')!;
const govtT = (govt * P[close].xag_per_btc * OZ) / 1e6;
const govtMonths = (govtT / MINES_T) * 12;

const SLATE: Item[] = [
	{ id: 'spacex-cash-space', at: '2026-11-07T13:30:00Z', media: () => jpg(get('cash_p-spacex'), 'spacex-cash'),
		text: `SpaceX holds ${f0(spacex)} bitcoin.\n\nForget the rockets. Cash the coins out in $1 bills at ${closeWord}’s close and stack them straight up: ${f0(spacexKm)} km.\n\n${spacexKm >= KARMAN_KM ? 'That’s past the edge of space, no rocket needed.' : 'Not quite space: they’d still need a rocket.'}`,
		reply: `The edge of space is the Kármán line, 100 km up; the space station flies at about ${ISS_KM} km. Stack any amount:\n` + L('preset=spacex&commodity=cash') },
	{ id: 'all-btc-prudhoe', at: '2026-11-07T17:00:00Z', media: () => jpg(get('oil_p-market-cap'), 'all-oil'),
		text: `Prudhoe Bay is North America’s biggest oilfield. From 1977 to the end of 2024 it pumped about 13.2 billion barrels.\n\nAll 21 million bitcoin, swapped for Brent at ${closeWord}’s close: ${(allBbl / 1e9).toFixed(1)} billion barrels.\n\n${prudhoePct >= 100 ? 'More than the field’s whole output.' : 'Not quite the field’s whole output.'} Which is the bigger store of value?`,
		reply: `${prudhoePct.toFixed(0)}% of Prudhoe Bay’s output to the end of 2024 (BP Prudhoe Bay Royalty Trust), at $${P[close].brent_usd.toFixed(2)} a barrel. Weigh any stack in oil:\n` + L('preset=market-cap&commodity=oil') },
	{ id: 'govt-silver-mines', at: '2026-11-07T21:30:00Z', media: () => jpg(get('silver_p-us-govt'), 'govt-silver'),
		text: `The US government holds ${f0(govt)} bitcoin, mostly seized from criminals.\n\nIn silver at ${closeWord}’s close: ${f0(govtT)} tonnes.\n\nThe world’s mines would need about ${govtMonths.toFixed(0)} months to dig that up. A lot of silver, or not much bitcoin?`,
		reply: 'World mine output: about 26,000 t in 2025 (USGS). Weigh any holder in silver:\n' + L('preset=us-govt&commodity=silver') },
];

await run(SLATE, OUT, `Sat 7 Nov · close ${close} ($${f0(px)}), previous ${prev}`);
