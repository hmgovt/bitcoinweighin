/**
 * make-gold-video.ts — historical gold visualisation, automated capture.
 *
 * Drives a headless browser across the full BTC price history (2013-01-02
 * to today) at a fixed BTC amount (default 1000) and screenshots the page
 * once per `stepDays` of the dataset. Frames are written to
 * `output/frames/{cut}/00000.png` and stitched into MP4 + WebM via
 * ffmpeg. An overlay layer injected before each screenshot draws the
 * date readout and anchor-event captions.
 *
 * The point of 1000 BTC (not 1) is that the gold cube ranges from
 * marble-sized in 2013 to dog-sized today, which is the entire site's
 * thesis distilled into one camera move.
 *
 *   npx tsx scripts/make-gold-video.ts                 # default: x-landscape
 *   npx tsx scripts/make-gold-video.ts --cut=hn-long
 *   npx tsx scripts/make-gold-video.ts --cut=shorts-vert
 *   npx tsx scripts/make-gold-video.ts --cut=all
 *
 * ── Preconditions ────────────────────────────────────────────
 *
 *   1. Playwright is installed:
 *        npm install -D playwright
 *        npx playwright install chromium
 *
 *   2. ffmpeg is on PATH:
 *        macOS:  brew install ffmpeg
 *        Linux:  sudo apt install ffmpeg
 *
 *   3. The dev server is running at SITE_BASE_URL (default
 *      http://localhost:5173):
 *        npm run dev
 *
 *   4. The cube-mode viewport sizing fix (max(shibaH, cubeH) × 1.10) is
 *      on main and rendering correctly at btc=1000 across the date range.
 *      Verify manually before kicking off — an 80-minute run captures
 *      whatever the page renders, bugs included.
 *
 * ── Runtime budget ───────────────────────────────────────────
 *
 *   Frames are ~1620 at stepDays=3, ~700 at stepDays=7. Each frame:
 *   goto + wait + screenshot ≈ 2–3 seconds. So:
 *     x-landscape (7-day step):   25–35 min
 *     hn-long     (3-day step):   50–80 min
 *     shorts-vert (5-day step):   30–45 min
 *     all three:                  ~2–3 hours
 *
 *   Run overnight on the first pass.
 */

