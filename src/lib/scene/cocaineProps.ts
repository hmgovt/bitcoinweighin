/**
 * cocaineProps — the cocaine stage's things, built procedurally (no models
 * to download): powder lines, zip-lock baggies, taped 1 kg bricks, pallets
 * under shrink-wrap, the mirror and a razor blade. Sizes come from
 * src/lib/cocaine-scene.ts; this module only makes them look like
 * themselves. Client-only (canvas textures); dynamic-imported by
 * CocaineStage.svelte.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BAG, BRICK, PALLET, PALLET_LOAD_M, hash01 } from '../cocaine-scene.js';

// ── Small helpers ───────────────────────────────────────────────────────────

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	return [c, c.getContext('2d')!];
}

function tex(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
	const t = new THREE.CanvasTexture(c);
	if (srgb) t.colorSpace = THREE.SRGBColorSpace;
	t.wrapS = t.wrapT = THREE.RepeatWrapping;
	t.anisotropy = 8;
	return t;
}

/** Smooth value noise in 2-D from the stable hash. */
function noise2(x: number, y: number, seed = 0): number {
	const xi = Math.floor(x);
	const yi = Math.floor(y);
	const xf = x - xi;
	const yf = y - yi;
	const h = (a: number, b: number) => hash01(a * 57 + b * 131 + seed * 17.3, seed);
	const s = (t: number) => t * t * (3 - 2 * t);
	const a = h(xi, yi);
	const b = h(xi + 1, yi);
	const c = h(xi, yi + 1);
	const d = h(xi + 1, yi + 1);
	return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf);
}

function smoothstep(a: number, b: number, x: number): number {
	const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
}

// ── Textures ───────────────────────────────────────────────────────────────

/** Chopped powder: off-white with brighter crystals and faint grey grit. */
export function makePowderTexture(): THREE.CanvasTexture {
	const [c, g] = canvas(256, 256);
	g.fillStyle = '#e2ded6';
	g.fillRect(0, 0, 256, 256);
	const img = g.getImageData(0, 0, 256, 256);
	for (let i = 0; i < 256 * 256; i++) {
		const n = hash01(i, 5);
		const v = n > 0.985 ? 250 : n < 0.03 ? 170 : 214 + (n - 0.5) * 34;
		img.data[i * 4] = v;
		img.data[i * 4 + 1] = v - 2;
		img.data[i * 4 + 2] = v - 7;
	}
	g.putImageData(img, 0, 0);
	return tex(c);
}

/** Roughness for the powder: mostly matte, with glinting crystal facets. */
export function makePowderRoughness(): THREE.CanvasTexture {
	const [c, g] = canvas(128, 128);
	const img = g.createImageData(128, 128);
	for (let i = 0; i < 128 * 128; i++) {
		const v = hash01(i, 9) > 0.93 ? 70 : 235;
		img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
		img.data[i * 4 + 3] = 255;
	}
	g.putImageData(img, 0, 0);
	return tex(c, false);
}

/**
 * Packing tape wound round a brick: a few wide wraps overlapping at small
 * angles (a slightly deeper tone where two layers lie), a bright edge where
 * each wrap ends, soft cling-film sheen and fine creases. `stamp` adds the
 * smuggler's worn ink mark on the face that carries it.
 */
