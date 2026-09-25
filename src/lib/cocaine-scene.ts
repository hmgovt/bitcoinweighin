/**
 * The cocaine stage's physical layout — pure, tested
 * (tests/cocaine-scene.test.ts). How big each thing is, how many of them a
 * mass makes, where each one sits, and where the camera looks from.
 * Drawn by src/lib/scene/CocaineStage.svelte.
 *
 * Units: metres, grams. The tiers and grams-per-unit are the same as the
 * readout's (CocaineBrickStack.helpers.ts), so the words and the picture
 * always agree:
 *   < 1 g          lines on a mirror (30 mg each)
 *   1 g – 1 kg     1 g baggies
 *   1 kg – 1 t     1 kg bricks
 *   ≥ 1 t          pallets of 1,000 bricks
 */

import {
	GRAMS_PER_LINE,
	GRAMS_PER_BAG,
	GRAMS_PER_BRICK,
	BRICKS_PER_PALLET,
	PARTIAL_MIN_FRACTION,
	selectTier,
} from './components/CocaineBrickStack.helpers.js';

export type StageTier = 'lines' | 'bags' | 'bricks' | 'pallets';

export function stageTier(grams: number): StageTier | null {
	const t = selectTier(grams);
	if (t === null) return null;
	return t === 'production' ? 'pallets' : t;
}

// ── The things ─────────────────────────────────────────────────────────────

/** Loose cocaine hydrochloride powder, g/cm³ — light and fluffy once chopped. */
export const POWDER_BULK_DENSITY = 0.5;

/** A line: 30 mg chopped out to ~6 cm × 4.5 mm on glass. */
export const LINE = { lengthM: 0.06, widthM: 0.0045 } as const;

/**
 * Peak height of a line, m. Its cross-section is a flattened dome (area
 * ≈ 0.6 × width × height) that tapers over the last ~12% at each end, so
 * volume ≈ 0.6·w·h·(0.88·L). Solved for h from grams ÷ bulk density.
 */
export function lineHeightM(grams: number = GRAMS_PER_LINE): number {
	const volM3 = grams / POWDER_BULK_DENSITY / 1e6;
	return volM3 / (0.6 * LINE.widthM * 0.88 * LINE.lengthM);
}

/** A small zip-lock bag (2 × 2.4 in) holding 1 g. */
export const BAG = { widthM: 0.05, lengthM: 0.06, sealM: 0.005, zipM: 0.011, thickM: 0.0048 } as const;

/**
 * A pressed, taped 1 kg brick — about the size of a hardback book, ~0.9 g/cm³
 * as wrapped (the press gets it to ~1.2; tape, film and corners add air).
 */
export const BRICK = { lengthM: 0.21, widthM: 0.14, heightM: 0.038 } as const;

/** A 1.2 × 1.0 m pallet (0.144 m deck) carrying 1,000 bricks, 5 × 7 per layer. */
export const PALLET = {
	lengthM: 1.2,
	widthM: 1.0,
	deckM: 0.144,
	perLayer: 35,
	layers: Math.ceil(BRICKS_PER_PALLET / 35),
} as const;
export const PALLET_LOAD_M = PALLET.layers * BRICK.heightM;

/** Individual pallets drawn up to this many; past it, one block of them. */
export const PALLET_FIELD_CAP = 120;
/** Aisle between pallets in the field, m. */
export const PALLET_AISLE_M = 0.35;

// ── Counts ─────────────────────────────────────────────────────────────────

export interface Count {
	tier: StageTier;
	/** Exact number of units (lines, bags, bricks, pallets). */
	exact: number;
	/** Whole units drawn. */
	whole: number;
	/** The trailing part-unit (0 when too small to draw). */
	part: number;
}

