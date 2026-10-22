/**
 * Fri 23 Oct 2026: three posts, written to scripts/social/WRITING.md. El
 * Salvador's coins in plutonium-238 counted in Voyagers (guess first), the long
 * "cyber Manhattan" cut with new lines, and the biggest bitcoin ETF against the
 * biggest gold ETF (tribal). Live figures. See lib.ts for how to run it.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, type Item } from './lib.ts';
import { OG_COMMODITIES, computeAmount } from '../../../functions/_lib.ts';

const OUT = 'output/slates/2026-10-23';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// El Salvador's coins in Pu-238 (illustrative price) against Voyager 1's three RTGs, about 4.5 kg
// of Pu-238 each (MHW-RTG): about 13.5 kg at launch.
const sv = presetBtc('el-salvador')!;
const svPuKg = (computeAmount(sv, OG_COMMODITIES.pu238, { btc: px, xau: P[close].xau_usd, xag: P[close].xag_usd }) ?? 0) * (OG_COMMODITIES.pu238.unitMassGrams ?? 1) / 1000;
const VOYAGER_KG = 13.5;
const voyagers = svPuKg / VOYAGER_KG;

// Every coin mined so far against Manhattan, live (the video is at the 6 Oct close).
import { LAND_VALUE_USD } from '../../../src/lib/manhattan.ts';
const mined = (P[close] as unknown as { btc_supply: number }).btc_supply;
const minedPct = Math.round(((mined * px) / LAND_VALUE_USD) * 100);

// BlackRock's bitcoin ETF in gold against the SPDR Gold Trust: 32,314,228 oz on 30 June 2026 (its 10-Q).
const ibit = presetBtc('blackrock-ibit')!;
const ibitOz = ibit * P[close].xau_per_btc;
const GLD_OZ = 32_314_228;

const SLATE: Item[] = [
	{ id: 'el-salvador-voyagers', at: '2026-10-23T13:30:00Z', media: () => jpg(get('pu238_p-el-salvador'), 'el-salvador-pu238'),
		text: `Voyager 1 has flown for 49 years on three nuclear batteries holding about 13.5 kg of plutonium-238.\n\nEl Salvador holds ${f0(sv)} bitcoin. Swapped for plutonium-238 at ${closeWord}’s close, how many Voyagers could it fuel?\n\nGuess first.`,
		reply: `About ${Math.round(voyagers)}: ${f0(svPuKg)} kg. The price is illustrative (DOE and NASA estimates): there’s no open market. Weigh any stack:\n` + L('preset=el-salvador&commodity=pu238') },
	{ id: 'cyber-manhattan-lines', at: '2026-10-23T17:00:00Z', media: () => 'scripts/social/media/manhattan-long.mp4',
		text: `The 2010 pizza coins buy a whole Midtown block.\n\nThe US government’s bitcoin reaches Wall Street.\n\nSatoshi’s gets to Chambers Street.\n\nWe spent the biggest stacks on Manhattan, lot by lot. Who gets furthest?`,
		reply: `The video is at the 6 Oct close. At ${closeWord}’s, every coin mined so far buys ${minedPct}% of the island (2014 land value, illustrative). Try any stack:\n` + L('btc=1&commodity=manhattan') },
	{ id: 'ibit-vs-gld', at: '2026-10-23T21:30:00Z', media: () => jpg(get('gold_p-blackrock-ibit'), 'ibit-gold'),
		text: `The biggest gold ETF, SPDR Gold Shares, held ${(GLD_OZ / 1e6).toFixed(1)} million oz of gold at the end of June.\n\nThe biggest bitcoin ETF, BlackRock’s, holds ${f0(ibit)} coins: ${(ibitOz / 1e6).toFixed(1)} million oz of gold at ${closeWord}’s close.\n\nThat’s ${Math.round((ibitOz / GLD_OZ) * 100)}% of the way there. When does it pass?`,
		reply: 'GLD holdings: its 10-Q, 30 June 2026. Weigh any stack in gold:\n' + L('preset=blackrock-ibit&commodity=gold') },
];

await run(SLATE, OUT, `Fri 23 Oct · close ${close} ($${f0(px)}), previous ${prev}`);