export function makeTapeTexture(base: string, seed: number, stamp = false): THREE.CanvasTexture {
	const S = 512;
	const [c, g] = canvas(S, S);
	g.fillStyle = base;
	g.fillRect(0, 0, S, S);
	// Wraps in two directions — round the length and round the width — so
	// the overlaps cross-hatch instead of running like grain.
	for (let i = 0; i < 8; i++) {
		const across = i % 2 === 1;
		const pos = ((i >> 1) / 3) * S + (hash01(i, seed) - 0.5) * 80;
		const ang = (across ? Math.PI / 2 : 0) + (hash01(i, seed + 1) - 0.5) * 0.4;
		const w = 120 + hash01(i, seed + 2) * 70;
		g.save();
		g.translate(across ? pos : S / 2, across ? S / 2 : pos);
		g.rotate(ang);
		g.fillStyle = `rgba(55,28,8,${0.07 + hash01(i, seed + 3) * 0.06})`;
		g.fillRect(-S, -w / 2, S * 2, w);
		g.fillStyle = 'rgba(255,238,210,0.3)';
		g.fillRect(-S, -w / 2 - 1, S * 2, 1.6);
		g.fillStyle = 'rgba(40,20,6,0.25)';
		g.fillRect(-S, w / 2, S * 2, 1.2);
		g.restore();
	}
	// Cling-film sheen: broad soft highlights.
	for (let i = 0; i < 5; i++) {
		const x = hash01(i, seed + 30) * S;
		const y = hash01(i, seed + 31) * S;
		const r = 80 + hash01(i, seed + 32) * 140;
		const grd = g.createRadialGradient(x, y, 0, x, y, r);
		grd.addColorStop(0, 'rgba(255,245,230,0.16)');
		grd.addColorStop(1, 'rgba(255,245,230,0)');
		g.fillStyle = grd;
		g.fillRect(0, 0, S, S);
	}
	// Fine creases, mostly along the wrap.
	for (let i = 0; i < 70; i++) {
		const x = hash01(i, seed + 7) * S;
		const y = hash01(i, seed + 8) * S;
		const a = (hash01(i, seed + 9) - 0.5) * 0.7;
		const l = 8 + hash01(i, seed + 10) * 26;
		g.strokeStyle = `rgba(255,248,235,${0.05 + hash01(i, seed + 11) * 0.12})`;
		g.lineWidth = 0.8;
		g.beginPath();
		g.moveTo(x, y);
		g.quadraticCurveTo(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5 + 2, x + Math.cos(a) * l, y + Math.sin(a) * l);
		g.stroke();
	}
	if (stamp) {
		// A worn ink stamp: a ring, a star, a bar — the anonymous kind.
		const [sc, sg] = canvas(S, S);
		sg.translate(S * 0.5, S * 0.5);
		sg.rotate(-0.18);
		sg.strokeStyle = sg.fillStyle = '#7d1418';
		sg.lineWidth = 14;
		sg.beginPath();
		sg.arc(0, 0, 118, 0, Math.PI * 2);
		sg.stroke();
		sg.lineWidth = 5;
		sg.beginPath();
		sg.arc(0, 0, 96, 0, Math.PI * 2);
		sg.stroke();
		sg.beginPath();
		for (let k = 0; k < 10; k++) {
			const r = k % 2 ? 30 : 72;
			const a = -Math.PI / 2 + (k * Math.PI) / 5;
			sg[k ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r - 6);
		}
		sg.closePath();
		sg.fill();
		sg.fillRect(-60, 62, 120, 14);
		sg.setTransform(1, 0, 0, 1, 0, 0);
		// Wear: knock holes in the ink only.
		sg.globalCompositeOperation = 'destination-out';
		for (let i = 0; i < 1400; i++) {
			sg.fillStyle = `rgba(0,0,0,${0.35 + hash01(i, seed + 20) * 0.65})`;
			const r = 1 + hash01(i, seed + 21) * 4;
			sg.fillRect(S * 0.2 + hash01(i, seed + 22) * S * 0.6, S * 0.2 + hash01(i, seed + 23) * S * 0.6, r, r);
		}
		g.globalAlpha = 0.8;
		g.drawImage(sc, 0, 0);
		g.globalAlpha = 1;
	}
	return tex(c);
}

/** Glossy tape with a matte crinkle pattern. */
export function makeTapeRoughness(seed: number): THREE.CanvasTexture {
	const [c, g] = canvas(256, 256);
	g.fillStyle = 'rgb(80,80,80)';
	g.fillRect(0, 0, 256, 256);
	for (let i = 0; i < 70; i++) {
		g.strokeStyle = `rgba(200,200,200,${0.3 + hash01(i, seed + 1) * 0.5})`;
		g.lineWidth = 1 + hash01(i, seed + 2) * 2;
		const x = hash01(i, seed + 3) * 256;
		const y = hash01(i, seed + 4) * 256;
		const a = hash01(i, seed + 5) * Math.PI;
		g.beginPath();
		g.moveTo(x, y);
		g.lineTo(x + Math.cos(a) * 30, y + Math.sin(a) * 30);
		g.stroke();
	}
	return tex(c, false);
}

