/**
 * The Cash stage's materials: $1 notes, strapped stacks, bundles and pallet
 * loads, all printed from noteArt.ts at runtime (canvas → texture). The
 * art is deliberately NOT a reproduction of genuine Federal Reserve Note
 * artwork (docs/handoff/14-cash.md, and see noteArt.ts); what's realistic
 * is the paper, the inks, the straps and how a stack looks edge-on.
 *
 * Geometry convention (BillStage): notes and blocks are boxes of
 * (width, height, length) — length along z. BoxGeometry face order is
 * [+x, −x, +y, −y, +z, −z]: the ±x faces are the long sides (where a strap
 * shows as a band down the middle), ±z the ends, +y the top note's face
 * and −y the bottom note's back. Face art is drawn length-across, so the
 * top/bottom textures are rotated a quarter turn onto the box.
 */
import * as THREE from 'three';
import {
	drawNoteFace,
	drawNoteBack,
	drawStrapAcross,
	drawStackSide,
	drawPalletFace,
	drawPalletTop,
	NOTE_ASPECT,
} from './noteArt.js';
import { PALLET_PITCH, PALLET_DECK_M, BILL_THICKNESS_MM } from '../billStack.js';

const FACE_W = 1536;
const FACE_H = Math.round(FACE_W / NOTE_ASPECT);
/** A touch of grey on the paper: the canvas art is drawn at full paper
 *  white, and under the stage's softbox it otherwise reads bleached. */
const PAPER_TINT = 0xdcddd3;

function canvas(w: number, h: number, readBack = false): [HTMLCanvasElement, CanvasRenderingContext2D] {
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	// Only the bump maps read pixels back; the rest stay GPU-accelerated.
	return [c, c.getContext('2d', { willReadFrequently: readBack })!];
}

function tex(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
	const t = new THREE.CanvasTexture(c);
	if (srgb) t.colorSpace = THREE.SRGBColorSpace;
	t.wrapS = t.wrapT = THREE.RepeatWrapping;
	t.anisotropy = 8;
	return t;
}

/** Raised ink: intaglio stands proud of the paper, so darker = higher. */
function bumpFrom(src: HTMLCanvasElement, scale = 0.5): HTMLCanvasElement {
	const [c, g] = canvas(Math.round(src.width * scale), Math.round(src.height * scale), true);
	g.drawImage(src, 0, 0, c.width, c.height);
	const img = g.getImageData(0, 0, c.width, c.height);
	const d = img.data;
	for (let i = 0; i < d.length; i += 4) {
		const l = 255 - (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11);
		d[i] = d[i + 1] = d[i + 2] = l;
	}
	g.putImageData(img, 0, 0);
	return c;
}

/** Quarter-turn a note texture onto a box's top or bottom (see header). */
function onBoxTop(t: THREE.Texture, repeatAcross = 1, repeatAlong = 1): THREE.Texture {
	t.center.set(0.5, 0.5);
	t.rotation = Math.PI / 2;
	t.repeat.set(repeatAlong, repeatAcross);
	return t;
}

export interface CashMaterials {
	/** A single note as a box: [ends… , face, back, …] per BoxGeometry order. */
	note: THREE.Material[];
	/** A strap of 100, banded. */
	strap: THREE.Material[];
	/** A bundle of 1,000 (ten banded straps). */
	bundle: THREE.Material[];
	/** Curled loose notes: the face (front side) and back (back side) of one plane. */
	looseFace: THREE.MeshStandardMaterial;
	looseBack: THREE.MeshStandardMaterial;
	/** Materials for a block of `colsX × layers × colsZ` bundles (a pallet load). */
	block(colsX: number, layers: number, colsZ: number): THREE.Material[];
	/** Materials for the warehouse block: `colsX × layers × colsZ` pallets at pallet pitch. */
	warehouse(colsX: number, layers: number, colsZ: number): THREE.Material[];
	/** A block of `notes` notes with the bundle look, e.g. a part-bundle. */
	partial(notes: number): THREE.Material[];
	/** The materials this module owns — never dispose these per render. */
	shared(): Set<THREE.Material>;
	dispose(): void;
}