export function countFor(grams: number): Count | null {
	const tier = stageTier(grams);
	if (!tier) return null;
	const per =
		tier === 'lines'
			? GRAMS_PER_LINE
			: tier === 'bags'
				? GRAMS_PER_BAG
				: tier === 'bricks'
					? GRAMS_PER_BRICK
					: GRAMS_PER_BRICK * BRICKS_PER_PALLET;
	const exact = grams / per;
	let whole = Math.floor(exact + 1e-9);
	let part = exact - whole;
	if (part < PARTIAL_MIN_FRACTION || part > 1 - 1e-9) part = 0;
	if (whole === 0 && part === 0) {
		// Always draw something: a lone part-unit.
		part = Math.max(exact, PARTIAL_MIN_FRACTION);
	}
	return { tier, exact, whole, part };
}

// ── Deterministic noise ────────────────────────────────────────────────────

/** Stable 0–1 hash, so the same amount always lays out the same way. */
export function hash01(i: number, k = 0): number {
	const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
	return s - Math.floor(s);
}

// ── Layouts ────────────────────────────────────────────────────────────────

export interface Placed {
	x: number;
	y: number;
	z: number;
	/** Rotation about the vertical, radians. */
	rotY: number;
	/** Fraction of a whole unit (1 = whole). */
	fill: number;
	/** Small tilt for things resting on others, radians. */
	tiltX?: number;
	tiltZ?: number;
}

export interface Extent {
	/** Footprint, x and z, m. */
	w: number;
	d: number;
	/** Height, m. */
	h: number;
}

/** Lines side by side on a mirror (eight to a column), a razor blade alongside. */
export function layoutLines(c: Count): { lines: Placed[]; mirror: Extent; blade: Placed } {
	const n = c.whole + (c.part > 0 ? 1 : 0);
	const perCol = Math.min(8, Math.max(1, n));
	const cols = Math.ceil(n / perCol);
	const gapZ = 0.016;
	const gapX = 0.014;
	const lines: Placed[] = [];
	for (let i = 0; i < n; i++) {
		const col = Math.floor(i / perCol);
		const row = i % perCol;
		const isPart = c.part > 0 && i === n - 1;
		lines.push({
			x: (col - (cols - 1) / 2) * (LINE.lengthM + gapX) + (hash01(i, 1) - 0.5) * 0.004,
			y: 0,
			z: (row - (perCol - 1) / 2) * gapZ + (hash01(i, 2) - 0.5) * 0.002,
			rotY: (hash01(i, 3) - 0.5) * 0.08,
			fill: isPart ? c.part : 1,
		});
	}
	const w = cols * LINE.lengthM + (cols - 1) * gapX + 0.07;
	const d = (perCol - 1) * gapZ + 0.075;
	const mirror = { w: Math.max(w, 0.16), d: Math.max(d, 0.11), h: 0.004 };
	const blade: Placed = { x: mirror.w * 0.2, y: 0, z: mirror.d / 2 - 0.022, rotY: 0.35, fill: 1 };
	return { lines, mirror, blade };
}

/**
 * Baggies dropped into a loose heap: each lands where it falls, on top of
 * whatever is already there (a coarse height field), so a few make a
 * scatter and hundreds make a mound.
 */
