/**
 * opentweet.ts — post to @bitcoinweighin through OpenTweet's REST API
 * (https://opentweet.io/docs/api), the same API its MCP server wraps.
 *
 * Our pattern is a two-post thread: the eye-catcher (image or video, no
 * link — X demotes posts with links) and the link as the first reply.
 *
 *   # account status and today's posting limit
 *   npx tsx scripts/social/opentweet.ts status
 *
 *   # a draft (appears in the OpenTweet dashboard; posts nothing)
 *   npx tsx scripts/social/opentweet.ts thread --media=output/clips/manhattan-strategy.mp4 \
 *     --text="…" --reply="…https://bitcoinweighin.com/btc/manhattan" --draft
 *
 *   # scheduled (UTC) or immediately
 *   … --at=2026-09-29T17:00:00Z
 *   … --now
 *
 *   # list scheduled / posted
 *   npx tsx scripts/social/opentweet.ts list --status=scheduled
 *
 * Reads OPENTWEET_API_KEY from the environment. Always pins the post to X
 * (platforms: ["x"]) — left unset, OpenTweet follows the account's auto
 * cross-post setting instead.
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const BASE = (process.env.OPENTWEET_BASE_URL ?? 'https://opentweet.io').replace(/\/$/, '') + '/api/v1';
const MIME: Record<string, string> = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
	'.gif': 'image/gif',
	'.mp4': 'video/mp4',
	'.mov': 'video/quicktime',
};

function key(): string {
	const k = process.env.OPENTWEET_API_KEY;
	if (!k) throw new Error('OPENTWEET_API_KEY is not set');
	return k;
}

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
	const res = await fetch(BASE + path, {
		method,
		headers: { Authorization: `Bearer ${key()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
		body: body ? JSON.stringify(body) : undefined,
	});
	const data = (await res.json().catch(() => ({}))) as { error?: string; details?: unknown };
	if (!res.ok) throw new Error(`${method} ${path}: ${data.error ?? res.status}${data.details ? ` — ${JSON.stringify(data.details)}` : ''}`);
	return data as T;
}

/** Upload an image (≤5 MB) or video (≤20 MB); returns the URL to attach. */
export async function uploadMedia(file: string): Promise<string> {
	const type = MIME[extname(file).toLowerCase()];
	if (!type) throw new Error(`Unsupported media type: ${file}`);
	const buf = await readFile(file);
	const limit = type.startsWith('video/') ? 20e6 : 5e6;
	if (buf.length > limit) throw new Error(`${file} is ${(buf.length / 1e6).toFixed(1)} MB; the limit is ${limit / 1e6} MB`);
	const form = new FormData();
	form.append('file', new Blob([new Uint8Array(buf)], { type }), basename(file));
	const res = await fetch(`${BASE}/upload`, { method: 'POST', headers: { Authorization: `Bearer ${key()}` }, body: form });
	const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
	if (!res.ok || !data.url) throw new Error(`upload: ${data.error ?? res.status}`);
	return data.url;
}

export interface ThreadOptions {
	text: string;
	reply?: string;
	media?: string;
	/** ISO 8601 UTC; omit for a draft unless `now`. */
	at?: string;
	now?: boolean;
}

/** The eye-catcher plus the link reply, as one OpenTweet thread post. */
export async function postThread(o: ThreadOptions): Promise<{ id: string; status: string; url?: string }> {
	for (const [name, t] of [['text', o.text], ['reply', o.reply ?? '']] as const)
		if (t.length > 280) throw new Error(`${name} is ${t.length} characters; X's limit is 280`);
	const media_urls = o.media ? [await uploadMedia(o.media)] : undefined;
	const res = await api<{ posts: { id: string; status: string; url?: string }[] }>('POST', '/posts', {
		text: o.text,
		...(o.reply ? { is_thread: true, thread_tweets: [o.reply] } : {}),
		media_urls,
		platforms: ['x'],
		...(o.at ? { scheduled_date: o.at } : {}),
		...(o.now ? { publish_now: true } : {}),
	});
	return res.posts[0];
}

async function main() {
	const [cmd] = process.argv.slice(2);
	const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
	const has = (n: string) => process.argv.includes(`--${n}`);
	if (cmd === 'status') {
		console.log(JSON.stringify(await api('GET', '/me'), null, 2));
	} else if (cmd === 'list') {
		const q = new URLSearchParams({ limit: '20', ...(arg('status') ? { status: arg('status')! } : {}) });
		console.log(JSON.stringify(await api('GET', `/posts?${q}`), null, 2));
	} else if (cmd === 'thread') {
		const text = arg('text');
		if (!text) throw new Error('--text is required');
		if (!arg('at') && !has('now') && !has('draft')) throw new Error('say when: --at=<ISO UTC>, --now, or --draft');
		const post = await postThread({ text, reply: arg('reply'), media: arg('media'), at: arg('at'), now: has('now') });
		console.log(`✓ ${post.status} · id ${post.id}${post.url ? ` · ${post.url}` : ''}`);
	} else {
		console.log('usage: opentweet.ts status | list [--status=scheduled|posted|draft|failed] | thread --text=… [--reply=…] [--media=file] (--at=ISO | --now | --draft)');
		process.exit(1);
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	main().catch((e) => {
		console.error(`✗ ${e.message}`);
		process.exit(1);
	});
}
