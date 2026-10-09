/**
 * preview-cards.ts — render sample link cards locally, through the same
 * engine, fonts and element tree as the build (scripts/og/build-cards.ts),
 * to look them over before a deploy.
 *
 *   npx tsx scripts/og/preview-cards.ts --out=output/cards-preview
 */
import satori from 'satori';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { buildCard, cardModel, presetBtc, CARD_W, CARD_H } from '../../functions/_card.ts';
import { BRAND_MARK_DATA_URL, type PricesFile } from '../../functions/_lib.ts';

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const out = resolve(arg('out') ?? 'output/cards-preview');

const SAMPLES: { name: string; commodity: string; btc?: number; preset?: string }[] = [
	{ name: 'gold-1', commodity: 'gold', btc: 1 },
	{ name: 'gold-satoshi', commodity: 'gold', preset: 'satoshi' },
	{ name: 'silver-el-salvador', commodity: 'silver', preset: 'el-salvador' },
	{ name: 'pu238-1', commodity: 'pu238', btc: 1 },
	{ name: 'cocaine-1', commodity: 'cocaine', btc: 1 },
	{ name: 'cocaine-100', commodity: 'cocaine', btc: 100 },
	{ name: 'cash-1', commodity: 'cash', btc: 1 },
	{ name: 'cash-21m', commodity: 'cash', preset: 'market-cap' },
	{ name: 'manhattan-1', commodity: 'manhattan', btc: 1 },
	{ name: 'manhattan-pizza', commodity: 'manhattan', preset: 'pizza-day' },
	{ name: 'manhattan-strategy', commodity: 'manhattan', preset: 'strategy' },
	{ name: 'manhattan-21m', commodity: 'manhattan', preset: 'market-cap' },
	{ name: 'oil-1', commodity: 'oil', btc: 1 },
	{ name: 'oil-sats', commodity: 'oil', btc: 0.0003 },
	{ name: 'oil-el-salvador', commodity: 'oil', preset: 'el-salvador' },
	{ name: 'oil-strategy', commodity: 'oil', preset: 'strategy' },
	{ name: 'oil-21m', commodity: 'oil', preset: 'market-cap' },
];

async function main() {
	await initWasm(await readFile('node_modules/@resvg/resvg-wasm/index_bg.wasm'));
	const fonts = await Promise.all(
		([['Inter Tight', 600], ['Inter Tight', 700], ['Inter Tight', 900], ['JetBrains Mono', 500], ['JetBrains Mono', 700]] as const).map(async ([name, weight]) => ({
			name, weight, style: 'normal' as const, data: await readFile(`scripts/og/fonts/${name.replace(' ', '')}-${weight}.ttf`),
		}))
	);
	const prices = JSON.parse(await readFile('static/prices.json', 'utf8')) as PricesFile;
	const date = Object.keys(prices).sort().pop()!;
	await mkdir(out, { recursive: true });
	for (const s of SAMPLES) {
		const btc = s.btc ?? presetBtc(s.preset) ?? 1;
		const model = cardModel({ commodity: s.commodity, btc, preset: s.preset, date, day: prices[date] });
		const art = model.art ? `data:image/jpeg;base64,${(await readFile(join('static/og/art', model.art))).toString('base64')}` : null;
		const svg = await satori(buildCard(model, art, BRAND_MARK_DATA_URL) as never, { width: CARD_W, height: CARD_H, fonts });
		const png = new Resvg(svg, { fitTo: { mode: 'width', value: CARD_W } }).render().asPng();
		await writeFile(join(out, `${s.name}.png`), png);
		console.log(`✓ ${s.name}  ${model.eyebrow} · ${model.big}${model.unit} ${model.mid} · art ${model.art}`);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
