/**
 * make-manhattan-clip.ts — the "cyber Manhattan" video: a vertical MP4 of
 * /clip/manhattan (quote card → the island → 1 BTC at the Battery → the fill
 * climbing to a holder's stack), for X, TikTok, Reels and Shorts.
 *
 * Frame-exact like scripts/dive-capture.ts: the page runs on a virtual
 * clock that only moves when we say, so every frame is exactly 1/fps of
 * animation apart however slow the software renderer is. Silent.
 *
 *   npm run build && npx vite preview --port 4173 &
 *   npx tsx scripts/clips/make-manhattan-clip.ts --base=http://localhost:4173
 *   npx tsx scripts/clips/make-manhattan-clip.ts --holder=satoshi --out=satoshi.mp4
 *
 * Price and date default to the dataset's last day (static/data/prices.json),
 * so the numbers on screen are the site's numbers for that day.
 * Preconditions: ffmpeg on PATH, Playwright chromium.
 */
import { chromium } from 'playwright';
import { mkdtemp, mkdir, rm, readFile, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { ffmpeg } from '../dive-capture.ts';

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');

const base = arg('base') ?? process.env.SITE_BASE_URL ?? 'http://localhost:4173';
const holder = arg('holder') ?? 'strategy';
const fps = Number(arg('fps') ?? 30);
const width = Number(arg('width') ?? 540);
const height = Number(arg('height') ?? 960);
const dpr = Number(arg('dpr') ?? 2);
const out = resolve(arg('out') ?? `output/clips/manhattan-${holder}.mp4`);
/** Render only the first N seconds (quick looks). */
const only = arg('seconds') ? Number(arg('seconds')) : null;

async function lastPrice(): Promise<{ price: number; date: string }> {
	if (arg('price')) return { price: Number(arg('price')), date: arg('date') ?? '' };
	const rows = JSON.parse(await readFile('static/data/prices.json', 'utf8')) as Record<string, { btc_usd: number | null }>;
	const date = Object.keys(rows).sort().filter((d) => rows[d].btc_usd).pop()!;
	return { price: rows[date].btc_usd!, date };
}

async function main() {
	const { price, date } = await lastPrice();
	await mkdir(dirname(out), { recursive: true });
	const dir = await mkdtemp(join(tmpdir(), 'clip-'));
	const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	try {
		const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
		// The virtual clock (see dive-capture.ts): real time until __vt is set.
		// The virtual clock: real time until __vt is set, then performance.now()
		// only moves when we say, and animation-frame callbacks wait in a queue
		// until __flush() — so the (slow, software) map renders exactly once
		// per captured frame, never in between.
		await page.addInitScript(() => {
			const realNow = performance.now.bind(performance);
			const realRaf = window.requestAnimationFrame.bind(window);
			const w = window as unknown as { __vt: number | null; __flush: () => void; __present: () => Promise<void> };
			const queue: FrameRequestCallback[] = [];
			w.__vt = null;
			performance.now = () => w.__vt ?? realNow();
			window.requestAnimationFrame = (cb) => {
				if (w.__vt === null) return realRaf(() => cb(performance.now()));
				queue.push(cb);
				return 0;
			};
			w.__flush = () => {
				for (const cb of queue.splice(0)) cb(performance.now());
			};
			w.__present = () => new Promise((r) => realRaf(() => r()));
		});
		const url = `${base}/clip/manhattan?holder=${holder}&price=${price}&date=${date}`;
		console.log(`→ ${url}`);
		await page.goto(url, { waitUntil: 'networkidle' });
		await page.waitForFunction(() => (window as unknown as { __clipReady?: () => boolean }).__clipReady?.(), null, { timeout: 900_000, polling: 1000 });
		await page.evaluate(() => document.fonts.ready);

		/** Move the clock; unless the frame is hidden behind a card, render it. Returns whether it was hidden. */
		const advance = (ms: number) =>
			page.evaluate(async (ms) => {
				const w = window as unknown as { __vt: number; __clipOpaque?: () => boolean; __flush: () => void; __present: () => Promise<void> };
				w.__vt += ms;
				if (w.__clipOpaque?.()) return true;
				w.__flush();
				await w.__present();
				return false;
			}, ms);
		await page.evaluate(() => {
			const w = window as unknown as { __vt: number | null };
			w.__vt = performance.now();
		});
		// Let the camera settle on the whole island, then roll.
		for (let i = 0; i < 8; i++) await advance(250);
		await page.evaluate(() => (window as unknown as { __clipStart: () => void }).__clipStart());

		const duration = only ?? (await page.evaluate(() => (window as unknown as { __clipDuration: number }).__clipDuration));
		const total = Math.round(duration * fps);
		const t0 = Date.now();
		let held: Buffer | null = null;
		for (let i = 0; i < total; i++) {
			// Behind an opaque card the frame can't change: shoot it once, repeat it.
			const opaque = await advance(i === 0 ? 0 : 1000 / fps);
			const png: Buffer = opaque && held ? held : await page.screenshot();
			held = opaque ? png : null;
			await writeFile(join(dir, `f${String(i).padStart(4, '0')}.png`), png);
			if (i % 30 === 0) console.log(`  frame ${i}/${total}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
		}

		await ffmpeg([
			'-y', '-framerate', String(fps), '-i', join(dir, 'f%04d.png'),
			'-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p',
			'-movflags', '+faststart', out,
		]);
		const mb = (await stat(out)).size / 1e6;
		console.log(`✓ ${out}  ${total} frames, ${mb.toFixed(1)} MB${mb > 20 ? '  (over the 20 MB upload limit: raise --crf)' : ''}`);
	} finally {
		await browser.close();
		await rm(dir, { recursive: true, force: true });
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
