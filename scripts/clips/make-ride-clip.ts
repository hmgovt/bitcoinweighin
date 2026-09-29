/**
 * make-ride-clip.ts — the Moon ride as a vertical video: the cash tab's
 * stack of $1 notes for an amount (default: all 21 million bitcoin),
 * restacked as one column and ridden to the top, with a title up front and
 * an end card. For the pinned post, X, TikTok, Reels and Shorts.
 *
 *   npm run build && npx vite preview --port 4173 &
 *   npx tsx scripts/clips/make-ride-clip.ts                     # all 21M
 *   npx tsx scripts/clips/make-ride-clip.ts --preset=satoshi --title="Satoshi’s coins,|stacked in \$1 bills."
 *
 * Frame-exact on a virtual clock (./virtual-clock.ts). Silent. Numbers are
 * the site's own for the dataset's last day.
 */
import { chromium } from 'playwright';
import { mkdtemp, mkdir, rm, readFile, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { ffmpeg } from '../dive-capture.ts';
import { installVirtualClock, startVirtualClock, advance } from './virtual-clock.ts';

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

const base = arg('base') ?? process.env.SITE_BASE_URL ?? 'http://localhost:4173';
const preset = arg('preset') ?? 'market-cap';
const title = (arg('title') ?? 'All 21 million bitcoin,|stacked in $1 bills.').split('|');
const fps = Number(arg('fps') ?? 30);
const width = Number(arg('width') ?? 540);
const height = Number(arg('height') ?? 960);
const dpr = Number(arg('dpr') ?? 2);
/** Seconds after the ride ends (its summary card up) before the end card. */
const holdS = Number(arg('hold') ?? 3);
const endS = 3.5;
const out = resolve(arg('out') ?? `output/clips/ride-${preset}.mp4`);

async function lastClose(): Promise<{ price: number; date: string }> {
	const rows = JSON.parse(await readFile('static/data/prices.json', 'utf8')) as Record<string, { btc_usd: number | null }>;
	const date = Object.keys(rows).sort().filter((d) => rows[d].btc_usd).pop()!;
	return { price: rows[date].btc_usd!, date };
}

// Everything drawn over the page for the video, positioned over the stage.
const OVERLAY_CSS = `
section.hero-stage .bill-stage { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important;
	max-width: none !important; margin: 0 !important; border-radius: 0 !important; border: 0 !important; z-index: 2147483000 !important; }
section.hero-stage .bill-stage button { display: none !important; }
html, body { overflow: hidden !important; }
#clip-title, #clip-foot, #clip-end { position: fixed; z-index: 2147483600; font-family: 'Inter Tight', system-ui, sans-serif; color: #fafafa; pointer-events: none; }
#clip-title { left: 0; right: 0; bottom: 0; padding: 120px 34px 96px; background: linear-gradient(#0b0b0d00, #0b0b0de6 45%); }
#clip-title p { margin: 0; font-size: 42px; font-weight: 800; line-height: 1.08; letter-spacing: -0.03em; }
#clip-title p + p { color: #f7931a; }
#clip-foot { left: 18px; right: 18px; bottom: 16px; padding: 8px 10px; border-radius: 8px; background: #0b0b0dc0;
	font: 11px/1.45 'JetBrains Mono', ui-monospace, monospace; color: #a1a1aa; }
#clip-end { inset: 0; background: #0b0b0d; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 0 40px; gap: 18px; }
#clip-end .l { font-size: 22px; color: #a1a1aa; margin: 0; }
#clip-end .b { font-size: 50px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.05; margin: 0; }
#clip-end .b span { color: #f7931a; }
#clip-end .u { font-size: 30px; font-weight: 700; margin: 18px 0 0; }
`;

async function main() {
	const { price, date } = await lastClose();
	const moonPrice = Math.round(384_400_000 / 0.00010922 / 21_000_000);
	await mkdir(dirname(out), { recursive: true });
	const dir = await mkdtemp(join(tmpdir(), 'ride-'));
	const browser = await chromium.launch({
		executablePath: process.env.CHROMIUM_PATH || undefined,
		args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
	});
	try {
		const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
		await installVirtualClock(page);
		const url = `${base}/?preset=${preset}&commodity=cash`;
		console.log(`→ ${url}`);
		await page.goto(url, { waitUntil: 'domcontentloaded' });
		await page.waitForSelector('section.hero-stage[data-commodity="cash"]', { timeout: 300_000 });
		await page.addStyleTag({ content: OVERLAY_CSS });
		const dateLabel = new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
		// Built as a string: tsx wraps named functions in a helper that doesn't exist in the page.
		const overlays = {
			'clip-title': title.map((t) => `<p>${t}</p>`).join(''),
			'clip-foot': `BTC $${Math.round(price).toLocaleString('en-US')} · ${dateLabel} · one $1 note is 0.109 mm thick · true scale`,
			'clip-end': `<p class="l">At <b>$${moonPrice.toLocaleString('en-US')}</b> a coin,</p><p class="b">the stack reaches <span>the Moon.</span></p><p class="u">bitcoinweighin.com</p>`,
		};
		await page.evaluate(`(() => {
			const o = ${JSON.stringify(overlays)};
			for (const id of Object.keys(o)) {
				const d = document.createElement('div');
				d.id = id;
				d.innerHTML = o[id];
				document.body.appendChild(d);
			}
			document.getElementById('clip-end').style.opacity = '0';
		})()`);
		await page.evaluate(() => document.fonts.ready);
		await page.waitForTimeout(3000);
		await startVirtualClock(page);
		for (let i = 0; i < 6; i++) await advance(page, 1000 / fps);
		/** Seconds of the pile standing still before the ride starts. */
		const leadS = 1.2;

		const frameMs = 1000 / fps;
		const opacity = (sel: string, o: number) =>
			page.evaluate(({ sel, o }) => ((document.querySelector(sel) as HTMLElement).style.opacity = String(o)), { sel, o });
		const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
		let frames = 0;
		let rideEndedAt: number | null = null;
		const t0 = Date.now();
		let started = false;
		for (;;) {
			const t = frames / fps;
			if (!started && t >= leadS) {
				// Start the ride (its button is hidden for the video, so click it from script).
				await page.evaluate(() => (document.querySelector('.ride-btn') as HTMLElement | null)?.click());
				started = true;
			}
			await opacity('#clip-title', 1 - smooth((t - 4.2) / 0.6));
			if (rideEndedAt === null && (await page.evaluate(() => !!document.querySelector('.ride-card')))) rideEndedAt = t;
			const endIn = rideEndedAt === null ? 0 : smooth((t - rideEndedAt - holdS) / 0.5);
			await opacity('#clip-end', endIn);
			await advance(page, frames === 0 ? 0 : frameMs);
			await writeFile(join(dir, `f${String(frames).padStart(4, '0')}.png`), await page.screenshot());
			frames++;
			if (frames % 30 === 0) console.log(`  frame ${frames}  t=${t.toFixed(1)}s  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
			if (rideEndedAt !== null && t > rideEndedAt + holdS + endS) break;
			if (t > 60) throw new Error('the ride never finished');
		}
		await ffmpeg([
			'-y', '-framerate', String(fps), '-i', join(dir, 'f%04d.png'),
			'-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out,
		]);
		const mb = (await stat(out)).size / 1e6;
		console.log(`✓ ${out}  ${frames} frames, ${mb.toFixed(1)} MB`);
	} finally {
		await browser.close();
		await rm(dir, { recursive: true, force: true });
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
