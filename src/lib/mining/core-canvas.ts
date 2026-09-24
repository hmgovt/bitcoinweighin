/**
 * The hash core, drawn two ways on one canvas:
 *
 *  - "registers": 128 stages as columns of the eight SHA-256 working registers.
 *  - "silicon": a representative physical layout, zoomable die → core → stage,
 *    where every flip-flop glows when its real bit flips on this clock.
 *
 * What's real in the silicon view (which flip-flops exist, the bits they hold,
 * which flip, each logic block's switching, the K constants) comes from the
 * pipeline; placement and proportions are illustrative.
 */
import { DEPTH, type HashPipeline, type StageActivity } from './pipeline.js';
import { K, hex8 } from './sha256.js';
import { dieLayout, type DieLayout, type NRect } from './die-layout.js';
import { n0 } from './format.js';
import { C, MF, SF, WARM, clamp01, ease, lerp, mulberry, smooth } from './palette.js';

export type View = 'silicon' | 'registers';
export type Level = 'die' | 'core' | 'stage';

export interface CanvasInputs {
	sel: number;
	playing: boolean;
	speed: number;
	/** performance.now() of the last clock tick. */
	lastTick: number;
	/** performance.now() of the last share, for the comparator flash. */
	flashT: number;
	reduced: boolean;
}

interface Rect { x: number; y: number; w: number; h: number }
interface Tile extends Rect { row: number; dir: 1 | -1 }
interface Trans { from: Level; to: Level; rect: Rect; zoomIn: boolean; t0: number; dur: number }

const LV: Record<Level, number> = { die: 0, core: 1, stage: 2 };
const ONE = '#5d5d67';
/** Register brightness ramp for the registers view, indexed by a register's top byte. */
const GRAY = Array.from({ length: 256 }, (_, i) => {
	const t = i / 255;
	return `rgb(${Math.round(29 + t * 191)},${Math.round(29 + t * 187)},${Math.round(34 + t * 174)})`;
});
const ZERO = '#24242a';
const inRect = (p: { x: number; y: number }, r: Rect, pad = 0) =>
	p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;

const STAGE_WIDE: Record<string, [number, number, number, number]> = {
	sig1: [0, 0, 0.17, 0.27], ch: [0, 0.3, 0.17, 0.17], ktie: [0.19, 0, 0.045, 0.47],
	csa1: [0.255, 0, 0.185, 0.47], addE: [0.455, 0, 0.165, 0.47], wires: [0, 0.495, 0.62, 0.035],
	sig0: [0, 0.555, 0.17, 0.215], maj: [0, 0.795, 0.17, 0.205], addA: [0.19, 0.555, 0.43, 0.215], msched: [0.19, 0.795, 0.43, 0.205],
	stateFF: [0.645, 0, 0.14, 1], wFF: [0.8, 0, 0.2, 1],
};
const STAGE_TALL: Record<string, [number, number, number, number]> = {
	sig1: [0, 0, 0.3, 0.15], ch: [0, 0.165, 0.3, 0.105], ktie: [0.32, 0, 0.075, 0.27],
	csa1: [0.415, 0, 0.285, 0.27], addE: [0.715, 0, 0.285, 0.27], wires: [0, 0.283, 1, 0.03],
	sig0: [0, 0.325, 0.3, 0.12], maj: [0, 0.455, 0.3, 0.105], addA: [0.32, 0.325, 0.68, 0.12], msched: [0.32, 0.455, 0.68, 0.105],
	stateFF: [0, 0.585, 0.34, 0.415], wFF: [0.36, 0.585, 0.64, 0.415],
};
type RegKey = 'sig1' | 'ch' | 'csa1' | 'addE' | 'sig0' | 'maj' | 'addA' | 'msched';
const REG: Record<RegKey, { name: string; sub: string; tone: string; rot?: number[]; extra?: boolean }> = {
	sig1: { name: 'Σ1(E)', sub: 'crossed wires + XOR', tone: '#2b2f36', rot: [6, 11, 25] },
	ch: { name: 'Ch(E,F,G)', sub: 'bitwise choose', tone: '#2f2b36' },
	csa1: { name: 'CSA tree → T1', sub: 'H + Σ1 + Ch + K + W', tone: '#302c27', extra: true },
	addE: { name: 'Adder → E', sub: 'E = D + T1', tone: '#342d25', extra: true },
	sig0: { name: 'Σ0(A)', sub: 'crossed wires + XOR', tone: '#2b2f36', rot: [2, 13, 22] },
	maj: { name: 'Maj(A,B,C)', sub: 'bitwise majority', tone: '#2f2b36' },
	addA: { name: 'CSA + adder → A', sub: 'A = T1 + Σ0 + Maj', tone: '#342d25', extra: true },
	msched: { name: 'Message schedule', sub: 'next W = σ1(W) + W + σ0(W) + W', tone: '#28302c' },
};
const REG_KEYS = Object.keys(REG) as RegKey[];

export const DIE_NOTES: [string, string, string][] = [
	['Hash-core array', 'identical cores', 'Many identical cores, each working through its own nonces. Core count and arrangement vary by chip.'],
	['This core', 'click to zoom in', 'The one simulated on this page. Click it to zoom in.'],
	['Power grid', 'thick top metal', 'Wide straps of top-layer metal. Mining chips run at very low voltage and high current, so much of the metal just carries power.'],
	['Pads', 'links to the package', 'Where the die connects to its package: power, ground, clock and data.'],
	['PLL', 'makes the clock', 'Multiplies a slow reference clock up to the core clock.'],
	['Serial I/O', 'jobs in, nonces out', 'Chips on a hashboard are chained together. Jobs arrive here and found nonces leave.'],
	['Job distribution', 'feeds every core', 'Hands each core its midstate, header tail and a slice of the nonce range.'],
	['Seal ring', 'protective edge', 'A metal wall around the die edge that keeps cracks and moisture out of the circuitry.'],
];