export function layoutBags(c: Count): { bags: Placed[]; extent: Extent } {
	const n = c.whole + (c.part > 0 ? 1 : 0);
	const cell = 0.01;
	const radius = 0.03 + 0.024 * Math.sqrt(n);
	const size = Math.ceil((radius * 2 + 0.1) / cell);
	const half = (size * cell) / 2;
	const field = new Float32Array(size * size);
	const bags: Placed[] = [];
	let maxH = 0;
	let maxR = 0;
	for (let i = 0; i < n; i++) {
		// Heavier toward the middle: r ∝ √u gives a uniform disc; u^0.7 piles it up.
		const r = radius * Math.pow(hash01(i, 11), 0.7);
		const a = hash01(i, 12) * Math.PI * 2;
		const x = Math.cos(a) * r;
		const z = Math.sin(a) * r;
		const rotY = hash01(i, 13) * Math.PI * 2;
		// Footprint cells under this bag (its bounding circle, slightly shrunk).
		const fr = BAG.lengthM * 0.42;
		const cx = Math.floor((x + half) / cell);
		const cz = Math.floor((z + half) / cell);
		const k = Math.ceil(fr / cell);
		let base = 0;
		for (let dx = -k; dx <= k; dx++) {
			for (let dz = -k; dz <= k; dz++) {
				if (dx * dx + dz * dz > k * k) continue;
				const ix = cx + dx;
				const iz = cz + dz;
				if (ix < 0 || iz < 0 || ix >= size || iz >= size) continue;
				base = Math.max(base, field[iz * size + ix]);
			}
		}
		const isPart = c.part > 0 && i === n - 1;
		const top = base + BAG.thickM * (isPart ? 0.5 + 0.5 * c.part : 1) * 0.8;
		for (let dx = -k; dx <= k; dx++) {
			for (let dz = -k; dz <= k; dz++) {
				if (dx * dx + dz * dz > k * k) continue;
				const ix = cx + dx;
				const iz = cz + dz;
				if (ix < 0 || iz < 0 || ix >= size || iz >= size) continue;
				field[iz * size + ix] = top;
			}
		}
		const tilt = base > 0 ? 0.12 : 0.02;
		bags.push({
			x,
			y: base,
			z,
			rotY,
			fill: isPart ? c.part : 1,
			tiltX: (hash01(i, 14) - 0.5) * tilt,
			tiltZ: (hash01(i, 15) - 0.5) * tilt,
		});
		maxH = Math.max(maxH, top);
		maxR = Math.max(maxR, r + BAG.lengthM * 0.55);
	}
	return { bags, extent: { w: maxR * 2, d: maxR * 2, h: maxH } };
}

/**
 * Bricks. A handful lie in a row on the floor, as seizure photos lay them
 * out; more are stacked into a neat block five long by seven deep — a
 * pallet's layer pattern — rising a layer at a time, with a part-brick (cut)
 * on top.
 */
export function layoutBricks(c: Count): { bricks: Placed[]; extent: Extent } {
	const n = c.whole + (c.part > 0 ? 1 : 0);
	const bricks: Placed[] = [];
	const L = BRICK.lengthM;
	const W = BRICK.widthM;
	const H = BRICK.heightM;
	if (n <= 6) {
		const gap = 0.03;
		for (let i = 0; i < n; i++) {
			const isPart = c.part > 0 && i === n - 1;
			bricks.push({
				x: (i - (n - 1) / 2) * (W + gap) + (hash01(i, 21) - 0.5) * 0.01,
				y: 0,
				z: (hash01(i, 22) - 0.5) * 0.02,
				rotY: Math.PI / 2 + (hash01(i, 23) - 0.5) * 0.08,
				fill: isPart ? c.part : 1,
			});
		}
		return { bricks, extent: { w: n * W + (n - 1) * gap, d: L, h: H } };
	}
	// Stacked block, square-ish and growing toward a full pallet layer (5 × 7).
	const colsX = Math.min(5, Math.max(2, Math.round(Math.cbrt(n) * 0.8)));
	const colsZ = Math.min(7, Math.max(2, Math.round(colsX * 1.4)));
	const pitchX = L * 1.01;
	const pitchZ = W * 1.01;
	let maxLayer = 0;
	for (let i = 0; i < n; i++) {
		const layer = Math.floor(i / (colsX * colsZ));
		const j = i % (colsX * colsZ);
		const ix = j % colsX;
		const iz = Math.floor(j / colsX);
		const isPart = c.part > 0 && i === n - 1;
		bricks.push({
			x: (ix - (colsX - 1) / 2) * pitchX + (hash01(i, 24) - 0.5) * 0.006,
			y: layer * H * 1.002,
			z: (iz - (colsZ - 1) / 2) * pitchZ + (hash01(i, 25) - 0.5) * 0.006,
			rotY: (hash01(i, 26) - 0.5) * 0.03,
			fill: isPart ? c.part : 1,
		});
		maxLayer = layer;
	}
	return { bricks, extent: { w: colsX * pitchX, d: colsZ * pitchZ, h: (maxLayer + 1) * H } };
}

