/**
 * make-mining-loop.ts — the silent looping clip for the homepage's /mining strip.
 *
 * Captures the real /mining 3D scene frame by frame (a virtual clock drives
 * the animation, so frames are evenly spaced however slow the renderer is): a chip comes apart, then its die turns over to show the
 * circuitry. ffmpeg plays that forward then backward, so the loop is seamless,
 * and writes an H.264 MP4 (plays everywhere) plus a poster frame.
 *
 *   # against a local dev server:
 *   npx tsx scripts/make-mining-loop.ts
 *   # or any running build:
 *   SITE_BASE_URL=https://bitcoinweighin.com npx tsx scripts/make-mining-loop.ts
 *
 * Preconditions: ffmpeg on PATH, `npx playwright install chromium` done once.
 * Outputs: static/video/mining-loop.mp4, static/images/mining-loop-poster.jpg
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.SITE_BASE_URL ?? 'http://localhost:5173';
const FPS = 24;
const W = 960;
const H = 540;

function run(cmd: string, args: string[]): Promise<void> {
	return new Promise((resolve, reject) => {
		const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
		let err = '';
		p.stderr.on('data', (d) => (err += d));
		p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}\n${err.slice(-2000)}`))));
	});
}

const frames = await mkdtemp(join(tmpdir(), 'mining-loop-'));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
	const page = await browser.newPage({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 1 });
	// A virtual clock for the scene: performance.now() only moves when we say so, while the browser keeps
	// painting real frames. Every captured frame is exactly 1/FPS of animation apart, however slow the renderer.
	await page.addInitScript(() => {
		const realNow = performance.now.bind(performance);
		const w = window as unknown as { __vt: number | null };
		w.__vt = null;
		performance.now = () => w.__vt ?? realNow();
		const raf = window.requestAnimationFrame.bind(window);
		window.requestAnimationFrame = (cb) => raf(() => cb(performance.now()));
	});
	await page.goto(`${BASE}/mining`, { waitUntil: 'networkidle' });
	// A clean 16:9 stage: no labels, buttons or captions.
	await page.addStyleTag({
		content: `.stage3d{height:${Math.round((1080 * H) / W)}px!important;border:0!important;border-radius:0!important}
			.stage3d .labels,.stage3d .snd,.stage3d .corner,.stage3d .dragnote{display:none!important}`,
	});
	await page.waitForSelector('.stage3d canvas');
	await page.locator('.stage3d').evaluate((el) => el.scrollIntoView({ block: 'start' }));
	await page.waitForTimeout(1500);
	const box = await page.locator('.stage3d').boundingBox();
	if (!box) throw new Error('3D stage not found');
	await page.evaluate(() => { const w = window as unknown as { __vt: number | null }; w.__vt = performance.now(); });
	const advance = (ms: number) =>
		page.evaluate(async (ms) => {
			const w = window as unknown as { __vt: number };
			w.__vt += ms;
			// Two real frames: one to render at the new time, one to present it.
			await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
		}, ms);
	const step = 1000 / FPS;
	let n = 0;
	const shoot = async (ms: number) => {
		for (let t = 0; t < ms; t += step) {
			await advance(step);
			await writeFile(join(frames, `f${String(n++).padStart(4, '0')}.png`), await page.screenshot({ clip: box }));
		}
	};
	const settle = async (ms: number) => { for (let t = 0; t < ms; t += 250) await advance(250); };
	// Settle on the chip close-up, then capture it coming apart and the die turning over.
	await page.getByRole('button', { name: /^2\s*Chip$/ }).click();
	await settle(2600);
	await shoot(400);
	await page.getByRole('button', { name: /Exploded/ }).click();
	await shoot(2700);
	await page.getByRole('button', { name: /Die face/ }).click();
	await shoot(3000);
	console.log(`captured ${n} frames`);
	await mkdir(join(ROOT, 'static/video'), { recursive: true });
	const loop = '[0:v]split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1[c];[c]scale=' + `${W}:${H}` + ':flags=lanczos[out]';
	const input = ['-y', '-framerate', String(FPS), '-i', join(frames, 'f%04d.png'), '-filter_complex', loop, '-map', '[out]', '-an'];
	await run('ffmpeg', [...input, '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '32', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(ROOT, 'static/video/mining-loop.mp4')]);
	// Poster: the exploded package, mid-loop.
	const mid = join(frames, `f${String(Math.round(n * 0.42)).padStart(4, '0')}.png`);
	await sharp(mid).resize(W, H).jpeg({ quality: 80, mozjpeg: true }).toFile(join(ROOT, 'static/images/mining-loop-poster.jpg'));
	console.log('wrote static/video/mining-loop.mp4 and static/images/mining-loop-poster.jpg');
} finally {
	await browser.close();
	await rm(frames, { recursive: true, force: true });
}