import { chromium, type Page, type BrowserContext, type Browser } from 'playwright';
import { spawn } from 'node:child_process';
import { promises as fs, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Config ──────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const OUTPUT_DIR = join(PROJECT_ROOT, 'output');
const FRAMES_DIR = join(OUTPUT_DIR, 'frames');
const VIDEOS_DIR = join(OUTPUT_DIR, 'video');

const SITE_BASE_URL = process.env.SITE_BASE_URL ?? 'http://localhost:5173';
const PRICES_PATH = join(PROJECT_ROOT, 'static', 'prices.json');

interface VideoConfig {
	name: string;
	width: number;
	height: number;
	stepDays: number;
	fps: number;
	btcAmount: number;
	/** Extra frames to dwell on anchor events (turns each anchor into a visual pause). */
	anchorHoldFrames: number;
}

const CUTS: VideoConfig[] = [
	{ name: 'x-landscape', width: 1280, height: 720, stepDays: 7, fps: 30, btcAmount: 1000, anchorHoldFrames: 45 },
	{ name: 'hn-long', width: 1280, height: 720, stepDays: 3, fps: 30, btcAmount: 1000, anchorHoldFrames: 60 },
	{ name: 'shorts-vert', width: 1080, height: 1920, stepDays: 5, fps: 30, btcAmount: 1000, anchorHoldFrames: 45 },
];

// ── Anchor events ──────────────────────────────────────────────
// Loaded from src/lib/events.json if present; otherwise this baked-in
// fallback list runs. The list mirrors the SPEC anchor events that fall
// within the dataset range (2013-01 onward). Pizza Day (2010-05-22) and
// the Genesis Block (2009) sit outside the dataset and are skipped.

interface AnchorEvent {
	date: string;       // ISO date YYYY-MM-DD
	title: string;
	caption: string;    // ≤ 120 chars per SPEC
}

const FALLBACK_EVENTS: AnchorEvent[] = [
	{ date: '2014-02-24', title: 'Mt. Gox halts withdrawals', caption: 'Mt. Gox — the largest exchange — collapses, taking ~850,000 BTC with it.' },
	{ date: '2016-07-09', title: 'Second halving', caption: 'Block reward drops from 25 BTC to 12.5. Supply issuance halves overnight.' },
	{ date: '2017-12-17', title: 'First $20k peak', caption: '1 BTC briefly trades above $20,000 — the cycle that brought bitcoin into mainstream view.' },
	{ date: '2020-03-12', title: 'COVID liquidity crash', caption: 'Global markets plunge; BTC falls ~50 % in a day to ~$4,000 alongside equities.' },
	{ date: '2020-05-11', title: 'Third halving', caption: 'Block reward drops from 12.5 BTC to 6.25. Stock-to-flow tightens.' },
	{ date: '2021-11-10', title: '$69k all-time high', caption: 'BTC peaks at $69,000 amid the institutional inflows wave.' },
	{ date: '2022-11-11', title: 'FTX collapse', caption: 'FTX files for bankruptcy. Sam Bankman-Fried later convicted on seven counts.' },
	{ date: '2024-01-11', title: 'Spot ETFs approved', caption: 'The SEC approves the first US spot bitcoin ETFs. BlackRock IBIT begins trading.' },
	{ date: '2024-04-19', title: 'Fourth halving', caption: 'Block reward drops from 6.25 BTC to 3.125. The post-halving cycle begins.' },
	{ date: '2024-12-05', title: '$100k breach', caption: '1 BTC trades above $100,000 for the first time.' },
];

async function loadEvents(): Promise<AnchorEvent[]> {
	const eventsPath = join(PROJECT_ROOT, 'src', 'lib', 'events.json');
	if (existsSync(eventsPath)) {
		const raw = await fs.readFile(eventsPath, 'utf-8');
		const parsed = JSON.parse(raw);
		// Accept either { events: [...] } or a top-level array.
		const list = Array.isArray(parsed) ? parsed : parsed.events;
		if (Array.isArray(list)) return list as AnchorEvent[];
	}
	return FALLBACK_EVENTS;
}

// ── Date helpers ───────────────────────────────────────────────

function addDays(iso: string, days: number): string {
	const d = new Date(iso + 'T00:00:00Z');
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

function formatHumanDate(iso: string): string {
	const d = new Date(iso + 'T00:00:00Z');
	return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function formatYearMonth(iso: string): string {
	const d = new Date(iso + 'T00:00:00Z');
	return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', timeZone: 'UTC' });
}

// ── Frame capture ──────────────────────────────────────────────

async function injectOverlay(
	page: Page,
	dateStr: string,
	anchorMatch: AnchorEvent | null,
): Promise<void> {
	await page.evaluate(
		({ humanDate, anchor }) => {
			const existing = document.getElementById('__video-overlay');
			if (existing) existing.remove();

			const overlay = document.createElement('div');
			overlay.id = '__video-overlay';
			overlay.style.cssText = [
				'position: fixed',
				'inset: 0',
				'pointer-events: none',
				'z-index: 9999',
				"font-family: 'Inter Tight', system-ui, sans-serif",
			].join(';');

			// Date readout, top-left.
			const date = document.createElement('div');
			date.textContent = humanDate;
			date.style.cssText = [
				'position: absolute',
				'top: 24px',
				'left: 24px',
				'padding: 8px 14px',
				'background: rgba(9, 9, 11, 0.78)',
				'color: #fafafa',
				"font-family: 'JetBrains Mono', ui-monospace, monospace",
				'font-size: 22px',
				'font-weight: 500',
				'letter-spacing: 0.04em',
				'border-radius: 6px',
				'border: 1px solid rgba(255, 255, 255, 0.08)',
			].join(';');
			overlay.appendChild(date);

			if (anchor) {
				const card = document.createElement('div');
				card.style.cssText = [
					'position: absolute',
					'bottom: 32px',
					'left: 50%',
					'transform: translateX(-50%)',
					'max-width: 80%',
					'padding: 14px 22px',
					'background: rgba(9, 9, 11, 0.92)',
					'color: #fafafa',
					'border-radius: 10px',
					'border: 1px solid rgba(251, 191, 36, 0.55)', // amber border
					'box-shadow: 0 12px 40px -12px rgba(0, 0, 0, 0.8)',
					'text-align: center',
				].join(';');
				const title = document.createElement('div');
				title.textContent = anchor.title;
				title.style.cssText = [
					'color: #fbbf24',
					'font-size: 22px',
					'font-weight: 600',
					'margin-bottom: 4px',
					'letter-spacing: -0.01em',
				].join(';');
				const caption = document.createElement('div');
				caption.textContent = anchor.caption;
				caption.style.cssText = [
					'color: #e4e4e7',
					'font-size: 16px',
					'line-height: 1.4',
				].join(';');
				card.appendChild(title);
				card.appendChild(caption);
				overlay.appendChild(card);
			}

			document.body.appendChild(overlay);
		},
		{
			humanDate: formatHumanDate(dateStr),
			anchor: anchorMatch,
		},
	);
}

async function waitForReady(page: Page, expectedDate: string): Promise<void> {
	// Wait for the gold panel to be present (prices loaded, panels rendered)
	// and for the date input to reflect the requested date (URL hydration
	// done). The page doesn't animate on date change — once those two are
	// true, the readout is at its final value.
	await page.waitForSelector('#gold', { state: 'visible', timeout: 20_000 });
	await page.waitForFunction(
		(target: string) => {
			const el = document.querySelector('input[type="date"]') as HTMLInputElement | null;
			return el ? el.value === target : false;
		},
		expectedDate,
		{ timeout: 8_000 },
	).catch(() => {
		// If date hydration didn't match (e.g. dateParam clamp), continue —
		// the readout still reflects whatever date the page picked.
	});
	// One animation frame settle so any layout effects flush.
	await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => r())));
}