/** Pallets: a field with aisles up to PALLET_FIELD_CAP, then one block. */
export function layoutPallets(c: Count): {
	pallets: Placed[];
	block: { colsX: number; colsZ: number; layers: number; count: number } | null;
	extent: Extent;
} {
	const n = c.whole + (c.part > 0 ? 1 : 0);
	const unitH = PALLET.deckM + PALLET_LOAD_M;
	if (n <= PALLET_FIELD_CAP) {
		const colsX = Math.max(1, Math.ceil(Math.sqrt(n * 0.9)));
		const colsZ = Math.ceil(n / colsX);
		const pitchX = PALLET.lengthM + PALLET_AISLE_M;
		const pitchZ = PALLET.widthM + PALLET_AISLE_M;
		const pallets: Placed[] = [];
		for (let i = 0; i < n; i++) {
			const ix = i % colsX;
			const iz = Math.floor(i / colsX);
			const isPart = c.part > 0 && i === n - 1;
			pallets.push({
				x: (ix - (colsX - 1) / 2) * pitchX,
				y: 0,
				z: (iz - (colsZ - 1) / 2) * pitchZ,
				rotY: (hash01(i, 31) - 0.5) * 0.04,
				fill: isPart ? c.part : 1,
			});
		}
		return {
			pallets,
			block: null,
			extent: { w: colsX * pitchX - PALLET_AISLE_M, d: colsZ * pitchZ - PALLET_AISLE_M, h: unitH },
		};
	}
	// A warehouse block of pallets, stacked, roughly cubic in metres.
	const count = Math.ceil(c.exact);
	const side = Math.cbrt(count * PALLET.lengthM * PALLET.widthM * unitH);
	const layers = Math.max(1, Math.round(side / unitH));
	const perLayer = Math.ceil(count / layers);
	const colsX = Math.max(1, Math.round(Math.sqrt(perLayer * (PALLET.widthM / PALLET.lengthM))));
	const colsZ = Math.ceil(perLayer / colsX);
	return {
		pallets: [],
		block: { colsX, colsZ, layers, count },
		extent: { w: colsX * PALLET.lengthM, d: colsZ * PALLET.widthM, h: layers * unitH },
	};
}

// ── Camera ─────────────────────────────────────────────────────────────────

const FOV_DEG = 35;
const AZIMUTH = (-32 * Math.PI) / 180;

/**
 * Where to look from. Flat things (lines on a mirror, a scatter of baggies)
 * need to be looked down on — a line is under half a millimetre tall — so
 * the camera starts high (42°) and flattens toward the metal stage's low
 * angle (12°) as the load grows into bricks, pallets and a warehouse.
 * `center` shifts the shot to take in Sat beside the load.
 */
export function stageCamera(
	extent: Extent,
	aspect: number,
	center: { x: number; z: number } = { x: 0, z: 0 }
): { pos: { x: number; y: number; z: number }; aim: { x: number; y: number; z: number }; elev: number; dist: number } {
	const span = Math.max(extent.w, extent.d, extent.h * 1.4, 0.05);
	const t = Math.min(1, Math.max(0, (Math.log10(span) - Math.log10(0.3)) / (Math.log10(40) - Math.log10(0.3))));
	const elev = ((42 - 30 * t) * Math.PI) / 180;
	const vHalf = Math.tan(((FOV_DEG / 2) * Math.PI) / 180);
	const hHalf = vHalf * Math.max(aspect, 0.2);
	// Fit the footprint across the frame and the height (plus the footprint's
	// foreshortened depth) up it, with some air.
	const needW = span * 1.2;
	const needH = (extent.h + extent.d * Math.sin(elev)) * 1.3 + 0.02;
	const dist = Math.max(needW / (2 * hHalf), needH / (2 * vHalf), 0.12);
	const aim = { x: center.x, y: extent.h * 0.4, z: center.z };
	const pos = {
		x: aim.x + dist * Math.cos(elev) * Math.sin(AZIMUTH),
		y: aim.y + dist * Math.sin(elev),
		z: aim.z + dist * Math.cos(elev) * Math.cos(AZIMUTH),
	};
	return { pos, aim, elev, dist };
}

