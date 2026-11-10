/**
 * Turns static/data/manhattan.bin (scripts/build-manhattan.ts) into
 * render-ready buffers: the land, parks, every developable lot (flat, in
 * fill order) and every building (extruded, sorted by the lot it stands
 * on). Pure — no three.js — so it runs in a Web Worker and under test.
 *
 * Frame: map (x, y) metres → scene (x, height, −y), so north up the
 * island is −z. Because lots are packed in fill order and buildings sorted
 * by lot, "everything owned" is always a prefix of each index buffer: the
 * stage draws owned and unowned as two draw ranges over shared buffers,
 * and a change of amount costs nothing but moving the split.
 */
import earcut from 'earcut';

export interface SectionIndex {
	[name: string]: { offset: number; length: number; type: string };
}

export interface MapMeta {
	projection: { metresPerUnit: number };
	sections: SectionIndex;
}

export interface Mesh {
	positions: Float32Array;
	index: Uint32Array;
	/** Per-vertex grey tint 0–255 (buildings only), for variety. */
	shade?: Uint8Array;
}

export interface ManhattanBuffers {
	land: Mesh;
	parks: Mesh;
	lots: Mesh;
	buildings: Mesh;
	/** lotIndexStart[i] = index count of lots 0…i−1 (length lots + 1). */
	lotIndexStart: Uint32Array;
	/** bldIndexByLot[i] = index count of all buildings standing on lots 0…i−1. */
	bldIndexByLot: Uint32Array;
	/** Running bounds of lots 0…i (plan, map metres): minX, minY, maxX, maxY per lot. */
	prefixBounds: Float32Array;
	/** Plan centroid of each lot (map metres), for placing a part-lot patch. */
	lotCentroid: Float32Array;
	lotArea: Float32Array;
	/** Tallest building on lots 0…i, m. */
	prefixMaxHeight: Float32Array;
	/** The island's plan bounds, map metres. */
	bounds: [number, number, number, number];
}

type Typed = Int16Array | Uint16Array | Uint32Array | Int32Array | Float32Array;
const CTOR: Record<string, new (b: ArrayBuffer, o: number, l: number) => Typed> = {
	i16: Int16Array,
	u16: Uint16Array,
	u32: Uint32Array,
	i32: Int32Array,
	f32: Float32Array,
};

function section<T extends Typed>(buf: ArrayBuffer, sections: SectionIndex, name: string): T {
	const s = sections[name];
	if (!s) throw new Error(`manhattan.bin: no section ${name}`);
	return new CTOR[s.type](buf, s.offset, s.length) as T;
}

interface PolySet {
	polyStart: Uint32Array;
	ringStart: Uint32Array;
	coords: Int16Array;
}

function polySet(buf: ArrayBuffer, sections: SectionIndex, name: string): PolySet {
	return {
		polyStart: section(buf, sections, `${name}.polyStart`),
		ringStart: section(buf, sections, `${name}.ringStart`),
		coords: section(buf, sections, `${name}.coords`),
	};
}

/** A growable pair of vertex/index arrays. */
class Builder {
	pos: Float32Array;
	idx: Uint32Array;
	shade: Uint8Array | null;
	nv = 0;
	ni = 0;
	constructor(verts: number, indices: number, withShade = false) {
		this.pos = new Float32Array(verts * 3);
		this.idx = new Uint32Array(indices);
		this.shade = withShade ? new Uint8Array(verts) : null;
	}
	private growV(n: number): void {
		const cap = this.pos.length / 3;
		if (this.nv + n <= cap) return;
		const next = Math.max(this.nv + n, Math.ceil(cap * 1.5));
		const p = new Float32Array(next * 3);
		p.set(this.pos);
		this.pos = p;
		if (this.shade) {
			const s = new Uint8Array(next);
			s.set(this.shade);
			this.shade = s;
		}
	}
	private growI(n: number): void {
		if (this.ni + n <= this.idx.length) return;
		const i = new Uint32Array(Math.max(this.ni + n, this.idx.length * 1.5) | 0);
		i.set(this.idx);
		this.idx = i;
	}
	vertex(x: number, h: number, y: number, shade = 255): number {
		this.growV(1);
		const k = this.nv++;
		this.pos[k * 3] = x;
		this.pos[k * 3 + 1] = h;
		this.pos[k * 3 + 2] = -y;
		if (this.shade) this.shade[k] = shade;
		return k;
	}
	tri(a: number, b: number, c: number): void {
		this.growI(3);
		this.idx[this.ni++] = a;
		this.idx[this.ni++] = b;
		this.idx[this.ni++] = c;
	}
	done(): Mesh {
		return {
			positions: this.pos.slice(0, this.nv * 3),
			index: this.idx.slice(0, this.ni),
			...(this.shade ? { shade: this.shade.slice(0, this.nv) } : {}),
		};
	}
}

