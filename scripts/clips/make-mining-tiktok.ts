/**
 * make-mining-tiktok.ts — the /mining dive as a TikTok cut (rendered at 720×1280 and scaled to 1080×1920, ~23 s; full-size software WebGL is too slow),
 * built to scripts/clips/VIDEO.md: frame one is the payoff (the die, "a
 * trillion guesses a second"), a new part of the miner every ~3.5 s, and it
 * ends diving into one core. Captions sit inside TikTok's safe
 * zone. Silent: add a sound in the app.
 *
 *   npm run build && npx vite preview --port 4173 &
 *   npx tsx scripts/clips/make-mining-tiktok.ts --base=http://localhost:4173
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ffmpeg, openDive } from '../dive-capture.ts';
import { miningShortFacts } from '../bot/make-mining-short.ts';
import { n0 } from '../../src/lib/mining/format.ts';

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const FPS = 24;
const base = arg('base') ?? process.env.SITE_BASE_URL ?? 'http://localhost:4173';
const out = resolve(arg('out') ?? 'output/clips/mining-tiktok.mp4');

const HOOK = 'This chip guesses a trillion times a second.<small>Almost every guess fails.</small>';

async function main() {
	const f = miningShortFacts();
	const dir = await mkdtemp(join(tmpdir(), 'mining-tiktok-'));
	const cap = await openDive({ base, dir, fps: FPS, width: 540, height: 960, dpr: 4 / 3 });
	try {
		await cap.page.evaluate(() => {
			const st = document.querySelector('.stage3d') as HTMLElement;
			const style = document.createElement('style');
			// TikTok covers the top ~80 px, bottom ~240 px and right ~60 px of 540×960.
			style.textContent = `
				#cap{position:absolute;left:30px;right:70px;top:96px;z-index:5;font:800 38px/1.08 'Inter Tight',system-ui,sans-serif;letter-spacing:-0.025em;color:#f4f4f5;text-shadow:0 2px 24px #000,0 0 3px #000;text-wrap:balance}
				#cap small{display:block;margin-top:14px;font:600 18px/1.45 'JetBrains Mono',monospace;letter-spacing:0;color:#d4d4d8;word-break:break-all}
				#cap small b{color:#fbbf24;font-weight:700}
				#brand{position:absolute;left:30px;bottom:256px;z-index:5;font:600 14px/1 'JetBrains Mono',monospace;letter-spacing:0.14em;text-transform:uppercase;color:#d4d4d8;text-shadow:0 0 6px #000}`;
			document.head.appendChild(style);
			st.insertAdjacentHTML('beforeend', '<div id="cap"></div><div id="brand">bitcoinweighin.com/mining</div>');
		});
		const say = (html: string) => cap.page.evaluate((h) => { (document.getElementById('cap') as HTMLElement).innerHTML = h; }, html);
		const zc = f.zeros >> 2;
		const hashHtml = `<b>${f.hash.slice(0, zc)}</b>${f.hash.slice(zc)}`;

		// Frame one: the die, already turned over (settled before the first frame).
		await cap.step(/Die face/);
		for (let t = 0; t < 3000; t += 250) await cap.advance(250);
		await say(HOOK);
		await cap.shoot(3200);
		await cap.step(/Hashboard/);
		await say('It sits on a board like this.<small>A miner holds three, each with dozens of chips.</small>');
		await cap.shoot(3500);
		await cap.step(/^2\s*Chip$/);
		await say('One chip, from above.<small>That mirror is the back of the silicon.</small>');
		await cap.shoot(3300);
		await cap.step(/Exploded/);
		await say('Taken apart.<small>Solder balls, the substrate, and the die on top, face-down.</small>');
		await cap.shoot(3600);
		await cap.step(/Die face/);
		await say('Turned over: thousands of identical hash cores.');
		await cap.shoot(3300);
		await cap.step(/Into the core/);
		await say(`One guess from cores like these found block ${n0(f.height)}.<small>nonce ${f.nonce}<br>${hashHtml}</small>`);
		// About 2 s into the core the page hands the dive to its 2D view and
		// scrolls away, so the cut ends on the dive.
		await cap.shoot(2000);
		console.log(`captured ${cap.frames} frames`);
		await ffmpeg([
			'-y', '-framerate', String(FPS), '-i', join(dir, 'f%04d.png'),
			'-vf', 'scale=1080:1920:flags=lanczos,format=yuv420p',
			'-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-movflags', '+faststart', out,
		]);
		console.log(`✓ ${out}`);
	} finally {
		await cap.close();
		await rm(dir, { recursive: true, force: true });
	}
}

main().catch((e) => { console.error(e); process.exit(1); });
