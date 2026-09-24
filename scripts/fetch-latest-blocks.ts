/**
 * fetch-latest-blocks.ts — the two newest Bitcoin block headers, for /mining.
 *
 * /mining mines the older block's template, replays its real winning nonce,
 * then moves on to the newer one (whose previous-block field is the older
 * one's hash). Run daily by .github/workflows/daily-update.yml.
 *
 * Every header is checked before it's written: its double SHA-256 must equal
 * the block hash mempool.space reports, and the newer header must point at
 * the older one. Any failure leaves the last good file untouched, so the
 * page never ships unverifiable data.
 *
 *   npx tsx scripts/fetch-latest-blocks.ts
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src', 'lib', 'mining', 'blocks-latest.json');
const API = process.env.MEMPOOL_API ?? 'https://mempool.space/api';

interface BlockOut { height: number; hash: string; header: string }

async function get(path: string): Promise<string> {
	let last: unknown;
	for (let attempt = 1; attempt <= 3; attempt++) {
		try {
			const res = await fetch(`${API}${path}`, { headers: { 'user-agent': 'bitcoinweighin.com daily update' } });
			if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
			return (await res.text()).trim();
		} catch (err) {
			last = err;
			await new Promise((r) => setTimeout(r, attempt * 2000));
		}
	}
	throw last;
}

const sha256d = (hex: string) =>
	Buffer.from(createHash('sha256').update(createHash('sha256').update(Buffer.from(hex, 'hex')).digest()).digest()).reverse().toString('hex');
/** Previous-block hash from a raw header, in display (byte-reversed) order. */
const prevOf = (header: string) => Buffer.from(header.slice(8, 72), 'hex').reverse().toString('hex');

async function fetchBlock(height: number): Promise<BlockOut> {
	const hash = await get(`/block-height/${height}`);
	const header = await get(`/block/${hash}/header`);
	if (!/^[0-9a-f]{160}$/.test(header)) throw new Error(`block ${height}: header is not 80 bytes of hex`);
	if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error(`block ${height}: bad hash ${hash}`);
	if (sha256d(header) !== hash) throw new Error(`block ${height}: header does not hash to ${hash}`);
	return { height, hash, header };
}

async function main(): Promise<void> {
	// One block back from the tip, so both blocks have at least one confirmation.
	const tip = Number(await get('/blocks/tip/height'));
	if (!Number.isInteger(tip) || tip < 1) throw new Error(`bad tip height: ${tip}`);
	const older = await fetchBlock(tip - 2);
	const newer = await fetchBlock(tip - 1);
	if (prevOf(newer.header) !== older.hash) throw new Error(`block ${newer.height} does not build on ${older.height}`);

	const current = JSON.parse(await readFile(OUT, 'utf-8').catch(() => '{"blocks":[]}')) as { blocks: BlockOut[] };
	if (current.blocks.at(-1)?.height === newer.height) {
		console.log(`blocks-latest.json already at ${newer.height} — unchanged.`);
		return;
	}
	const out = { source: 'mempool.space', fetchedAt: new Date().toISOString(), blocks: [older, newer] };
	await writeFile(OUT, JSON.stringify(out, null, '\t') + '\n');
	console.log(`blocks-latest.json → ${older.height}, ${newer.height} (verified)`);
}

main().catch((err) => {
	// Keep the last good file; the page keeps working with yesterday's blocks.
	console.error(`fetch-latest-blocks: ${err instanceof Error ? err.message : err} — keeping the existing file.`);
	process.exitCode = 1;
});