/** Flat polygon `p` of `set` at height `h`: earcut over its rings. Returns index count added. */
function flatPoly(b: Builder, set: PolySet, p: number, h: number, q: number): number {
	const r0 = set.polyStart[p];
	const r1 = set.polyStart[p + 1];
	const v0 = set.ringStart[r0];
	const v1 = set.ringStart[r1];
	const flat: number[] = [];
	const holes: number[] = [];
	for (let r = r0; r < r1; r++) {
		if (r > r0) holes.push(set.ringStart[r] - v0);
		for (let v = set.ringStart[r]; v < set.ringStart[r + 1]; v++) flat.push(set.coords[v * 2] * q, set.coords[v * 2 + 1] * q);
	}
	const base = b.nv;
	for (let v = 0; v < v1 - v0; v++) b.vertex(flat[v * 2], h, flat[v * 2 + 1]);
	const tris = earcut(flat, holes.length ? holes : undefined);
	// Face every triangle up (+y). In the scene's (x, −y) frame that means
	// counter-clockwise in map coordinates; earcut's own winding varies.
	for (let t = 0; t < tris.length; t += 3) {
		const [i, j, k] = [tris[t], tris[t + 1], tris[t + 2]];
		const cross =
			(flat[j * 2] - flat[i * 2]) * (flat[k * 2 + 1] - flat[i * 2 + 1]) -
			(flat[j * 2 + 1] - flat[i * 2 + 1]) * (flat[k * 2] - flat[i * 2]);
		if (cross >= 0) b.tri(base + i, base + j, base + k);
		else b.tri(base + i, base + k, base + j);
	}
	return tris.length;
}

