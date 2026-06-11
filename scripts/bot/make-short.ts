/**
 * make-short.ts — daily "weigh-in" vertical Short for TikTok / Reels / Shorts.
 *
 * A short (~10s) 1080×1920 clip built from three captured beats:
 *   1. title  — "What does 1 BTC weigh today?" + date
 *   2. reveal — the commodity panel + the absolute headline (cube + weight)
 *   3. delta  — the same panel + the day-over-day weight-delta reframe
 *
 * It reuses the bot's capture approach (deep-link → headless chromium →
 * screenshot) and the delta engine (deltas.ts / objects.json), then stitches
 * the three stills into an MP4 with a gentle ken-burns zoom and crossfades
 * via ffmpeg. It writes nothing to X — that's the caller's job.
 *
 *   # standalone (computes its own captions for the latest dataset day):
 *   npx tsx scripts/bot/make-short.ts --commodity=gold
 *   npx tsx scripts/bot/make-short.ts --commodity=silver --out=silver.mp4
 *
 *   # against production (no dev server needed):
 *   SITE_BASE_URL=https://bitcoinweighin.com npx tsx scripts/bot/make-short.ts --commodity=gold
 *
 * Preconditions: ffmpeg on PATH, `npx playwright install chromium` done once,
 * and a reachable SITE_BASE_URL (dev server locally, or production in CI).
 */
import 'dotenv/config';
import { chromium, type Page } from 'playwright';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { dirname, join, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeDelta } from './deltas.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');
const OBJECTS_PATH = join(__dirname, 'objects.json');
const CONFIG_PATH = join(__dirname, 'config.json');
const PRICES_PATH = join(PROJECT_ROOT, 'static', 'prices.json');
const OUT_DIR = join(PROJECT_ROOT, 'output', 'shorts');

const SITE_BASE_URL = process.env.SITE_BASE_URL ?? 'http://localhost:5173';

const W = 1080;
const H = 1920;
const FPS = 30;
const TROY_OZ_G = 31.1035;
const LB_PER_KG = 2.20462;

// Beat durations (seconds) and crossfade length.
const DUR = { title: 2.5, reveal: 4.5, delta: 4.0 };
const XFADE = 0.6;

const KNOWN = new Set(['gold', 'silver', 'pu238', 'cocaine']);
type CommodityId = 'gold' | 'silver' | 'cocaine' | 'pu238';

// ── Types (subset of config.json / objects.json) ────────────────────
interface Phys {
	display: string;
	noun: string;
	shape: 'cube' | 'mass';
	densityGPerCm3?: number;
	novelty?: boolean;
}
interface Config {
	siteBase: string;
	physical: Record<CommodityId, Phys>;
}
type DayPrices = { btc: number; [field: string]: number };
type PriceData = Record<string, DayPrices>;

// ── Content math (mirrors run.ts/deltas.ts; kept local so run.ts stays untouched) ──
function gramsPerBtc(commodity: CommodityId, day: DayPrices, objs: any): number {
	const rule = objs.pricing[commodity];
	if (rule.kind === 'fixed') return day.btc / rule.usdPerGram;
	const usdPerGram = rule.perTroyOz ? day[rule.field] / TROY_OZ_G : day[rule.field];
	return day.btc / usdPerGram;
}

function fmtWeight(grams: number): string {
	const kg = grams / 1000;
	const lb = kg * LB_PER_KG;
	if (grams < 1000) return `${grams.toFixed(0)} g (${lb.toFixed(2)} lb)`;
	return `${kg.toFixed(1)} kg (${lb.toFixed(1)} lb)`;
}

function cubeEdge(grams: number, density: number): string {
	const cm = Math.cbrt(grams / density);
	const mm = cm * 10;
	return mm < 100 ? `${mm.toFixed(0)} mm` : `${cm.toFixed(1)} cm`;
}

interface Beats {
	titleMain: string;
	titleSub: string;
	revealMain: string;
	revealSub: string;
	deltaMain: string;
}

