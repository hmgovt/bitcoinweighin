/**
 * make-oil-clip.ts — "What does bitcoin buy in oil?": the long-form vertical
 * MP4 of /clip/oil (one sat → a car's tank → 1 BTC of drums → supertankers →
 * Prudhoe Bay → crude vs the pump → 1 BTC in barrels since 2013), for
 * TikTok, Reels and Shorts. About 1 min 46 s.
 *
 * Frame-exact like make-manhattan-clip.ts: the page runs on a virtual clock
 * that only moves when we say, so every frame is exactly 1/fps of animation
 * apart however slow the software renderer is. Pass --audio to mux in the
 * score (scripts/clips/score-oil.ts).
 *
 *   npm run build && npx vite preview --port 4173 &
 *   npx tsx scripts/clips/score-oil.ts --out=output/clips/oil-score.wav
 *   npx tsx scripts/clips/make-oil-clip.ts --audio=output/clips/oil-score.wav
 *   npx tsx scripts/clips/make-oil-clip.ts --still=24      # one frame, for a look
 *
 * The close defaults to the latest in /prices.json (--date to pick one), so
 * the numbers on screen are the site's numbers for that day.
 * Preconditions: ffmpeg on PATH, Playwright chromium.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');

const base = arg('base') ?? process.env.SITE_BASE_URL ?? 'http://localhost:4173';
const date = arg('date');
const fps = Number(arg('fps') ?? 30);
const width = Number(arg('width') ?? 540);
const height = Number(arg('height') ?? 960);
const dpr = Number(arg('dpr') ?? 2);
const audio = arg('audio');
/** Render only from --from to --seconds (quick looks at one stretch). */
const from = Number(arg('from') ?? 0);
const only = arg('seconds') ? Number(arg('seconds')) : null;
/** Save one PNG at this clip time instead of a video (e.g. --still=24.5). */
const still = arg('still') ? Number(arg('still')) : null;
const out = resolve(arg('out') ?? `output/clips/oil${still !== null ? `-${still}s.png` : '.mp4'}`);

async function main() {
	await mkdir(dirname(out), { recursive: true });
	const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	try {
		const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
		// The virtual clock: real time until __vt is set, then performance.now()
		// only moves when we say, and animation-frame callbacks wait in a queue
		// until __flush(), so the stage renders exactly once per captured frame.
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
		const url = `${base}/clip/oil${date ? `?date=${date}` : ''}`;
		console.log(`→ ${url}`);
		await page.goto(url, { waitUntil: 'networkidle' });
		await page.waitForFunction(() => (window as unknown as { __clipReady?: () => boolean }).__clipReady?.(), null, { timeout: 600_000, polling: 1000 });
		await page.evaluate(() => document.fonts.ready);

		/** Move the clock; unless a full-screen card hides the stage, render it. Returns whether it was hidden. */
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
		for (let i = 0; i < 8; i++) await advance(250);
		await page.evaluate(() => (window as unknown as { __clipStart: () => void }).__clipStart());

		// Step to the start at 20 fps: the stage's camera eases on a capped 50 ms
		// step, so this is the same camera path as the video, just not shot.
		const to = still ?? from;
		for (let t = 0; t < to - 1e-6; t += 0.05) await advance(50);
		if (still !== null) {
			await writeFile(out, await page.screenshot());
			console.log(`✓ ${out}  still at ${still}s`);
			return;
		}

		const duration = only ?? (await page.evaluate(() => (window as unknown as { __clipDuration: number }).__clipDuration)) - from;
		const total = Math.round(duration * fps);
		// Frames go straight into ffmpeg (a few GB of PNGs never touch the disk).
		const withAudio = audio && from === 0;
		const enc = spawn('ffmpeg', [
			'-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
			...(withAudio ? ['-i', resolve(audio!)] : []),
			'-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p',
			...(withAudio ? ['-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
			'-movflags', '+faststart', out,
		], { stdio: ['pipe', 'inherit', 'inherit'] });
		const done = new Promise<number>((r) => enc.on('close', (c) => r(c ?? 1)));
		const write = (b: Buffer) => new Promise<void>((r) => (enc.stdin.write(b) ? r() : enc.stdin.once('drain', () => r())));
		const t0 = Date.now();
		let held: Buffer | null = null;
		for (let i = 0; i < total; i++) {
			// Behind an opaque card the frame can't change: shoot it once, repeat it.
			const opaque = await advance(i === 0 ? 0 : 1000 / fps);
			const png: Buffer = opaque && held ? held : await page.screenshot();
			held = opaque ? png : null;
			await write(png);
			if (i % 150 === 0) console.log(`  frame ${i}/${total}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
		}
		enc.stdin.end();
		if ((await done) !== 0) throw new Error('ffmpeg failed');
		const mb = (await stat(out)).size / 1e6;
		console.log(`✓ ${out}  ${total} frames${withAudio ? ' + score' : ''}, ${mb.toFixed(1)} MB, ${((Date.now() - t0) / 60000).toFixed(0)} min`);
	} finally {
		await browser.close();
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
