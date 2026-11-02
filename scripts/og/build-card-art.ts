/**
 * build-card-art.ts — the art library behind the link cards (functions/og-image.ts).
 *
 * Renders every tab's real stage at a ladder of PHYSICAL quantities — grams
 * of gold, $1 notes, square metres of Manhattan — so the pictures never go
 * stale with the price: a link's card shows the rung nearest its amount, and
 * the card's numbers are always exact. Cube metals step in half-decades (a
 * cube is at most ~20% off in edge), and so does cocaine, whose stage changes
 * form with the amount; everything else in decades.
 *
 *   npm run build && npx vite preview --port 4173 &
 *   npx tsx scripts/og/build-card-art.ts                 # everything missing
 *   npx tsx scripts/og/build-card-art.ts --only=gold --force
 *   npx tsx scripts/og/build-card-art.ts --files=manhattan/1p00.jpg --force
 *
 * Writes static/og/art/<commodity>/<rung>.jpg and static/og/art/manifest.json,
 * which also records where each picture's subject sits across the frame, so
 * the card can keep it clear of the headline (functions/_card.ts, artLeft).
 * Needs a built site served locally, ffmpeg, and Playwright chromium.
 */
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ffmpeg } from '../dive-capture.ts';
import { USD_PER_M2, DEVELOPABLE_M2 } from '../../src/lib/manhattan.ts';
import { LITRES_PER_BARREL, PRUDHOE_L } from '../../src/lib/oil.ts';

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const base = arg('base') ?? 'http://localhost:4173';
const only = arg('only')?.split(',');
const force = process.argv.includes('--force');
const jobs = Number(arg('jobs') ?? 2);
/** Only these art files (commodity/rung.jpg), e.g. to redo a few rungs with --force. */
const files = arg('files')?.split(',');
const OUT = resolve('static/og/art');
const OZ = 31.1035;
const MAX_BTC = 21_000_000;

type Unit = 'g' | 'notes' | 'm2' | 'L';
interface Ladder {
	commodity: string; unit: Unit; from: number; to: number; step: number; extra?: number[];
	/** Real ms to let the camera settle; software WebGL runs a few fps, and the eases are per frame. */
	settle?: number;
	/** Crop into the stage's framing for a rung (stage-still --zoom), where it leaves the subject tiny. */
	zoom?: (q: number) => number;
}

// Exponents of 10 in the quantity's unit.
const LADDERS: Ladder[] = [
	{ commodity: 'gold', unit: 'g', from: 0, to: 10, step: 0.5 },
	{ commodity: 'silver', unit: 'g', from: 1, to: 12, step: 0.5 },
	{ commodity: 'pu238', unit: 'g', from: -1, to: 9, step: 0.5 },
	// Half-decades: the stage changes form with the amount (lines, baggies, bricks, pallets).
	{ commodity: 'cocaine', unit: 'g', from: -1, to: 11, step: 0.5 },
	{ commodity: 'cash', unit: 'notes', from: 1, to: 13, step: 1 },
	// The site frames a doormat with plenty of street around it; a thumbnail wants it closer.
	{ commodity: 'manhattan', unit: 'm2', from: -2, to: 7, step: 1, extra: [DEVELOPABLE_M2], settle: 12_000, zoom: (q) => (q <= 1 ? 2.5 : q <= 10 ? 1.8 : 1) },
	// Litres of Brent crude, half-decades: the stage changes form (car, drums, tankers, field).
	// Plus all of Prudhoe Bay, where the field is fully lit (the whole supply buys about that).
	{ commodity: 'oil', unit: 'L', from: 1, to: 12.5, step: 0.5, extra: [PRUDHOE_L], settle: 9000 },
];

async function lastClose() {
	const rows = JSON.parse(await readFile('static/data/prices.json', 'utf8')) as Record<string, { btc_usd: number | null; xau_per_btc: number | null; xag_per_btc: number | null; brent_per_btc: number | null }>;
	const date = Object.keys(rows).sort().filter((d) => rows[d].btc_usd).pop()!;
	return { date, ...rows[date] } as { date: string; btc_usd: number; xau_per_btc: number; xag_per_btc: number; brent_per_btc: number };
}

/** BTC that buys `q` of the commodity at the given close. */
function btcFor(commodity: string, q: number, p: Awaited<ReturnType<typeof lastClose>>): number {
	switch (commodity) {
		case 'gold': return q / (p.xau_per_btc * OZ);
		case 'silver': return q / (p.xag_per_btc * OZ);
		case 'pu238': return (q * 5000) / p.btc_usd; // illustrative $/g, as the site
		case 'cocaine': return ((q / 1000) * 30000) / p.btc_usd; // US wholesale $/kg, as the site
		case 'cash': return q / p.btc_usd;
		case 'manhattan': return (q * USD_PER_M2) / p.btc_usd;
		case 'oil': return q / LITRES_PER_BARREL / p.brent_per_btc; // litres of Brent crude
	}
	throw new Error(commodity);
}

