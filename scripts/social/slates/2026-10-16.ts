/**
 * Fri 16 Oct 2026: three posts, written to scripts/social/WRITING.md. One coin in
 * gold on this date across the years (tribal: both sides get their year), El
 * Salvador's coins in silver against truckloads (guess first), and Satoshi's
 * coins in $1 bills drilled toward the centre of the Earth (guess first). Live
 * figures. See lib.ts for how to run it.
 */
import { execFileSync } from 'node:child_process';
import { L, SITE, f0, images, loadPrices, presetBtc, run, weekday, OZ, type Item } from './lib.ts';

const OUT = 'output/slates/2026-10-16';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// One coin in gold on this month and day, every few years since 2013 (the latest row on or before it).
const md = close.slice(5);
const onOrBefore = (d: string) => Object.keys(P).filter((k) => k <= d && P[k].xau_per_btc).sort().pop()!;
const YEARS = [2013, 2017, 2021, 2022];
const rows = YEARS.map((y) => onOrBefore(`${y}-${md}`));
const oz = (d: string) => P[d].xau_per_btc;
const ozText = (v: number) => (v < 1 ? `${v.toFixed(2)} oz` : `${v.toFixed(1)} oz`);
const dayLabel = new Date(close + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const times = Math.round(oz(close) / oz(rows[0]));

// El Salvador's coins in silver against a US truckload (80,000 lb gross, about 20 t of cargo).
const sv = presetBtc('el-salvador')!;
const svT = (sv * P[close].xag_per_btc * OZ) / 1e6;
const TRUCK_T = 20;
const svGoldT = (sv * P[close].xau_per_btc * OZ) / 1e6;

// Satoshi's coins in $1 bills (0.10922 mm a note) against the Earth's mean radius, 6,371 km.
const sat = presetBtc('satoshi')!;
const satKm = (sat * px * 0.10922) / 1e6;
const EARTH_R = 6371;

/** The first year's card, rendered here (the site doesn't pre-render it), above today's. */
const thenAndNow = (): string => {
	const then = `${OUT}/gold-then.png`;
	execFileSync('curl', ['-sfS', '--max-time', '60', '-o', `${OUT}/card-prices.json`, `${SITE}/prices.json`]);
	execFileSync('npx', ['tsx', 'scripts/og/render-card.ts', `${then}|btc=1&commodity=gold&date=${rows[0]}`], { env: { ...process.env, PRICES: `${OUT}/card-prices.json` } });
	const file = `${OUT}/gold-then-now.jpg`;
	execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', then, '-i', get('gold_b-1'), '-filter_complex', '[0][1]vstack=inputs=2', '-q:v', '2', file]);
	return file;
};

const SLATE: Item[] = [
	{ id: 'gold-this-date', at: '2026-10-16T13:30:00Z', media: thenAndNow,
		text: `One bitcoin, weighed in gold, on ${dayLabel}:\n\n${rows.map((d, i) => `${YEARS[i]}: ${ozText(oz(d))}`).join('\n')}\n2026: ${ozText(oz(close))}\n\n${times}× in ${2026 - YEARS[0]} years, and it more than halved along the way. Which year proves your point?`,
		reply: 'Slide the date back to 2013 yourself:\n' + L('btc=1&commodity=gold') },
	{ id: 'el-salvador-silver-trucks', at: '2026-10-16T17:00:00Z', media: () => jpg(get('silver_p-el-salvador'), 'el-salvador-silver'),
		text: `El Salvador holds ${f0(sv)} bitcoin.\n\nSwap it all for silver bars and load them onto trucks, about ${TRUCK_T} tonnes each.\n\nHow many trucks? Guess first.`,
		reply: `${Math.ceil(svT / TRUCK_T)}: ${f0(svT)} tonnes of silver at ${closeWord}’s close. In gold it’s ${svGoldT.toFixed(1)} t: ${Math.ceil(svGoldT / TRUCK_T) === 1 ? 'one truck' : `${Math.ceil(svGoldT / TRUCK_T)} trucks`}. Weigh any country’s stack:\n` + L('preset=el-salvador&commodity=silver') },
	{ id: 'satoshi-earth-core', at: '2026-10-16T21:30:00Z', media: () => jpg(get('cash_p-satoshi'), 'satoshi-cash'),
		text: `Satoshi’s ${f0(sat)} bitcoin, changed into $1 bills.\n\nStack them straight down into the ground.\n\nDo they reach the centre of the Earth? Guess first.`,
		reply: (satKm >= EARTH_R
			? `Yes, and past it: ${f0(satKm)} km of bills at ${closeWord}’s close. The centre is ${f0(EARTH_R)} km down. `
			: `No: ${f0(satKm)} km of bills at ${closeWord}’s close. The centre is ${f0(EARTH_R)} km down. `) + 'Stack any amount:\n' + L('preset=satoshi&commodity=cash') },
];

await run(SLATE, OUT, `Fri 16 Oct · close ${close} ($${f0(px)}), previous ${prev}`);
