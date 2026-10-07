/**
 * Thu 8 Oct 2026: three posts, written to scripts/social/WRITING.md. One coin
 * in three elements (the new video: gold, silver, plutonium-238), the long
 * Manhattan cut (every coin mined, then the stacks one by one), and a
 * guess-first post on the US government's stack in $1 bills against the
 * Space Station. See lib.ts for how to run it.
 *
 * The two videos carry their own figures, at the 6 Oct close they were
 * rendered at, so their posts name that close; the third is live.
 */
import { L, f0, images, loadPrices, presetBtc, run, weekday, type Item } from './lib.ts';
import { LAND_VALUE_USD } from '../../../src/lib/manhattan.ts';

const OUT = 'output/slates/2026-10-08';
const { P, close, prev } = await loadPrices();
const { get, jpg } = images(OUT);
const closeWord = weekday(close);
const px = P[close].btc_usd;

// The US government's stack in $1 bills (a note is 0.10922 mm thick) against
// the Space Station, which orbits about 400 km up.
const govt = presetBtc('us-govt')!;
const stackKm = (govt * px * 0.10922) / 1e6;
const ISS_KM = 400;
const issTimes = stackKm / ISS_KM;

// Every coin mined so far against Manhattan's land, at the latest close (live,
// for the long cut's first reply; the video itself is at the 6 Oct close).
const mined = (P[close] as unknown as { btc_supply: number }).btc_supply;
const minedShare = (mined * px) / LAND_VALUE_USD;
const wholeAt = Math.round(LAND_VALUE_USD / mined / 100) * 100;
const minedLine = minedShare < 1
	? `At ${closeWord}’s close it’s ${Math.round(minedShare * 100)}%. At about $${f0(wholeAt)} a coin, it’s the whole island.`
	: `At ${closeWord}’s close it’s the whole island, with ${Math.round((minedShare - 1) * 100)}% to spare.`;

const SLATE: Item[] = [
	{ id: 'three-elements', at: '2026-10-08T13:30:00Z', media: () => 'scripts/social/media/metals-new-element.mp4',
		text: `One bitcoin buys 44 kg of silver.\n\nOr 638 g of gold.\n\nOr 17 g of plutonium-238, the fuel that has powered Voyager since 1977.\n\nSame coin, at Tuesday’s close. Which would you take home?`,
		reply: 'The plutonium price is illustrative (DOE and NASA estimates). Weigh any amount in all three:\n' + L('btc=1&commodity=pu238') },
	{ id: 'manhattan-long', at: '2026-10-08T17:00:00Z', media: () => 'scripts/social/media/manhattan-long.mp4',
		text: `Every bitcoin ever mined would buy 98% of Manhattan.\n\nSaylor calls bitcoin “cyber Manhattan,” so we raced the biggest stacks up the real island: the 2010 pizza coins, the US government, BlackRock, Strategy and Satoshi.\n\nWho gets furthest? Guess, then watch.`,
		reply: `${minedLine} (2014 land value, illustrative.)\n\nReply with your stack and we’ll say how far it gets:\n` + L('btc=1&commodity=manhattan') },
	{ id: 'govt-iss', at: '2026-10-08T21:30:00Z', media: () => jpg(get('cash_p-us-govt'), 'govt-iss'),
		text: `The US government holds ${f0(govt)} bitcoin.\n\nStacked in $1 bills at ${closeWord}’s close, would it reach the Space Station?\n\nGuess before you look.`,
		reply: issTimes >= 1
			? `${f0(stackKm)} km tall. The Space Station orbits about ${ISS_KM} km up, so the stack is about ${issTimes.toFixed(1)} times as high. Stack any amount:\n` + L('preset=us-govt&commodity=cash')
			: `${f0(stackKm)} km tall: short of the Space Station, which orbits about ${ISS_KM} km up. Stack any amount:\n` + L('preset=us-govt&commodity=cash') },
];

await run(SLATE, OUT, `Thu 8 Oct · close ${close} ($${f0(px)}), previous ${prev}`);
