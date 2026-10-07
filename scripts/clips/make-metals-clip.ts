/**
 * make-metals-clip.ts — one bitcoin weighed in three metals, as a vertical
 * video: the homepage's live stage drops 1 BTC of gold, then silver, then
 * plutonium-238 (every tab switch is a new drop), each figure over its cube,
 * then an end card. For replies on X, and for TikTok, Reels and Shorts.
 *
 *   npm run build && npx vite preview --port 4173 &
 *   npx tsx scripts/clips/make-metals-clip.ts
 *   npx tsx scripts/clips/make-metals-clip.ts --btc=0.1 --out=output/clips/metals-tenth.mp4
 *   npx tsx scripts/clips/make-metals-clip.ts --lead="The new element, weighed in the old ones."
 *
 * Frame-exact on a virtual clock (./virtual-clock.ts). Silent. The figures
 * are the link cards' own (functions/_card.ts) for the dataset's last day.
 */
import { chromium } from 'playwright';
import { mkdtemp, mkdir, rm, readFile, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { ffmpeg } from '../dive-capture.ts';
import { installVirtualClock, startVirtualClock, advance } from './virtual-clock.ts';
import { cardModel, sig3 } from '../../functions/_card.ts';
import { OG_COMMODITIES, computeAmount } from '../../functions/_lib.ts';

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

const base = arg('base') ?? process.env.SITE_BASE_URL ?? 'http://localhost:4173';
const btc = Number(arg('btc') ?? 1);
const fps = Number(arg('fps') ?? 30);
const width = Number(arg('width') ?? 540);
const height = Number(arg('height') ?? 960);
const dpr = Number(arg('dpr') ?? 2);
/** Seconds on each metal, and on the end card. */
const segS = Number(arg('seg') ?? 4.5);
const endS = Number(arg('end') ?? 3.5);
const out = resolve(arg('out') ?? `output/clips/metals-${btc}btc.mp4`);
/** The end card's first line, above the three weights. */
const lead = arg('lead') ?? 'Same coin.';

/** In stage order; the key is the homepage's own tab shortcut. */
const METALS = [
	{ id: 'gold', key: 'g', name: 'gold', tile: { z: 79, sym: 'Au', label: 'Gold', mass: '196.97' } },
	{ id: 'silver', key: 's', name: 'silver', tile: { z: 47, sym: 'Ag', label: 'Silver', mass: '107.87' } },
	{ id: 'pu238', key: 'p', name: 'plutonium-238', tile: { z: 94, sym: 'Pu', label: 'Plutonium-238', mass: '238.05' } },
];

/** A mass in words a reader can feel: "638 g", "44 kg". */
const massWords = (g: number) => (g < 1000 ? `${sig3(g)} g` : g < 1e6 ? `${sig3(g / 1000)} kg` : `${sig3(g / 1e6)} t`);

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const STAGES = '.live-stage';
const CHROME = [
	'.stage-buttons', 'button', '[role="button"]', '.hud', '.labels', '.corner', '.dragnote', '.hint', '.caption',
	'.caption-strip', '.chips', '.chip', '.cube-caption', '.cube-edge', '.edge-label', '.blow-caption',
].map((s) => `${STAGES} ${s}`).join(', ');

const OVERLAY_CSS = `
section.hero-stage ${STAGES} { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important;
	max-width: none !important; max-height: none !important; margin: 0 !important; border-radius: 0 !important; border: 0 !important;
	z-index: 2147483000 !important; }
${CHROME} { display: none !important; }
html, body { overflow: hidden !important; }
.mc { position: fixed; z-index: 2147483600; font-family: 'Inter Tight', system-ui, sans-serif; color: #fafafa; pointer-events: none; }
#mc-top { right: 22px; top: 22px; text-align: right; padding: 7px 10px; border-radius: 6px; background: #0b0b0dc0;
	font: 600 14px/1.5 'JetBrains Mono', ui-monospace, monospace; letter-spacing: 0.06em; color: #f7931a; text-transform: uppercase; }
#mc-top span { color: #a1a1aa; }
.mc-panel { left: 0; right: 0; bottom: 0; padding: 120px 30px 64px; background: linear-gradient(#0b0b0d00, #0b0b0de6 42%); }
.mc-panel p { margin: 0; }
.mc-panel .big { font-size: 92px; font-weight: 900; line-height: 0.95; letter-spacing: -0.045em; }
.mc-panel .big span { color: #f7931a; font-size: 64px; letter-spacing: -0.02em; }
.mc-panel .mid { font-size: 38px; font-weight: 800; letter-spacing: -0.03em; margin-top: 4px; }
.mc-panel .sub { font-size: 22px; color: #d4d4d8; margin-top: 14px; }
.mc-panel .fine { font: 12px/1.4 'JetBrains Mono', ui-monospace, monospace; color: #a1a1aa; margin-top: 10px; }
.mc-tile { left: 22px; top: 22px; width: 108px; height: 124px; box-sizing: border-box; padding: 8px 10px;
	border: 2px solid #f7931a; border-radius: 6px; background: #0b0b0dcc; }
.mc-tile p { margin: 0; }
.mc-tile .z { font: 600 14px/1 'JetBrains Mono', ui-monospace, monospace; color: #a1a1aa; }
.mc-tile .s { font-size: 50px; font-weight: 800; line-height: 1; letter-spacing: -0.02em; margin-top: 6px; }
.mc-tile .n { font-size: 12px; font-weight: 600; color: #e4e4e7; margin-top: 7px; white-space: nowrap; }
.mc-tile .m { font: 11px/1.3 'JetBrains Mono', ui-monospace, monospace; color: #a1a1aa; }
#mc-end { inset: 0; background: #0b0b0d; display: flex; flex-direction: column; justify-content: center; padding: 0 36px; gap: 20px; }
#mc-end p { margin: 0; }
#mc-end .l { font-size: 30px; color: #a1a1aa; font-weight: 700; line-height: 1.2; }
#mc-end .b { font-size: 44px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.12; }
#mc-end .b span { color: #f7931a; }
#mc-end .u { font-size: 28px; font-weight: 700; margin-top: 26px; }
`;

async function lastClose() {
	const rows = JSON.parse(await readFile('static/data/prices.json', 'utf8')) as Record<string, { btc_usd: number | null; xau_usd: number | null; xag_usd: number | null }>;
	const date = Object.keys(rows).sort().filter((d) => rows[d].btc_usd).pop()!;
	const r = rows[date];
	return { date, day: { btc: r.btc_usd!, xau: r.xau_usd!, xag: r.xag_usd! } };
}

async function main() {
	const { date, day } = await lastClose();
	const figures = METALS.map((m) => {
		const card = cardModel({ commodity: m.id, btc, date, day });
		const c = OG_COMMODITIES[m.id];
		const grams = (computeAmount(btc, c, day) ?? 0) * (c.unitMassGrams ?? 1);
		return { ...m, card, grams };
	});
	const dateLabel = new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
	const who = btc === 1 ? '1 bitcoin' : `${btc.toLocaleString('en-US')} bitcoin`;
	for (const f of figures) console.log(`${f.id}: ${f.card.big}${f.card.unit} ${f.card.mid} · ${f.card.subs[0]} · ${massWords(f.grams)}`);

	await mkdir(dirname(out), { recursive: true });
	const dir = await mkdtemp(join(tmpdir(), 'metals-'));
	const browser = await chromium.launch({
		executablePath: process.env.CHROMIUM_PATH || undefined,
		args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
	});
	try {
		// The live stage stays a still poster in automated browsers; present as a normal one.
		const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr, userAgent: UA });
		await page.addInitScript({ content: "Object.defineProperty(Navigator.prototype, 'webdriver', { get() { return false; } });" });
		await installVirtualClock(page);
		// Open on the last metal, so switching to the first is a tab change: a drop.
		const url = `${base}/?btc=${btc}&commodity=${METALS[METALS.length - 1].id}`;
		console.log(`→ ${url}`);
		await page.goto(url, { waitUntil: 'domcontentloaded' });
		await page.waitForSelector(`section.hero-stage[data-commodity="${METALS[METALS.length - 1].id}"]`, { timeout: 300_000 });
		await page.keyboard.press(METALS[0].key); // a first interaction starts the scene loading
		await page.waitForSelector('.live-stage [data-fx]', { timeout: 300_000 });
		console.log(`  stage: ${await page.$eval('.live-stage [data-fx]', (e) => (e as HTMLElement).dataset.fx)} render path`);
		await page.addStyleTag({ content: OVERLAY_CSS });
		// Built as a string: tsx wraps named functions in a helper that doesn't exist in the page.
		const overlays: Record<string, string> = {
			'mc-top': `${who}<br><span>$${Math.round(day.btc).toLocaleString('en-US')} · ${dateLabel} close</span>`,
			...Object.fromEntries(
				figures.map((f) => [
					`mc-${f.id}`,
					`<p class="big">${f.card.big}<span>${f.card.unit}</span></p><p class="mid">${f.card.mid}</p>` +
						// The mass, unless the big figure already is one (plutonium's grams).
						`<p class="sub">${f.card.subs[0].replace(/\.$/, '')}${f.card.unit.trim() === 'g' ? '' : ` · ${massWords(f.grams)}`}</p>` +
						(f.card.fine ? `<p class="fine">${f.card.fine}</p>` : ''),
				])
			),
			...Object.fromEntries(
				figures.map((f) => [`mc-tile-${f.id}`, `<p class="z">${f.tile.z}</p><p class="s">${f.tile.sym}</p><p class="n">${f.tile.label}</p><p class="m">${f.tile.mass}</p>`])
			),
			'mc-end': `<p class="l">${lead}</p><p class="b">${figures.map((f, i) => (i === figures.length - 1 ? `<span>${massWords(f.grams)} of ${f.name}.</span>` : `${massWords(f.grams)} of ${f.name}.`)).join('<br>')}</p><p class="u">bitcoinweighin.com</p>`,
		};
		await page.evaluate(`(() => {
			const o = ${JSON.stringify(overlays)};
			for (const id of Object.keys(o)) {
				const d = document.createElement('div');
				d.id = id;
				d.className = 'mc' + (id.startsWith('mc-tile-') ? ' mc-tile' : id === 'mc-top' || id === 'mc-end' ? '' : ' mc-panel');
				d.innerHTML = o[id];
				d.style.opacity = id === 'mc-top' ? '1' : '0';
				document.body.appendChild(d);
			}
		})()`);
		await page.evaluate(() => document.fonts.ready);
		// Warm every metal's materials in real time, so no frame waits on a load.
		for (const m of METALS) {
			await page.keyboard.press(m.key);
			await page.waitForTimeout(2500);
		}
		await page.keyboard.press(METALS[METALS.length - 1].key);
		await page.waitForTimeout(2500);
		await startVirtualClock(page);

		const frameMs = 1000 / fps;
		const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
		const total = METALS.length * segS + endS;
		let frames = 0;
		let seg = -1;
		const t0 = Date.now();
		for (;;) {
			const t = frames / fps;
			if (t >= total) break;
			const now = Math.min(METALS.length - 1, Math.floor(t / segS));
			if (now !== seg && t < METALS.length * segS) {
				seg = now;
				await page.keyboard.press(METALS[seg].key);
			}
			const endIn = smooth((t - METALS.length * segS) / 0.5);
			const ops: Record<string, number> = { 'mc-end': endIn, 'mc-top': 1 - endIn };
			figures.forEach((f, i) => {
				const s = i * segS;
				const inn = smooth((t - s - 0.5) / 0.4);
				const outt = i === figures.length - 1 ? endIn : smooth((t - (s + segS) + 0.3) / 0.3);
				ops[`mc-${f.id}`] = ops[`mc-tile-${f.id}`] = inn * (1 - outt);
			});
			await page.evaluate((o) => { for (const [id, v] of Object.entries(o)) (document.getElementById(id) as HTMLElement).style.opacity = String(v); }, ops);
			await advance(page, frames === 0 ? 0 : frameMs);
			await writeFile(join(dir, `f${String(frames).padStart(4, '0')}.png`), await page.screenshot());
			frames++;
			if (frames % 30 === 0) console.log(`  frame ${frames}  t=${t.toFixed(1)}s  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
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