function humanDate(iso: string): string {
	return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		timeZone: 'UTC',
	});
}

/** Compute the three on-screen lines for a commodity on the latest dataset day. */
function buildBeats(commodity: CommodityId, cfg: Config, objs: any, prices: PriceData): Beats {
	const dates = Object.keys(prices).sort();
	const [pd, cd] = [dates[dates.length - 2], dates[dates.length - 1]];
	const phys = cfg.physical[commodity];
	const grams = gramsPerBtc(commodity, prices[cd], objs);
	const weight = fmtWeight(grams);

	let revealMain: string;
	if (phys.shape === 'cube' && phys.densityGPerCm3) {
		revealMain = `a ${cubeEdge(grams, phys.densityGPerCm3)} cube of ${phys.noun}`;
	} else {
		revealMain = `${weight.split(' (')[0]} of ${phys.noun}`;
	}

	const delta = computeDelta(objs, commodity, { date: pd, day: prices[pd] }, { date: cd, day: prices[cd] });

	return {
		titleMain: 'What does 1 BTC weigh today?',
		titleSub: humanDate(cd),
		revealMain: `1 BTC = ${revealMain}`,
		revealSub: `Weighs ${weight}`,
		deltaMain: delta.caption,
	};
}

// ── Capture helpers (copied subset of make-card.ts) ──────────────────
async function waitForReady(page: Page, expectedDate: string, commodity: string): Promise<void> {
	await page.waitForSelector(`#${commodity}`, { state: 'visible', timeout: 20_000 });
	await page
		.waitForFunction(
			(target: string) => {
				const el = document.querySelector('input[type="date"]') as HTMLInputElement | null;
				return el ? el.value === target : false;
			},
			expectedDate,
			{ timeout: 8_000 },
		)
		.catch(() => {});
	await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => r())));
}

async function scrollToCommodity(page: Page, commodity: string): Promise<void> {
	await page.evaluate((id) => {
		const el = document.getElementById(id);
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const offset = window.scrollY + rect.top - 80;
		window.scrollTo({ top: offset, behavior: 'instant' as ScrollBehavior });
	}, commodity);
	await page.waitForTimeout(80);
}

/** Bottom caption card (reveal/delta beats). `accent` tints the border. */
async function injectCaption(page: Page, main: string, sub: string | null, accent: string): Promise<void> {
	await page.evaluate(
		({ main, sub, accent }) => {
			document.getElementById('__short-overlay')?.remove();
			const wrap = document.createElement('div');
			wrap.id = '__short-overlay';
			wrap.style.cssText = [
				'position: fixed',
				'left: 50%',
				'bottom: 120px',
				'transform: translateX(-50%)',
				'width: 86%',
				'padding: 32px 36px',
				'background: rgba(9, 9, 11, 0.92)',
				'border-radius: 20px',
				`border: 2px solid ${accent}`,
				'box-shadow: 0 24px 80px -24px rgba(0,0,0,0.85)',
				'text-align: center',
				'z-index: 9999',
				'pointer-events: none',
			].join(';');
			const m = document.createElement('div');
			m.textContent = main;
			m.style.cssText = [
				'color: #fafafa',
				"font-family: 'Inter Tight', system-ui, sans-serif",
				'font-size: 46px',
				'font-weight: 700',
				'line-height: 1.2',
				'letter-spacing: -0.01em',
			].join(';');
			wrap.appendChild(m);
			if (sub) {
				const s = document.createElement('div');
				s.textContent = sub;
				s.style.cssText = [
					'margin-top: 14px',
					'color: #d4d4d8',
					"font-family: 'JetBrains Mono', ui-monospace, monospace",
					'font-size: 30px',
					'font-weight: 500',
				].join(';');
				wrap.appendChild(s);
			}
			document.body.appendChild(wrap);
		},
		{ main, sub, accent },
	);
}

