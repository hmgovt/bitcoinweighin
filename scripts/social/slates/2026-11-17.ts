/**
 * Tue 17 Nov 2026: three posts, written to scripts/social/WRITING.md.
 * Satoshi's coins in gold against Fort Knox, a NEW video: El Salvador's
 * coins stacked in $1 bills and ridden up towards the edge of space, and the
 * US government's coins in silver weighed against the Eiffel Tower. Second
 * video of the week (Mon, Tue). Live figures. See lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, OZ, type Item } from './lib.ts';

const OUT = 'output/slates/2026-11-17';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// Satoshi's coins in gold against Fort Knox: 147,341,858 troy oz (US Treasury).
const KNOX_OZ = 147_341_858;
const satoshi = presetBtc('satoshi')!;
const satOz = satoshi * P[close].xau_per_btc;
const satT = (satOz * OZ) / 1e6;
const knoxPct = (satOz / KNOX_OZ) * 100;

// El Salvador's coins in $1 bills (0.10922 mm a note) against the Kármán line, 100 km.
// Quoted at the video's own close (15 Nov), so the text and the clip agree.
const VID = '2026-11-15';
const KARMAN_KM = 100;
const sv = presetBtc('el-salvador')!;
const svKm = (sv * P[VID].btc_usd * 0.10922) / 1e6;

// The US government's coins in silver against the Eiffel Tower: 10,100 t (SETE).
const EIFFEL_T = 10_100;
const govt = presetBtc('us-govt')!;
const govtT = (govt * P[close].xag_per_btc * OZ) / 1e6;

const SLATE: Item[] = [
	{ id: 'satoshi-gold-fort-knox', at: '2026-11-17T13:30:00Z', media: () => jpg(get('gold_p-satoshi'), 'satoshi-gold'),
		text: `Satoshi’s ${f0(satoshi)} bitcoin have sat untouched for over 15 years.\n\nSwapped for gold at ${closeWord}’s close: ${f0(satT)} tonnes.\n\nThat’s ${knoxPct.toFixed(0)}% of everything in Fort Knox. A forgotten stash, or America’s vault?`,
		reply: 'Fort Knox: 147,341,858 troy oz (US Treasury). Weigh any holder in gold:\n' + L('preset=satoshi&commodity=gold') },
	{ id: 'el-salvador-ride', at: '2026-11-17T17:00:00Z', media: () => 'scripts/social/media/ride-el-salvador.mp4',
		text: `El Salvador holds ${f0(sv)} bitcoin.\n\nWe changed them into $1 bills at ${weekday(VID)}’s close, stacked them in one column, and rode to the top.\n\nSpace starts at 100 km. Does a country’s bitcoin get there?`,
		reply: `${svKm.toFixed(1)} km: about ${f0(KARMAN_KM - svKm)} km short of the Kármán line. Every note true to scale, 0.11 mm thick. Ride it yourself:\n` + L('preset=el-salvador&commodity=cash&ride=play') },
	{ id: 'govt-silver-eiffel', at: '2026-11-17T21:30:00Z', media: () => jpg(get('silver_p-us-govt'), 'govt-silver'),
		text: `Most of Washington’s ${f0(govt)} bitcoin were seized in criminal cases.\n\nSwap them for silver at ${closeWord}’s close: ${f0(govtT)} tonnes of metal.\n\nThe Eiffel Tower weighs ${f0(EIFFEL_T)} tonnes. The silver is ${govtT >= EIFFEL_T ? `about ${(govtT / EIFFEL_T).toFixed(1)} times heavier` : `${((govtT / EIFFEL_T) * 100).toFixed(0)}% of that`}. Could you even move it?`,
		reply: 'Eiffel Tower: 10,100 t (Société d’Exploitation de la Tour Eiffel). Weigh any holder in silver:\n' + L('preset=us-govt&commodity=silver') },
];

await run(SLATE, OUT, `Tue 17 Nov · close ${close} ($${f0(px)}), previous ${prev}`);
