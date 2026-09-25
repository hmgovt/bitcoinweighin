/**
 * Builds the Manhattan map the Land tab draws: every tax lot, park and
 * building on the island, from NYC Open Data, packed into one small binary.
 *
 *   npm run build-manhattan            (uses .cache/nyc/ when present)
 *   npm run build-manhattan -- --fetch (re-downloads first)
 *
 * Not part of `npm run build` — the city's map changes slowly and the build
 * machine may have no network. Re-run it to refresh, and commit the output.
 *
 * Sources (NYC Open Data, data.cityofnewyork.us):
 *   i38t-6if2  Digital Tax Map tax lot polygons (DOF)
 *   64uk-42ks  PLUTO — land use and lot area per BBL (DCP)
 *   gthc-hcne  Borough Boundaries, clipped to the shoreline (DCP)
 *   5zhs-2jue  Building Footprints, with roof heights (OTI)
 *
 * Output:
 *   static/data/manhattan.bin   quantised geometry (see the layout below)
 *   src/lib/manhattan-map.json  metadata: projection, section offsets, totals,
 *                               and the cross-street table for the readout
 *
 * Coordinates are metres in a local frame turned to Manhattan's street grid
 * (the avenues run 29° east of true north), so +y runs up the island. The
 * island's developable land (every lot but parks and open space) fills in
 * order of y: from the Battery northward, the way the city grew — then the
 * outer islands (Roosevelt, Randalls and Wards, Governors, Liberty, Ellis,
 * Marble Hill). Tax-lot outlines run out over the rivers in places, so every
 * lot and park is clipped to the shoreline first: only land is counted.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import polygonClipping from 'polygon-clipping';

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE = path.join(ROOT, '.cache/nyc');
const OUT_BIN = path.join(ROOT, 'static/data/manhattan.bin');
const OUT_META = path.join(ROOT, 'src/lib/manhattan-map.json');
const UA = 'bitcoinweighin.com map build (+https://bitcoinweighin.com)';

// ── Fetch ────────────────────────────────────────────────────────────────
const SOURCES: Record<string, { resource: string; params: Record<string, string> }> = {
	'lots.geojson': { resource: 'i38t-6if2.geojson', params: { $where: "boro='1'" } },
	'pluto.json': {
		resource: '64uk-42ks.json',
		params: { $select: 'bbl,landuse,lotarea,address', $where: "borough='MN'" },
	},
	'boroughs.geojson': { resource: 'gthc-hcne.geojson', params: { $where: "boroname='Manhattan'" } },
	'buildings.geojson': {
		resource: '5zhs-2jue.geojson',
		params: { $select: 'the_geom,base_bbl,height_roof', $where: "starts_with(base_bbl,'1')" },
	},
};

function fetchAll(force: boolean): void {
	mkdirSync(CACHE, { recursive: true });
	for (const [file, src] of Object.entries(SOURCES)) {
		const out = path.join(CACHE, file);
		if (existsSync(out) && !force) continue;
		const args = ['-sS', '--fail', '--max-time', '1200', '-A', UA, '-G', `https://data.cityofnewyork.us/resource/${src.resource}`];
		for (const [k, v] of Object.entries({ ...src.params, $limit: '100000' })) args.push('--data-urlencode', `${k}=${v}`);
		args.push('-o', out);
		console.log(`fetching ${file}…`);
		execFileSync('curl', args, { stdio: 'inherit' });
	}
}

// ── Projection ───────────────────────────────────────────────────────────
const LAT0 = 40.7831;
const LON0 = -73.9712;
const GRID_DEG = 29;
const phi = (LAT0 * Math.PI) / 180;
const M_PER_DEG_LAT = 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi);
const M_PER_DEG_LON = 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi);
const th = (GRID_DEG * Math.PI) / 180;
const [ct, st] = [Math.cos(th), Math.sin(th)];

type Pt = [number, number];
type Ring = Pt[];
type Poly = Ring[];

function project([lon, lat]: number[]): Pt {
	const e = (lon - LON0) * M_PER_DEG_LON;
	const n = (lat - LAT0) * M_PER_DEG_LAT;
	return [e * ct - n * st, e * st + n * ct];
}

function ringArea(r: Ring): number {
	let s = 0;
	for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += r[j][0] * r[i][1] - r[i][0] * r[j][1];
	return s / 2;
}
const polyArea = (p: Poly) => Math.abs(ringArea(p[0])) - p.slice(1).reduce((a, h) => a + Math.abs(ringArea(h)), 0);

function centroid(p: Poly): Pt {
	const r = p[0];
	let a = 0, cx = 0, cy = 0;
	for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
		const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
		a += f;
		cx += (r[j][0] + r[i][0]) * f;
		cy += (r[j][1] + r[i][1]) * f;
	}
	if (Math.abs(a) < 1e-9) return r[0];
	return [cx / (3 * a), cy / (3 * a)];
}

/** Douglas–Peucker on a closed ring (first point kept; closing point dropped). */
function simplify(r: Ring, tol: number): Ring {
	const pts = r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r.slice(0, -1) : r;
	if (pts.length <= 4) return pts;
	const keep = new Uint8Array(pts.length);
	keep[0] = keep[pts.length - 1] = 1;
	const stack: [number, number][] = [[0, pts.length - 1]];
	while (stack.length) {
		const [a, b] = stack.pop()!;
		let best = -1, bestD = tol;
		const [ax, ay] = pts[a], [bx, by] = pts[b];
		const dx = bx - ax, dy = by - ay;
		const len = Math.hypot(dx, dy) || 1e-9;
		for (let i = a + 1; i < b; i++) {
			const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
			if (d > bestD) { bestD = d; best = i; }
		}
		if (best >= 0) { keep[best] = 1; stack.push([a, best], [best, b]); }
	}
	const out = pts.filter((_, i) => keep[i]);
	return out.length >= 3 ? out : pts.slice(0, 3);
}