/** Pallet pine: warm planks, grain lines, the odd knot. */
export function makeWoodTexture(): THREE.CanvasTexture {
	const [c, g] = canvas(256, 256);
	g.fillStyle = '#a57c50';
	g.fillRect(0, 0, 256, 256);
	for (let y = 0; y < 256; y += 2) {
		const n = noise2(0, y / 9, 3);
		g.fillStyle = `rgba(${n > 0.5 ? 70 : 190},${n > 0.5 ? 45 : 150},${n > 0.5 ? 25 : 100},${0.08 + Math.abs(n - 0.5) * 0.25})`;
		g.fillRect(0, y, 256, 2);
	}
	for (let i = 0; i < 4; i++) {
		g.fillStyle = 'rgba(70,40,20,0.35)';
		g.beginPath();
		g.ellipse(hash01(i, 40) * 256, hash01(i, 41) * 256, 7, 4, 0, 0, Math.PI * 2);
		g.fill();
	}
	return tex(c);
}

/**
 * The sides and top of a pallet load: 1 kg bricks seen end-on or side-on
 * in courses, each taped a slightly different tone, under shrink-wrap.
 */
export function makeLoadTexture(cols: number, rows: number, top: boolean): THREE.CanvasTexture {
	const S = 512;
	const [c, g] = canvas(S, S);
	g.fillStyle = '#3a2716';
	g.fillRect(0, 0, S, S);
	const cw = S / cols;
	const ch = S / rows;
	for (let r = 0; r < rows; r++) {
		for (let k = 0; k < cols; k++) {
			const i = r * cols + k;
			const tone = 0.85 + hash01(i, 50) * 0.3;
			const yellow = hash01(i, 51) > 0.9;
			const [R, G, B] = yellow ? [181, 150, 56] : [140, 106, 69];
			g.fillStyle = `rgb(${R * tone},${G * tone},${B * tone})`;
			g.fillRect(k * cw + 1.2, r * ch + 1.2, cw - 2.4, ch - 2.4);
			g.fillStyle = 'rgba(255,255,255,0.12)';
			g.fillRect(k * cw + 1.2, r * ch + 1.2, cw - 2.4, Math.max(1, ch * 0.15));
			if (top && hash01(i, 52) > 0.2) {
				g.strokeStyle = 'rgba(150,20,24,0.7)';
				g.lineWidth = Math.max(1, cw * 0.05);
				g.beginPath();
				g.arc(k * cw + cw / 2, r * ch + ch / 2, Math.min(cw, ch) * 0.26, 0, Math.PI * 2);
				g.stroke();
			}
		}
	}
	return tex(c);
}

/** Shrink-wrap: faint streaks and stretch marks. */
export function makeFilmTexture(): THREE.CanvasTexture {
	const [c, g] = canvas(256, 256);
	g.fillStyle = '#ffffff';
	g.fillRect(0, 0, 256, 256);
	for (let i = 0; i < 60; i++) {
		g.fillStyle = `rgba(160,170,180,${0.1 + hash01(i, 60) * 0.25})`;
		g.fillRect(0, hash01(i, 61) * 256, 256, 1 + hash01(i, 62) * 4);
	}
	return tex(c);
}

