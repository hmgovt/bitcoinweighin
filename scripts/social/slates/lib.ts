/**
 * lib.ts — shared machinery for the daily X slates (scripts/social/slates/<date>.ts).
 *
 * A slate is a list of posts, each an eye-catcher (image or video, no link)
 * plus a first reply carrying the link. Figures come from the live site's
 * latest close and images from its pre-rendered link cards
 * (/og/cards/<key>.png), so a slate run after the 02:00 UTC price update and
 * deploy is always current. Runs post through OpenTweet (../opentweet.ts).
 *
 *   NODE_USE_ENV_PROXY=1 npx tsx scripts/social/slates/<date>.ts --dry     # print the copy
 *   … --build                                                              # make the images only
 *   …                                                                      # schedule every post still ahead
 *   … --only=id,id
 *   … --discord [--note="…"]   # also send each post, image attached, to DISCORD_WEBHOOK_URL
 *                                (with --dry: Discord only, nothing scheduled)
 *
 * Every post's link should have its own card: 1 BTC or a holder at the
 * latest close is always rendered; anything with a date or an odd amount
 * must be listed in scripts/og/card-links.json before the post goes out.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, openAsBlob, statSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { postThread } from '../opentweet.ts';
import { cardModel, presetBtc, sig3 } from '../../../functions/_card.ts';

export { presetBtc, sig3 };
export const SITE = 'https://bitcoinweighin.com';
export const OZ = 31.1035;
const UTM = 'utm_source=x&utm_medium=first_reply&utm_campaign=launch';
/** A homepage link with its settings, tagged as a first-reply link from X. */
export const L = (q: string) => `${SITE}/?${q}&${UTM}`;
export const DATA = `${SITE}/data?${UTM}`;

export type Row = { btc_usd: number; xau_usd: number; xag_usd: number; xau_per_btc: number; xag_per_btc: number; brent_per_btc: number };
export interface Item {
	id: string;
	/** ISO time, UTC. */
	at: string;
	text: string;
	/** First reply, usually the link; '' for none. */
	reply: string;
	/** Makes the image or video and returns its path; run only when posting or with --build. */
	media?: () => string;
}

export async function loadPrices() {
	const P = (await (await fetch(`${SITE}/data/prices.json`)).json()) as Record<string, Row>;
	const dates = Object.keys(P).filter((d) => P[d].btc_usd).sort();
	const close = dates[dates.length - 1];
	const prev = dates[dates.length - 2];
	const day = (d: string) => ({ btc: P[d].btc_usd, xau: P[d].xau_usd, xag: P[d].xag_usd });
	/** The link card's model (its numbers and words) for an amount, at the close or a past date. */
	const card = (commodity: string, btc: number, preset?: string, date = close) => cardModel({ commodity, btc, preset, date, day: day(date) });
	return { P, close, prev, card };
}

export const f0 = (n: number) => Math.round(n).toLocaleString('en-US');
export const nice = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
export const weekday = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });

/** Image helpers writing into one output folder per slate. */
export function images(out: string) {
	mkdirSync(out, { recursive: true });
	const get = (key: string): string => {
		const file = `${out}/${key}.png`;
		execFileSync('curl', ['-sfS', '--max-time', '60', '-o', file, `${SITE}/og/cards/${key}.png`]);
		return file;
	};
	const jpg = (src: string, name: string): string => {
		const file = `${out}/${name}.jpg`;
		execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', src, '-q:v', '2', file]);
		return file;
	};
	/** Two cards stacked: a past date above, today below. */
	const pair = (a: string, b: string, name: string): string => {
		const file = `${out}/${name}.jpg`;
		execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', get(a), '-i', get(b), '-filter_complex', '[0][1]vstack=inputs=2', '-q:v', '2', file]);
		return file;
	};
	/** Cards rendered here, for amounts the site doesn't pre-render, tiled 2×2. */
	const grid = (queries: string[], name: string, date: string): string => {
		const files = queries.map((_, i) => `${out}/${name}-${i}.png`);
		execFileSync('curl', ['-sfS', '--max-time', '60', '-o', `${out}/card-prices.json`, `${SITE}/prices.json`]);
		execFileSync('npx', ['tsx', 'scripts/og/render-card.ts', ...queries.map((q, i) => `${files[i]}|${q}&date=${date}`)], { env: { ...process.env, PRICES: `${out}/card-prices.json` } });
		const file = `${out}/${name}.jpg`;
		execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...files.flatMap((f) => ['-i', f]), '-filter_complex', 'xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0,scale=1600:-1', '-q:v', '2', file]);
		return file;
	};
	return { get, jpg, pair, grid };
}

