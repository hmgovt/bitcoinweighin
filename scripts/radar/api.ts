/**
 * api.ts — what the radar scripts share: the TwitterAPI.io client, the post
 * shape it returns, the watchlist, and how "hot" a post is.
 *
 * Needs TWITTERAPI_IO_KEY. Never log it.
 */
import { readFile } from 'node:fs/promises';

const API = 'https://api.twitterapi.io/twitter';

export interface Post {
	id: string; url: string; text: string; createdAt: string;
	likeCount: number; retweetCount: number; replyCount: number; quoteCount: number; viewCount: number;
	isReply?: boolean; retweeted_tweet?: unknown;
	author: { userName: string; name?: string; followers: number };
}

export interface Watchlist {
	hours: { tz: string; from: string; to: string };
	limits: { perAccountPerDay: number; perDay: number; maxPostAgeMinutes: number };
	sweep: { recheckAfterMinutes: number; giveUpAfterMinutes: number; minHeat: number; minLikes: number; maxDraftsPerRun: number };
	groups: Record<string, { angle: string; accounts: string[] }>;
	priority: string[];
}

export const loadWatchlist = async (): Promise<Watchlist> => JSON.parse(await readFile('scripts/radar/watchlist.json', 'utf8'));

/** Each handle with the group it sits in. */
export const handlesOf = (wl: Watchlist) => Object.entries(wl.groups).flatMap(([group, g]) => g.accounts.map((h) => ({ h, group })));

// TwitterAPI.io's free tier allows one request every 5 seconds; paid accounts
// can set TWITTERAPI_IO_GAP_MS lower.
const GAP_MS = Number(process.env.TWITTERAPI_IO_GAP_MS ?? 5200);
let lastCall = 0;
export const usage = { requests: 0, returned: 0, credits: 0 };
/** Posts cost 15 credits each, with a 15-credit floor per call. */
const charge = (n: number) => { usage.returned += n; usage.credits += Math.max(15, 15 * n); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function api<T>(path: string, retried = false): Promise<T> {
	const key = process.env.TWITTERAPI_IO_KEY;
	if (!key) throw new Error('TWITTERAPI_IO_KEY is not set');
	const wait = lastCall + GAP_MS - Date.now();
	if (wait > 0) await sleep(wait);
	lastCall = Date.now();
	usage.requests++;
	const res = await fetch(`${API}${path}`, { headers: { 'x-api-key': key } });
	if (res.status === 429 && !retried) { await sleep(GAP_MS); return api<T>(path, true); }
	const body = (await res.json().catch(() => ({}))) as T & { status?: string; msg?: string; message?: string };
	if (!res.ok || body.status === 'error') throw new Error(`${path.split('?')[0]}: ${res.status} ${body.msg ?? body.message ?? ''}`);
	return body;
}

/** Original posts only: no replies, no reposts. */
export const isOriginal = (t: Post) => !t.isReply && !t.retweeted_tweet && !/^RT @/.test(t.text);

/** The ~20 most recent posts of one account (the dry run's way in; costly to poll). */
export async function recentPosts(userName: string): Promise<Post[]> {
	type R = { data?: { tweets?: Post[] }; tweets?: Post[] };
	const r = await api<R>(`/user/last_tweets?userName=${encodeURIComponent(userName)}&includeReplies=false`);
	const tweets = r.data?.tweets ?? r.tweets ?? [];
	charge(tweets.length);
	return tweets.filter(isOriginal);
}

/**
 * Every original post from these accounts since a moment, newest first, via
 * advanced search: one call per page of 20, paying only for what's new.
 * X caps query length, so handles go in batches.
 */
export async function postsSince(handles: string[], sinceSec: number, untilSec: number): Promise<Post[]> {
	const out: Post[] = [];
	for (let i = 0; i < handles.length; i += 16) {
		const q = `(${handles.slice(i, i + 16).map((h) => `from:${h}`).join(' OR ')}) -filter:replies -filter:retweets since_time:${sinceSec} until_time:${untilSec}`;
		let cursor = '';
		for (let page = 0; page < 10; page++) {
			type R = { tweets?: Post[]; has_next_page?: boolean; next_cursor?: string };
			const r = await api<R>(`/tweet/advanced_search?queryType=Latest&query=${encodeURIComponent(q)}&cursor=${encodeURIComponent(cursor)}`);
			const tweets = r.tweets ?? [];
			charge(tweets.length);
			out.push(...tweets.filter(isOriginal));
			if (!r.has_next_page || !r.next_cursor || !tweets.length) break;
			cursor = r.next_cursor;
		}
	}
	return out;
}

/** Current counts for up to 100 posts per call. */
export async function postsByIds(ids: string[]): Promise<Post[]> {
	const out: Post[] = [];
	for (let i = 0; i < ids.length; i += 100) {
		type R = { tweets?: Post[] };
		const r = await api<R>(`/tweets?tweet_ids=${ids.slice(i, i + 100).join(',')}`);
		charge(r.tweets?.length ?? 0);
		out.push(...(r.tweets ?? []));
	}
	return out;
}

/** What the calls so far cost (1 USD = 100,000 credits). */
export function costLine(): string {
	return `TwitterAPI.io: ${usage.requests} requests, ${usage.returned} posts returned, ~${usage.credits.toLocaleString('en-US')} credits (~$${(usage.credits / 100_000).toFixed(4)}).`;
}

/** Minutes since midnight in a time zone. */
export function localMinutes(d: Date, tz: string): number {
	const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(d).split(':').map(Number);
	return (h % 24) * 60 + m;
}
export const hm = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
/** The calendar day in a time zone, YYYY-MM-DD. */
export const localDay = (d: Date, tz: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);

/**
 * How hard a post took off, relative to its author's size: engagement per
 * thousand followers, with replies and reposts weighted over likes, per hour
 * of age so a post from last night doesn't outrank one taking off now.
 * Age is floored at an hour so a minutes-old post with a handful of likes
 * doesn't top the list.
 */
export function heat(p: Post, now = Date.now()): number {
	const e = p.likeCount + 3 * p.retweetCount + 2 * p.replyCount + 3 * p.quoteCount;
	const ageH = Math.max(1, (now - new Date(p.createdAt).getTime()) / 3600_000);
	return e / Math.max(1, p.author.followers / 1000) / ageH;
}