/** Full-screen branded title card (covers the page). */
async function injectTitle(page: Page, main: string, sub: string): Promise<void> {
	await page.evaluate(
		({ main, sub }) => {
			document.getElementById('__short-title')?.remove();
			const wrap = document.createElement('div');
			wrap.id = '__short-title';
			wrap.style.cssText = [
				'position: fixed',
				'inset: 0',
				'background: #09090b',
				'display: flex',
				'flex-direction: column',
				'align-items: center',
				'justify-content: center',
				'gap: 28px',
				'padding: 0 64px',
				'text-align: center',
				'z-index: 10000',
				'pointer-events: none',
			].join(';');
			const m = document.createElement('div');
			m.textContent = main;
			m.style.cssText = [
				'color: #fafafa',
				"font-family: 'Inter Tight', system-ui, sans-serif",
				'font-size: 72px',
				'font-weight: 800',
				'line-height: 1.12',
				'letter-spacing: -0.02em',
			].join(';');
			const s = document.createElement('div');
			s.textContent = sub;
			s.style.cssText = [
				'color: #fbbf24',
				"font-family: 'JetBrains Mono', ui-monospace, monospace",
				'font-size: 38px',
				'font-weight: 600',
				'letter-spacing: 0.02em',
			].join(';');
			wrap.appendChild(m);
			wrap.appendChild(s);
			document.body.appendChild(wrap);
		},
		{ main, sub },
	);
}

