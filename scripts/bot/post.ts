/**
 * post.ts — upload a card image + caption to X.
 *
 *   # safe: composes, validates media path, logs the tweet — posts NOTHING
 *   npx tsx scripts/bot/post.ts --image=output/cards/gold-1000.png \
 *     --caption="1,000 BTC today = this much gold." --dry-run
 *
 *   # live: actually posts (requires App permissions = Read+Write)
 *   npx tsx scripts/bot/post.ts --image=output/cards/gold-1000.png \
 *     --caption="1,000 BTC today = this much gold."
 *
 * OAuth 1.0a user context; reads the four X_* vars from .env (local) or
 * the workflow env (CI). Default is dry-run-safe in spirit, but --dry-run
 * must be passed explicitly so a live run is never accidental from a typo.
 */
import 'dotenv/config';
import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { TwitterApi } from 'twitter-api-v2';

interface Args {
	image: string;
	caption: string;
	dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
	const get = (name: string) =>
		argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
	const image = get('image');
	const caption = get('caption');
	const dryRun = argv.includes('--dry-run');

	if (!image) throw new Error('--image=<path> is required');
	if (!caption) throw new Error('--caption=<text> is required');
	if (caption.length > 280) {
		throw new Error(`Caption is ${caption.length} chars; X limit is 280.`);
	}
	return { image, caption, dryRun };
}

function clientFromEnv(): TwitterApi {
	const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env;
	const missing = Object.entries({ X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET })
		.filter(([, v]) => !v)
		.map(([k]) => k);
	if (missing.length) throw new Error(`Missing env vars: ${missing.join(', ')}`);
	return new TwitterApi({
		appKey: X_API_KEY!,
		appSecret: X_API_SECRET!,
		accessToken: X_ACCESS_TOKEN!,
		accessSecret: X_ACCESS_SECRET!,
	});
}

/**
 * Upload `imagePath` and post `caption`. Returns the new tweet id.
 * Throws on any failure (caller decides whether to swallow).
 */
export async function postTweet(imagePath: string, caption: string): Promise<string> {
	if (caption.length > 280) throw new Error(`Caption ${caption.length} chars > 280 limit.`);
	const client = clientFromEnv();
	const mediaId = await client.v1.uploadMedia(imagePath);
	const { data } = await client.v2.tweet({
		text: caption,
		media: { media_ids: [mediaId] },
	});
	return data.id;
}

/**
 * Post a text-only reply to an existing tweet.
 *
 * Used for the "first-reply link" pattern: the main tweet stays link-free
 * (avoiding X's 30-80% external-link penalty) and the site URL goes here
 * where it still gets impressions from anyone who expands the thread.
 *
 * Returns the reply tweet id.
 */
export async function replyToTweet(parentTweetId: string, text: string): Promise<string> {
	if (text.length > 280) throw new Error(`Reply ${text.length} chars > 280 limit.`);
	const client = clientFromEnv();
	const { data } = await client.v2.tweet({
		text,
		reply: { in_reply_to_tweet_id: parentTweetId },
	});
	return data.id;
}

/**
 * Post a thread (array of tweets where each replies to the previous).
 * First tweet can have an image; subsequent are text-only.
 * Returns array of tweet ids in thread order.
 *
 * Threads get 40-60% more total impressions than standalone posts
 * because the algo assigns each tweet its own velocity score while
 * cross-pollinating impressions across the thread.
 */
export async function postThread(tweets: Array<{ text: string; imagePath?: string }>): Promise<string[]> {
	if (!tweets.length) throw new Error('Thread must have at least one tweet.');
	const client = clientFromEnv();
	const ids: string[] = [];

	for (const tweet of tweets) {
		if (tweet.text.length > 280) throw new Error(`Thread tweet ${ids.length + 1} is ${tweet.text.length} chars > 280.`);
		let mediaId: string | undefined;
		if (tweet.imagePath) {
			mediaId = await client.v1.uploadMedia(tweet.imagePath);
		}
		const payload: Record<string, unknown> = { text: tweet.text };
		if (mediaId) payload.media = { media_ids: [mediaId] };
		if (ids.length > 0) payload.reply = { in_reply_to_tweet_id: ids[ids.length - 1] };

		const { data } = await client.v2.tweet(payload);
		ids.push(data.id);
	}

	return ids;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const imagePath = resolve(args.image);

	const stat = await fs.stat(imagePath).catch(() => null);
	if (!stat || !stat.isFile()) throw new Error(`Image not found: ${imagePath}`);

	console.log('─'.repeat(56));
	console.log(`image:   ${imagePath} (${(stat.size / 1024).toFixed(0)} KB)`);
	console.log(`caption: ${args.caption}`);
	console.log(`length:  ${args.caption.length}/280`);
	console.log(`mode:    ${args.dryRun ? 'DRY RUN — nothing posted' : 'LIVE — posting to X'}`);
	console.log('─'.repeat(56));

	if (args.dryRun) {
		console.log('✓ Dry run complete. No post made.');
		return;
	}

	const client = clientFromEnv();
	console.log('Uploading media…');
	const mediaId = await client.v1.uploadMedia(imagePath);
	console.log(`  media_id: ${mediaId}`);

	console.log('Posting tweet…');
	const { data } = await client.v2.tweet({
		text: args.caption,
		media: { media_ids: [mediaId] },
	});
	console.log(`✓ Posted: https://x.com/bitcoinweighin/status/${data.id}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((err) => {
		console.error('✗ Post failed.');
		console.error('  message:', err?.data?.detail || err?.message || String(err));
		if (err?.code === 403) {
			console.error('  → 403: tokens likely read-only. Set Read+Write, then regenerate Access Token & Secret.');
		}
		process.exit(1);
	});
}
