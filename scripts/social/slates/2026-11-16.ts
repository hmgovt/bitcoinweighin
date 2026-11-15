/**
 * Mon 16 Nov 2026: three posts, written to scripts/social/WRITING.md.
 * El Salvador's coins in silver shared out per citizen, a NEW video:
 * BlackRock's bitcoin ETF stacked in $1 bills and ridden up past the Space
 * Station, and the US government's seized coins in gold against America's
 * official gold. First video of the week. Live figures. See lib.ts for how
 * to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, OZ, type Item } from './lib.ts';

const OUT = 'output/slates/2026-11-16';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// El Salvador's coins in silver, per resident: 6,029,976 people (2024 census, BCR).
const POP = 6_029_976;
const sv = presetBtc('el-salvador')!;
const svOz = sv * P[close].xag_per_btc;
const svT = (svOz * OZ) / 1e6;
const gEach = (svOz * OZ) / POP;

// BlackRock's ETF coins in $1 bills (0.10922 mm a note) against the ISS, about 408 km up.
// Quoted at the video's own close (14 Nov), so the text and the clip agree.
const VID = '2026-11-14';
const ISS_KM = 408;
const ibit = presetBtc('blackrock-ibit')!;
const ibitKm = (ibit * P[VID].btc_usd * 0.10922) / 1e6;

// The US government's coins in gold against US official gold: 8,133.5 t (World Gold Council).
const US_GOLD_T = 8133.5;
const govt = presetBtc('us-govt')!;
const govtT = (govt * P[close].xau_per_btc * OZ) / 1e6;
const govtPct = (govtT / US_GOLD_T) * 100;

const SLATE: Item[] = [
	{ id: 'el-salvador-silver-per-person', at: '2026-11-16T13:30:00Z', media: () => jpg(get('silver_p-el-salvador'), 'el-salvador-silver'),
		text: `El Salvador holds ${f0(sv)} bitcoin.\n\nSwapped for silver at ${closeWord}’s close: ${f0(svT)} tonnes.\n\nShared out among its ${(POP / 1e6).toFixed(2)} million people, that’s about ${f0(gEach)} grams each: ${(gEach / OZ).toFixed(1)} troy ounces. A national treasure, or pocket change?`,
		reply: 'Population: 6,029,976 (2024 census, Banco Central de Reserva). Weigh any holder in silver:\n' + L('preset=el-salvador&commodity=silver') },
	{ id: 'ibit-ride-video', at: '2026-11-16T17:00:00Z', media: () => 'scripts/social/media/ride-blackrock-ibit.mp4',
		text: `BlackRock’s bitcoin ETF holds ${f0(ibit)} coins.\n\nWe changed them into $1 bills at ${weekday(VID)}’s close, stacked them in one column, and rode to the top.\n\n${f0(ibitKm)} km up (${f0(ibitKm / 1.609344)} miles): about ${(ibitKm / ISS_KM).toFixed(0)} times higher than the Space Station.`,
		reply: 'Every note true to scale, 0.11 mm thick; the ISS orbits about 408 km up. Ride it yourself:\n' + L('preset=blackrock-ibit&commodity=cash&ride=play') },
	{ id: 'govt-gold-vs-us-gold', at: '2026-11-16T21:30:00Z', media: () => jpg(get('gold_p-us-govt'), 'govt-gold'),
		text: `Washington owns two reserves: 8,133 tonnes of gold, and ${f0(govt)} bitcoin, mostly seized from criminals.\n\nSwap the coins for gold at ${closeWord}’s close: ${f0(govtT)} tonnes.\n\nThe nation’s gold pile would grow by ${govtPct.toFixed(1)}%. Sell the coins, or keep them?`,
		reply: 'US official gold: 8,133.5 t (World Gold Council). Weigh any holder in gold:\n' + L('preset=us-govt&commodity=gold') },
];

await run(SLATE, OUT, `Mon 16 Nov · close ${close} ($${f0(px)}), previous ${prev}`);
