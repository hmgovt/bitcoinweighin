/**
 * dive-capture.ts — frame-exact captures of the /mining 3D dive, shared by
 * make-mining-loop.ts (homepage clip) and bot/make-mining-short.ts.
 *
 * The page runs on a virtual clock: performance.now() and the timestamps
 * requestAnimationFrame hands out only advance when `advance()` says so,
 * while the browser keeps painting real frames. So every captured frame is
 * exactly 1/fps of animation apart, however slow the (software) renderer is.
 */
import { chromium, type Browser, type Page } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface DiveCapture {
	page: Page;
	/** Move the scene's clock forward and wait for it to paint. */
	advance(ms: number): Promise<void>;
	/** Capture `ms` of animation as numbered PNGs in `dir`. */
	shoot(ms: number): Promise<void>;
	/** Repeat the current frame for `ms` without moving the clock. */
	hold(ms: number): Promise<void>;
	/** Click one of the dive's step buttons (e.g. /Exploded/). */
	step(name: RegExp): Promise<void>;
	frames: number;
	close(): Promise<void>;
}

export interface CaptureOptions {
	base: string;
	dir: string;
	fps: number;
	/** CSS size of the captured stage and the device pixel ratio. */
	width: number;
	height: number;
	dpr?: number;
}

export async function openDive(o: CaptureOptions): Promise<DiveCapture> {
	const browser: Browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	const page = await browser.newPage({ viewport: { width: o.width, height: o.height + 200 }, deviceScaleFactor: o.dpr ?? 1 });
	await page.addInitScript(() => {
		const realNow = performance.now.bind(performance);
		const w = window as unknown as { __vt: number | null };
		w.__vt = null;
		performance.now = () => w.__vt ?? realNow();
		const raf = window.requestAnimationFrame.bind(window);
		window.requestAnimationFrame = (cb) => raf(() => cb(performance.now()));
	});
	await page.goto(`${o.base}/mining`, { waitUntil: 'networkidle' });
	// The stage alone, at exactly the requested size: no page chrome, labels or buttons.
	await page.addStyleTag({
		content: `.mining .wrap{padding:0!important;max-width:none!important;gap:0!important}
			.stage3d{width:${o.width}px!important;height:${o.height}px!important;border:0!important;border-radius:0!important}
			.stage3d .labels,.stage3d .snd,.stage3d .corner,.stage3d .dragnote{display:none!important}`,
	});
	await page.waitForSelector('.stage3d canvas');
	await page.locator('.stage3d').evaluate((el) => el.scrollIntoView({ block: 'start' }));
	await page.waitForTimeout(1500);
	const box = await page.locator('.stage3d').boundingBox();
	if (!box) throw new Error('3D stage not found');
	await page.evaluate(() => { const w = window as unknown as { __vt: number | null }; w.__vt = performance.now(); });

	const frameMs = 1000 / o.fps;
	let frames = 0;
	let last: Buffer | null = null;
	const save = async (png: Buffer) => { last = png; await writeFile(join(o.dir, `f${String(frames++).padStart(4, '0')}.png`), png); };
	const cap: DiveCapture = {
		page,
		get frames() { return frames; },
		set frames(n) { frames = n; },
		async advance(ms) {
			await page.evaluate(async (ms) => {
				const w = window as unknown as { __vt: number };
				w.__vt += ms;
				// Two real frames: one to render at the new time, one to present it.
				await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
			}, ms);
		},
		async shoot(ms) {
			for (let t = 0; t < ms - 1e-6; t += frameMs) {
				await cap.advance(frameMs);
				await save(await page.screenshot({ clip: box }));
			}
		},
		async hold(ms) {
			const png = last ?? (await page.screenshot({ clip: box }));
			for (let t = 0; t < ms - 1e-6; t += frameMs) await save(png);
		},
		async step(name) {
			await page.getByRole('button', { name }).click();
		},
		async close() { await browser.close(); },
	};
	// Let the first step settle before anything is captured.
	for (let t = 0; t < 1000; t += 250) await cap.advance(250);
	return cap;
}

export function ffmpeg(args: string[]): Promise<void> {
	return new Promise((resolve, reject) => {
		const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
		let err = '';
		p.stderr.on('data', (d) => (err += d));
		p.on('error', reject);
		p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}\n${err.slice(-2000)}`))));
	});
}