// ── ffmpeg ───────────────────────────────────────────────────────────
function runFfmpeg(args: string[]): Promise<void> {
	return new Promise((res, rej) => {
		const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'inherit'] });
		child.on('error', rej);
		child.on('exit', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}`))));
	});
}

/** Turn one still into a clip with a slow ken-burns zoom over `dur` seconds. */
async function beatClip(png: string, dur: number, out: string): Promise<void> {
	const frames = Math.round(dur * FPS);
	// Single still in; zoompan generates `frames` output frames from it.
	// (Looping the input first would multiply frames×frames — a 400s clip.)
	// Upscale 2× before zoompan to avoid the well-known integer-step jitter.
	await runFfmpeg([
		'-y',
		'-i', png,
		'-vf',
		`scale=${W * 2}:${H * 2},zoompan=z='min(zoom+0.0006,1.10)':d=${frames}:s=${W}x${H}:fps=${FPS},format=yuv420p`,
		'-frames:v', String(frames),
		'-c:v', 'libx264',
		'-preset', 'medium',
		'-crf', '18',
		out,
	]);
}

/** Crossfade three beat clips into the final Short. */
async function assemble(clips: { path: string; dur: number }[], out: string): Promise<void> {
	const [a, b, c] = clips;
	const off1 = (a.dur - XFADE).toFixed(3);
	const off2 = (a.dur + b.dur - 2 * XFADE).toFixed(3);
	await runFfmpeg([
		'-y',
		'-i', a.path,
		'-i', b.path,
		'-i', c.path,
		'-filter_complex',
		`[0][1]xfade=transition=fade:duration=${XFADE}:offset=${off1}[ab];` +
			`[ab][2]xfade=transition=fade:duration=${XFADE}:offset=${off2}[v]`,
		'-map', '[v]',
		'-c:v', 'libx264',
		'-preset', 'medium',
		'-crf', '18',
		'-pix_fmt', 'yuv420p',
		'-movflags', '+faststart',
		out,
	]);
}

// ── Public API ───────────────────────────────────────────────────────
export interface ShortOpts {
	commodity: CommodityId;
	date?: string;
	beats: Beats;
	/** Absolute or relative-to-output/shorts path. */
	out: string;
}

/** Render one daily Short to `out`. Returns the absolute path written. */
export async function renderShort(opts: ShortOpts): Promise<string> {
	if (!KNOWN.has(opts.commodity)) throw new Error(`Unknown commodity "${opts.commodity}"`);
	const outPath = isAbsolute(opts.out) ? opts.out : join(OUT_DIR, opts.out);
	const work = join(OUT_DIR, '.work', `${opts.commodity}-${Date.now()}`);
	await fs.mkdir(work, { recursive: true });
	await fs.mkdir(dirname(outPath), { recursive: true });

	const date = opts.date ?? (await latestDate());
	const url = `${SITE_BASE_URL}/?btc=1&commodity=${opts.commodity}&date=${date}`;
	const accent = opts.commodity === 'pu238' ? 'rgba(74, 222, 128, 0.7)' : 'rgba(251, 191, 36, 0.6)';

	const titlePng = join(work, 'title.png');
	const revealPng = join(work, 'reveal.png');
	const deltaPng = join(work, 'delta.png');

	const browser = await chromium.launch({ headless: true });
	try {
		const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
		const page = await context.newPage();
		await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
		await waitForReady(page, date, opts.commodity);
		await scrollToCommodity(page, opts.commodity);

		// reveal beat
		await injectCaption(page, opts.beats.revealMain, opts.beats.revealSub, accent);
		await page.screenshot({ path: revealPng, type: 'png', fullPage: false });

		// delta beat (swap caption, keep panel)
		await injectCaption(page, opts.beats.deltaMain, null, accent);
		await page.screenshot({ path: deltaPng, type: 'png', fullPage: false });

		// title beat (full-screen cover)
		await injectTitle(page, opts.beats.titleMain, opts.beats.titleSub);
		await page.screenshot({ path: titlePng, type: 'png', fullPage: false });
	} finally {
		await browser.close();
	}

	const titleClip = join(work, 'title.mp4');
	const revealClip = join(work, 'reveal.mp4');
	const deltaClip = join(work, 'delta.mp4');
	await beatClip(titlePng, DUR.title, titleClip);
	await beatClip(revealPng, DUR.reveal, revealClip);
	await beatClip(deltaPng, DUR.delta, deltaClip);

	await assemble(
		[
			{ path: titleClip, dur: DUR.title },
			{ path: revealClip, dur: DUR.reveal },
			{ path: deltaClip, dur: DUR.delta },
		],
		outPath,
	);

	await fs.rm(work, { recursive: true, force: true });
	return outPath;
}

async function latestDate(): Promise<string> {
	const prices = JSON.parse(await fs.readFile(PRICES_PATH, 'utf-8')) as PriceData;
	const dates = Object.keys(prices).sort();
	return dates[dates.length - 1];
}

// ── CLI ──────────────────────────────────────────────────────────────
function arg(name: string): string | undefined {
	return process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
}

async function main() {
	const commodity = (arg('commodity') ?? 'gold') as CommodityId;
	if (!KNOWN.has(commodity)) throw new Error(`--commodity must be one of ${[...KNOWN].join(', ')}`);

	const [cfg, objs, prices] = await Promise.all([
		fs.readFile(CONFIG_PATH, 'utf-8').then(JSON.parse) as Promise<Config>,
		fs.readFile(OBJECTS_PATH, 'utf-8').then(JSON.parse),
		fs.readFile(PRICES_PATH, 'utf-8').then(JSON.parse) as Promise<PriceData>,
	]);

	const date = arg('date') ?? Object.keys(prices).sort().slice(-1)[0];
	const beats = buildBeats(commodity, cfg, objs, prices);
	const out = arg('out') ?? `${commodity}-${date}.mp4`;

	console.log('─'.repeat(56));
	console.log(`commodity: ${commodity}   date: ${date}`);
	console.log(`title:  ${beats.titleMain} · ${beats.titleSub}`);
	console.log(`reveal: ${beats.revealMain} — ${beats.revealSub}`);
	console.log(`delta:  ${beats.deltaMain}`);
	console.log(`site:   ${SITE_BASE_URL}`);
	console.log('─'.repeat(56));

	const path = await renderShort({ commodity, date, beats, out });
	console.log(`✓ ${path}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((err) => {
		console.error('✗ make-short failed:', err?.message || err);
		process.exit(1);
	});
}
