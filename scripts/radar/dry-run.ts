/**
 * dry-run.ts — what the reply radar would have flagged over the last N hours.
 *
 * Reads each watchlist account's recent posts from TwitterAPI.io, keeps the
 * ones posted inside the waking window that took off fast, matches each to one
 * of our angles, drafts a reply with live figures, and prints the list (and,
 * with --discord, posts it as one digest to DISCORD_WEBHOOK_URL).
 *
 *   NODE_USE_ENV_PROXY=1 npx tsx scripts/radar/dry-run.ts [--hours=24] [--discord] [--verify]
 *
 * --verify only checks the handles exist and prints their follower counts.
 * Needs TWITTERAPI_IO_KEY (and DISCORD_WEBHOOK_URL for --discord).
 */
import { readFile } from 'node:fs/promises';
import { draftReply, type Draft } from './angles.ts';

const API = 'https://api.twitterapi.io/twitter';
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const hours = Number(arg('hours') ?? 24);

interface Watchlist { hours: { tz: string; from: string; to: string }; limits: { perAccountPerDay: number; perDay: number; maxPostAgeMinutes: number }; groups: Record<string, { angle: string; accounts: string[] }>; priority: string[] }
export interface Post {
	id: string; url: string; text: string; createdAt: string;
	likeCount: number; retweetCount: number; replyCount: number; quoteCount: number; viewCount: number;
	isReply?: boolean; author: { userName: string; name?: string; followers: number };
}

// TwitterAPI.io's free tier allows one request every 5 seconds.
const GAP_MS = Number(process.env.TWITTERAPI_IO_GAP_MS ?? 5200);
let lastCall = 0;
export let requests = 0;
let returned = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api<T>(path: string, retried = false): Promise<T> {
	const key = process.env.TWITTERAPI_IO_KEY;
	if (!key) throw new Error('TWITTERAPI_IO_KEY is not set');
	const wait = lastCall + GAP_MS - Date.now();
	if (wait > 0) await sleep(wait);
	lastCall = Date.now();
	requests++;
	const res = await fetch(`${API}${path}`, { headers: { 'x-api-key': key } });
	if (res.status === 429 && !retried) { await sleep(GAP_MS); return api<T>(path, true); }
	const body = (await res.json().catch(() => ({}))) as T & { status?: string; msg?: string; message?: string };
	if (!res.ok || body.status === 'error') throw new Error(`${path}: ${res.status} ${body.msg ?? body.message ?? ''}`);
	return body;
}

/** Recent original posts (no replies, no reposts) for an account. */
async function recentPosts(userName: string): Promise<Post[]> {
	type R = { data?: { tweets?: Post[] }; tweets?: Post[] };
	const r = await api<R>(`/user/last_tweets?userName=${encodeURIComponent(userName)}&includeReplies=false`);
	const tweets = r.data?.tweets ?? r.tweets ?? [];
	returned += tweets.length;
	return tweets.filter((t) => !t.isReply && !/^RT @/.test(t.text));
}

/** Minutes since midnight in the watchlist's time zone. */
function localMinutes(d: Date, tz: string): number {
	const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(d).split(':').map(Number);
	return h * 60 + m;
}
const hm = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

/**
 * How hard a post took off, relative to its author's size: engagement per
 * thousand followers, with replies and reposts weighted over likes.
 * (A dry run sees final counts; live, the radar measures this in the first
 * 10–20 minutes.)
 */
function heat(p: Post): number {
	const e = p.likeCount + 3 * p.retweetCount + 2 * p.replyCount + 3 * p.quoteCount;
	return e / Math.max(1, p.author.followers / 1000);
}

