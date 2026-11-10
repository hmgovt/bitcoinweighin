/**
 * Leading-zero-bits histogram on a log scale, with the distribution perfectly
 * random output predicts, and the share / pool / block thresholds.
 */
import { MF, C } from './palette.js';

export interface HistInputs {
	counts: number[];
	total: number;
	shareBits: number;
	poolBits: number;
	targetZeros: number;
}

export function drawHistogram(canvas: HTMLCanvasElement, width: number, inp: HistInputs): void {
	const dpr = Math.min(2, window.devicePixelRatio || 1);
	const W = width;
	const H = 220;
	if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
		canvas.width = Math.round(W * dpr);
		canvas.height = Math.round(H * dpr);
		canvas.style.width = `${W}px`;
		canvas.style.height = `${H}px`;
	}
	const c = canvas.getContext('2d')!;
	c.setTransform(dpr, 0, 0, dpr, 0, 0);
	c.clearRect(0, 0, W, H);
	const m = { l: 36, r: 8, t: 26, b: 24 };
	const pw = W - m.l - m.r;
	const ph = H - m.t - m.b;
	const XMAX = 84;
	const bw = pw / (XMAX + 1);
	const maxC = Math.max(1, ...inp.counts);
	const yTop = Math.max(2, Math.ceil(Math.log10(maxC) + 0.05));
	const yBot = Math.log10(0.5);
	const yOf = (v: number) => m.t + ph - ((Math.log10(v) - yBot) / (yTop - yBot)) * ph;
	const xOf = (z: number) => m.l + z * bw;
	c.font = MF(10);
	c.textBaseline = 'middle';
	const yl = ['1', '10', '100', '1k', '10k', '100k', '1M', '10M', '100M'];
	for (let k = 0; k <= yTop; k++) {
		const y = yOf(10 ** k);
		c.strokeStyle = C.rule;
		c.lineWidth = 1;
		c.beginPath(); c.moveTo(m.l, y + 0.5); c.lineTo(W - m.r, y + 0.5); c.stroke();
		c.fillStyle = C.ink3;
		c.textAlign = 'right';
		c.fillText(yl[k] ?? `1e${k}`, m.l - 6, y);
	}
	c.strokeStyle = C.rule2;
	c.beginPath(); c.moveTo(m.l, m.t + ph + 0.5); c.lineTo(W - m.r, m.t + ph + 0.5); c.stroke();
	c.textAlign = 'center';
	c.textBaseline = 'top';
	for (const z of [0, 16, 32, 48, 64, 80]) {
		c.fillStyle = C.ink3;
		c.fillText(String(z), xOf(z) + bw / 2, m.t + ph + 6);
	}
	for (let z = 0; z <= XMAX; z++) {
		if (!inp.counts[z]) continue;
		const y = yOf(inp.counts[z]);
		c.fillStyle = z >= inp.targetZeros ? C.gold : z >= inp.shareBits ? C.steel : C.ink2;
		c.fillRect(xOf(z) + 0.5, y, Math.max(1, bw - 1), m.t + ph - y);
	}
	if (inp.total > 0) {
		c.save();
		c.beginPath(); c.rect(m.l, m.t, pw, ph); c.clip();
		c.strokeStyle = C.ink3;
		c.setLineDash([3, 3]);
		c.lineWidth = 1;
		c.beginPath();
		for (let z = 0; z <= XMAX; z++) {
			const e = inp.total * 2 ** -(z + 1);
			const x = xOf(z) + bw / 2;
			const y = yOf(Math.max(e, 0.3));
			if (z === 0) c.moveTo(x, y); else c.lineTo(x, y);
			if (e < 0.3) break;
		}
		c.stroke();
		c.restore();
	}
	const mark = (z: number, col: string, text: string, align: CanvasTextAlign) => {
		const x = Math.round(xOf(z)) + 0.5;
		c.strokeStyle = col;
		c.lineWidth = 1;
		c.setLineDash([]);
		c.beginPath(); c.moveTo(x, m.t - 4); c.lineTo(x, m.t + ph); c.stroke();
		c.fillStyle = col;
		c.textBaseline = 'alphabetic';
		c.textAlign = align;
		c.fillText(text, align === 'left' ? x + 4 : x - 4, m.t - 8);
	};
	c.font = MF(10);
	mark(inp.shareBits, C.steel, `demo share ${inp.shareBits}`, 'left');
	mark(inp.poolBits, C.ink3, `pool share ≈${inp.poolBits}`, W < 520 ? 'right' : 'left');
	mark(inp.targetZeros, C.gold, `block ${inp.targetZeros}`, 'right');
}
