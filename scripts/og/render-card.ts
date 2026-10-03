/**
 * render-card.ts — render any link card to a PNG, for amounts or dates the
 * build doesn't pre-render (post images, previews). Same engine, fonts and
 * layout as scripts/og/build-cards.ts.
 *
 *   PRICES=static/prices.json npx tsx scripts/og/render-card.ts "out.png|commodity=cash&btc=0.001" …
 *
 * PRICES is a card price file (static/prices.json, or the live /prices.json).
 */
import satori from 'satori';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { buildCard, cardModel, presetBtc, CARD_W, CARD_H } from '../../functions/_card.ts';
import { BRAND_MARK_DATA_URL } from '../../functions/_lib.ts';
await initWasm(await readFile(createRequire(import.meta.url).resolve('@resvg/resvg-wasm/index_bg.wasm')));
const fonts = await Promise.all(([['Inter Tight', 600], ['Inter Tight', 700], ['Inter Tight', 900], ['JetBrains Mono', 500], ['JetBrains Mono', 700]] as const).map(async ([name, weight]) => ({ name, weight, style: 'normal' as const, data: await readFile(`scripts/og/fonts/${name.replace(' ', '')}-${weight}.ttf`) })));
const prices = JSON.parse(await readFile(process.env.PRICES!, 'utf8'));
for (const spec of process.argv.slice(2)) {
	const [out, qs] = spec.split('|');
	const q = new URLSearchParams(qs);
	const preset = q.get('preset') ?? undefined;
	const btc = Number(q.get('btc')) || presetBtc(preset) || 1;
	const date = q.get('date') ?? Object.keys(prices).sort().pop()!;
	const model = cardModel({ commodity: q.get('commodity')!, btc, preset, date, day: prices[date] });
	const art = model.art ? `data:image/jpeg;base64,${(await readFile('static/og/art/' + model.art)).toString('base64')}` : null;
	const svg = await satori(buildCard(model, art, BRAND_MARK_DATA_URL) as never, { width: CARD_W, height: CARD_H, fonts });
	await writeFile(out, new Resvg(svg, { fitTo: { mode: 'width', value: CARD_W } }).render().asPng());
	console.log('ok', out, model.big + model.unit, model.mid);
}
