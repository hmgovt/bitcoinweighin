/**
 * make-mining-short.ts — a ~15 s vertical (720×1280) video of the /mining
 * dive for X / Shorts / Reels, captioned with the block the page replays.
 *
 * 720p rather than 1080p because it renders with software WebGL on GitHub's
 * runners, where every extra pixel is CPU time; 720×1280 is a standard size
 * for all three platforms.
 *
 * Beats: hashboard → one chip → the package taken apart → the die turned over
 * → a dive into one core, then an end card pointing at /mining. Captions are
 * drawn into the page over the real 3D scene, so they use the site's fonts.
 * Silent (X autoplays muted).
 *
 *   npx tsx scripts/bot/make-mining-short.ts                       # local dev server
 *   SITE_BASE_URL=https://bitcoinweighin.com npx tsx scripts/bot/make-mining-short.ts --out=mining.mp4
 *
 * Preconditions: ffmpeg on PATH, `npx playwright install chromium` done once.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ffmpeg, openDive } from '../dive-capture.ts';
import { BLOCKS } from '../../src/lib/mining/blocks.ts';
import { hexZeros, parseTemplate } from '../../src/lib/mining/sha256.ts';
import { fmtAgo, n0 } from '../../src/lib/mining/format.ts';

const FPS = 24;

export interface MiningShortFacts {
	height: number;
	ago: string;
	nonce: string;
	hash: string;
	zeros: number;
}

/** The block /mining replays: the older of the two latest blocks. */
export function miningShortFacts(now = new Date()): MiningShortFacts {
	const tpl = parseTemplate(BLOCKS[0]);
	return {
		height: tpl.height,
		ago: fmtAgo(now.getTime() / 1000 - tpl.time),
		nonce: `0x${(tpl.nonce >>> 0).toString(16).padStart(8, '0')}`,
		hash: tpl.hash,
		zeros: hexZeros(tpl.hash),
	};
}

export async function renderMiningShort(opts: { out: string; base?: string }): Promise<string> {
	const base = opts.base ?? process.env.SITE_BASE_URL ?? 'http://localhost:5173';
	const f = miningShortFacts();
	const dir = await mkdtemp(join(tmpdir(), 'mining-short-'));
	const cap = await openDive({ base, dir, fps: FPS, width: 540, height: 960, dpr: 4 / 3 });
	try {
		await cap.page.evaluate(() => {
			const st = document.querySelector('.stage3d') as HTMLElement;
			const style = document.createElement('style');
			style.textContent = `
				#cap{position:absolute;left:34px;right:34px;top:92px;z-index:5;font:600 38px/1.08 'Inter Tight',system-ui,sans-serif;letter-spacing:-0.02em;color:#f4f4f5;text-shadow:0 2px 24px #000,0 0 3px #000;text-wrap:balance}
				#cap small{display:block;margin-top:16px;font:500 17px/1.45 'JetBrains Mono',monospace;letter-spacing:0;color:#d4d4d8;word-break:break-all}
				#cap small b{color:#fbbf24;font-weight:600}
				#brand{position:absolute;left:34px;bottom:44px;z-index:5;font:600 15px/1 'JetBrains Mono',monospace;letter-spacing:0.14em;text-transform:uppercase;color:#a1a1aa}
				#end{position:absolute;inset:0;z-index:6;display:none;flex-direction:column;justify-content:center;padding:0 40px;background:#0e0e11}
				#end h1{font:600 50px/1.04 'Inter Tight',system-ui,sans-serif;letter-spacing:-0.025em;color:#f4f4f5;margin:0}
				#end p{font:500 19px/1.5 'Inter Tight',system-ui,sans-serif;color:#a1a1aa;margin:18px 0 0}
				#end .url{margin-top:34px;display:inline-block;align-self:flex-start;font:600 20px/1 'JetBrains Mono',monospace;color:#09090b;background:#fbbf24;border-radius:10px;padding:16px 20px}`;
			document.head.appendChild(style);
			st.insertAdjacentHTML('beforeend', '<div id="cap"></div><div id="brand">bitcoinweighin.com</div><div id="end"></div>');
		});
		const say = (html: string) => cap.page.evaluate((h) => { (document.getElementById('cap') as HTMLElement).innerHTML = h; }, html);
		const zc = f.zeros >> 2;
		const hashHtml = `<b>${f.hash.slice(0, zc)}</b>${f.hash.slice(zc)}`;

		await say(`Bitcoin block ${n0(f.height)} was found ${f.ago}.<small>By one lucky guess.</small>`);
		await cap.shoot(2600);
		await cap.step(/^2\s*Chip$/);
		await say('The guess came from a chip like this.');
		await cap.shoot(2600);
		await cap.step(/Exploded/);
		await say('Inside: a sliver of silicon, mounted face-down.');
		await cap.shoot(3000);
		await cap.step(/Die face/);
		await say('It guesses about a trillion times a second.<small>Almost every guess fails.</small>');
		await cap.shoot(3000);
		await cap.step(/Into the core/);
		await say(`The winning guess: nonce ${f.nonce}<small>${hashHtml}</small>`);
		// Stop just before the page hands the dive over to the 2D view (and scrolls).
		await cap.shoot(2300);
		await cap.page.evaluate((h) => {
			const end = document.getElementById('end') as HTMLElement;
			end.innerHTML = `<h1>Watch a real block get found.</h1><p>Take the chip apart yourself, then replay block ${h} one SHA-256 round at a time.</p><span class="url">bitcoinweighin.com/mining</span>`;
			end.style.display = 'flex';
			(document.getElementById('cap') as HTMLElement).style.display = 'none';
			(document.getElementById('brand') as HTMLElement).style.display = 'none';
		}, n0(f.height));
		await cap.advance(1);
		await cap.shoot(1);
		await cap.hold(2200);
		console.log(`captured ${cap.frames} frames`);
		const out = resolve(opts.out);
		await ffmpeg([
			'-y', '-framerate', String(FPS), '-i', join(dir, 'f%04d.png'),
			'-vf', 'scale=720:1280:flags=lanczos,format=yuv420p',
			'-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-movflags', '+faststart', out,
		]);
		return out;
	} finally {
		await cap.close();
		await rm(dir, { recursive: true, force: true });
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const out = process.argv.find((a) => a.startsWith('--out='))?.slice(6) ?? 'mining-short.mp4';
	renderMiningShort({ out })
		.then((p) => console.log(`✓ ${p}`))
		.catch((err) => { console.error(err); process.exit(1); });
}
