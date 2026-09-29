/**
 * stage-still.ts — a still of any hero stage (gold, silver, Pu-238, cocaine,
 * cash, Manhattan) at any amount and date, for posts and link cards.
 *
 * Opens the homepage deep link, waits for the stage to report a rendered
 * frame (HeroStage's data-commodity hook), blows the stage up to fill the
 * viewport with its buttons and labels hidden, lets the camera settle, and
 * screenshots it. The numbers are the site's own for that day.
 *
 *   npx tsx scripts/clips/stage-still.ts --commodity=gold --btc=1
 *   npx tsx scripts/clips/stage-still.ts --commodity=gold --preset=satoshi --width=1200 --height=630
 *   npx tsx scripts/clips/stage-still.ts --commodity=cash --btc=1 --date=2013-01-02 --out=cash-2013.png
 *
 * Preconditions: a built site served locally (npm run build && npx vite preview
 * --port 4173) or --base=https://bitcoinweighin.com; Playwright chromium.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

const base = arg('base') ?? process.env.SITE_BASE_URL ?? 'http://localhost:4173';
const commodity = arg('commodity') ?? 'gold';
const preset = arg('preset');
const btc = arg('btc');
const date = arg('date');
const width = Number(arg('width') ?? 1200);
const height = Number(arg('height') ?? 630);
const dpr = Number(arg('dpr') ?? 2);
/** Real time to let the camera and animations settle once the stage is up. */
const settle = Number(arg('settle') ?? 9000);
const out = resolve(arg('out') ?? `output/stills/${commodity}-${preset ?? btc ?? 'default'}${date ? `-${date}` : ''}.png`);

// Every stage's root, and the chrome drawn over it that a still doesn't want.
const STAGES = '.live-stage, .bill-stage, .coke-stage, .land-stage';
const CHROME = [
	'.stage-buttons', '.land-credit', '.land-note', 'button', '[role="button"]',
	'.hud', '.ride-hud', '.ride-card', '.ride-alt', '.ride-label', '.scale-label', '.labels', '.corner', '.dragnote',
	'.hint', '.caption', '.chips', '.loupe-label', '.loupe-svg', '.cube-caption', '.cube-edge', '.edge-label',
].map((s) => `:is(${STAGES}) ${s}`).join(', ');

async function main() {
	const q = new URLSearchParams();
	if (preset) q.set('preset', preset);
	else if (btc) q.set('btc', btc);
	if (date) q.set('date', date);
	q.set('commodity', commodity);
	const url = `${base}/?${q}`;

	await mkdir(dirname(out), { recursive: true });
	const browser = await chromium.launch({
		executablePath: process.env.CHROMIUM_PATH || undefined,
		args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
	});
	try {
		const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
		console.log(`→ ${url}`);
		await page.goto(url, { waitUntil: 'domcontentloaded' });
		await page.waitForSelector(`section.hero-stage[data-commodity="${commodity}"]`, { timeout: 180_000 });
		await page.addStyleTag({
			content: `${STAGES.split(', ').map((s) => `section.hero-stage ${s}`).join(', ')} {
				position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important;
				max-width: none !important; max-height: none !important; margin: 0 !important;
				border-radius: 0 !important; border: 0 !important; z-index: 2147483000 !important; }
			${CHROME} { display: none !important; }
			html, body { overflow: hidden !important; }`,
		});
		await page.evaluate(() => document.fonts.ready);
		await page.waitForTimeout(settle);
		await page.screenshot({ path: out });
		console.log(`✓ ${out}`);
	} finally {
		await browser.close();
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