async function scrollToGold(page: Page): Promise<void> {
	await page.evaluate(() => {
		const el = document.getElementById('gold');
		if (!el) return;
		// Scroll so the gold panel sits comfortably below the controls.
		const rect = el.getBoundingClientRect();
		const offset = window.scrollY + rect.top - 80;
		window.scrollTo({ top: offset, behavior: 'instant' as ScrollBehavior });
	});
	await page.waitForTimeout(60);
}

async function captureFrame(
	page: Page,
	dateStr: string,
	anchorMatch: AnchorEvent | null,
	outPath: string,
	btcAmount: number,
): Promise<void> {
	const url = `${SITE_BASE_URL}/?btc=${btcAmount}&date=${dateStr}`;
	await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
	await waitForReady(page, dateStr);
	await scrollToGold(page);
	await injectOverlay(page, dateStr, anchorMatch);
	await page.screenshot({ path: outPath, type: 'png', fullPage: false });
}

// ── Stitch ─────────────────────────────────────────────────────

function runFfmpeg(args: string[]): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn('ffmpeg', args, { stdio: ['ignore', 'inherit', 'inherit'] });
		child.on('error', reject);
		child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
	});
}

async function stitch(config: VideoConfig, frameCount: number): Promise<{ mp4: string; webm: string }> {
	const framePattern = join(FRAMES_DIR, config.name, '%05d.png');
	const mp4 = join(VIDEOS_DIR, `${config.name}.mp4`);
	const webm = join(VIDEOS_DIR, `${config.name}.webm`);
	await fs.mkdir(VIDEOS_DIR, { recursive: true });

	console.log(`[${config.name}] stitching ${frameCount} frames → ${mp4}`);
	await runFfmpeg([
		'-y',
		'-framerate', String(config.fps),
		'-i', framePattern,
		'-c:v', 'libx264',
		'-pix_fmt', 'yuv420p',
		'-crf', '18',
		'-movflags', '+faststart',
		mp4,
	]);

	console.log(`[${config.name}] stitching → ${webm}`);
	await runFfmpeg([
		'-y',
		'-framerate', String(config.fps),
		'-i', framePattern,
		'-c:v', 'libvpx-vp9',
		'-crf', '30',
		'-b:v', '0',
		webm,
	]);

	return { mp4, webm };
}

// ── Run a cut ──────────────────────────────────────────────────

interface PricesFile { [date: string]: Record<string, number> }

async function loadDatasetRange(): Promise<{ first: string; last: string }> {
	const raw = await fs.readFile(PRICES_PATH, 'utf-8');
	const prices: PricesFile = JSON.parse(raw);
	const dates = Object.keys(prices).sort();
	return { first: dates[0], last: dates[dates.length - 1] };
}

function findAnchorMatch(dateStr: string, events: AnchorEvent[], windowDays: number): AnchorEvent | null {
	// Match anchor if the current frame date falls within [event.date, event.date + windowDays].
	// `windowDays` should be ≥ stepDays so we don't skip over an anchor sitting between two frames.
	for (const ev of events) {
		const evMs = new Date(ev.date + 'T00:00:00Z').getTime();
		const cursorMs = new Date(dateStr + 'T00:00:00Z').getTime();
		const diffDays = (cursorMs - evMs) / 86_400_000;
		if (diffDays >= 0 && diffDays < windowDays) return ev;
	}
	return null;
}