export class CoreCanvas {
	view: View = 'silicon';
	level: Level = 'core';
	/** Set when the picture must be redrawn even though the pipeline hasn't changed. */
	invalid = true;
	/** Called whenever the level being shown (or zoomed towards) changes. */
	onLevel?: (level: Level) => void;

	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private pipe: HashPipeline;
	private inputs: () => CanvasInputs;
	private dpr = 1;
	private w = 0;
	private h = 0;
	private wide = true;
	private trans: Trans | null = null;
	private tex = new Map<string, HTMLCanvasElement>();
	private stageCache: HTMLCanvasElement | null = null;
	private acts: StageActivity[] = [];
	private togAll = 0;
	private bitsAll = 0;
	private pulse = 1;
	// registers layout
	private L = { cols: 64, rows: 2, segH: 8, gl: 14, cw: 0, ch: 0, rowTop: [] as number[] };
	// silicon layouts
	private core!: { C: number; R: number; gap: number; passGap: number; uturn: number; gx0: number; gx1: number; gy0: number; tw: number; th: number; tiles: Tile[]; job: Rect; nonce: Rect; cmp: Rect; fifo: Rect };
	private die!: { die: Rect; D: number; lay: DieLayout; cores: Rect[]; me: Rect; blocks: Rect[]; pads: Rect[]; anchors: { x: number; y: number; left?: boolean }[]; legend: Rect };
	private stage!: { F: Rect; rects: Record<string, Rect> };

