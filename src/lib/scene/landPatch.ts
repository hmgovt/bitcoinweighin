/**
 * Geometry helpers for the Land stage that don't need three.js: the owned
 * slice of a part-owned lot, and a camera distance that fits a box.
 */

type Pt = [number, number];

/** Sutherland–Hodgman against one half-plane: keep y ≤ cut. */
function clipBelow(r: Pt[], cut: number): Pt[] {
	const out: Pt[] = [];
	for (let i = 0; i < r.length; i++) {
		const a = r[(i + r.length - 1) % r.length];
		const b = r[i];
		const ina = a[1] <= cut;
		const inb = b[1] <= cut;
		if (inb) {
			if (!ina) out.push([a[0] + ((b[0] - a[0]) * (cut - a[1])) / (b[1] - a[1]), cut]);
			out.push(b);
		} else if (ina) out.push([a[0] + ((b[0] - a[0]) * (cut - a[1])) / (b[1] - a[1]), cut]);
	}
	return out;
}

function area(r: Pt[]): number {
	let s = 0;
	for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += r[j][0] * r[i][1] - r[i][0] * r[j][1];
	return Math.abs(s) / 2;
}

/**
 * The southern slice of a lot (rings: outer first, then holes) whose area
 * is `fraction` of the lot's — the part-owned lot, filled the way the
 * whole island fills, from the south. Returns the clipped rings.
 */
export function southernSlice(rings: Pt[][], fraction: number): Pt[][] {
	const f = Math.min(1, Math.max(0, fraction));
	let lo = Infinity;
	let hi = -Infinity;
	for (const [, y] of rings[0]) {
		lo = Math.min(lo, y);
		hi = Math.max(hi, y);
	}
	const total = area(rings[0]) - rings.slice(1).reduce((a, h) => a + area(h), 0);
	const areaBelow = (cut: number) =>
		area(clipBelow(rings[0], cut)) - rings.slice(1).reduce((a, h) => a + area(clipBelow(h, cut)), 0);
	let a = lo;
	let b = hi;
	for (let i = 0; i < 40; i++) {
		const mid = (a + b) / 2;
		if (areaBelow(mid) < f * total) a = mid;
		else b = mid;
	}
	return rings.map((r) => clipBelow(r, b)).filter((r) => r.length >= 3);
}

export function ringsArea(rings: Pt[][]): number {
	return rings.length ? area(rings[0]) - rings.slice(1).reduce((a, h) => a + area(h), 0) : 0;
}

/**
 * Distance from `target` along unit vector `back` (target → camera) at
 * which every corner of a box fits the frustum, with `margin` to spare.
 * Corners are relative to the target; right/up are the camera's axes.
 */
export function fitDistance(
	corners: [number, number, number][],
	back: [number, number, number],
	right: [number, number, number],
	up: [number, number, number],
	vFovRad: number,
	aspect: number,
	margin = 1.12
): number {
	const tv = Math.tan(vFovRad / 2);
	const th = tv * aspect;
	let d = 0;
	for (const c of corners) {
		const f = c[0] * back[0] + c[1] * back[1] + c[2] * back[2];
		const r = Math.abs(c[0] * right[0] + c[1] * right[1] + c[2] * right[2]) * margin;
		const u = Math.abs(c[0] * up[0] + c[1] * up[1] + c[2] * up[2]) * margin;
		d = Math.max(d, f + r / th, f + u / tv);
	}
	return d;
}
