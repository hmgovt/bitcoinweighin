/**
 * Read-only credential check. Confirms the OAuth 1.0a keys in .env
 * authenticate and reports the account + access level. Posts nothing.
 *
 *   npx tsx scripts/bot/verify-auth.ts
 */
import 'dotenv/config';
import { TwitterApi } from 'twitter-api-v2';

const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env;

const missing = Object.entries({
	X_API_KEY,
	X_API_SECRET,
	X_ACCESS_TOKEN,
	X_ACCESS_SECRET,
}).filter(([, v]) => !v).map(([k]) => k);

if (missing.length) {
	console.error('Missing env vars:', missing.join(', '));
	process.exit(1);
}

const client = new TwitterApi({
	appKey: X_API_KEY!,
	appSecret: X_API_SECRET!,
	accessToken: X_ACCESS_TOKEN!,
	accessSecret: X_ACCESS_SECRET!,
});

try {
	const me = await client.v2.me();
	console.log(`✓ Authenticated as @${me.data.username} (id ${me.data.id})`);

	// Access level is reported in the response headers of a v1.1 call.
	// We avoid any write here; this read is enough to confirm the token works.
	console.log('✓ OAuth 1.0a user-context credentials are valid.');
	console.log(
		'Next: a real post requires App permissions = Read+Write and tokens minted after that change.',
	);
} catch (err: any) {
	console.error('✗ Auth failed.');
	console.error('  code:', err?.code ?? '(none)');
	console.error('  message:', err?.data?.detail || err?.message || String(err));
	if (err?.code === 401) {
		console.error('  → 401: keys/tokens wrong or revoked. Regenerate in the portal.');
	}
	if (err?.code === 403) {
		console.error('  → 403: tokens are read-only. Set App permissions to Read+Write, then REGENERATE the Access Token & Secret.');
	}
	process.exit(1);
}
