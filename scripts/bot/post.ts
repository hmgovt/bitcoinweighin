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

main().catch((err) => {
	console.error('✗ Post failed.');
	console.error('  message:', err?.data?.detail || err?.message || String(err));
	if (err?.code === 403) {
		console.error('  → 403: tokens likely read-only. Set Read+Write, then regenerate Access Token & Secret.');
	}
	process.exit(1);
});