type Box = [number, number, number, number];
const bboxOf = (r: Ring): Box => {
	let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
	for (const [x, y] of r) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
	return [a, b, c, d];
};
const overlaps = (p: Box, q: Box) => p[0] <= q[2] && q[0] <= p[2] && p[1] <= q[3] && q[1] <= p[3];

/** Sutherland–Hodgman: a ring clipped to an axis-aligned box. */
function clipRingToBox(r: Ring, [x0, y0, x1, y1]: Box): Ring {
	let pts = r;
	const edges: [(p: Pt) => boolean, (a: Pt, b: Pt) => Pt][] = [
		[(p) => p[0] >= x0, (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])]],
		[(p) => p[0] <= x1, (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])]],
		[(p) => p[1] >= y0, (a, b) => [a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1]), y0]],
		[(p) => p[1] <= y1, (a, b) => [a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1]), y1]],
	];
	for (const [inside, cut] of edges) {
		if (!pts.length) break;
		const out: Pt[] = [];
		for (let i = 0; i < pts.length; i++) {
			const cur = pts[i];
			const prev = pts[(i + pts.length - 1) % pts.length];
			if (inside(cur)) {
				if (!inside(prev)) out.push(cut(prev, cur));
				out.push(cur);
			} else if (inside(prev)) out.push(cut(prev, cur));
		}
		pts = out;
	}
	return pts;
}

/** The land a polygon covers: its intersection with the shoreline outline.
 *  Fast path when the outline covers the polygon's whole bounding box. */
function clipToLand(poly: Poly, land: { poly: Poly; box: Box }[]): Poly[] {
	const box = bboxOf(poly[0]);
	const pad: Box = [box[0] - 1, box[1] - 1, box[2] + 1, box[3] + 1];
	const pieces: Poly[] = [];
	for (const l of land) {
		if (!overlaps(l.box, pad)) continue;
		const outer = clipRingToBox(l.poly[0], pad);
		if (outer.length < 3) continue;
		// Outline fills the whole box (and no hole touches it): the polygon is all land.
		const full = Math.abs(ringArea(outer)) >= (pad[2] - pad[0]) * (pad[3] - pad[1]) * 0.9999;
		const holes = l.poly.slice(1).filter((h) => overlaps(bboxOf(h), pad));
		if (full && !holes.length) return [poly];
		const clipped = polygonClipping.intersection(
			poly as unknown as polygonClipping.Geom,
			[outer, ...holes.map((h) => clipRingToBox(h, pad)).filter((h) => h.length >= 3)] as unknown as polygonClipping.Geom
		);
		for (const p of clipped) pieces.push(p as unknown as Poly);
	}
	return pieces;
}

