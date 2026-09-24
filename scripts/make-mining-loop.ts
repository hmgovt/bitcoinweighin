/**
 * make-mining-loop.ts — the silent looping clip for the homepage's /mining strip.
 *
 * Captures the real /mining 3D scene (see dive-capture.ts): a chip comes
 * apart, then its die turns over to show the circuitry. ffmpeg plays that
 * forward then backward, so the loop is seamless, and writes an H.264 MP4
 * (plays everywhere) plus a poster frame.
 *
 *   # against a local dev server:
 *   npx tsx scripts/make-mining-loop.ts
 *   # or any running build:
 *   SITE_BASE_URL=https://bitcoinweighin.com npx tsx scripts/make-mining-loop.ts
 *
 * Preconditions: ffmpeg on PATH, `npx playwright install chromium` done once.
 * Outputs: static/video/mining-loop.mp4, static/images/mining-loop-poster.jpg
 */
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ffmpeg, openDive } from './dive-capture.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.SITE_BASE_URL ?? 'http://localhost:5173';
const FPS = 24;
const W = 960;
const H = 540;

const dir = await mkdtemp(join(tmpdir(), 'mining-loop-'));
const cap = await openDive({ base: BASE, dir, fps: FPS, width: 1080, height: 608 });
try {
	// Settle on the chip close-up, then capture it coming apart and the die turning over.
	await cap.step(/^2\s*Chip$/);
	for (let t = 0; t < 2600; t += 250) await cap.advance(250);
	await cap.shoot(400);
	await cap.step(/Exploded/);
	await cap.shoot(2700);
	await cap.step(/Die face/);
	await cap.shoot(3000);
	console.log(`captured ${cap.frames} frames`);
	await mkdir(join(ROOT, 'static/video'), { recursive: true });
	await ffmpeg([
		'-y', '-framerate', String(FPS), '-i', join(dir, 'f%04d.png'),
		'-filter_complex', `[0:v]split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1[c];[c]scale=${W}:${H}:flags=lanczos[out]`,
		'-map', '[out]', '-an', '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '32', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
		join(ROOT, 'static/video/mining-loop.mp4'),
	]);
	// Poster: the exploded package, mid-loop.
	const mid = join(dir, `f${String(Math.round(cap.frames * 0.42)).padStart(4, '0')}.png`);
	await sharp(mid).resize(W, H).jpeg({ quality: 80, mozjpeg: true }).toFile(join(ROOT, 'static/images/mining-loop-poster.jpg'));
	console.log('wrote static/video/mining-loop.mp4 and static/images/mining-loop-poster.jpg');
} finally {
	await cap.close();
	await rm(dir, { recursive: true, force: true });
}