export function makeCashMaterials(maxAnisotropy = 8): CashMaterials {
	const owned: { t: THREE.Texture[]; m: THREE.Material[] } = { t: [], m: [] };
	const T = <X extends THREE.Texture>(t: X): X => {
		t.anisotropy = maxAnisotropy;
		owned.t.push(t);
		return t;
	};
	const Mm = <X extends THREE.Material>(m: X): X => {
		owned.m.push(m);
		return m;
	};

	// Printed faces.
	const [fc, fg] = canvas(FACE_W, FACE_H);
	drawNoteFace(fg, FACE_W, FACE_H, 7);
	const [bc, bg] = canvas(FACE_W, FACE_H);
	drawNoteBack(bg, FACE_W, FACE_H, 8);
	const [sfc, sfg] = canvas(FACE_W, FACE_H);
	sfg.drawImage(fc, 0, 0);
	drawStrapAcross(sfg, FACE_W, FACE_H);
	const [sbc, sbg] = canvas(FACE_W, FACE_H);
	sbg.drawImage(bc, 0, 0);
	drawStrapAcross(sbg, FACE_W, FACE_H);

	const faceBump = bumpFrom(fc);
	const backBump = bumpFrom(bc);

	const paper = (map: THREE.Texture, bump?: HTMLCanvasElement) =>
		Mm(
			new THREE.MeshStandardMaterial({
				map,
				bumpMap: bump ? T(tex(bump, false)) : null,
				bumpScale: 0.6,
				color: PAPER_TINT,
				roughness: 0.78,
				metalness: 0,
			})
		);

	// Stack sides: one strap (100 note edges) per texture repeat, so the
	// strap-to-strap rhythm and the tone drift survive mip-mapping.
	const EDGE_NOTES = 100;
	const [lc, lg] = canvas(512, 512);
	drawStackSide(lg, 512, 512, EDGE_NOTES, true);
	const [ec, eg] = canvas(256, 512);
	drawStackSide(eg, 256, 512, EDGE_NOTES, false, 11);
	const [pc, pg] = canvas(256, 512);
	drawStackSide(pg, 256, 512, EDGE_NOTES, false, 13);

	const side = (c: HTMLCanvasElement, notes: number, across = 1) => {
		const t = T(tex(c));
		t.repeat.set(across, notes / EDGE_NOTES);
		return Mm(new THREE.MeshStandardMaterial({ map: t, color: PAPER_TINT, roughness: 0.9 }));
	};
	// A bundle's sides: ten straps, and the shadowed seam where one bundle
	// sits on the next — one bundle per repeat, so blocks of bundles keep
	// their courses legible from across a room.
	const bundleSide = (strapSide: HTMLCanvasElement): HTMLCanvasElement => {
		const [c, g] = canvas(strapSide.width, 1024);
		for (let k = 0; k < 10; k++) g.drawImage(strapSide, 0, (k * 1024) / 10, strapSide.width, 1024 / 10);
		g.fillStyle = 'rgba(10,12,10,0.6)';
		g.fillRect(0, 0, c.width, 6);
		return c;
	};
	const [blc, bec] = [bundleSide(lc), bundleSide(ec)];
	const bundleSideMat = (c: HTMLCanvasElement) => {
		const t = T(tex(c));
		return Mm(new THREE.MeshStandardMaterial({ map: t, color: PAPER_TINT, roughness: 0.9 }));
	};

	// The warehouse block's pallets: one pallet pitch per tile.
	const gap = 1 - 1 / PALLET_PITCH;
	const unitH = PALLET_DECK_M + (1000 * 10 * BILL_THICKNESS_MM) / 1000;
	const [pfl, pflg] = canvas(512, 512);
	drawPalletFace(pflg, 512, 512, true, gap, PALLET_DECK_M / unitH);
	const [pfe, pfeg] = canvas(512, 512);
	drawPalletFace(pfeg, 512, 512, false, gap, PALLET_DECK_M / unitH, 9);
	const [ptc, ptg] = canvas(512, 1024);
	drawPalletTop(ptg, 512, 1024, gap);
	// Base textures for per-render clones: a clone shares its source image,
	// so the GPU uploads each canvas once however many blocks use it.
	const base = {
		sfc: T(tex(sfc)),
		sbc: T(tex(sbc)),
		blc: T(tex(blc)),
		bec: T(tex(bec)),
		lc: T(tex(lc)),
		ec: T(tex(ec)),
		pfl: T(tex(pfl)),
		pfe: T(tex(pfe)),
		ptc: T(tex(ptc)),
	};
	/** Untracked clone: `block`/`partial` materials belong to the caller's render. */
	const fresh = (t: THREE.Texture) => {
		const c = t.clone();
		c.anisotropy = maxAnisotropy;
		c.needsUpdate = true;
		return c;
	};

	// A single note.
	const noteFace = paper(T(onBoxTop(tex(fc))), faceBump);
	const noteBack = paper(T(onBoxTop(tex(bc))), backBump);
	const noteEdge = side(pc, 1);
	const note = [noteEdge, noteEdge, noteFace, noteBack, noteEdge, noteEdge];

	// A strap of 100.
	const strapTop = paper(T(onBoxTop(tex(sfc))), faceBump);
	const strapBottom = paper(T(onBoxTop(tex(sbc))), backBump);
	const strapLong = side(lc, 100);
	const strapEnd = side(ec, 100);
	const strap = [strapLong, strapLong, strapTop, strapBottom, strapEnd, strapEnd];

	// A bundle of 1,000: ten straps high, one bundle per repeat.
	const bundleLong = bundleSideMat(blc);
	const bundleEnd = bundleSideMat(bec);
	const bundle = [bundleLong, bundleLong, strapTop, strapBottom, bundleEnd, bundleEnd];

	// Loose notes (planes): face on the front side, back on the back side
	// (mirrored back so it reads the right way round from underneath).
	const looseFace = Mm(
		new THREE.MeshStandardMaterial({
			map: T(tex(fc)),
			bumpMap: T(tex(faceBump, false)),
			bumpScale: 0.6,
			color: PAPER_TINT,
			roughness: 0.78,
			side: THREE.FrontSide,
		})
	);
	const lbMap = T(tex(bc));
	lbMap.repeat.set(-1, 1);
	lbMap.offset.set(1, 0);
	const looseBack = Mm(new THREE.MeshStandardMaterial({ map: lbMap, color: PAPER_TINT, roughness: 0.8, side: THREE.BackSide }));

	/** Block of bundles: the top is `colsX × colsZ` bundle tops, the long
	 *  sides `colsZ × layers` bundle sides, the ends `colsX × layers`.
	 *  Fresh materials each call — the caller disposes them (and their maps). */
	function block(colsX: number, layers: number, colsZ: number): THREE.Material[] {
		const mat = (map: THREE.Texture, roughness: number) =>
			new THREE.MeshStandardMaterial({ map, color: PAPER_TINT, roughness });
		const top = mat(onBoxTop(fresh(base.sfc), colsX, colsZ), 0.8);
		const bot = mat(onBoxTop(fresh(base.sbc), colsX, colsZ), 0.8);
		const lt = fresh(base.blc);
		lt.repeat.set(colsZ, layers);
		const et = fresh(base.bec);
		et.repeat.set(colsX, layers);
		const long = mat(lt, 0.88);
		const end = mat(et, 0.88);
		return [long, long, top, bot, end, end];
	}

	/** The warehouse block, faced with its pallets (see `drawPalletFace`).
	 *  Fresh materials each call — the caller disposes them (and their maps). */
	function warehouse(colsX: number, layers: number, colsZ: number): THREE.Material[] {
		const mat = (map: THREE.Texture) => new THREE.MeshStandardMaterial({ map, roughness: 0.75 });
		const lt = fresh(base.pfl);
		lt.repeat.set(colsZ, layers);
		const et = fresh(base.pfe);
		et.repeat.set(colsX, layers);
		const tt = fresh(base.ptc);
		tt.repeat.set(colsX, colsZ);
		const long = mat(lt);
		const end = mat(et);
		const top = mat(tt);
		const bot = new THREE.MeshStandardMaterial({ color: 0x2a1d12, roughness: 0.9 });
		return [long, long, top, bot, end, end];
	}

	/** A short block of `notes` (a part-bundle): fresh sides, the shared strap top. */
	function partial(notes: number): THREE.Material[] {
		const lt = fresh(base.lc);
		lt.repeat.set(1, notes / EDGE_NOTES);
		const et = fresh(base.ec);
		et.repeat.set(1, notes / EDGE_NOTES);
		const long = new THREE.MeshStandardMaterial({ map: lt, color: PAPER_TINT, roughness: 0.9 });
		const end = new THREE.MeshStandardMaterial({ map: et, color: PAPER_TINT, roughness: 0.9 });
		return [long, long, strapTop, strapBottom, end, end];
	}

	/** Everything this module keeps (callers must not dispose these). */
	const shared = (): Set<THREE.Material> => new Set(owned.m);

	return {
		note,
		strap,
		bundle,
		looseFace,
		looseBack,
		block,
		warehouse,
		partial,
		shared,
		dispose() {
			for (const m of owned.m) m.dispose();
			for (const t of owned.t) t.dispose();
			owned.m.length = 0;
			owned.t.length = 0;
		},
	};
}
