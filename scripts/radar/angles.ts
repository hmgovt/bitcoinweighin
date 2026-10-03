/**
 * angles.ts — match a big account's post to one of our comparisons, and draft
 * a short reply with today's figures and a link whose card shows the picture.
 *
 * Replies are drafts for a person to read and send; nothing here posts.
 * Rules: one fact, plain words, no hashtags, under ~220 characters before the
 * link. A post that matches nothing gets no draft (the radar stays quiet).
 */
import { L, OZ, f0, loadPrices, presetBtc, sig3 } from '../social/slates/lib.ts';
import type { Post } from './api.ts';

export interface Draft { angle: string; text: string }

let live: Awaited<ReturnType<typeof loadPrices>> | null = null;
async function prices() { return (live ??= await loadPrices()); }

const NOTE_M = 0.10922e-3, MOON_M = 384_400_000, PEAK = '2024-12-17';
const has = (t: string, re: RegExp) => re.test(t);
const BTC = /\b(bitcoin|btc|sats?|satoshi)\b|₿/i;

type Rule = { angle: string; when: (t: string, group: string, author: string) => boolean; draft: (t: string) => Promise<string> };

const RULES: Rule[] = [
	{
		angle: 'El Salvador in silver',
		when: (t) => has(t, /\b(el salvador|bukele)\b/i),
		async draft() {
			const { card } = await prices();
			const m = card('silver', presetBtc('el-salvador')!, 'el-salvador');
			return `El Salvador’s ${f0(presetBtc('el-salvador')!)} BTC, weighed in silver: ${m.big}${m.unit}. ${m.subs[0]}\n${L('preset=el-salvador&commodity=silver')}`;
		},
	},
	{
		angle: 'Strategy in Manhattan',
		when: (t, _g, a) => has(t, /\b(strategy|mstr|saylor)\b/i) || ['saylor', 'strategy'].includes(a),
		async draft() {
			const { card } = await prices();
			const btc = presetBtc('strategy')!;
			const m = card('manhattan', btc, 'strategy');
			return `Strategy’s ${f0(btc)} BTC would buy ${m.big}${m.unit} of Manhattan’s land, lot by lot: ${m.subs[0].replace(/\.$/, '')}.\n${L('preset=strategy&commodity=manhattan')}`;
		},
	},
	{
		angle: 'BlackRock’s ETF in gold',
		when: (t) => has(t, /\b(ibit|blackrock|etf|etfs|inflows?|outflows?)\b/i),
		async draft() {
			const { card } = await prices();
			const btc = presetBtc('blackrock-ibit')!;
			const m = card('gold', btc, 'blackrock-ibit');
			return `BlackRock’s ETF holds ${f0(btc)} BTC. In gold that’s ${m.big}${m.unit}: ${m.subs.join(' ').replace('A cube', 'a cube').replace(/\.$/, '')}.\n${L('preset=blackrock-ibit&commodity=gold')}`;
		},
	},
	{
		angle: 'Satoshi’s stack',
		when: (t) => has(t, /\bsatoshi\b/i) && !has(t, /\bsats?\b/i),
		async draft() {
			const { P, close } = await prices();
			const km = (presetBtc('satoshi')! * P[close].btc_usd * NOTE_M) / 1000;
			return `Satoshi’s 1.1 million coins, stacked as $1 bills, would reach ${f0(km)} km up. The Space Station orbits at about 400.\n${L('preset=satoshi&commodity=cash&ride=play')}`;
		},
	},
	{
		angle: 'Gold, both ways',
		when: (t, g) => has(t, /\bgold\b/i) && (BTC.test(t) || g === 'gold-macro'),
		async draft() {
			const { P, close, card } = await prices();
			const g = P[close].xau_per_btc;
			return `Today 1 BTC buys ${g.toFixed(1)} oz of gold: ${card('gold', 1).subs[0].replace('A cube', 'a cube').replace(/\.$/, '')}. At the Dec 2024 peak it bought ${P[PEAK].xau_per_btc.toFixed(1)} oz. We weigh it both ways, every day since 2013.\n${L('btc=1&commodity=gold')}`;
		},
	},
	{
		angle: 'Silver',
		when: (t) => has(t, /\bsilver\b/i) && BTC.test(t),
		async draft() {
			const { P, close, card } = await prices();
			const oz = P[close].xag_per_btc;
			return `1 BTC buys ${f0(oz)} oz of silver today: ${sig3((oz * OZ) / 1000)} kg, ${card('silver', 1).subs[0].replace('A cube', 'a cube').replace(/\.$/, '')}.\n${L('btc=1&commodity=silver')}`;
		},
	},
	{
		angle: 'Pizza day',
		when: (t) => has(t, /\bpizza/i) && BTC.test(t),
		async draft() {
			const { card } = await prices();
			const m = card('manhattan', 10000, 'pizza-day');
			return `Those 10,000 pizza coins would buy ${m.big}${m.unit} of Manhattan land today.\n${L('preset=pizza-day&commodity=manhattan')}`;
		},
	},
	{
		angle: 'Price milestone: the Moon stack',
		when: (t) => BTC.test(t) && has(t, /(all[- ]time high|\bath\b|\$\d{2,3}(,\d{3}|k)\b|\b\d{2,3}k\b|new high|breaks? (above|below)|price)/i),
		async draft(t) {
			const { P, close } = await prices();
			// The price the post names ($90,000, 90k), else the latest close.
			const m = t.match(/\$\s?(\d{2,3})(?:,(\d{3})|\s?k\b)|\b(\d{2,3})k\b/i);
			const named = m ? Number(m[1] ?? m[3]) * 1000 + (m[2] ? Number(m[2]) : 0) : 0;
			const px = named >= 10_000 && named <= 999_000 ? named : P[close].btc_usd;
			const pct = ((px * 21e6 * NOTE_M) / MOON_M) * 100;
			return `At $${f0(px)} a coin, all 21 million bitcoin stacked as $1 bills would reach ${pct.toFixed(1)}% of the way to the Moon. At $${f0(MOON_M / NOTE_M / 21e6)}, they arrive.\n${L('preset=market-cap&commodity=cash&ride=play')}`;
		},
	},
];

/** Worth a reply at all: about bitcoin, or gold from the gold crowd, or anything from the holders (often just a chart or a ₿). */
export const onTopic = (t: string, group: string) => BTC.test(t) || group === 'holders' || (group === 'gold-macro' && /\bgold\b/i.test(t));

export async function draftReply(p: Post, group: string): Promise<Draft | null> {
	const t = p.text;
	if (!onTopic(t, group)) return null;
	const author = p.author.userName.toLowerCase();
	for (const r of RULES) if (r.when(t, group, author)) return { angle: r.angle, text: await r.draft(t) };
	return null;
}
