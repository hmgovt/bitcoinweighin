/**
 * build-cards.ts — pre-render the link cards into the built site.
 *
 * A card takes about a second of CPU to render (Satori lays it out, resvg
 * rasterises it), far past a Worker's CPU limit: rendered on request, most
 * cards failed with Cloudflare error 1102 or came back empty. So they are
 * rendered here, at build time, into build/og/cards/<cardKey>.png, and
 * functions/index.ts and functions/og-image.ts serve those files.
 *
 * Renders the cards in cardLinks() below, plus the extra links listed in
 * scripts/og/card-links.json (posts with a date or an unusual amount). Add a
 * post's link there before it goes out, or its card falls back to the
 * commodity's 1 BTC card.
 *
 *   npm run build     # runs this after vite build
 *   npx tsx scripts/og/build-cards.ts --out=build/og/cards
 *
 * Fonts are vendored in scripts/og/fonts (SIL Open Font License), so the
 * build needs no network.
 */
import satori from 'satori';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { buildCard, cardKey, cardModel, presetBtc, CARD_PRESETS, CARD_W, CARD_H } from '../../functions/_card.ts';
import { BRAND_MARK_DATA_URL, OG_COMMODITIES, type PricesFile } from '../../functions/_lib.ts';

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const out = resolve(arg('out') ?? 'build/og/cards');

const FONTS = [
	['Inter Tight', 600, 'InterTight-600.ttf'],
	['Inter Tight', 700, 'InterTight-700.ttf'],
	['Inter Tight', 900, 'InterTight-900.ttf'],
	['JetBrains Mono', 500, 'JetBrainsMono-500.ttf'],
	['JetBrains Mono', 700, 'JetBrainsMono-700.ttf'],
] as const;

export interface CardLink { commodity: string; btc?: number; preset?: string; date?: string }

/**
 * Every card the build renders: each commodity at 1 BTC and at each holder
 * (latest close); the homepage's landing view (500 BTC of gold); 1 BTC of
 * gold at each year's end, for the /snapshot pages; then the extras.
 */
export function cardLinks(extras: string[], years: number[]): CardLink[] {
	const links: CardLink[] = [];
	for (const commodity of Object.keys(OG_COMMODITIES)) {
		links.push({ commodity, btc: 1 });
		for (const preset of CARD_PRESETS) links.push({ commodity, preset });
	}
	links.push({ commodity: 'gold', btc: 500 });
	for (const y of years) links.push({ commodity: 'gold', btc: 1, date: `${y}-12-31` });
	for (const qs of extras) {
		const q = new URLSearchParams(qs);
		const btc = Number(q.get('btc'));
		links.push({
			commodity: q.get('commodity') ?? 'gold',
			...(q.get('preset') ? { preset: q.get('preset')! } : { btc: btc > 0 ? btc : 1 }),
			...(q.get('date') ? { date: q.get('date')! } : {}),
		});
	}
	return links;
}

async function main() {
	const require = createRequire(import.meta.url);
	await initWasm(await readFile(require.resolve('@resvg/resvg-wasm/index_bg.wasm')));
	const fonts = await Promise.all(
		FONTS.map(async ([name, weight, file]) => ({ name, weight, style: 'normal' as const, data: await readFile(join('scripts/og/fonts', file)) }))
	);
	const prices = JSON.parse(await readFile('static/prices.json', 'utf8')) as PricesFile;
	const dates = Object.keys(prices).sort();
	const latest = dates[dates.length - 1];
	const years = [...new Set(dates.filter((d) => d.endsWith('-12-31')).map((d) => Number(d.slice(0, 4))))];
	const extras = JSON.parse(await readFile('scripts/og/card-links.json', 'utf8')) as string[];
	await mkdir(out, { recursive: true });

	const art = new Map<string, string>();
	const seen = new Set<string>();
	const t0 = Date.now();
	for (const link of cardLinks(extras, years)) {
		const key = cardKey(link);
		if (seen.has(key)) continue;
		seen.add(key);
		const date = link.date && prices[link.date] ? link.date : latest;
		const btc = link.preset ? presetBtc(link.preset) ?? 1 : link.btc ?? 1;
		const model = cardModel({ commodity: link.commodity, btc, preset: link.preset, date, day: prices[date] });
		if (model.art && !art.has(model.art)) art.set(model.art, `data:image/jpeg;base64,${(await readFile(join('static/og/art', model.art))).toString('base64')}`);
		const svg = await satori(buildCard(model, model.art ? art.get(model.art)! : null, BRAND_MARK_DATA_URL) as never, { width: CARD_W, height: CARD_H, fonts });
		await writeFile(join(out, `${key}.png`), new Resvg(svg, { fitTo: { mode: 'width', value: CARD_W } }).render().asPng());
	}
	console.log(`link cards: ${seen.size} rendered into ${out} (${((Date.now() - t0) / 1000).toFixed(0)} s, close ${latest})`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/og/build-cards.ts')) {
	main().catch((e) => {
		console.error(e);
		process.exit(1);
	});
}