/** Escape Discord's formatting (links untouched) so a copied post is exactly the post. */
const plain = (t: string) => t.split(/(https?:\/\/\S+)/).map((part, i) => (i % 2 ? part : part.replace(/([*_~`|\\])/g, '\\$1').replace(/^([#>-])/gm, '\\$1'))).join('');
const ukTime = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

/**
 * Send one post to Discord as a message to copy from: time, text, first reply,
 * and its image or video attached. Discord takes files up to 25 MB on a webhook.
 */
export async function toDiscord(it: Item, n: number, of: number, file: string | undefined, note?: string) {
	const url = process.env.DISCORD_WEBHOOK_URL;
	if (!url) throw new Error('DISCORD_WEBHOOK_URL is not set');
	const fits = file && existsSync(file) && statSync(file).size < 24 * 1024 * 1024;
	const lines = [
		`**Post ${n} of ${of} · ${ukTime(it.at)} UK**`,
		plain(it.text),
		it.reply ? `↳ **First reply:** ${plain(it.reply)}` : '',
		file && !fits ? `-# The file is too big for Discord: ${file}` : '',
		note ? `-# ${note}` : '',
	].filter(Boolean);
	const form = new FormData();
	// flags 4: no link previews, so the message stays a clean copy of the post.
	form.append('payload_json', JSON.stringify({ username: 'Bitcoin Weigh-In posts', content: lines.join('\n').slice(0, 2000), flags: 4, allowed_mentions: { parse: [] } }));
	if (fits) form.append('files[0]', await openAsBlob(file!), basename(file!));
	const r = await fetch(url, { method: 'POST', body: form });
	if (!r.ok) throw new Error(`Discord ${r.status} for ${it.id}`);
}

/** Print, build, schedule or send a slate to Discord, per the command-line flags. */
export async function run(slate: Item[], out: string, header: string) {
	const dry = process.argv.includes('--dry');
	const build = process.argv.includes('--build');
	const discord = process.argv.includes('--discord');
	const note = process.argv.find((a) => a.startsWith('--note='))?.slice(7);
	const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');
	console.log(header);
	const preview: string[] = [];
	const items = [...slate].sort((a, b) => a.at.localeCompare(b.at)).filter((it) => !only || only.includes(it.id));
	for (const [i, it] of items.entries()) {
		for (const [n, t] of [['text', it.text], ['reply', it.reply]] as const) if (t.length > 280) throw new Error(`${it.id} ${n} is ${t.length} chars`);
		preview.push(`## ${it.at.slice(5, 16).replace('T', ' ')} UTC · ${it.id}${it.media ? ' · image' : ''}\n${it.text}\n↳ ${it.reply || '(no reply)'}\n`);
		if (build) { if (it.media) console.log('built', it.media()); continue; }
		if (discord) {
			await toDiscord(it, i + 1, items.length, it.media?.(), note);
			console.log(`sent ${it.id} to Discord`);
		}
		if (dry) continue;
		if (Date.parse(it.at) - Date.now() < 3 * 60_000) { console.log(`skip ${it.id} (time passed)`); continue; }
		const file = it.media?.();
		if (file && !existsSync(file)) throw new Error(`no media for ${it.id}`);
		const r = await postThread({ text: it.text, reply: it.reply || undefined, media: file, at: it.at });
		console.log(`scheduled ${it.id} ${it.at} → ${r.id} ${r.status}`);
	}
	if (dry) {
		writeFileSync(`${out}/preview.md`, `${header}\n\n${preview.join('\n')}`);
		console.log(preview.join('\n'));
	}
}
