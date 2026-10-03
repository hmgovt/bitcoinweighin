/**
 * uptober.ts — the "Uptober, checked" chart card: bitcoin's October return
 * every year since 2013, from the dataset's daily closes (30 Sep → 31 Oct).
 * Up and down colours checked for colour-blind separation on the dark card.
 *
 *   npx tsx scripts/social/charts/uptober.ts <data/prices.json> <out.png>
 */
import satori from 'satori';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { BRAND_MARK_DATA_URL } from '../../../functions/_lib.ts';

const P = JSON.parse(await readFile(process.argv[2], 'utf8'));
const D = Object.keys(P).filter((k) => P[k].btc_usd).sort();
const onOrBefore = (s: string) => D.filter((x) => x <= s).pop()!;
const rows = [];
for (let y = 2013; y <= 2025; y++) {
	const a = onOrBefore(`${y}-09-30`), b = onOrBefore(`${y}-10-31`);
	rows.push({ y, r: (P[b].btc_usd / P[a].btc_usd - 1) * 100 });
}
const up = rows.filter((x) => x.r > 0).length;
const best = rows.reduce((m, x) => (x.r > m.r ? x : m)), worst = rows.reduce((m, x) => (x.r < m.r ? x : m)), last = rows[rows.length - 1];
const labelled = new Set([best.y, worst.y, last.y]);
const W = 1200, H = 675, UP = '#c9730c', DOWN = '#5b8de8', BG = '#1b1b1f';
const el = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}) => ({ type, props: { style, children, ...extra } });
const fmt = (r: number) => `${r > 0 ? '+' : '−'}${Math.abs(r).toFixed(1)}%`;

// Chart geometry
const cx = 520, cw = 640, top = 150, pos = 330, pxPer = pos / 55, base = top + pos;
const slot = cw / rows.length, bw = 24;
const kids: unknown[] = [];
kids.push(el('div', { position: 'absolute', left: cx, top: base, width: cw, height: 1, backgroundColor: '#3a3a40' }));
rows.forEach((x, i) => {
	const h = Math.max(2, Math.abs(x.r) * pxPer), left = cx + i * slot + (slot - bw) / 2;
	const upBar = x.r > 0;
	kids.push(el('div', { position: 'absolute', left, width: bw, height: h, top: upBar ? base - h : base + 1, backgroundColor: upBar ? UP : DOWN,
		borderTopLeftRadius: upBar ? 4 : 0, borderTopRightRadius: upBar ? 4 : 0, borderBottomLeftRadius: upBar ? 0 : 4, borderBottomRightRadius: upBar ? 0 : 4 }));
	kids.push(el('div', { position: 'absolute', left: left - 12, width: bw + 24, top: base + (upBar ? 12 : h + 12), display: 'flex', justifyContent: 'center', fontFamily: 'JetBrains Mono', fontSize: 16, color: '#8b8b93' }, `’${String(x.y).slice(2)}`));
	if (labelled.has(x.y)) kids.push(el('div', { position: 'absolute', left: left - 40, width: bw + 80, top: upBar ? base - h - 34 : base + h + 38, display: 'flex', justifyContent: 'center', fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 20, color: '#fafafa' }, fmt(x.r)));
});
// Legend
const key = (c: string, t: string) => el('div', { display: 'flex', alignItems: 'center', marginLeft: 22 }, [el('div', { width: 14, height: 14, borderRadius: 3, backgroundColor: c, marginRight: 8 }), el('span', { color: '#c4c4cc' }, t)]);
kids.push(el('div', { position: 'absolute', left: cx, top: 92, width: cw, display: 'flex', justifyContent: 'flex-end', fontSize: 20, fontWeight: 600 }, [key(UP, 'October up'), key(DOWN, 'October down')]));
// Text column
kids.push(el('div', { position: 'absolute', left: 48, top: 48, width: 440, display: 'flex', flexDirection: 'column' }, [
	el('div', { display: 'flex', fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 22, letterSpacing: 1.5, color: '#f7931a' }, 'UPTOBER, CHECKED'),
	el('div', { display: 'flex', alignItems: 'baseline', marginTop: 18, fontWeight: 900, fontSize: 150, lineHeight: 0.86, letterSpacing: -7, color: '#fafafa' }, [el('span', {}, String(up)), el('span', { fontSize: 64, letterSpacing: -2, marginLeft: 16, color: '#fafafa' }, `of ${rows.length}`)]),
	el('div', { display: 'flex', marginTop: 16, fontWeight: 900, fontSize: 50, lineHeight: 1.02, letterSpacing: -2, color: '#fafafa' }, 'Octobers ended up.'),
	el('div', { display: 'flex', flexDirection: 'column', marginTop: 18, fontWeight: 600, fontSize: 25, lineHeight: 1.3, color: '#d4d4d8' }, [
		el('div', { display: 'flex' }, `Best: ${fmt(best.r)} (${best.y}).`), el('div', { display: 'flex' }, `Worst: ${fmt(worst.r)} (${worst.y}).`), el('div', { display: 'flex' }, `Last year: ${fmt(last.r)}.`)]),
	el('div', { display: 'flex', marginTop: 16, fontFamily: 'JetBrains Mono', fontWeight: 500, fontSize: 15, color: '#a1a1aa' }, 'BTC close 30 Sep → 31 Oct, 2013–2025'),
]));
kids.push(el('div', { position: 'absolute', left: 48, bottom: 34, display: 'flex', alignItems: 'center', fontWeight: 700, fontSize: 25, color: '#fafafa' }, [
	el('img', { width: 40, height: 40, marginRight: 12 }, undefined, { src: BRAND_MARK_DATA_URL, width: 40, height: 40 }), el('span', {}, 'bitcoinweighin.com')]));
kids.push(el('div', { position: 'absolute', right: 40, bottom: 38, display: 'flex', fontFamily: 'JetBrains Mono', fontSize: 15, color: '#8b8b93' }, 'Free daily dataset since 2013 · CC-BY-4.0'));

const require = createRequire(import.meta.url);
await initWasm(await readFile(require.resolve('@resvg/resvg-wasm/index_bg.wasm')));
const F = (n: string, w: number, f: string) => readFile(`scripts/og/fonts/${f}`).then((data) => ({ name: n, weight: w as 500, style: 'normal' as const, data }));
const fonts = await Promise.all([F('Inter Tight', 600, 'InterTight-600.ttf'), F('Inter Tight', 700, 'InterTight-700.ttf'), F('Inter Tight', 900, 'InterTight-900.ttf'), F('JetBrains Mono', 500, 'JetBrainsMono-500.ttf'), F('JetBrains Mono', 700, 'JetBrainsMono-700.ttf')]);
const svg = await satori(el('div', { display: 'flex', position: 'relative', width: W, height: H, background: BG, fontFamily: 'Inter Tight' }, kids) as never, { width: W, height: H, fonts });
await writeFile(process.argv[3], new Resvg(svg, { fitTo: { mode: 'width', value: W * 1.5 } }).render().asPng());
console.log('ok', up, best, worst, last);
