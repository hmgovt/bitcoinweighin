/**
 * Floorplan of the illustrative mining die, in normalised die coordinates
 * (0–1, y down). Shared by the 2D silicon view and the 3D model's die face so
 * the dive lands on exactly the same picture it zooms out of.
 *
 * Illustrative: real chips differ in core count and periphery, and Bitmain
 * publishes no layouts.
 */

export interface NRect { x: number; y: number; w: number; h: number }

export interface DieLayout {
	cores: NRect[];
	/** Index of the core this page simulates. */
	meIdx: number;
	nx: number;
	ny: number;
	array: NRect;
	strip: NRect;
	blocks: { pll: NRect; io: NRect; ctrl: NRect; io2: NRect };
	pads: NRect[];
	/** Power-strap centre lines. */
	xs: number[];
	ys: number[];
	strapW: number;
	/** Inset of the straps from the die edge. */
	strapInset: number;
	padSize: number;
}

/** `px` is the die's drawn size in pixels; a few margins are held in pixels so the drawing stays crisp. */
export function dieLayout(px: number): DieLayout {
	const u = (v: number) => v / px;
	const padSize = Math.max(4, px * 0.02) / px;
	const inset = u(5) + padSize + u(9);
	const inner: NRect = { x: inset, y: inset, w: 1 - 2 * inset, h: 1 - 2 * inset };
	const stripH = inner.h * 0.1;
	const strip: NRect = { x: inner.x, y: inner.y + inner.h - stripH, w: inner.w, h: stripH };
	const array: NRect = { x: inner.x, y: inner.y, w: inner.w, h: inner.h - stripH - u(8) };
	const nx = 12;
	const ny = 11;
	const g = Math.max(2, px * 0.006) / px;
	const cw = (array.w - (nx - 1) * g) / nx;
	const ch = (array.h - (ny - 1) * g) / ny;
	const cores: NRect[] = [];
	for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) cores.push({ x: array.x + i * (cw + g), y: array.y + j * (ch + g), w: cw, h: ch });
	const blocks = {
		pll: { x: strip.x, y: strip.y, w: strip.w * 0.14, h: strip.h },
		io: { x: strip.x + strip.w * 0.16, y: strip.y, w: strip.w * 0.22, h: strip.h },
		ctrl: { x: strip.x + strip.w * 0.4, y: strip.y, w: strip.w * 0.36, h: strip.h },
		io2: { x: strip.x + strip.w * 0.78, y: strip.y, w: strip.w * 0.22, h: strip.h },
	};
	const pads: NRect[] = [];
	const n = Math.max(6, Math.round(px / 40));
	const span = 1 - u(28) - padSize;
	for (let i = 0; i < n; i++) {
		const t = u(14) + ((i + 0.5) / n) * span;
		pads.push(
			{ x: t, y: u(7), w: padSize, h: padSize },
			{ x: t, y: 1 - u(7) - padSize, w: padSize, h: padSize },
			{ x: u(7), y: t, w: padSize, h: padSize },
			{ x: 1 - u(7) - padSize, y: t, w: padSize, h: padSize }
		);
	}
	const xs: number[] = [];
	const ys: number[] = [];
	for (let k = 0; k < 5; k++) {
		xs.push(array.x + (array.w * (k + 0.5)) / 5);
		ys.push(array.y + (array.h * (k + 0.5)) / 5);
	}
	return {
		cores, meIdx: 4 * nx + 7, nx, ny, array, strip, blocks, pads, xs, ys,
		strapW: Math.max(3, px * 0.016) / px, strapInset: u(12), padSize,
	};
}
