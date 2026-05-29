/**
 * make-card.ts — single-frame share card for the X bot.
 *
 * A thin subset of make-gold-video.ts: launch chromium, navigate to a
 * deep link (?btc=&commodity=&date=), wait for the page to settle, scroll
 * the chosen commodity into view, optionally inject a caption overlay, and
 * take one screenshot at 1200×675 (X's 16:9 single-image size).
 *
 * The capture helpers are copied (not imported) from make-gold-video.ts so
 * this stays decoupled from the video pipeline — that script is unexported
 * and load-bearing; we don't refactor it just to share three functions.
 *
 *   npx tsx scripts/bot/make-card.ts --btc=1000 --commodity=gold
 *   npx tsx scripts/bot/make-card.ts --btc=1000 --commodity=gold --date=2026-05-28
 *   npx tsx scripts/bot/make-card.ts --btc=1000 --commodity=gold --caption="..."
 *   npx tsx scripts/bot/make-card.ts --btc=811291 --commodity=gold --out=blackrock.png
 *
 * Preconditions: dev server running (npm run dev) at SITE_BASE_URL, and
 * `npx playwright install chromium` done once.
 */
import { chromium, type Page } from 'playwright';
import { promises as fs } from 'node:fs';
import { dirname, join, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');
const OUT_DIR = join(PROJECT_ROOT, 'output', 'cards');
const PRICES_LATEST = join(PROJECT_ROOT, 'static', 'prices-latest.json');

const SITE_BASE_URL = process.env.SITE_BASE_URL ?? 'http://localhost:5173';

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 675;

// Launch commodities that have an in-page section anchor (#id).
const KNOWN_COMMODITIES = new Set(['gold', 'silver', 'pu238', 'cocaine']);

interface Args {
	btc: number;
	commodity: string;
	date?: string;
	caption?: string;
	out: string;
}

function parseArgs(argv: string[]): Args {
	const get = (name: string) =>
		argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');

	const btcRaw = get('btc') ?? '1';
	const btc = parseFloat(btcRaw);
	if (isNaN(btc) || btc <= 0) throw new Error(`--btc must be a positive number, got "${btcRaw}"`);

	const commodity = get('commodity') ?? 'gold';
	if (!KNOWN_COMMODITIES.has(commodity)) {
		throw new Error(
			`--commodity must be one of ${[...KNOWN_COMMODITIES].join(', ')}, got "${commodity}"`,
		);
	}

	const date = get('date');
	const caption = get('caption');
	const out = get('out') ?? `${commodity}-${btc}.png`;

	return { btc, commodity, date, caption, out };
}

async function latestDatasetDate(): Promise<string> {
	const raw = await fs.readFile(PRICES_LATEST, 'utf-8');
	const obj = JSON.parse(raw) as Record<string, unknown>;
	const dates = Object.keys(obj).sort();
	return dates[dates.length - 1];
}

// ── Copied capture helpers (subset of make-gold-video.ts) ─────────

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
		.catch(() => {
			// Date hydration clamp may differ; the readout still reflects the page's chosen date.
		});
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
	await page.waitForTimeout(60);
}

async function injectCaption(page: Page, caption: string): Promise<void> {
	await page.evaluate((text) => {
		const existing = document.getElementById('__card-overlay');
		if (existing) existing.remove();
		const card = document.createElement('div');
		card.id = '__card-overlay';
		card.textContent = text;
		card.style.cssText = [
			'position: fixed',
			'bottom: 28px',
			'left: 50%',
			'transform: translateX(-50%)',
			'max-width: 86%',
			'padding: 14px 22px',
			'background: rgba(9, 9, 11, 0.92)',
			'color: #fafafa',
			"font-family: 'JetBrains Mono', ui-monospace, monospace",
			'font-size: 20px',
			'line-height: 1.4',
			'font-weight: 500',
			'text-align: center',
			'border-radius: 10px',
			'border: 1px solid rgba(251, 191, 36, 0.55)',
			'box-shadow: 0 12px 40px -12px rgba(0, 0, 0, 0.8)',
			'z-index: 9999',
			'pointer-events: none',
		].join(';');
		document.body.appendChild(card);
	}, caption);
}

// ── Reusable render ─────────────────────────────────────────────────

export interface RenderOpts {
	btc: number;
	commodity: string;
	date?: string;
	caption?: string;
	/** Absolute or relative-to-output/cards path. */
	out: string;
}

/** Render one share card to `out`. Returns the absolute path written. */
export async function renderCard(opts: RenderOpts): Promise<string> {
	if (!KNOWN_COMMODITIES.has(opts.commodity)) {
		throw new Error(`Unknown commodity "${opts.commodity}"`);
	}
	const date = opts.date ?? (await latestDatasetDate());
	const outPath = isAbsolute(opts.out) ? opts.out : join(OUT_DIR, opts.out);
	await fs.mkdir(dirname(outPath), { recursive: true });

	const url = `${SITE_BASE_URL}/?btc=${opts.btc}&commodity=${opts.commodity}&date=${date}`;
	const browser = await chromium.launch({ headless: true });
	try {
		const context = await browser.newContext({
			viewport: { width: CARD_WIDTH, height: CARD_HEIGHT },
			deviceScaleFactor: 2, // retina-sharp output
		});
		const page = await context.newPage();
		await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
		await waitForReady(page, date, opts.commodity);
		await scrollToCommodity(page, opts.commodity);
		if (opts.caption) await injectCaption(page, opts.caption);
		await page.screenshot({ path: outPath, type: 'png', fullPage: false });
		return outPath;
	} finally {
		await browser.close();
	}
}

// ── CLI ─────────────────────────────────────────────────────────────

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const date = args.date ?? (await latestDatasetDate());
	console.log(`Card: ${args.commodity} @ ${args.btc} BTC, ${date}`);
	const out = await renderCard(args);
	console.log(`  ✓ ${out}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