/** A whole pallet's face, for the warehouse block: deck at the foot, the wrapped load above. */
export function makePalletFaceTexture(): THREE.CanvasTexture {
	const S = 256;
	const [c, g] = canvas(S, S);
	const deck = Math.round((PALLET.deckM / (PALLET.deckM + PALLET_LOAD_M)) * S);
	const loadH = S - deck;
	g.fillStyle = '#86694a';
	g.fillRect(0, 0, S, loadH);
	// Courses of bricks, faint under the film.
	g.strokeStyle = 'rgba(40,25,12,0.28)';
	g.lineWidth = 1;
	for (let r = 1; r < PALLET.layers; r++) {
		const y = (r / PALLET.layers) * loadH;
		g.beginPath();
		g.moveTo(0, y);
		g.lineTo(S, y);
		g.stroke();
	}
	for (let k = 1; k < 5; k++) {
		g.beginPath();
		g.moveTo((k / 5) * S, 0);
		g.lineTo((k / 5) * S, loadH);
		g.stroke();
	}
	// Film sheen.
	const grd = g.createLinearGradient(0, 0, S, loadH);
	grd.addColorStop(0, 'rgba(255,255,255,0.16)');
	grd.addColorStop(0.5, 'rgba(255,255,255,0.03)');
	grd.addColorStop(1, 'rgba(255,255,255,0.12)');
	g.fillStyle = grd;
	g.fillRect(0, 0, S, loadH);
	// The deck: boards and the dark gaps between its blocks.
	g.fillStyle = '#8d6a44';
	g.fillRect(0, loadH, S, deck);
	g.fillStyle = '#17110b';
	for (const x of [0.06, 0.52]) g.fillRect(x * S, loadH + deck * 0.3, S * 0.4, deck * 0.52);
	g.fillStyle = '#0b0b0d';
	g.fillRect(0, S - 2, S, 2);
	g.fillRect(S - 2, 0, 2, S);
	return tex(c);
}

// ── Materials ──────────────────────────────────────────────────────────────

export interface CocaineMaterials {
	powder: THREE.MeshStandardMaterial;
	plastic: THREE.MeshPhysicalMaterial;
	zip: THREE.MeshStandardMaterial;
	brick: THREE.Material[];
	brickAlt: THREE.Material[];
	brickCut: THREE.MeshStandardMaterial;
	mirror: THREE.MeshPhysicalMaterial;
	mirrorEdge: THREE.MeshStandardMaterial;
	steel: THREE.MeshStandardMaterial;
	wood: THREE.MeshStandardMaterial;
	load: THREE.Material[];
	film: THREE.MeshPhysicalMaterial;
	palletFace: THREE.MeshStandardMaterial;
	palletTop: THREE.MeshStandardMaterial;
	dispose(): void;
}