	constructor(canvas: HTMLCanvasElement, pipe: HashPipeline, inputs: () => CanvasInputs) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d')!;
		this.pipe = pipe;
		this.inputs = inputs;
	}

	get cols(): number { return this.view === 'registers' ? this.L.cols : this.core.C; }
	get width(): number { return this.w; }

	setView(v: View, width: number): void {
		this.view = v;
		this.layout(width);
	}

	layout(width: number): void {
		this.dpr = Math.min(2, window.devicePixelRatio || 1);
		this.w = width;
		this.wide = width >= 640;
		if (this.view === 'registers') this.layoutRegisters();
		else this.layoutSilicon();
		this.canvas.width = Math.round(this.w * this.dpr);
		this.canvas.height = Math.round(this.h * this.dpr);
		this.canvas.style.width = `${this.w}px`;
		this.canvas.style.height = `${this.h}px`;
		this.invalid = true;
	}

	draw(now: number): void {
		const inp = this.inputs();
		const c = this.ctx;
		this.invalid = false;
		c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
		c.clearRect(0, 0, this.w, this.h);
		c.globalAlpha = 1;
		c.textAlign = 'left';
		c.textBaseline = 'alphabetic';
		if (this.view === 'registers') { this.drawRegisters(inp); return; }
		this.acts = [];
		this.togAll = 0;
		this.bitsAll = 0;
		for (let s = 0; s < DEPTH; s++) {
			const a = this.pipe.stageActivity(s);
			this.acts.push(a);
			this.togAll += a.tog;
			this.bitsAll += a.bits;
		}
		this.pulse = !inp.playing ? 0.85 : inp.speed > 15 ? 0.8 : 1 - 0.65 * clamp01((now - inp.lastTick) / (1000 / inp.speed));
		if (this.trans) {
			const t = this.trans;
			const p = t.dur ? (now - t.t0) / t.dur : 1;
			if (p >= 1) {
				this.level = t.to;
				this.trans = null;
			} else {
				const e = t.zoomIn ? ease(p) : 1 - ease(p);
				const outer = t.zoomIn ? t.from : t.to;
				const inner = t.zoomIn ? t.to : t.from;
				const r = t.rect;
				const W = this.w;
				const H = this.h;
				const k = lerp(1, W / r.w, e);
				c.save();
				c.translate(W / 2, H / 2);
				c.scale(k, k);
				c.translate(-lerp(W / 2, r.x + r.w / 2, e), -lerp(H / 2, r.y + r.h / 2, e));
				const aOut = 1 - smooth(0.55, 1, e);
				if (aOut > 0.01) this.drawLevel(outer, aOut, inp, now);
				const aIn = smooth(0.3, 0.95, e);
				if (aIn > 0.01) {
					const sc = r.w / W;
					c.translate(r.x, r.y + r.h / 2 - (H * sc) / 2);
					c.scale(sc, sc);
					this.drawLevel(inner, aIn, inp, now);
				}
				c.restore();
				c.globalAlpha = 1;
				return;
			}
		}
		this.drawLevel(this.level, 1, inp, now);
	}

	get animating(): boolean { return this.trans !== null; }

	zoomTo(lv: Level, sel: number, reduced: boolean): void {
		if (this.trans || lv === this.level) return;
		const zoomIn = LV[lv] > LV[this.level];
		const outer = zoomIn ? this.level : lv;
		const rect = outer === 'die' ? this.die.me : this.core.tiles[sel];
		if (reduced) { this.level = lv; this.invalid = true; }
		else this.trans = { from: this.level, to: lv, rect, zoomIn, t0: performance.now(), dur: 750 };
		this.onLevel?.(lv);
	}

	/** Jump to a level with no animation (used when the 3D dive hands over). */
	setLevel(lv: Level): void {
		this.trans = null;
		this.level = lv;
		this.invalid = true;
		this.onLevel?.(lv);
	}

	/** Which stage (or zoom target) is under this canvas-space point? */
	hit(x: number, y: number): { station?: number; die?: boolean } {
		const p = { x, y };
		if (this.view === 'registers') {
			const L = this.L;
			for (let r = 0; r < L.rows; r++) {
				if (y >= L.rowTop[r] - 6 && y <= L.rowTop[r] + L.ch + 6) {
					const col = Math.max(0, Math.min(L.cols - 1, Math.floor((x - L.gl) / L.cw)));
					return { station: r * L.cols + col };
				}
			}
			return {};
		}
		if (this.trans) return {};
		if (this.level === 'die') return inRect(p, this.die.me, 4) ? { die: true } : {};
		if (this.level === 'core') {
			const s = this.core.tiles.findIndex((t) => inRect(p, t, this.core.gap / 2));
			return s >= 0 ? { station: s } : {};
		}
		return {};
	}

	// ── Registers view ─────────────────────────────────────────────────────

	private layoutRegisters(): void {
		const L = this.L;
		L.cols = this.w < 640 ? 32 : 64;
		L.rows = DEPTH / L.cols;
		L.segH = this.w < 640 ? 6 : 8;
		L.gl = 14;
		L.cw = (this.w - L.gl) / L.cols;
		L.ch = 8 * L.segH + 2;
		const labelH = 20, annH = 22, gap = 12, tailH = 22;
		let y = 0;
		L.rowTop = [];
		for (let r = 0; r < L.rows; r++) {
			y += labelH;
			L.rowTop.push(y);
			y += L.ch + (r === 0 ? annH : r === L.rows - 1 ? tailH : gap);
		}
		this.h = y;
	}

	private drawRegisters(inp: CanvasInputs): void {
		const c = this.ctx;
		const L = this.L;
		const pipe = this.pipe;
		const segY = (k: number) => k * L.segH + (k >= 4 ? 2 : 0);
		const cell = (s: number): [number, number] => [L.gl + (s % L.cols) * L.cw, L.rowTop[Math.floor(s / L.cols)]];
		for (let r = 0; r < L.rows; r++) {
			const y0 = L.rowTop[r];
			const first = r * L.cols;
			const pass = first < 64 ? 1 : 2;
			const ra = (first % 64) + 1;
			c.font = MF(10, 500);
			c.fillStyle = C.ink3;
			let label = `PASS ${pass} · ROUNDS ${ra}–${ra + L.cols - 1}`;
			if (L.cols === 64) label += pass === 1 ? '   SHA-256 of the header tail, starting from the midstate' : '   SHA-256 of pass 1’s digest, starting from the standard IV';
			c.fillText(label, L.gl, y0 - 7);
			c.font = MF(9);
			c.fillText('A', 1, y0 + segY(0) + L.segH);
			c.fillText('E', 1, y0 + segY(4) + L.segH);
			for (let col = 0; col < L.cols; col++) {
				const s = first + col;
				const x = L.gl + col * L.cw;
				const tok = pipe.stations[s];
				if (!tok) {
					c.strokeStyle = C.rule;
					c.lineWidth = 1;
					c.strokeRect(x + 1, y0 + 0.5, L.cw - 2, L.ch - 1);
					continue;
				}
				const st = s < 64 ? tok.s1 : tok.s2;
				const o = (s % 64) * 8;
				for (let k = 0; k < 8; k++) {
					c.fillStyle = GRAY[st[o + k] >>> 24];
					c.fillRect(x + 0.5, y0 + segY(k), L.cw - 1, L.segH - 0.6);
				}
			}
		}
		if (pipe.tracked !== null) {
			const s = pipe.stations.findIndex((t) => t && t.nonce === pipe.tracked);
			if (s >= 0) {
				const [x, y] = cell(s);
				c.strokeStyle = C.gold;
				c.lineWidth = 2;
				c.strokeRect(x - 1, y - 2, L.cw + 2, L.ch + 4);
			}
		}
		const [sx, sy] = cell(inp.sel);
		c.strokeStyle = C.ink;
		c.lineWidth = 1.25;
		c.strokeRect(sx - 0.5, sy - 3.5, L.cw + 1, L.ch + 7);
		const y = L.rowTop[0] + L.ch + 6;
		c.strokeStyle = C.ink3;
		c.lineWidth = 1;
		c.beginPath();
		c.moveTo(L.gl + 1, y - 3); c.lineTo(L.gl + 1, y); c.lineTo(L.gl + 3 * L.cw - 1, y); c.lineTo(L.gl + 3 * L.cw - 1, y - 3);
		c.stroke();
		const cx = L.gl + 3.5 * L.cw;
		c.fillStyle = C.ink2;
		c.beginPath(); c.moveTo(cx, y - 3); c.lineTo(cx - 3.5, y + 3); c.lineTo(cx + 3.5, y + 3); c.closePath(); c.fill();
		c.font = MF(10);
		c.fillStyle = C.ink3;
		c.fillText(L.cols === 64 ? 'rounds 1–3 are identical for every nonce   ▲ the nonce enters at round 4' : '1–3 fixed · ▲ nonce enters', L.gl + 4 * L.cw + 4, y + 5);
		c.textAlign = 'right';
		c.fillText('result exits → comparator ↓', L.gl + L.cols * L.cw, L.rowTop[L.rows - 1] + L.ch + 15);
		c.textAlign = 'left';
	}

	// ── Silicon view: layout ───────────────────────────────────────────────

	private layoutSilicon(): void {
		const w = this.w;
		this.h = this.wide ? Math.round(Math.max(440, Math.min(600, w * 0.56))) : Math.round(w * 1.6);
		this.layoutCore();
		this.layoutDie();
		this.layoutStage();
		this.tex.clear();
		this.stageCache = null;
	}

	private layoutCore(): void {
		const { w, h, wide } = this;
		const Cn = wide ? 16 : 8;
		const R = DEPTH / Cn;
		const pad = 14, leftW = wide ? 118 : 60, gap = wide ? 5 : 3, passGap = wide ? 22 : 18, uturn = 10;
		const gx0 = pad + leftW + 22;
		const gx1 = w - pad - uturn;
		const gy0 = wide ? 48 : 58;
		const tw = (gx1 - gx0 - (Cn - 1) * gap) / Cn;
		const th = (h - 12 - gy0 - (R - 1) * gap - passGap) / R;
		const tiles: Tile[] = [];
		for (let s = 0; s < DEPTH; s++) {
			const row = Math.floor(s / Cn);
			const ci = s % Cn;
			const col = row % 2 === 0 ? ci : Cn - 1 - ci;
			tiles.push({ x: gx0 + col * (tw + gap), y: gy0 + row * (th + gap) + (row >= R / 2 ? passGap : 0), w: tw, h: th, row, dir: row % 2 === 0 ? 1 : -1 });
		}
		const bh = Math.max(wide ? 40 : 30, th);
		const lastT = tiles[DEPTH - 1];
		const job = { x: pad, y: gy0, w: leftW, h: bh };
		const nonce = { x: pad, y: job.y + bh + 8, w: leftW, h: bh };
		const cmp = { x: pad, y: lastT.y + lastT.h - bh, w: leftW, h: bh };
		const fifo = { x: pad, y: cmp.y - bh - 8, w: leftW, h: bh };
		this.core = { C: Cn, R, gap, passGap, uturn, gx0, gx1, gy0, tw, th, tiles, job, nonce, cmp, fifo };
	}

	private layoutDie(): void {
		const { w, h, wide } = this;
		const pad = 14;
		const D = wide ? Math.min(h - 56, w * 0.5) : w - 2 * pad;
		const die = { x: pad, y: wide ? 40 : 34, w: D, h: D };
		const lay = dieLayout(D);
		const abs = (r: NRect): Rect => ({ x: die.x + r.x * D, y: die.y + r.y * D, w: r.w * D, h: r.h * D });
		const cores = lay.cores.map(abs);
		const blocks = Object.values(lay.blocks).map(abs);
		const pads = lay.pads.map(abs);
		const ctr = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
		const arr = abs(lay.array);
		const anchors = [
			ctr(cores[lay.nx + 1]), ctr(cores[lay.meIdx]), { x: die.x + lay.xs[1] * D, y: arr.y + arr.h * 0.86 }, ctr(pads[4]),
			ctr(blocks[0]), ctr(blocks[1]), ctr(blocks[2]), { x: die.x + D - 3, y: die.y + D * 0.46, left: true },
		];
		const legend = wide ? { x: die.x + D + 34, y: die.y, w: w - (die.x + D + 34) - pad, h: 0 } : { x: pad, y: die.y + D + 16, w: w - 2 * pad, h: 0 };
		this.die = { die, D, lay, cores, me: cores[lay.meIdx], blocks, pads, anchors, legend };
	}

	private layoutStage(): void {
		const { w, h, wide } = this;
		const L0 = wide ? 66 : 12, T0 = wide ? 40 : 52, B0 = wide ? 34 : 70;
		const F = { x: L0, y: T0, w: w - L0 - 12, h: h - T0 - B0 };
		const spec = wide ? STAGE_WIDE : STAGE_TALL;
		const rects: Record<string, Rect> = {};
		for (const k in spec) {
			const [fx, fy, fw, fh] = spec[k];
			rects[k] = { x: F.x + fx * F.w, y: F.y + fy * F.h, w: fw * F.w, h: fh * F.h };
		}
		this.stage = { F, rects };
	}

	// ── Silicon view: drawing helpers ──────────────────────────────────────

	private tileTex(w: number, h: number, seed = 3): HTMLCanvasElement {
		const key = `${w.toFixed(1)}x${h.toFixed(1)}x${seed}`;
		const hit = this.tex.get(key);
		if (hit) return hit;
		const cv = document.createElement('canvas');
		cv.width = Math.max(1, Math.round(w * this.dpr));
		cv.height = Math.max(1, Math.round(h * this.dpr));
		const c = cv.getContext('2d')!;
		c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
		const rnd = mulberry(seed * 7919);
		c.fillStyle = '#17171b';
		c.fillRect(0, 0, w, h);
		const rh = Math.max(1.6, h / 16);
		const split = w * 0.62;
		for (let y = 1; y + rh <= h - 1; y += rh) {
			let x = 1;
			while (x < split - 1) {
				const cw = Math.min(split - 1 - x, 1 + rnd() * Math.max(2, w / 12));
				if (rnd() > 0.12) {
					c.fillStyle = rnd() > 0.7 ? '#35353d' : '#2a2a31';
					c.fillRect(x, y + rh * 0.18, Math.max(0.6, cw - 0.5), rh * 0.64);
				}
				x += cw;
			}
		}
		const fx = split + 1;
		const fw = w - fx - 1;
		const rows = Math.max(6, Math.round(h / 3.2));
		const cw = fw / 8;
		const ch = (h - 2) / rows;
		c.fillStyle = '#3c3c45';
		for (let i = 0; i < 8; i++) for (let j = 0; j < rows; j++) c.fillRect(fx + i * cw + 0.25, 1 + j * ch + 0.25, Math.max(0.4, cw - 0.5), Math.max(0.4, ch - 0.5));
		c.fillStyle = 'rgba(143,179,200,0.12)';
		for (let x = 3; x < w; x += Math.max(4, w / 7)) c.fillRect(x, 0, 0.7, h);
		this.tex.set(key, cv);
		return cv;
	}

	private title(left: string, right: string | null): void {
		const c = this.ctx;
		c.textAlign = 'left';
		c.font = MF(10, 500);
		c.fillStyle = C.ink3;
		c.fillText(left, 14, 20);
		if (!right) return;
		c.fillStyle = C.ink2;
		if (this.wide) {
			c.textAlign = 'right';
			c.fillText(right, this.w - 14, 20);
			c.textAlign = 'left';
		} else c.fillText(right, 14, 36);
	}

	private bubble(x: number, y: number, n: number): void {
		const c = this.ctx;
		c.beginPath();
		c.arc(x, y, 8, 0, Math.PI * 2);
		c.fillStyle = C.ground;
		c.fill();
		c.strokeStyle = C.ink2;
		c.lineWidth = 1;
		c.stroke();
		c.font = MF(9.5, 500);
		c.fillStyle = C.ink;
		c.textAlign = 'center';
		c.fillText(String(n), x, y + 3.5);
		c.textAlign = 'left';
	}

	private wrapText(text: string, x: number, y: number, maxW: number, lh: number): number {
		const c = this.ctx;
		let line = '';
		for (const word of text.split(' ')) {
			const t = line ? `${line} ${word}` : word;
			if (c.measureText(t).width > maxW && line) {
				c.fillText(line, x, y);
				y += lh;
				line = word;
			} else line = t;
		}
		if (line) c.fillText(line, x, y);
		return y;
	}

	private regionBody(rr: Rect, extra?: boolean): Rect {
		const top = rr.h >= 56 ? (extra ? 44 : 32) : 18;
		return { x: rr.x + 4, y: rr.y + top, w: rr.w - 8, h: Math.max(2, rr.h - top - 4) };
	}

	private ffBody(rr: Rect, n: number) {
		const b = { x: rr.x + 4, y: rr.y + 32, w: rr.w - 8, h: rr.h - 36 };
		return { ...b, cw: b.w / n, ch: b.h / 32 };
	}

	/** Static layer of the stage floorplan: regions, cell rows, wiring, legend. */
	private buildStageCache(): HTMLCanvasElement {
		const cv = document.createElement('canvas');
		cv.width = Math.round(this.w * this.dpr);
		cv.height = Math.round(this.h * this.dpr);
		const c = cv.getContext('2d')!;
		c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
		const { rects: R, F } = this.stage;
		const wide = this.wide;
		const cellRows = (b: Rect, tone: string, seed: number) => {
			const rh = wide ? 6 : 4.5;
			const rnd = mulberry(seed);
			for (let y = b.y; y + rh <= b.y + b.h; y += rh) {
				c.fillStyle = '#23232a';
				c.fillRect(b.x, y, b.w, 0.8);
				let x = b.x;
				while (x < b.x + b.w - 1) {
					const cw = Math.min(b.x + b.w - x, 2 + Math.floor(rnd() * 9));
					if (rnd() > 0.1) {
						c.fillStyle = tone;
						c.fillRect(x + 0.5, y + 1.4, cw - 1, rh - 2.2);
					}
					x += cw;
				}
			}
			c.fillStyle = 'rgba(143,179,200,0.10)';
			for (let x = b.x + 7; x < b.x + b.w; x += 14) c.fillRect(x, b.y, 0.8, b.h);
		};
		// Rotations cost no gates: bit i is simply wired to bit i+ρ (real amounts).
		const rotWires = (b: Rect, rots: number[]): Rect => {
			const w = b.w * 0.4;
			const n = 16;
			const step = w / n;
			c.fillStyle = '#101013';
			c.fillRect(b.x, b.y, w, b.h);
			c.lineWidth = 0.8;
			rots.forEach((rho, q) => {
				c.strokeStyle = `rgba(143,179,200,${0.22 + q * 0.12})`;
				c.beginPath();
				for (let i = 0; i < n; i++) {
					const j = (i + Math.round(rho / 2)) % n;
					c.moveTo(b.x + (i + 0.5) * step, b.y + 2);
					c.lineTo(b.x + (j + 0.5) * step, b.y + b.h - 2);
				}
				c.stroke();
			});
			return { x: b.x + w + 4, y: b.y, w: b.w - w - 4, h: b.h };
		};
		c.strokeStyle = 'rgba(143,179,200,0.35)';
		c.lineWidth = 1.5;
		if (wide) {
			for (const k of ['sig1', 'ch', 'sig0', 'maj', 'msched']) {
				const rr = R[k];
				const y = rr.y + rr.h / 2;
				c.beginPath(); c.moveTo(4, y); c.lineTo(rr.x, y); c.stroke();
			}
			for (const k of ['addE', 'addA', 'msched']) {
				const rr = R[k];
				const y = rr.y + rr.h / 2;
				c.beginPath(); c.moveTo(rr.x + rr.w, y); c.lineTo(R.stateFF.x, y); c.stroke();
			}
			c.font = MF(9);
			c.fillStyle = C.ink3;
			c.fillText('from the', 4, F.y + 10);
			c.fillText('previous', 4, F.y + 21);
			c.fillText('stage →', 4, F.y + 32);
		}
		for (const k of REG_KEYS) {
			const meta = REG[k];
			const rr = R[k];
			c.fillStyle = '#131317';
			c.fillRect(rr.x, rr.y, rr.w, rr.h);
			let body = this.regionBody(rr, meta.extra);
			if (meta.rot) body = rotWires(body, meta.rot);
			cellRows(body, meta.tone, k.length * 977 + k.charCodeAt(0) * 31);
			c.strokeStyle = '#303037';
			c.lineWidth = 1;
			c.strokeRect(rr.x + 0.5, rr.y + 0.5, rr.w - 1, rr.h - 1);
			c.font = MF(wide ? 10 : 9, 500);
			c.fillStyle = C.ink2;
			c.fillText(meta.name, rr.x + 6, rr.y + 13);
			c.font = SF(wide ? 11 : 10);
			if (rr.h >= 56 && c.measureText(meta.sub).width < rr.w - 12) {
				c.fillStyle = C.ink3;
				c.fillText(meta.sub, rr.x + 6, rr.y + 26);
			}
		}
		{
			const rr = R.ktie;
			c.fillStyle = '#131317';
			c.fillRect(rr.x, rr.y, rr.w, rr.h);
			c.strokeStyle = '#303037';
			c.strokeRect(rr.x + 0.5, rr.y + 0.5, rr.w - 1, rr.h - 1);
			c.font = MF(wide ? 10 : 9, 500);
			c.fillStyle = C.ink2;
			c.fillText('K', rr.x + 6, rr.y + 13);
		}
		{
			const rr = R.wires;
			const x1 = wide ? R.stateFF.x : rr.x + rr.w;
			c.strokeStyle = 'rgba(143,179,200,0.30)';
			c.lineWidth = 1;
			for (let i = 0; i < 6; i++) {
				const y = rr.y + 2 + (i * (rr.h - 4)) / 5;
				c.beginPath(); c.moveTo(wide ? 4 : rr.x, y); c.lineTo(x1, y); c.stroke();
			}
			const label = wide ? 'B←A  C←B  D←C  F←E  G←F  H←G  ·  just wires into the flip-flops, no gates' : 'B←A C←B D←C F←E G←F H←G · wires only';
			c.font = MF(wide ? 9.5 : 8.5);
			const tw = c.measureText(label).width;
			c.fillStyle = C.panel;
			c.fillRect(rr.x + 8, rr.y + rr.h / 2 - 6, tw + 8, 12);
			c.fillStyle = C.ink2;
			c.fillText(label, rr.x + 12, rr.y + rr.h / 2 + 3.5);
		}
		for (const [k, name] of [['stateFF', wide ? 'STATE FLIP-FLOPS · 256' : 'STATE · 256'], ['wFF', wide ? 'MESSAGE WINDOW · UP TO 512' : 'MESSAGE WINDOW']] as const) {
			const rr = R[k];
			c.fillStyle = '#131317';
			c.fillRect(rr.x, rr.y, rr.w, rr.h);
			c.strokeStyle = '#303037';
			c.strokeRect(rr.x + 0.5, rr.y + 0.5, rr.w - 1, rr.h - 1);
			c.font = MF(wide ? 9.5 : 8.5, 500);
			c.fillStyle = C.ink2;
			c.fillText(name, rr.x + 6, rr.y + 13);
		}
		{
			const b = this.ffBody(R.stateFF, 8);
			c.font = MF(9);
			c.textAlign = 'center';
			for (let i = 0; i < 8; i++) {
				c.fillStyle = i === 0 || i === 4 ? C.ink : C.ink3;
				c.fillText('ABCDEFGH'[i], b.x + (i + 0.5) * b.cw, b.y - 5);
			}
			c.textAlign = 'left';
		}
		let ly = F.y + F.h + (wide ? 22 : 18);
		let x = F.x;
		c.font = SF(11);
		const sw = (fill: string | null, label: string) => {
			const tw = c.measureText(label).width;
			if (x + 15 + tw > this.w - 12) { x = F.x; ly += 16; }
			if (fill) { c.fillStyle = fill; c.fillRect(x, ly - 8, 10, 10); }
			else { c.strokeStyle = '#3a3a42'; c.lineWidth = 1; c.strokeRect(x + 0.5, ly - 7.5, 9, 9); }
			c.fillStyle = C.ink3;
			c.fillText(label, x + 15, ly);
			x += 15 + tw + 16;
		};
		sw(ONE, 'flip-flop holding 1');
		sw(ZERO, 'holding 0');
		sw(`rgba(${WARM},0.9)`, 'flipped this clock');
		sw(null, 'no flip-flop: constant');
		const note = 'Representative layout, drawn from the logic. Not traced from a real chip.';
		const nw = c.measureText(note).width;
		if (wide && x + nw < this.w - 12) {
			c.textAlign = 'right';
			c.fillText(note, this.w - 12, ly);
			c.textAlign = 'left';
		} else c.fillText(note, F.x, ly + 16);
		return cv;
	}

	private drawFlops(rr: Rect, s: number, k0: number, n: number): void {
		const c = this.ctx;
		const pipe = this.pipe;
		const tok = pipe.stations[s];
		const p = pipe.prevAt(s);
		const b = this.ffBody(rr, n);
		const glow = `rgba(${WARM},${(0.9 * this.pulse).toFixed(3)})`;
		c.lineWidth = 1;
		for (let i = 0; i < n; i++) {
			const k = k0 + i;
			const ex = pipe.flopExists(s, k);
			const v = tok && ex ? pipe.flopWord(tok, s, k) : 0;
			const flip = tok && p && ex ? v ^ pipe.flopWord(p, s, k) : 0;
			const cx = b.x + i * b.cw;
			for (let bit = 31; bit >= 0; bit--) {
				const cy = b.y + (31 - bit) * b.ch;
				if (!ex) {
					c.strokeStyle = '#26262c';
					c.strokeRect(cx + 1, cy + 1, Math.max(1, b.cw - 2), Math.max(1, b.ch - 2));
					continue;
				}
				c.fillStyle = !tok ? '#1a1a1f' : (v >>> bit) & 1 ? ONE : ZERO;
				c.fillRect(cx + 0.5, cy + 0.5, b.cw - 1, Math.max(0.6, b.ch - 1));
				if ((flip >>> bit) & 1) {
					c.fillStyle = glow;
					c.fillRect(cx + 0.5, cy + 0.5, b.cw - 1, Math.max(0.6, b.ch - 1));
				}
			}
		}
	}

	// ── Silicon view: levels ────────────────────────────────────────────────

	private drawLevel(lv: Level, A: number, inp: CanvasInputs, now: number): void {
		if (lv === 'die') this.drawDie(A);
		else if (lv === 'core') this.drawCore(A, inp, now);
		else this.drawStage(A, inp);
		this.ctx.globalAlpha = 1;
	}

	private drawStage(A: number, inp: CanvasInputs): void {
		const c = this.ctx;
		const pipe = this.pipe;
		const R = this.stage.rects;
		const s = inp.sel;
		const tok = pipe.stations[s];
		const pass = s < 64 ? 1 : 2;
		const r = s % 64;
		const fa = this.acts[s];
		if (!this.stageCache) this.stageCache = this.buildStageCache();
		c.globalAlpha = A;
		c.drawImage(this.stageCache, 0, 0, this.w, this.h);
		const who = tok ? (tok.nonce === pipe.tracked ? ' · WINNING NONCE' : '') : ' · EMPTY';
		this.title(
			this.wide ? `STAGE ${s + 1} OF 128 · PASS ${pass}, ROUND ${r + 1}${tok ? ` · NONCE 0x${hex8(tok.nonce)}` : ''}${who}` : `STAGE ${s + 1}/128 · PASS ${pass} ROUND ${r + 1}${who}`,
			tok ? `${n0(fa.tog)} of ${n0(fa.bits)} flip-flops flipped this clock` : 'refilling after clean_jobs'
		);
		const act = pipe.logicActivity(s);
		if (act) {
			for (const k of REG_KEYS) {
				const b = this.regionBody(R[k], REG[k].extra);
				c.fillStyle = `rgba(${WARM},${(0.4 * act[k] * this.pulse).toFixed(3)})`;
				c.fillRect(b.x, b.y, b.w, b.h);
			}
			const rr = R.wires;
			c.fillStyle = `rgba(${WARM},${(0.3 * act.wires * this.pulse).toFixed(3)})`;
			c.fillRect(rr.x, rr.y, rr.w, rr.h);
		}
		c.font = MF(this.wide ? 9.5 : 8.5);
		c.fillStyle = C.ink;
		const kv = K[r];
		if (R.csa1.h >= 56) c.fillText(this.wide ? `K[${r}] = ${hex8(kv)} (hard-wired)` : `K = ${hex8(kv)}`, R.csa1.x + 6, R.csa1.y + 38);
		if (act && R.addE.h >= 56) c.fillText(`E → ${hex8(act.nE)}`, R.addE.x + 6, R.addE.y + 38);
		if (act && R.addA.h >= 56) c.fillText(`A → ${hex8(act.nA)}`, R.addA.x + 6, R.addA.y + 38);
		{
			const rr = R.ktie;
			const top = rr.y + 18;
			const ch = (rr.h - 22) / 32;
			for (let bit = 31; bit >= 0; bit--) {
				c.fillStyle = (kv >>> bit) & 1 ? '#8a8a94' : '#1f1f24';
				c.fillRect(rr.x + 5, top + (31 - bit) * ch + 0.5, rr.w - 10, Math.max(0.8, ch - 1));
			}
		}
		if (r >= 48) {
			const rr = R.msched;
			c.fillStyle = 'rgba(14,14,16,0.78)';
			c.fillRect(rr.x + 1, rr.y + 1, rr.w - 2, rr.h - 2);
			c.font = MF(this.wide ? 10 : 9);
			c.fillStyle = C.ink3;
			c.fillText(this.wide ? 'idle: rounds 49–64 need no new message words' : 'idle after round 48', rr.x + 8, rr.y + rr.h / 2 + 4);
		}
		this.drawFlops(R.stateFF, s, 0, 8);
		this.drawFlops(R.wFF, s, 8, 16);
		const j0 = r + 1;
		c.font = MF(9);
		c.fillStyle = C.ink3;
		c.fillText(j0 > 63 ? 'empty: no rounds left in this pass' : `W[${j0}] … W[${Math.min(r + 16, 63)}]`, R.wFF.x + 6, R.wFF.y + 26);
	}

	private drawCore(A: number, inp: CanvasInputs, now: number): void {
		const c = this.ctx;
		const pipe = this.pipe;
		const K2 = this.core;
		const tiles = K2.tiles;
		c.globalAlpha = A;
		const pct = this.bitsAll ? Math.round((100 * this.togAll) / this.bitsAll) : 0;
		this.title(this.wide ? 'HASH CORE · 128 PIPELINE STAGES · REPRESENTATIVE FLOORPLAN' : 'HASH CORE · 128 STAGES', `${pct}% of flip-flops flipped this clock`);
		c.font = MF(9.5);
		c.fillStyle = C.ink3;
		c.fillText('PASS 1 · rounds 1–64 →', K2.gx0, K2.gy0 - 8);
		{
			const t = tiles[64];
			const y = t.y - K2.passGap + 2;
			c.strokeStyle = C.rule2;
			c.setLineDash([3, 3]);
			c.beginPath(); c.moveTo(K2.gx0, y); c.lineTo(K2.gx1, y); c.stroke();
			c.setLineDash([]);
			c.fillText(this.wide ? 'PASS 2 · rounds 1–64 · fresh IV, pass-1 digest as the message →' : 'PASS 2 · rounds 1–64 →', K2.gx0, t.y - 6);
		}
		c.strokeStyle = 'rgba(143,179,200,0.38)';
		c.lineWidth = 1.5;
		c.beginPath();
		for (let s = 0; s < DEPTH - 1; s++) {
			const a = tiles[s];
			const b = tiles[s + 1];
			if (a.row === b.row) {
				const y = a.y + a.h / 2;
				if (a.dir > 0) { c.moveTo(a.x + a.w, y); c.lineTo(b.x, y); }
				else { c.moveTo(a.x, y); c.lineTo(b.x + b.w, y); }
			} else {
				const ya = a.y + a.h / 2;
				const yb = b.y + b.h / 2;
				const x0 = a.dir > 0 ? a.x + a.w : a.x;
				const xe = a.dir > 0 ? x0 + K2.uturn * 0.6 : x0 - 7;
				c.moveTo(x0, ya); c.lineTo(xe, ya); c.lineTo(xe, yb); c.lineTo(x0, yb);
			}
		}
		const vx = K2.gx0 - 14;
		const t0 = tiles[0];
		const tl = tiles[DEPTH - 1];
		const jm = K2.job.y + K2.job.h / 2;
		const nm = K2.nonce.y + K2.nonce.h / 2;
		const cm = K2.cmp.y + K2.cmp.h / 2;
		c.moveTo(K2.job.x + K2.job.w, jm); c.lineTo(vx, jm);
		c.moveTo(K2.nonce.x + K2.nonce.w, nm); c.lineTo(vx, nm); c.lineTo(vx, t0.y + t0.h / 2); c.lineTo(t0.x, t0.y + t0.h / 2);
		c.moveTo(tl.x, tl.y + tl.h / 2); c.lineTo(vx, tl.y + tl.h / 2); c.lineTo(vx, cm); c.lineTo(K2.cmp.x + K2.cmp.w, cm);
		c.moveTo(K2.cmp.x + K2.cmp.w / 2, K2.cmp.y); c.lineTo(K2.fifo.x + K2.fifo.w / 2, K2.fifo.y + K2.fifo.h);
		c.stroke();
		const tex = this.tileTex(K2.tw, K2.th);
		for (let s = 0; s < DEPTH; s++) {
			const t = tiles[s];
			const tok = pipe.stations[s];
			const a = this.acts[s].act;
			c.globalAlpha = A * (tok ? 0.95 : 0.28);
			c.drawImage(tex, t.x, t.y, t.w, t.h);
			c.globalAlpha = A;
			if (a > 0) {
				c.fillStyle = `rgba(${WARM},${(0.55 * a * this.pulse).toFixed(3)})`;
				c.fillRect(t.x, t.y, t.w, t.h);
			}
			c.strokeStyle = C.rule;
			c.lineWidth = 1;
			c.strokeRect(t.x + 0.5, t.y + 0.5, t.w - 1, t.h - 1);
			if (t.w >= 30 && t.h >= 24) {
				c.font = MF(9);
				c.fillStyle = C.ink2;
				c.fillText(String((s % 64) + 1), t.x + 3, t.y + 10);
			}
		}
		if (pipe.tracked !== null) {
			const s = pipe.stations.findIndex((t) => t && t.nonce === pipe.tracked);
			if (s >= 0) {
				const t = tiles[s];
				c.strokeStyle = C.gold;
				c.lineWidth = 2;
				c.strokeRect(t.x - 1.5, t.y - 1.5, t.w + 3, t.h + 3);
			}
		}
		{
			const t = tiles[inp.sel];
			c.strokeStyle = C.ink;
			c.lineWidth = 1.25;
			c.strokeRect(t.x - 3, t.y - 3, t.w + 6, t.h + 6);
		}
		const blk = (r: Rect, name: string, val: string, glow: string | null, valCol?: string) => {
			c.fillStyle = '#141418';
			c.fillRect(r.x, r.y, r.w, r.h);
			if (glow) { c.fillStyle = glow; c.fillRect(r.x, r.y, r.w, r.h); }
			c.strokeStyle = '#3a3a42';
			c.lineWidth = 1;
			c.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
			c.font = MF(this.wide ? 9 : 7.5, 500);
			c.fillStyle = C.ink3;
			c.fillText(name, r.x + 5, r.y + 12);
			c.font = MF(this.wide ? 10.5 : 8.5);
			c.fillStyle = valCol ?? C.ink;
			c.fillText(val, r.x + 5, r.y + r.h - 7);
		};
		const last = pipe.last;
		const cmpGlow = last?.v === 'block' ? 'rgba(212,161,74,0.35)' : now - inp.flashT < 900 ? `rgba(143,179,200,${(0.35 * (1 - (now - inp.flashT) / 900)).toFixed(3)})` : null;
		const fifo = pipe.fifoNonce;
		blk(K2.job, this.wide ? 'JOB REGISTERS' : 'JOB REGS', this.wide ? 'midstate + tail' : 'midstate', null);
		blk(K2.nonce, this.wide ? 'NONCE COUNTER' : 'NONCE', pipe.stations[0] ? hex8(pipe.stations[0].nonce) : '—', null);
		blk(K2.fifo, 'RESULT FIFO', fifo !== null ? hex8(fifo) : 'empty', fifo !== null ? 'rgba(212,161,74,0.18)' : null, fifo !== null ? C.gold : C.ink3);
		blk(K2.cmp, 'COMPARATOR', last ? (this.wide ? `${last.tok.zeros} bits · ${last.v}` : `${last.tok.zeros} bits`) : 'idle', cmpGlow, last?.v === 'block' ? C.gold : undefined);
	}

	private drawDie(A: number): void {
		const c = this.ctx;
		const Dd = this.die;
		const { die, lay, D } = Dd;
		c.globalAlpha = A;
		this.title(this.wide ? 'DIE · REPRESENTATIVE MINING ASIC, TOP VIEW' : 'DIE · TOP VIEW', null);
		const gr = c.createLinearGradient(die.x, die.y, die.x + die.w, die.y + die.h);
		gr.addColorStop(0, '#231f26');
		gr.addColorStop(0.5, '#19181c');
		gr.addColorStop(1, '#221e20');
		c.fillStyle = gr;
		c.fillRect(die.x, die.y, die.w, die.h);
		c.strokeStyle = '#4d4852';
		c.lineWidth = 2;
		c.strokeRect(die.x + 3, die.y + 3, die.w - 6, die.h - 6);
		c.strokeStyle = '#34313a';
		c.lineWidth = 1;
		c.strokeRect(die.x + 5.5, die.y + 5.5, die.w - 11, die.h - 11);
		c.fillStyle = '#5b5661';
		for (const p of Dd.pads) c.fillRect(p.x, p.y, p.w, p.h);
		const tex = this.tileTex(Dd.cores[0].w, Dd.cores[0].h);
		const mine = this.bitsAll ? this.togAll / this.bitsAll : 0;
		const clock = this.pipe.clock;
		for (let i = 0; i < Dd.cores.length; i++) {
			const r = Dd.cores[i];
			c.globalAlpha = A * 0.95;
			c.drawImage(tex, r.x, r.y, r.w, r.h);
			c.globalAlpha = A;
			const n = Math.sin(i * 12.9898 + clock * 78.233) * 43758.5453;
			const a = i === lay.meIdx ? mine : 0.44 + 0.08 * (n - Math.floor(n));
			c.fillStyle = `rgba(${WARM},${(0.34 * a * this.pulse).toFixed(3)})`;
			c.fillRect(r.x, r.y, r.w, r.h);
		}
		Dd.blocks.forEach((b, k) => {
			c.drawImage(this.tileTex(b.w, b.h, 12 + k), b.x, b.y, b.w, b.h);
			c.strokeStyle = '#3d3d45';
			c.lineWidth = 1;
			c.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
		});
		const inset = lay.strapInset * D;
		const top = die.y + inset;
		const bot = die.y + D - inset;
		const lft = die.x + inset;
		const rgt = die.x + D - inset;
		const sw = lay.strapW * D;
		c.fillStyle = 'rgba(176,122,84,0.20)';
		for (const x of lay.xs) c.fillRect(die.x + x * D - sw / 2, top, sw, bot - top);
		for (const y of lay.ys) c.fillRect(lft, die.y + y * D - sw / 2, rgt - lft, sw);
		c.fillStyle = 'rgba(176,122,84,0.30)';
		for (const x of lay.xs) for (const y of lay.ys) c.fillRect(die.x + x * D - sw / 2, die.y + y * D - sw / 2, sw, sw);
		const me = Dd.me;
		c.strokeStyle = C.ink;
		c.lineWidth = 1.5;
		c.strokeRect(me.x - 2, me.y - 2, me.w + 4, me.h + 4);
		Dd.anchors.forEach((pt, i) => {
			const bx = pt.x + (pt.left ? -18 : 16);
			const by = pt.y - 16;
			c.strokeStyle = C.ink2;
			c.lineWidth = 1;
			c.beginPath(); c.moveTo(pt.x, pt.y); c.lineTo(bx, by); c.stroke();
			c.fillStyle = C.ink;
			c.beginPath(); c.arc(pt.x, pt.y, 2, 0, Math.PI * 2); c.fill();
			this.bubble(bx, by, i + 1);
		});
		const lg = Dd.legend;
		let y = lg.y;
		DIE_NOTES.forEach(([name, short, long], i) => {
			if (this.wide) {
				this.bubble(lg.x + 9, y + 8, i + 1);
				c.font = SF(13, 500);
				c.fillStyle = C.ink;
				c.fillText(name, lg.x + 26, y + 13);
				c.font = SF(12);
				c.fillStyle = C.ink3;
				y = this.wrapText(long, lg.x + 26, y + 30, lg.w - 26, 16) + 16;
			} else {
				this.bubble(lg.x + 8, y + 8, i + 1);
				c.font = SF(11.5);
				c.fillStyle = C.ink2;
				c.fillText(`${name} · ${short}`, lg.x + 22, y + 12);
				y += 20;
			}
		});
	}
}
