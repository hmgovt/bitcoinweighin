/**
 * Tue 20 Oct 2026: three posts, written to scripts/social/WRITING.md. Satoshi's
 * coins as one cube of plutonium-238 (guess first), the inside-a-miner video with
 * a new opening, and one coin in silver at silver's peak against today (tribal).
 * Live figures. See lib.ts for how to run it.
 */
import { L, SITE, f0, images, loadPrices, presetBtc, run, weekday, type Item } from './lib.ts';
import { OG_COMMODITIES, computeAmount } from '../../../functions/_lib.ts';

const OUT = 'output/slates/2026-10-20';
const { P, close, prev, card } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;
const UTM = 'utm_source=x&utm_medium=first_reply&utm_campaign=launch';
const nice = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });

// Satoshi's coins in Pu-238 (illustrative price), as one cube: the card's own size line.
const sat = presetBtc('satoshi')!;
const puKg = (computeAmount(sat, OG_COMMODITIES.pu238, { btc: px, xau: P[close].xau_usd, xag: P[close].xag_usd }) ?? 0) * (OG_COMMODITIES.pu238.unitMassGrams ?? 1) / 1000;
const cube = card('pu238', sat, 'satoshi').subs[0].replace(/^A cube /, '').replace(/\.$/, '');

// Silver's highest close in the past year, and one coin in silver then and now.
const yearAgo = new Date(Date.parse(close + 'T00:00:00Z') - 365 * 864e5).toISOString().slice(0, 10);
const peak = Object.keys(P).filter((d) => d >= yearAgo && d <= close && P[d].xag_usd).reduce((a, b) => (P[b].xag_usd > P[a].xag_usd ? b : a));
const pct = (a: number, b: number) => Math.round((1 - b / a) * 100);

const SLATE: Item[] = [
	{ id: 'satoshi-plutonium-cube', at: '2026-10-20T13:30:00Z', media: () => jpg(get('pu238_p-satoshi'), 'satoshi-pu238'),
		text: `Satoshi’s ${f0(sat)} bitcoin, swapped for plutonium-238: the fuel that keeps NASA’s deep-space probes alive.\n\nCast it as one cube.\n\nHow wide is it? Guess first.`,
		reply: `${cube[0].toUpperCase()}${cube.slice(1)}: ${(puKg / 1000).toFixed(1)} tonnes at ${closeWord}’s close. The price is illustrative (DOE and NASA estimates): there’s no open market. Weigh any stack:\n` + L('preset=satoshi&commodity=pu238') },
	{ id: 'mining-dive-third', at: '2026-10-20T17:00:00Z', media: () => 'scripts/social/media/mining-dive.mp4',
		text: `Bitcoin mining, with no charts and no jargon.\n\nWe opened a real miner, went inside one chip, and followed the exact guess that won a real block.\n\n19 seconds. Did you know it was this physical?`,
		reply: `Take the chip apart yourself, round by round:\n${SITE}/mining?${UTM}` },
	{ id: 'silver-peak-vs-now', at: '2026-10-20T21:30:00Z', media: () => jpg(get('silver_b-1'), 'one-coin-silver'),
		text: `On ${nice(peak)}, silver’s high of the past year, one bitcoin bought ${f0(P[peak].xag_per_btc)} oz of silver.\n\nAt ${closeWord}’s close: ${f0(P[close].xag_per_btc)} oz.\n\nSince then bitcoin is down ${pct(P[peak].btc_usd, px)}% in dollars. Silver is down ${pct(P[peak].xag_usd, P[close].xag_usd)}%.\n\nSilver bugs: buying the dip, or done?`,
		reply: 'Slide the date back yourself:\n' + L('btc=1&commodity=silver') },
];

await run(SLATE, OUT, `Tue 20 Oct · close ${close} ($${f0(px)}), previous ${prev}`);