/** Sat's reach from where he stands to the tips of his front paws, m. */
export const DOG_REACH_M = 0.34;

/**
 * Where Sat stands. Beside lines he sits behind the mirror (his front paws
 * at its far edge, out of the way of the powder); beside anything else he
 * stands off the load's front-right corner, facing it.
 */
export function dogBeside(extent: Extent, tier: StageTier): { x: number; z: number } {
	if (tier === 'lines') return { x: extent.w * 0.4, z: -(extent.d / 2 + DOG_REACH_M * 0.6) };
	// Front-right corner, so the load never stands between him and the camera.
	return { x: extent.w / 2 + DOG_REACH_M + 0.04, z: extent.d / 2 + 0.1 };
}

/**
 * The shot's footprint: the load, plus Sat. Beside a load at least his own
 * size he's framed whole; beside anything smaller only his front paws and
 * chest make the shot (the metal stage's macro look), so small things stay
 * big in frame. For lines pass `dog = null`: the shot is the mirror.
 */
export function shotBounds(
	extent: Extent,
	dog: { x: number; z: number } | null
): { extent: Extent; center: { x: number; z: number } } {
	if (!dog) return { extent, center: { x: 0, z: 0 } };
	const whole = Math.max(extent.w, extent.d) >= 0.45;
	const reachX = whole ? dog.x + 0.2 : dog.x - DOG_REACH_M + 0.1;
	const minX = Math.min(-extent.w / 2, dog.x - DOG_REACH_M);
	const maxX = Math.max(extent.w / 2, reachX);
	const minZ = Math.min(-extent.d / 2, dog.z - 0.15);
	const maxZ = Math.max(extent.d / 2, dog.z + 0.15);
	return {
		extent: { w: maxX - minX, d: maxZ - minZ, h: Math.max(extent.h, whole ? 0.52 : 0.06) },
		center: { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 },
	};
}

/**
 * Where a camera ray through screen point `ndc` meets the floor — the spot
 * Sat walks to when the load dwarfs him (lower right of the frame, as on the
 * metal stage). Pushed forward if it would land on the load itself.
 * Null when the ray doesn't reach the floor.
 */
export function groundMark(
	pos: { x: number; y: number; z: number },
	aim: { x: number; y: number; z: number },
	aspect: number,
	extent: Extent,
	ndc: { x: number; y: number } = { x: 0.42, y: -0.72 }
): { x: number; z: number } | null {
	const norm = (v: [number, number, number]) => {
		const l = Math.hypot(v[0], v[1], v[2]) || 1;
		return [v[0] / l, v[1] / l, v[2] / l] as [number, number, number];
	};
	const cross = (a: [number, number, number], b: [number, number, number]) =>
		[a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] as [number, number, number];
	const f = norm([aim.x - pos.x, aim.y - pos.y, aim.z - pos.z]);
	const r = norm(cross(f, [0, 1, 0]));
	const u = cross(r, f);
	const tv = Math.tan(((FOV_DEG / 2) * Math.PI) / 180);
	const th = tv * aspect;
	const d = norm([
		f[0] + r[0] * ndc.x * th + u[0] * ndc.y * tv,
		f[1] + r[1] * ndc.x * th + u[1] * ndc.y * tv,
		f[2] + r[2] * ndc.x * th + u[2] * ndc.y * tv,
	]);
	if (d[1] >= -1e-4) return null;
	const t = -pos.y / d[1];
	let x = pos.x + d[0] * t;
	let z = pos.z + d[2] * t;
	const clearX = extent.w / 2 + DOG_REACH_M;
	const clearZ = extent.d / 2 + DOG_REACH_M;
	if (Math.abs(x) < clearX && Math.abs(z) < clearZ) z = clearZ + 0.1;
	return { x, z };
}
