/**
 * sweep.ts — the live radar's every-15-minutes pass (.github/workflows/radar.yml).
 *
 * 1. Asks TwitterAPI.io's search for every original post from the watchlist
 *    since the last sweep (paying only for new posts).
 * 2. Keeps the on-topic ones as "pending" and, once each is 10+ minutes old,
 *    re-reads its counts. A post that took off (heat ≥ minHeat, enough likes)
 *    becomes a candidate, within the daily caps; one that hasn't by 45
 *    minutes is dropped.
 * 3. Writes each candidate with its fact sheet and a template fallback reply
 *    to output/radar/candidates.json, for Claude to draft and alert.ts to send.
 *
 *   NODE_USE_ENV_PROXY=1 npx tsx scripts/radar/sweep.ts
 *   … --fixture=tests/fixtures/radar-posts.json --now=2026-10-02T13:50:00Z   # offline, no API calls
 *
 * State lives in .radar-state/state.json (kept between runs by the workflow's
 * cache). Needs TWITTERAPI_IO_KEY unless --fixture is given.
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { draftReply, onTopic } from './angles.ts';
import { costLine, handlesOf, heat, hm, isOriginal, loadWatchlist, localDay, localMinutes, postsByIds, postsSince, type Post } from './api.ts';
import { dailyFacts, datedFacts, postFacts } from './facts.ts';

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const STATE = arg('state') ?? '.radar-state/state.json';
const OUT = arg('out') ?? 'output/radar';
const fixture = arg('fixture');

export interface State {
	lastSweepSec?: number;
	pending: Record<string, { author: string; group: string; createdAt: string }>;
	alerted: Record<string, number>;
	days: Record<string, { count: number; accounts: string[] }>;
	recentReplies: { text: string; at: number }[];
}
export interface Candidate {
	id: string; url: string; author: string; followers: number; group: string; createdAt: string; ageMinutes: number;
	text: string; likes: number; reposts: number; replies: number; quotes: number; views: number; heat: number;
	facts: string[]; links: Record<string, string>;
	fallback: { angle: string; text: string } | null;
}

export function loadState(path = STATE): State {
	const empty: State = { pending: {}, alerted: {}, days: {}, recentReplies: [] };
	try { return { ...empty, ...JSON.parse(readFileSync(path, 'utf8')) }; } catch { return empty; }
}
export function saveState(s: State, path = STATE) {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, JSON.stringify(s, null, '\t'));
}

function output(name: string, value: string | number) {
	if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

async function main() {
	const wl = await loadWatchlist();
	const now = arg('now') ? Date.parse(arg('now')!) : Date.now();
	const nowSec = Math.floor(now / 1000);
	const tz = wl.hours.tz;
	const lm = localMinutes(new Date(now), tz);
	const from = hm(wl.hours.from), to = hm(wl.hours.to);
	const { recheckAfterMinutes, giveUpAfterMinutes, minHeat, minLikes, maxDraftsPerRun } = wl.sweep;
	mkdirSync(OUT, { recursive: true });
	writeFileSync(`${OUT}/candidates.json`, JSON.stringify({ candidates: [] }));
	output('candidates', 0);

	// Outside the waking window (plus time to finish weighing its last posts), do nothing.
	if (lm < from || lm > to + giveUpAfterMinutes) { console.log('Outside the window; nothing to do.'); return; }

	const state = loadState();
	const handles = handlesOf(wl);
	const groupOf = new Map(handles.map(({ h, group }) => [h.toLowerCase(), group]));
	const fx: Post[] | null = fixture ? (JSON.parse(readFileSync(fixture, 'utf8')) as { posts: Post[] }).posts : null;

	// 1. New posts since the last sweep (a minute's overlap). First run, or after a gap:
	// only as far back as a post could still be weighed.
	const since = Math.max(state.lastSweepSec ? state.lastSweepSec - 60 : 0, nowSec - giveUpAfterMinutes * 60);
	const fresh = fx
		? fx.filter((p) => { const t = Date.parse(p.createdAt) / 1000; return t >= since && t <= nowSec; })
		: lm <= to ? await postsSince(handles.map((x) => x.h), since, nowSec) : [];
	let added = 0;
	for (const p of fresh.filter(isOriginal)) {
		const author = p.author.userName.toLowerCase();
		const group = groupOf.get(author);
		if (!group || state.pending[p.id] || state.alerted[p.id]) continue;
		const plm = localMinutes(new Date(p.createdAt), tz);
		if (plm < from || plm > to || !onTopic(p.text, group)) continue;
		state.pending[p.id] = { author, group, createdAt: p.createdAt };
		added++;
	}
	state.lastSweepSec = nowSec;

	// 2. Weigh the pending posts that are old enough; drop the stale ones.
	const age = (createdAt: string) => (now - Date.parse(createdAt)) / 60_000;
	for (const [id, p] of Object.entries(state.pending)) if (age(p.createdAt) > giveUpAfterMinutes) delete state.pending[id];
	const due = Object.entries(state.pending).filter(([, p]) => age(p.createdAt) >= recheckAfterMinutes).map(([id]) => id);
	const current = due.length ? (fx ? fx.filter((p) => due.includes(p.id)) : await postsByIds(due)) : [];

	const today = localDay(new Date(now), tz);
	const day = (state.days[today] ??= { count: 0, accounts: [] });
	const prio = new Set(wl.priority.map((a) => a.toLowerCase()));
	const hot = current
		.map((p) => ({ p, h: heat(p, now), meta: state.pending[p.id] }))
		.filter(({ p, h, meta }) => meta && isHot(h, p.likeCount, prio.has(meta.author), minHeat, minLikes))
		.sort((a, b) => rank(b.h, prio.has(b.meta.author)) - rank(a.h, prio.has(a.meta.author)));

	const facts = await dailyFacts();
	const candidates: Candidate[] = [];
	for (const { p, h, meta } of hot) {
		if (candidates.length >= maxDraftsPerRun || day.count >= wl.limits.perDay) break;
		if (day.accounts.filter((a) => a === meta.author).length >= wl.limits.perAccountPerDay) continue;
		const fallback = await draftReply(p, meta.group);
		candidates.push({
			id: p.id, url: p.url, author: p.author.userName, followers: p.author.followers, group: meta.group, createdAt: p.createdAt,
			ageMinutes: Math.round(age(p.createdAt)), text: p.text,
			likes: p.likeCount, reposts: p.retweetCount, replies: p.replyCount, quotes: p.quoteCount, views: p.viewCount, heat: Number(h.toFixed(2)),
			facts: [...facts.lines, ...postFacts(p.text), ...(await datedFacts(p.text))], links: facts.links,
			fallback: fallback && { angle: fallback.angle, text: fallback.text },
		});
		// Claim it now so a failed alert never sends it twice.
		day.count++;
		day.accounts.push(meta.author);
		state.alerted[p.id] = nowSec;
		delete state.pending[p.id];
	}

	// Forget what's over a week old.
	for (const [id, t] of Object.entries(state.alerted)) if (nowSec - t > 7 * 86400) delete state.alerted[id];
	for (const d of Object.keys(state.days)) if (d < localDay(new Date(now - 7 * 86_400_000), tz)) delete state.days[d];
	state.recentReplies = state.recentReplies.filter((r) => nowSec - r.at < 7 * 86400);

	saveState(state);
	writeFileSync(`${OUT}/candidates.json`, JSON.stringify({ generatedAt: new Date(now).toISOString(), candidates }, null, '\t'));
	output('candidates', candidates.length);
	console.log(`${fresh.length} new posts, ${added} on topic; ${due.length} weighed, ${hot.length} hot, ${candidates.length} to draft. ${Object.keys(state.pending).length} still pending. Today: ${day.count}/${wl.limits.perDay}.`);
	if (!fx) console.log(costLine());
}

/**
 * Priority accounts (watchlist.json `priority`) count as taking off at half the
 * usual heat, and rank ahead of everyone else at the same heat.
 */
export function isHot(heat: number, likes: number, priority: boolean, minHeat: number, minLikes: number): boolean {
	return heat >= minHeat * (priority ? 0.5 : 1) && likes >= minLikes;
}
export function rank(heat: number, priority: boolean): number {
	return heat * (priority ? 2 : 1);
}

if (process.argv[1]?.endsWith('sweep.ts')) main().catch((e) => { console.error(e); process.exit(1); });