async function main() {
	const wl = JSON.parse(await readFile('scripts/radar/watchlist.json', 'utf8')) as Watchlist;
	const handles = Object.entries(wl.groups).flatMap(([group, g]) => g.accounts.map((h) => ({ h, group })));

	if (process.argv.includes('--verify')) {
		for (const { h, group } of handles) {
			try {
				const r = await api<{ data?: { userName: string; name: string; followers: number } }>(`/user/info?userName=${h}`);
				console.log(`${r.data ? '✓' : '✗'} ${group.padEnd(11)} @${h.padEnd(16)} ${r.data ? `${(r.data.followers / 1000).toFixed(0)}k  ${r.data.name}` : 'not found'}`);
			} catch (e) {
				console.log(`✗ ${group.padEnd(11)} @${h.padEnd(16)} ${(e as Error).message}`);
			}
		}
		return;
	}

	const since = Date.now() - hours * 3600_000;
	const from = hm(wl.hours.from), to = hm(wl.hours.to);
	const candidates: { p: Post; group: string; heat: number; draft: Draft | null }[] = [];
	for (const { h, group } of handles) {
		let posts: Post[] = [];
		try { posts = await recentPosts(h); } catch (e) { console.warn(`@${h}: ${(e as Error).message}`); continue; }
		for (const p of posts) {
			const t = new Date(p.createdAt);
			if (t.getTime() < since) continue;
			const lm = localMinutes(t, wl.hours.tz);
			if (lm < from || lm > to) continue;
			candidates.push({ p, group, heat: heat(p), draft: await draftReply(p, group) });
		}
	}
	// One per account (its hottest matched post), then the day's cap, hottest first.
	const best = new Map<string, (typeof candidates)[number]>();
	for (const c of candidates) {
		if (!c.draft) continue;
		const k = c.p.author.userName.toLowerCase();
		const cur = best.get(k);
		const boost = (x: typeof c) => x.heat * (wl.priority.map((s) => s.toLowerCase()).includes(k) ? 2 : 1);
		if (!cur || boost(c) > boost(cur)) best.set(k, c);
	}
	// The same reply twice in a day reads as spam: keep only the hottest post per draft.
	const used = new Set<string>();
	const picks = [...best.values()]
		.sort((a, b) => b.heat - a.heat)
		.filter((c) => !used.has(c.draft!.text) && !!used.add(c.draft!.text))
		.slice(0, wl.limits.perDay);

	console.log(`TwitterAPI.io: ${requests} requests, ${returned} posts returned (~$${((returned / 1000) * 0.15).toFixed(4)} at $0.15 per 1,000).`);
	console.log(`${candidates.length} posts in the window from ${handles.length} accounts; ${candidates.filter((c) => c.draft).length} matched an angle; ${picks.length} would have been alerts.\n`);
	const lines: string[] = [];
	for (const c of picks) {
		const when = new Intl.DateTimeFormat('en-GB', { timeZone: wl.hours.tz, weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(c.p.createdAt));
		const block = [
			`**@${c.p.author.userName}** · ${when} · ${c.p.likeCount.toLocaleString('en-US')} likes · heat ${c.heat.toFixed(1)} · angle: ${c.draft!.angle}`,
			`> ${c.p.text.replace(/\s+/g, ' ').slice(0, 220)}`,
			`Reply: ${c.draft!.text}`,
			`<${c.p.url}>`,
		].join('\n');
		lines.push(block);
		console.log(block.replace(/\*\*/g, '') + '\n');
	}

	if (process.argv.includes('--discord') && lines.length) {
		const url = process.env.DISCORD_WEBHOOK_URL;
		if (!url) throw new Error('DISCORD_WEBHOOK_URL is not set');
		const chunks: string[] = [`**Reply radar dry run:** the ${picks.length} posts it would have flagged in the last ${hours} hours (09:00–23:30 UK). Not live yet; nothing to do.`];
		for (const l of lines) {
			if ((chunks[chunks.length - 1] + '\n\n' + l).length > 1900) chunks.push(l);
			else chunks[chunks.length - 1] += '\n\n' + l;
		}
		for (const content of chunks) {
			const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'Bitcoin Weigh-In radar', content }) });
			if (!r.ok) throw new Error(`Discord ${r.status}`);
		}
		console.log(`posted ${chunks.length} message(s) to Discord`);
	}
}

main().catch((e) => { console.error(e); process.exit(1); });