async function runCut(
	browser: Browser,
	config: VideoConfig,
	range: { first: string; last: string },
	events: AnchorEvent[],
): Promise<void> {
	const cutFramesDir = join(FRAMES_DIR, config.name);
	await fs.mkdir(cutFramesDir, { recursive: true });

	const context: BrowserContext = await browser.newContext({
		viewport: { width: config.width, height: config.height },
		deviceScaleFactor: 1,
		// Honour reduced-motion if set system-wide — the site has its own
		// reduced-motion paths and we want the capture to reflect them.
		reducedMotion: 'no-preference',
	});
	const page = await context.newPage();

	const visibleEvents = events.filter((e) => e.date >= range.first && e.date <= range.last);
	console.log(`[${config.name}] ${visibleEvents.length} anchor events within dataset range`);

	const start = Date.now();
	let cursor = range.first;
	let frameIndex = 0;
	let anchorsMarked = 0;
	const seenAnchorDates = new Set<string>();
	const windowDays = Math.max(config.stepDays, 1);

	while (cursor <= range.last) {
		const anchor = findAnchorMatch(cursor, visibleEvents, windowDays);
		const isNewAnchor = anchor !== null && !seenAnchorDates.has(anchor.date);
		const framePath = join(cutFramesDir, `${String(frameIndex).padStart(5, '0')}.png`);

		try {
			await captureFrame(page, cursor, anchor, framePath, config.btcAmount);
		} catch (err) {
			console.error(`[${config.name}] frame ${frameIndex} (${cursor}) failed:`, err);
			// Re-throw on the first failure so the user can diagnose; alternative
			// is to skip-and-continue, but a broken capture loop should be loud.
			throw err;
		}

		frameIndex++;
		if (isNewAnchor && anchor) {
			seenAnchorDates.add(anchor.date);
			anchorsMarked++;
			// Hold on the anchor frame by duplicating it `anchorHoldFrames` times.
			for (let h = 0; h < config.anchorHoldFrames; h++) {
				const dupPath = join(cutFramesDir, `${String(frameIndex).padStart(5, '0')}.png`);
				await fs.copyFile(framePath, dupPath);
				frameIndex++;
			}
		}

		if (frameIndex % 50 === 0) {
			const elapsedSec = (Date.now() - start) / 1000;
			console.log(`[${config.name}] frame ${frameIndex}, cursor ${cursor}, ${elapsedSec.toFixed(0)}s elapsed`);
		}

		if (cursor === range.last) break;
		const next = addDays(cursor, config.stepDays);
		cursor = next > range.last ? range.last : next;
	}

	await context.close();
	console.log(`[${config.name}] capture done — ${frameIndex} frames, ${anchorsMarked} anchors marked`);

	// Stitch
	const { mp4, webm } = await stitch(config, frameIndex);

	// Manifest
	const manifest = {
		name: config.name,
		btcAmount: config.btcAmount,
		dateRange: [range.first, range.last],
		totalFrames: frameIndex,
		anchorEventsMarked: anchorsMarked,
		stepDays: config.stepDays,
		fps: config.fps,
		duration: `${(frameIndex / config.fps).toFixed(1)}s`,
		resolution: `${config.width}x${config.height}`,
		files: [`${config.name}.mp4`, `${config.name}.webm`],
		generatedAt: new Date().toISOString(),
	};
	await fs.writeFile(
		join(VIDEOS_DIR, `${config.name}.manifest.json`),
		JSON.stringify(manifest, null, 2),
	);
	console.log(`[${config.name}] ✓ ${mp4}`);
	console.log(`[${config.name}] ✓ ${webm}`);
}

// ── Entry point ────────────────────────────────────────────────

function parseArgs(argv: string[]): { cuts: VideoConfig[] } {
	const cutArg = argv.find((a) => a.startsWith('--cut='))?.split('=')[1] ?? 'x-landscape';
	if (cutArg === 'all') return { cuts: CUTS };
	const cut = CUTS.find((c) => c.name === cutArg);
	if (!cut) {
		throw new Error(
			`Unknown cut "${cutArg}". Options: ${CUTS.map((c) => c.name).join(', ')}, all`,
		);
	}
	return { cuts: [cut] };
}

async function main() {
	const { cuts } = parseArgs(process.argv.slice(2));

	console.log('Bitcoin Weigh-In — historical gold video capture');
	console.log(`  site: ${SITE_BASE_URL}`);
	console.log(`  cuts: ${cuts.map((c) => c.name).join(', ')}`);

	const range = await loadDatasetRange();
	console.log(`  dataset: ${range.first} → ${range.last}`);

	const events = await loadEvents();
	console.log(`  events: ${events.length} candidates`);

	await fs.mkdir(FRAMES_DIR, { recursive: true });

	const browser = await chromium.launch({ headless: true });
	try {
		for (const cut of cuts) {
			await runCut(browser, cut, range, events);
		}
	} finally {
		await browser.close();
	}

	console.log('Done.');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