const rungId = (q: number) => q.toPrecision(3).replace('+', '').replace('.', 'p');

function run(cmd: string, args: string[]): Promise<number> {
	return new Promise((res) => {
		const c = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'inherit'], env: process.env });
		c.on('close', (code) => res(code ?? 1));
	});
}

async function exists(f: string) { try { await stat(f); return true; } catch { return false; } }

const W = 1200, H = 630;

/**
 * The horizontal span of a picture's subject, in pixels of the 1200-wide art:
 * the columns with real edges in them (the stages' floors and skies are smooth
 * gradients), so a cube, a stack and Sat count and the empty floor doesn't.
 */
async function subjectX(file: string): Promise<[number, number] | null> {
	const gray = await new Promise<Buffer>((res, rej) => {
		const c = spawn('ffmpeg', ['-loglevel', 'error', '-i', file, '-vf', `scale=${W}:${H}`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-']);
		const chunks: Buffer[] = [];
		c.stdout.on('data', (d: Buffer) => chunks.push(d));
		c.on('close', (code) => (code === 0 ? res(Buffer.concat(chunks)) : rej(new Error(`ffmpeg ${code} on ${file}`))));
	});
	const cols = new Uint16Array(W);
	for (let y = 0; y < H; y++) for (let x = 0, r = y * W; x < W - 2; x++) if (Math.abs(gray[r + x + 2] - gray[r + x]) > 14) cols[x]++;
	let a = -1, b = -1;
	for (let x = 0; x < W; x++) if (cols[x] >= 3) { if (a < 0) a = x; b = x; }
	return a < 0 ? null : [a, b];
}

async function main() {
	const p = await lastClose();
	const manifest: Record<string, { unit: Unit; rungs: { q: number; file: string; x?: [number, number] }[] }> = {};
	const todo: { commodity: string; q: number; btc: number; file: string; settle: number; zoom: number }[] = [];
	for (const L of LADDERS) {
		const rungs: { q: number; file: string; x?: [number, number] }[] = [];
		const qs: number[] = [];
		for (let e = L.from; e <= L.to + 1e-9; e += L.step) qs.push(Math.pow(10, e));
		for (const q of [...qs, ...(L.extra ?? [])].sort((a, b) => a - b)) {
			const btc = btcFor(L.commodity, q, p);
			if (btc > MAX_BTC * 1.0001 || btc < 1e-7) continue;
			const file = `${L.commodity}/${rungId(q)}.jpg`;
			rungs.push({ q, file });
			if ((!only || only.includes(L.commodity)) && (!files || files.includes(file))) {
				todo.push({ commodity: L.commodity, q, btc, file, settle: L.settle ?? 7000, zoom: L.zoom?.(q) ?? 1 });
			}
		}
		manifest[L.commodity] = { unit: L.unit, rungs };
	}

	const tmp = resolve('.cache/card-art');
	await mkdir(tmp, { recursive: true });
	let done = 0;
	const queue = [...todo];
	const worker = async () => {
		for (let t = queue.shift(); t; t = queue.shift()) {
			const out = join(OUT, t.file);
			if (!force && (await exists(out))) { done++; continue; }
			await mkdir(join(OUT, t.commodity), { recursive: true });
			const png = join(tmp, t.file.replace(/[/.]/g, '_') + '.png');
			const code = await run('npx', ['tsx', 'scripts/clips/stage-still.ts', `--base=${base}`, `--commodity=${t.commodity}`,
				`--btc=${t.btc.toPrecision(8)}`, '--width=1200', '--height=630', '--dpr=1.5', `--settle=${t.settle}`, `--zoom=${t.zoom}`, `--out=${png}`]);
			if (code !== 0) { console.log(`✗ ${t.file} (render failed)`); continue; }
			await ffmpeg(['-y', '-i', png, '-vf', 'scale=1200:630:flags=lanczos', '-q:v', '4', out]);
			await rm(png, { force: true });
			console.log(`✓ ${t.file}  (${++done}/${todo.length})`);
		}
	};
	await Promise.all(Array.from({ length: jobs }, worker));

	for (const m of Object.values(manifest)) {
		for (const r of m.rungs) {
			const f = join(OUT, r.file);
			if (await exists(f)) r.x = (await subjectX(f)) ?? undefined;
		}
	}
	await writeFile(join(OUT, 'manifest.json'), JSON.stringify({ renderedFrom: base, close: p.date, manifest }, null, '\t') + '\n');
	console.log(`manifest: ${Object.values(manifest).reduce((n, m) => n + m.rungs.length, 0)} rungs`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