export function makeMaterials(): CocaineMaterials {
	const textures: THREE.Texture[] = [];
	const T = <X extends THREE.Texture>(t: X) => (textures.push(t), t);

	const powderMap = T(makePowderTexture());
	powderMap.repeat.set(3, 3);
	const powderRough = T(makePowderRoughness());
	powderRough.repeat.set(6, 6);
	const powder = new THREE.MeshStandardMaterial({ map: powderMap, roughnessMap: powderRough, roughness: 1, metalness: 0, color: 0xf2efe8 });

	const plastic = new THREE.MeshPhysicalMaterial({
		color: 0xdfe4e8,
		transparent: true,
		opacity: 0.2,
		roughness: 0.06,
		metalness: 0,
		clearcoat: 1,
		clearcoatRoughness: 0.08,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const zip = new THREE.MeshStandardMaterial({ color: 0xc41e2a, roughness: 0.35 });

	function brickSet(base: string, seed: number): THREE.Material[] {
		const side = T(makeTapeTexture(base, seed));
		const top = T(makeTapeTexture(base, seed + 100, true));
		const rough = T(makeTapeRoughness(seed));
		const mk = (map: THREE.Texture) =>
			new THREE.MeshPhysicalMaterial({ map, roughnessMap: rough, roughness: 0.9, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12 });
		const s = mk(side);
		const t = mk(top);
		// BoxGeometry face order: +x, −x (ends), +y (top), −y, +z, −z (long sides).
		return [s, s, t, s, s, s];
	}
	const brick = brickSet('#7d5c3b', 1);
	const brickAlt = brickSet('#b59638', 7);
	const brickCut = new THREE.MeshStandardMaterial({ map: powderMap, color: 0xe6e1d6, roughness: 0.95 });

	const mirror = new THREE.MeshPhysicalMaterial({ color: 0x07080a, metalness: 0.2, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, reflectivity: 1 });
	const mirrorEdge = new THREE.MeshStandardMaterial({ color: 0x2c3036, metalness: 0.6, roughness: 0.3 });
	const steel = new THREE.MeshStandardMaterial({ color: 0x8e959c, metalness: 1, roughness: 0.32 });

	const woodMap = T(makeWoodTexture());
	const wood = new THREE.MeshStandardMaterial({ map: woodMap, roughness: 0.9 });

	const loadSideX = T(makeLoadTexture(7, PALLET.layers, false)); // ends of bricks along the 1.0 m face
	const loadSideZ = T(makeLoadTexture(5, PALLET.layers, false)); // long sides along the 1.2 m face
	const loadTop = T(makeLoadTexture(5, 7, true));
	const lm = (map: THREE.Texture) => new THREE.MeshStandardMaterial({ map, roughness: 0.55 });
	const lx = lm(loadSideX);
	const lz = lm(loadSideZ);
	const load = [lx, lx, lm(loadTop), lx, lz, lz];

	const filmMap = T(makeFilmTexture());
	const film = new THREE.MeshPhysicalMaterial({
		color: 0xffffff,
		map: filmMap,
		transparent: true,
		opacity: 0.26,
		roughness: 0.2,
		clearcoat: 1,
		clearcoatRoughness: 0.15,
		depthWrite: false,
	});

	const pf = T(makePalletFaceTexture());
	const palletFace = new THREE.MeshStandardMaterial({ map: pf, roughness: 0.6 });
	const pt = T(makeLoadTexture(5, 7, true));
	const palletTop = new THREE.MeshStandardMaterial({ map: pt, roughness: 0.55 });

	const all: THREE.Material[] = [powder, plastic, zip, ...new Set([...brick, ...brickAlt]), brickCut, mirror, mirrorEdge, steel, wood, ...new Set(load), film, palletFace, palletTop];
	return {
		powder,
		plastic,
		zip,
		brick,
		brickAlt,
		brickCut,
		mirror,
		mirrorEdge,
		steel,
		wood,
		load,
		film,
		palletFace,
		palletTop,
		dispose() {
			for (const m of all) m.dispose();
			for (const t of textures) t.dispose();
		},
	};
}

// ── Geometry ───────────────────────────────────────────────────────────────

/**
 * One line of powder: a dome-profiled ridge, ragged at the edges and
 * tapering to nothing at the ends, lumpy along its crest. Local x along the
 * line, y up, sitting on y = 0. `fill` < 1 makes a shorter line.
 */
export function makeLineGeometry(lengthM: number, widthM: number, heightM: number, fill: number, seed: number): THREE.BufferGeometry {
	const len = lengthM * Math.max(0.15, fill);
	const nx = 160;
	const nz = 20;
	const zSpan = widthM * 0.75;
	const pos: number[] = [];
	const uv: number[] = [];
	for (let i = 0; i <= nx; i++) {
		const x = -len / 2 + (i / nx) * len;
		const u = (len / 2 - Math.abs(x)) / len; // 0 at the ends, 0.5 in the middle
		const taper = smoothstep(0, 0.12, u);
		const halfW = (widthM / 2) * (0.78 + 0.3 * noise2(x * 260, 0, seed) + 0.14 * noise2(x * 1400, 0, seed + 5)) * (0.6 + 0.4 * taper);
		for (let k = 0; k <= nz; k++) {
			const z = -zSpan + (k / nz) * 2 * zSpan;
			const v = z / halfW;
			const edgeJag = 0.12 * (noise2(x * 2200, z * 2200, seed + 9) - 0.5);
			const profile = Math.pow(Math.max(0, 1 - v * v + edgeJag), 0.55);
			const lump = 0.7 + 0.5 * noise2(x * 700, z * 700, seed + 1) + 0.3 * (hash01(i * 31 + k, seed) - 0.5);
			pos.push(x, heightM * taper * profile * lump, z);
			uv.push(x * 30, z * 30);
		}
	}
	const idx: number[] = [];
	const y = (v: number) => pos[v * 3 + 1];
	const eps = heightM * 0.02;
	for (let i = 0; i < nx; i++) {
		for (let k = 0; k < nz; k++) {
			const a = i * (nz + 1) + k;
			const b = a + nz + 1;
			// Only where there's powder: bare glass stays bare.
			if (Math.max(y(a), y(a + 1), y(b), y(b + 1)) < eps) continue;
			idx.push(a, a + 1, b, b, a + 1, b + 1);
		}
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
	g.setIndex(idx);
	g.computeVertexNormals();
	return g;
}

/** A crystal of powder, for the stray grains around the lines. */
export function makeGrainGeometry(): THREE.BufferGeometry {
	return new THREE.IcosahedronGeometry(1, 0);
}

/**
 * A 1 g zip bag lying flat: the plastic envelope (transparent, puffed over
 * the powder, a raised zip ridge near the top), the powder pouch inside,
 * and the red zip strip. Local x across the bag, z along it (top of the bag
 * toward +z), y up.
 */
export function makeBagGeometries(fill = 1): { plastic: THREE.BufferGeometry; powder: THREE.BufferGeometry; zip: THREE.BufferGeometry } {
	const W = BAG.widthM;
	const L = BAG.lengthM;
	const inner = W / 2 - BAG.sealM - 0.001;
	const z0 = -L / 2 + BAG.sealM + 0.001;
	const fullLen = (L - BAG.sealM - BAG.zipM - 0.007) * 0.66;
	const f = Math.max(0.15, fill);
	const fillLen = fullLen * Math.sqrt(f);
	const T = BAG.thickM * (0.55 + 0.45 * Math.sqrt(f));
	const zipZ = L / 2 - BAG.zipM;

	// The gram settles into a rounded lump toward the bottom of the bag,
	// fuller at the base than toward the zip.
	const zc = z0 + fillLen * 0.46;
	const powderAt = (x: number, z: number) => {
		const u = x / inner;
		const v = (z - zc) / (fillLen / 2);
		const widen = 1 + 0.25 * Math.max(0, -v); // broader at the bottom
		const r2 = (u * u) / (widen * widen) + v * v;
		if (r2 >= 1) return 0;
		return T * Math.pow(1 - r2, 0.55) * (0.82 + 0.36 * noise2(x * 240, z * 240, 71));
	};

	function grid(
		nx: number,
		nz: number,
		x0: number,
		x1: number,
		za: number,
		zb: number,
		y: (x: number, z: number) => number,
		floor = -1
	): THREE.BufferGeometry {
		const pos: number[] = [];
		const uv: number[] = [];
		for (let i = 0; i <= nx; i++) {
			for (let k = 0; k <= nz; k++) {
				const x = x0 + ((x1 - x0) * i) / nx;
				const z = za + ((zb - za) * k) / nz;
				pos.push(x, y(x, z), z);
				uv.push(x * 20, z * 20);
			}
		}
		const idx: number[] = [];
		const yy = (v: number) => pos[v * 3 + 1];
		for (let i = 0; i < nx; i++) {
			for (let k = 0; k < nz; k++) {
				const a = i * (nz + 1) + k;
				const b = a + nz + 1;
				if (Math.max(yy(a), yy(a + 1), yy(b), yy(b + 1)) <= floor) continue;
				idx.push(a, a + 1, b, b, a + 1, b + 1);
			}
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
		g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
		g.setIndex(idx);
		g.computeVertexNormals();
		return g;
	}

	const powder = grid(26, 26, -inner, inner, z0, z0 + fillLen, (x, z) => Math.max(0.0002, powderAt(x, z)), 0.00021);
	const plastic = grid(22, 26, -W / 2, W / 2, -L / 2, L / 2, (x, z) => {
		const edge = Math.min(W / 2 - Math.abs(x), L / 2 - Math.abs(z));
		const seal = smoothstep(BAG.sealM * 0.6, BAG.sealM * 1.4, edge);
		const wrinkle = 0.0005 + 0.0012 * noise2(x * 140, z * 140, 72) + 0.0004 * noise2(x * 600, z * 600, 73);
		const ridge = 0.0011 * Math.exp(-Math.pow((z - zipZ) / 0.0016, 2)) * smoothstep(0, BAG.sealM, W / 2 - Math.abs(x));
		return 0.0003 + seal * Math.max(powderAt(x, z) + 0.00035, wrinkle) + ridge;
	});
	const zip = new THREE.BoxGeometry(W - 2 * BAG.sealM * 0.8, 0.0009, 0.0014);
	zip.translate(0, 0.0006, zipZ);
	return { plastic, powder, zip };
}

/** A taped brick (rounded corners), length along x. `fill` < 1: a cut brick. */
export function makeBrickGeometry(fill = 1): THREE.BufferGeometry {
	const len = BRICK.lengthM * Math.max(0.15, fill);
	const g = new RoundedBoxGeometry(len, BRICK.heightM, BRICK.widthM, 3, 0.006);
	g.translate(0, BRICK.heightM / 2, 0);
	return g;
}

/** A pallet (1.2 × 1.0 m by default): bottom boards, three stringers along
 *  x, deck boards across them. The cash stage sizes it to its own loads. */
export function makePalletGeometry(L: number = PALLET.lengthM, W: number = PALLET.widthM): THREE.BufferGeometry {
	const parts: THREE.BufferGeometry[] = [];
	const bottom = 0.022;
	const stringer = 0.1;
	const top = PALLET.deckM - bottom - stringer;
	const nBottom = Math.max(3, Math.round(L / 0.3) + 1);
	for (let i = 0; i < nBottom; i++) {
		const b = new THREE.BoxGeometry(0.1, bottom, W);
		b.translate(-L / 2 + 0.05 + (i * (L - 0.1)) / (nBottom - 1), bottom / 2, 0);
		parts.push(b);
	}
	for (let i = 0; i < 3; i++) {
		const s = new THREE.BoxGeometry(L, stringer, 0.045);
		s.translate(0, bottom + stringer / 2, -W / 2 + 0.0225 + (i * (W - 0.045)) / 2);
		parts.push(s);
	}
	const nDeck = Math.max(3, Math.round(L / 0.19) + 1);
	for (let i = 0; i < nDeck; i++) {
		const d = new THREE.BoxGeometry(0.14, top, W);
		d.translate(-L / 2 + 0.07 + (i * (L - 0.14)) / (nDeck - 1), bottom + stringer + top / 2, 0);
		parts.push(d);
	}
	const merged = mergeGeometries(parts)!;
	for (const p of parts) p.dispose();
	return merged;
}

/** The mirror: a thin dark glass tile with a bevelled metal edge. */
export function makeMirrorGeometries(w: number, d: number): { glass: THREE.BufferGeometry; edge: THREE.BufferGeometry } {
	const glass = new RoundedBoxGeometry(w, 0.004, d, 2, 0.0018);
	glass.translate(0, 0.002, 0);
	const edge = new RoundedBoxGeometry(w + 0.004, 0.003, d + 0.004, 2, 0.0015);
	edge.translate(0, 0.0012, 0);
	return { glass, edge };
}

/** A double-edged razor blade, true size (43 × 22 mm), with its slot. */
export function makeBladeGeometry(): THREE.BufferGeometry {
	const w = 0.043;
	const h = 0.022;
	const s = new THREE.Shape();
	s.moveTo(-w / 2, -h / 2);
	s.lineTo(w / 2, -h / 2);
	s.lineTo(w / 2, -0.0035);
	s.lineTo(w / 2 - 0.0025, -0.0035);
	s.lineTo(w / 2 - 0.0025, 0.0035);
	s.lineTo(w / 2, 0.0035);
	s.lineTo(w / 2, h / 2);
	s.lineTo(-w / 2, h / 2);
	s.lineTo(-w / 2, 0.0035);
	s.lineTo(-w / 2 + 0.0025, 0.0035);
	s.lineTo(-w / 2 + 0.0025, -0.0035);
	s.lineTo(-w / 2, -0.0035);
	s.closePath();
	const slot = new THREE.Path();
	slot.moveTo(-0.014, -0.0012);
	slot.lineTo(0.014, -0.0012);
	slot.lineTo(0.014, 0.0012);
	slot.lineTo(-0.014, 0.0012);
	slot.closePath();
	s.holes.push(slot);
	for (const cx of [-0.017, 0, 0.017]) {
		const hole = new THREE.Path();
		hole.absarc(cx, 0, 0.0022, 0, Math.PI * 2, true);
		if (cx !== 0) s.holes.push(hole);
	}
	const g = new THREE.ExtrudeGeometry(s, { depth: 0.0001, bevelEnabled: false });
	g.rotateX(-Math.PI / 2);
	g.translate(0, 0.0041, 0);
	return g;
}