function polysOf(geom: { type: string; coordinates: number[][][] | number[][][][] }): Poly[] {
	const raw = geom.type === 'MultiPolygon' ? (geom.coordinates as number[][][][]) : [geom.coordinates as number[][][]];
	return raw.map((p) => p.map((ring) => ring.map(project)));
}

// ── Build ────────────────────────────────────────────────────────────────
function main(): void {
	fetchAll(process.argv.includes('--fetch'));
	const load = (f: string) => JSON.parse(readFileSync(path.join(CACHE, f), 'utf8'));

	// PLUTO: land use and address by BBL.
	const pluto = new Map<string, { landuse: string; address: string }>();
	for (const r of load('pluto.json')) {
		const bbl = String(Math.round(Number(r.bbl)));
		pluto.set(bbl, { landuse: r.landuse ?? '', address: (r.address ?? '').toUpperCase() });
	}

	// The shoreline, largest piece (Manhattan island itself) first.
	const outline: Poly[] = [];
	for (const f of load('boroughs.geojson').features) for (const p of polysOf(f.geometry)) outline.push(p);
	outline.sort((a, b) => polyArea(b) - polyArea(a));
	const land = outline.map((poly) => ({ poly, box: bboxOf(poly[0]) }));

	// Lots, clipped to land: developable (everything but parks and open
	// space, PLUTO land use 9) in fill order; open space drawn as parks.
	type Lot = { bbl: string; poly: Poly; area: number; c: Pt; address: string; main: boolean };
	const dev: Lot[] = [];
	const parks: Poly[] = [];
	let rawArea = 0;
	const t0 = Date.now();
	for (const f of load('lots.geojson').features) {
		if (!f.geometry) continue;
		const bbl = String(f.properties.bbl);
		const info = pluto.get(bbl);
		for (const raw of polysOf(f.geometry)) {
			if (info?.landuse !== '9') rawArea += polyArea(raw);
			for (const poly of clipToLand(raw, land)) {
				const area = polyArea(poly);
				if (!(area > 0.5)) continue;
				if (info?.landuse === '9') {
					parks.push(poly);
					continue;
				}
				const c = centroid(poly);
				const onMain = clipRingToBox([c, [c[0] + 0.01, c[1]], [c[0], c[1] + 0.01]], land[0].box).length > 0 && inRing(c, land[0].poly[0]);
				dev.push({ bbl, poly, area, c, address: info?.address ?? '', main: onMain });
			}
		}
	}
	console.log(`clipped lots to the shoreline in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
	// Up the island from the Battery, then the outer islands.
	dev.sort((a, b) => Number(b.main) - Number(a.main) || a.c[1] - b.c[1] || a.c[0] - b.c[0]);
	const lotIndexByBbl = new Map<string, number>();
	dev.forEach((l, i) => { if (!lotIndexByBbl.has(l.bbl)) lotIndexByBbl.set(l.bbl, i); });

	// Buildings, each tied to its lot where it stands on a developable one.
	type Bldg = { poly: Poly; h: number; lot: number };
	const bldgs: Bldg[] = [];
	for (const f of load('buildings.geojson').features) {
		if (!f.geometry) continue;
		const h = Number(f.properties.height_roof) * 0.3048;
		if (!(h > 1)) continue;
		const lot = lotIndexByBbl.get(String(f.properties.base_bbl)) ?? -1;
		for (const poly of polysOf(f.geometry)) if (polyArea(poly) > 2) bldgs.push({ poly, h, lot });
	}

	// Where a patch smaller than a lot goes: the most open spot (farthest
	// from any building or lot edge) on the first lots in fill order, so a
	// doormat of Manhattan sits on open ground at the Battery, not inside
	// a building.
	const segDist = (px: number, py: number, [ax, ay]: Pt, [bx, by]: Pt) => {
		const dx = bx - ax, dy = by - ay;
		const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
		return Math.hypot(px - ax - t * dx, py - ay - t * dy);
	};
	let patch = { lot: 0, x: dev[0].c[0], y: dev[0].c[1], clearanceM: 0 };
	for (let li = 0; li < Math.min(40, dev.length) && patch.clearanceM < 6; li++) {
		const l = dev[li];
		const onLot = bldgs.filter((b) => b.lot === li).map((b) => b.poly);
		const rings = [...l.poly, ...onLot.flat()];
		const [x0, y0, x1, y1] = bboxOf(l.poly[0]);
		for (let x = x0; x <= x1; x += 1)
			for (let y = y0; y <= y1; y += 1) {
				if (!inRing([x, y], l.poly[0]) || l.poly.slice(1).some((h) => inRing([x, y], h))) continue;
				if (onLot.some((b) => inRing([x, y], b[0]))) continue;
				let d = Infinity;
				for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) d = Math.min(d, segDist(x, y, r[j], r[i]));
				if (d > patch.clearanceM) patch = { lot: li, x, y, clearanceM: d };
			}
	}

	// Cross streets up the island, for "from the Battery to …" in the readout:
	// the median y of the lots on each street, kept only where it rises.
	const byStreet = new Map<string, number[]>();
	const add = (name: string, y: number) => { (byStreet.get(name) ?? byStreet.set(name, []).get(name)!).push(y); };
	for (const l of dev) {
		if (!l.main) continue;
		const m = /\b(?:WEST|EAST|W|E)?\s*(\d{1,3})(?:ST|ND|RD|TH)?\s+STREET\b/.exec(l.address);
		if (m) add(`${Number(m[1])}`, l.c[1]);
		for (const n of ['WALL', 'FULTON', 'CHAMBERS', 'CANAL', 'HOUSTON']) if (l.address.includes(`${n} STREET`)) add(n, l.c[1]);
	}
	const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
	const order = ['WALL', 'FULTON', 'CHAMBERS', 'CANAL', 'HOUSTON', ...Array.from({ length: 220 }, (_, i) => `${i + 1}`)];
	const streets: { name: string; y: number }[] = [];
	for (const name of order) {
		const ys = byStreet.get(name);
		if (!ys || ys.length < 3) continue;
		const y = Math.round(median(ys));
		if (!streets.length || y > streets[streets.length - 1].y + 20) streets.push({ name, y });
	}
	// How much of the fill lies south of each street: the readout names the
	// frontier from the owned area alone, before the map has loaded.
	const cumByLot: number[] = [];
	dev.reduce((a, l, i) => (cumByLot[i] = a + l.area), 0);
	const streetArea = (y: number) => {
		// Lots are sorted by y on the main island; the area of those south of y.
		let lo = 0, hi = dev.length;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (dev[mid].main && dev[mid].c[1] <= y) lo = mid + 1;
			else hi = mid;
		}
		return lo ? cumByLot[lo - 1] : 0;
	};
	const label = (n: string) => (/^\d+$/.test(n) ? `${n}${suffix(Number(n))} Street` : `${n.charAt(0)}${n.slice(1).toLowerCase()} Street`);

	// ── Quantise and pack ─────────────────────────────────────────────────
	let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
	for (const p of outline) for (const [x, y] of p[0]) {
		minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
	}
	const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
	const Q = 0.5; // metres per unit: int16 spans ±16 km
	if (Math.max(maxX - cx, maxY - cy) / Q > 32000) throw new Error('island too big for int16 at 0.5 m');

	type Section = { name: string; bytes: Buffer; type: string; length: number };
	const sections: Section[] = [];
	const push = (name: string, arr: Int16Array | Uint16Array | Uint32Array | Int32Array | Float32Array, type: string) =>
		sections.push({ name, bytes: Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength), type, length: arr.length });

	/** Polygons as three flat arrays: ring starts per polygon, vertex starts per ring, coords. */
	function packPolys(name: string, polys: Poly[], tol: number): void {
		const polyStart = [0], ringStart = [0], coords: number[] = [];
		for (const p of polys) {
			for (const r of p) {
				const s = simplify(r, tol);
				for (const [x, y] of s) coords.push(Math.round((x - cx) / Q), Math.round((y - cy) / Q));
				ringStart.push(coords.length / 2);
			}
			polyStart.push(ringStart.length - 1);
		}
		push(`${name}.polyStart`, Uint32Array.from(polyStart), 'u32');
		push(`${name}.ringStart`, Uint32Array.from(ringStart), 'u32');
		push(`${name}.coords`, Int16Array.from(coords), 'i16');
	}

	packPolys('outline', outline, 1.5);
	packPolys('parks', parks, 0.5);
	packPolys('lots', dev.map((l) => l.poly), 0.3);
	push('lots.area', Float32Array.from(dev.map((l) => l.area)), 'f32');
	packPolys('buildings', bldgs.map((b) => b.poly), 0.3);
	push('buildings.height', Uint16Array.from(bldgs.map((b) => Math.min(65535, Math.round(b.h * 10)))), 'u16');
	push('buildings.lot', Int32Array.from(bldgs.map((b) => b.lot)), 'i32');

	// Concatenate, each section 4-byte aligned.
	const index: Record<string, { offset: number; length: number; type: string }> = {};
	const parts: Buffer[] = [];
	let off = 0;
	for (const s of sections) {
		const pad = (4 - (off % 4)) % 4;
		if (pad) { parts.push(Buffer.alloc(pad)); off += pad; }
		index[s.name] = { offset: off, length: s.length, type: s.type };
		parts.push(s.bytes);
		off += s.bytes.length;
	}
	mkdirSync(path.dirname(OUT_BIN), { recursive: true });
	writeFileSync(OUT_BIN, Buffer.concat(parts));

	const developableM2 = dev.reduce((a, l) => a + l.area, 0);
	const mainM2 = dev.filter((l) => l.main).reduce((a, l) => a + l.area, 0);
	const meta = {
		generated: new Date().toISOString().slice(0, 10),
		attribution:
			'NYC Open Data: DOF Digital Tax Map, DCP PLUTO and Borough Boundaries, OTI Building Footprints',
		projection: { lat0: LAT0, lon0: LON0, gridDeg: GRID_DEG, centreX: cx, centreY: cy, metresPerUnit: Q },
		bytes: off,
		sections: index,
		counts: { lots: dev.length, parks: parks.length, buildings: bldgs.length, outline: outline.length },
		developableM2: Math.round(developableM2),
		/** Of which on Manhattan island itself (filled first). */
		mainIslandM2: Math.round(mainM2),
		mainIslandLots: dev.filter((l) => l.main).length,
		/** Developable lot outlines before clipping to the shoreline. */
		unclippedM2: Math.round(rawArea),
		parksM2: Math.round(parks.reduce((a, p) => a + polyArea(p), 0)),
		/** Fill runs up the island from here (y of the southernmost lot), metres, centred frame. */
		fillStartY: Math.round(dev[0].c[1] - cy),
		/** Open ground on an early lot for patches smaller than a lot (centred frame, m). */
		patch: { lot: patch.lot, x: +(patch.x - cx).toFixed(1), y: +(patch.y - cy).toFixed(1), clearanceM: +patch.clearanceM.toFixed(1) },
		streets: streets.map((s) => ({ name: label(s.name), y: s.y - Math.round(cy), areaM2: Math.round(streetArea(s.y)) })),
	};
	writeFileSync(OUT_META, JSON.stringify(meta, null, '\t') + '\n');
	console.log(
		`manhattan.bin ${(off / 1e6).toFixed(2)} MB — ${dev.length} lots (${(developableM2 / 1e6).toFixed(2)} km² developable, ` +
			`${(mainM2 / 1e6).toFixed(2)} on the island itself; ${(rawArea / 1e6).toFixed(2)} before clipping), ` +
			`${parks.length} parks, ${bldgs.length} buildings, ${streets.length} cross streets`
	);
}

function inRing([x, y]: Pt, r: Ring): boolean {
	let c = false;
	for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
		if (r[i][1] > y !== r[j][1] > y && x < ((r[j][0] - r[i][0]) * (y - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c;
	}
	return c;
}

function suffix(n: number): string {
	if (n % 100 >= 11 && n % 100 <= 13) return 'th';
	return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
}

main();