export function buildManhattan(buf: ArrayBuffer, meta: MapMeta): ManhattanBuffers {
	const q = meta.projection.metresPerUnit;
	const S = meta.sections;
	const outline = polySet(buf, S, 'outline');
	const parks = polySet(buf, S, 'parks');
	const lots = polySet(buf, S, 'lots');
	const blds = polySet(buf, S, 'buildings');
	const lotArea = section<Float32Array>(buf, S, 'lots.area');
	const bHeight = section<Uint16Array>(buf, S, 'buildings.height');
	const bLot = section<Int32Array>(buf, S, 'buildings.lot');
	const nLots = lots.polyStart.length - 1;
	const nBld = blds.polyStart.length - 1;

	// Land and parks, flat.
	const land = new Builder(outline.coords.length, outline.coords.length * 3);
	for (let p = 0; p < outline.polyStart.length - 1; p++) flatPoly(land, outline, p, 0, q);
	const park = new Builder(parks.coords.length, parks.coords.length * 3);
	for (let p = 0; p < parks.polyStart.length - 1; p++) flatPoly(park, parks, p, 0.08, q);

	// Lots, in fill order, just above the street.
	const lot = new Builder(lots.coords.length / 2, lots.coords.length * 3);
	const lotIndexStart = new Uint32Array(nLots + 1);
	const prefixBounds = new Float32Array(nLots * 4);
	const lotCentroid = new Float32Array(nLots * 2);
	let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
	for (let p = 0; p < nLots; p++) {
		lotIndexStart[p] = lot.ni;
		flatPoly(lot, lots, p, 0.15, q);
		const v0 = lots.ringStart[lots.polyStart[p]];
		const v1 = lots.ringStart[lots.polyStart[p] + 1];
		let sx = 0, sy = 0;
		for (let v = v0; v < v1; v++) {
			const x = lots.coords[v * 2] * q;
			const y = lots.coords[v * 2 + 1] * q;
			sx += x;
			sy += y;
			bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y);
		}
		lotCentroid[p * 2] = sx / (v1 - v0);
		lotCentroid[p * 2 + 1] = sy / (v1 - v0);
		prefixBounds.set([bx0, by0, bx1, by1], p * 4);
	}
	lotIndexStart[nLots] = lot.ni;

	// Buildings, sorted by lot (unowned-able ones, lot −1, last), extruded.
	const order = Array.from({ length: nBld }, (_, i) => i).sort((a, b) => {
		const la = bLot[a] < 0 ? nLots : bLot[a];
		const lb = bLot[b] < 0 ? nLots : bLot[b];
		return la - lb;
	});
	const bld = new Builder(blds.coords.length, blds.coords.length * 6, true);
	const bldIndexByLot = new Uint32Array(nLots + 1);
	const prefixMaxHeight = new Float32Array(nLots);
	let cursorLot = 0;
	let hash = 7;
	for (const i of order) {
		const li = bLot[i] < 0 ? nLots : bLot[i];
		while (cursorLot < li && cursorLot < nLots) bldIndexByLot[++cursorLot] = bld.ni;
		const h = bHeight[i] / 10;
		if (li < nLots) prefixMaxHeight[li] = Math.max(prefixMaxHeight[li], h);
		hash = (hash * 16807) % 2147483647;
		const shade = 200 + (hash % 56);
		const r0 = blds.polyStart[i];
		const r1 = blds.polyStart[i + 1];
		// Walls: every ring edge, bottom to top, facing out of the building —
		// outer rings walked counter-clockwise, holes clockwise (map frame).
		for (let r = r0; r < r1; r++) {
			const v0 = blds.ringStart[r];
			const n = blds.ringStart[r + 1] - v0;
			let area = 0;
			for (let v = 0; v < n; v++) {
				const w = (v + 1) % n;
				area +=
					blds.coords[(v0 + v) * 2] * blds.coords[(v0 + w) * 2 + 1] -
					blds.coords[(v0 + w) * 2] * blds.coords[(v0 + v) * 2 + 1];
			}
			const reverse = r === r0 ? area < 0 : area > 0;
			const base = bld.nv;
			for (let v = 0; v < n; v++) {
				const x = blds.coords[(v0 + v) * 2] * q;
				const y = blds.coords[(v0 + v) * 2 + 1] * q;
				bld.vertex(x, 0, y, Math.round(shade * 0.82));
				bld.vertex(x, h, y, shade);
			}
			for (let v = 0; v < n; v++) {
				const w = (v + 1) % n;
				const [a, b] = reverse ? [base + w * 2, base + v * 2] : [base + v * 2, base + w * 2];
				bld.tri(a, b, b + 1);
				bld.tri(a, b + 1, a + 1);
			}
		}
		// Roof.
		flatPolyShade(bld, blds, i, h, q, shade);
	}
	while (cursorLot < nLots) bldIndexByLot[++cursorLot] = bld.ni;
	for (let p = 1; p < nLots; p++) prefixMaxHeight[p] = Math.max(prefixMaxHeight[p], prefixMaxHeight[p - 1]);

	let ix0 = Infinity, iy0 = Infinity, ix1 = -Infinity, iy1 = -Infinity;
	for (let v = 0; v < outline.coords.length; v += 2) {
		ix0 = Math.min(ix0, outline.coords[v] * q); ix1 = Math.max(ix1, outline.coords[v] * q);
		iy0 = Math.min(iy0, outline.coords[v + 1] * q); iy1 = Math.max(iy1, outline.coords[v + 1] * q);
	}

	return {
		land: land.done(),
		parks: park.done(),
		lots: lot.done(),
		buildings: bld.done(),
		lotIndexStart,
		bldIndexByLot,
		prefixBounds,
		lotCentroid,
		lotArea: new Float32Array(lotArea),
		prefixMaxHeight,
		bounds: [ix0, iy0, ix1, iy1],
	};
}

/** Roof: `flatPoly` with the building's shade on every vertex. */
function flatPolyShade(b: Builder, set: PolySet, p: number, h: number, q: number, shade: number): void {
	const start = b.nv;
	flatPoly(b, set, p, h, q);
	if (b.shade) for (let v = start; v < b.nv; v++) b.shade[v] = Math.min(255, shade + 12);
}
