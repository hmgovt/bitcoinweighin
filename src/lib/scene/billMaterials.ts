/**
 * Procedural, stylized dollar-bill textures — deliberately NOT a
 * reproduction of genuine Federal Reserve Note artwork (see
 * docs/handoff/14-cash.md, "3D model": the source glb's baked-in texture
 * was a watermarked stock photo of a real note and was stripped in
 * scripts/compress-bill.ts). Canvas-drawn at runtime, same technique as
 * materials.ts's makeRoughnessMap — client-only, imported after hydration.
 */
import * as THREE from 'three';

// Palette note: these bases look noticeably deeper/greener than a scanned
// note would, ON PURPOSE. The stage renders through ACES tone mapping at
// exposure 1.3 with a full softbox env as diffuse irradiance — anything in
// the near-white #e6+ range washes out to plain white paper on screen. The
// sage/olive family below is what actually survives that pipeline and
// reads as "dollar green" at the camera.
// These bases sit MUCH deeper than a scanned note's actual paper color:
// the stage's key light + environment + ACES tone mapping at exposure 1.3
// lift albedos hard, and anything above ~0.6 luminance renders as plain
// white on screen. Screen-calibrated (not swatch-calibrated) so the
// stacks read as worn grey-green currency under the shared lighting rig.
const PAPER = '#aeb992'; // face background wash — worn-note grey-green
const PAPER_EDGE = '#a2ad87'; // side-face paper: desaturated sage
const PAPER_BUNDLE = '#98a37d'; // bundle-unit paper: a step deeper again (pallet-distance legibility)
const INK = '#2f5d3a';
const SEAM = '#6b7551'; // grey-olive lamination seam
const SEAM_DARK = '#5c6545'; // deeper olive seam variant for bundle-unit texture
const CATCH_LIGHT = '#bcc7a0'; // seam catch-light — green-tinted, deliberately NOT white
const MEDALLION_FILL = '#8e9873'; // desaturated moss
const SILHOUETTE = '#59613f';
const STRAP_BLUE = '#4a6fa5'; // ABA standard blue strap for $100-of-$1s (per reference imagery)
const STRAP_BLUE_LIGHT = '#7d9cc4'; // the strap's paler woven center stripe

/** The bill's face — top/bottom of a bundle or block, and the up-close
 *  view for loose/strap tiers and the stray notes scattered around the
 *  stack (see BillStage's addStrayNotes). Nested border, circled corner
 *  numerals, a central oval with an abstract bust, guilloche-suggestion
 *  ellipses, a faint background grid, and two flanking seals — enough
 *  structure to read unmistakably as a stylized dollar bill up close
 *  while staying clearly abstract (see the file header). */
export function makeBillFaceTexture(): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = 1024;
	canvas.height = 435; // matches the 155.956:66.294 (~2.353:1) bill aspect ratio
	const ctx = canvas.getContext('2d')!;
	const W = canvas.width;
	const H = canvas.height;
	const cx = W / 2;
	const cy = H / 2;

	ctx.fillStyle = PAPER;
	ctx.fillRect(0, 0, W, H);

	// Fine-grid background tint — a guilloche-adjacent texture cue under
	// everything else, low-contrast enough to read as engraved paper
	// texture rather than a pattern in its own right (but strong enough to
	// survive the tone-mapping wash — see the palette note above).
	ctx.strokeStyle = 'rgba(47, 93, 58, 0.09)';
	ctx.lineWidth = 1;
	for (let gx = 0; gx <= W; gx += 16) {
		ctx.beginPath();
		ctx.moveTo(gx, 0);
		ctx.lineTo(gx, H);
		ctx.stroke();
	}
	for (let gy = 0; gy <= H; gy += 16) {
		ctx.beginPath();
		ctx.moveTo(0, gy);
		ctx.lineTo(W, gy);
		ctx.stroke();
	}

	// Nested double border — weights sized to stay legible at mid-distance
	// framings (a bundle top a few metres from camera), not just up close.
	ctx.strokeStyle = INK;
	ctx.lineWidth = 8;
	ctx.strokeRect(14, 14, W - 28, H - 28);
	ctx.lineWidth = 3;
	ctx.strokeRect(26, 26, W - 52, H - 52);

	// Simple corner ornaments — small diamonds at the outer border's corners.
	ctx.fillStyle = INK;
	for (const [ox, oy] of [
		[14, 14],
		[W - 14, 14],
		[14, H - 14],
		[W - 14, H - 14],
	] as const) {
		ctx.save();
		ctx.translate(ox, oy);
		ctx.rotate(Math.PI / 4);
		ctx.fillRect(-6, -6, 12, 12);
		ctx.restore();
	}

	// Ornate-circled "1" numerals in all four corners.
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	for (const [nx, ny] of [
		[70, 70],
		[W - 70, 70],
		[70, H - 70],
		[W - 70, H - 70],
	] as const) {
		ctx.strokeStyle = INK;
		ctx.lineWidth = 3.5;
		ctx.beginPath();
		ctx.arc(nx, ny, 32, 0, Math.PI * 2);
		ctx.stroke();
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.arc(nx, ny, 26, 0, Math.PI * 2);
		ctx.stroke();
		ctx.fillStyle = INK;
		ctx.font = 'bold 34px Georgia, serif';
		ctx.fillText('1', nx, ny + 1);
	}

	// Central double-ellipse oval frame around the abstract bust — a plain
	// shape + simple silhouette, not a likeness of any real person or
	// engraving.
	ctx.strokeStyle = INK;
	ctx.lineWidth = 4;
	ctx.beginPath();
	ctx.ellipse(cx, cy, 108, 128, 0, 0, Math.PI * 2);
	ctx.stroke();
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.ellipse(cx, cy, 96, 116, 0, 0, Math.PI * 2);
	ctx.stroke();

	// A few concentric thin ellipses suggesting guilloche engraving.
	ctx.lineWidth = 1.5;
	ctx.strokeStyle = 'rgba(47, 93, 58, 0.45)';
	for (let i = 1; i <= 3; i++) {
		ctx.beginPath();
		ctx.ellipse(cx, cy, 96 - i * 14, 116 - i * 14, 0, 0, Math.PI * 2);
		ctx.stroke();
	}

	ctx.beginPath();
	ctx.ellipse(cx, cy, 90, 110, 0, 0, Math.PI * 2);
	ctx.fillStyle = MEDALLION_FILL;
	ctx.fill();
	ctx.beginPath();
	ctx.arc(cx, cy - 20, 34, 0, Math.PI * 2); // head
	ctx.fillStyle = SILHOUETTE;
	ctx.fill();
	ctx.beginPath();
	ctx.ellipse(cx, cy + 55, 46, 34, 0, Math.PI, 0); // shoulders
	ctx.fill();

	// Two small circular seals (plain abstract rosettes) flanking the
	// portrait.
	for (const [sx, sy] of [
		[cx - 210, cy],
		[cx + 210, cy],
	] as const) {
		ctx.strokeStyle = INK;
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.arc(sx, sy, 44, 0, Math.PI * 2);
		ctx.stroke();
		ctx.lineWidth = 1.5;
		for (let i = 0; i < 12; i++) {
			const a = (i / 12) * Math.PI * 2;
			ctx.beginPath();
			ctx.moveTo(sx + Math.cos(a) * 30, sy + Math.sin(a) * 30);
			ctx.lineTo(sx + Math.cos(a) * 44, sy + Math.sin(a) * 44);
			ctx.stroke();
		}
		ctx.beginPath();
		ctx.arc(sx, sy, 18, 0, Math.PI * 2);
		ctx.fillStyle = INK;
		ctx.fill();
	}

	ctx.fillStyle = INK;
	ctx.font = 'bold 30px Georgia, serif';
	ctx.fillText('THE UNITED STATES', cx, 40);
	ctx.font = '16px Georgia, serif';
	ctx.fillText('ONE DOLLAR', cx, H - 28);

	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

/**
 * The side-face pattern for a coalesced bill-stack block. This is a single
 * repeat unit; the caller sets `texture.repeat.y` to the true note count
 * the block represents, so the stripe density on screen is physically
 * honest (one repeat = one note's edge) rather than a decorative pattern —
 * the "precise thickness" requirement made visible.
 */
export function makeBillEdgeTexture(): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = 32;
	canvas.height = 64;
	const ctx = canvas.getContext('2d')!;

	// Paper base.
	ctx.fillStyle = PAPER_EDGE;
	ctx.fillRect(0, 0, 32, 64);

	// Faint horizontal tonal variation across the rest of the repeat unit so
	// a tall coalesced block (hundreds of stacked repeats) doesn't read as a
	// flat, uniformly-lit slab — bands break up the monolith without
	// implying any per-note detail beyond the lamination seam itself.
	ctx.fillStyle = 'rgba(0,0,0,0.035)';
	ctx.fillRect(0, 26, 32, 16);
	ctx.fillStyle = 'rgba(255,255,255,0.03)';
	ctx.fillRect(0, 46, 32, 10);

	// One note's edge seam, top of the repeat unit: a darker seam line
	// immediately followed by a brighter catch-light line, so the stripe
	// reads as a physical paper crease (shadow + highlight pair) rather than
	// a single flat band that mushes to grey under ACES tone mapping at
	// grazing angles / roughness 0.9. Contrast against the paper base is
	// deliberately much stronger than a single mid-tone line would give.
	ctx.fillStyle = SEAM;
	ctx.fillRect(0, 0, 32, 2);
	ctx.fillStyle = CATCH_LIGHT;
	ctx.fillRect(0, 2, 32, 1);

	const texture = new THREE.CanvasTexture(canvas);
	texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

/**
 * One repeat unit = ONE BUNDLE seen edge-on — impressionistic bundle-scale
 * granularity for pallet side faces (tiled 10x10: a pallet face is 10x10
 * bundle edges). Deliberately NOT per-note-honest, unlike
 * `makeBillEdgeTexture`: a pallet face spans 10,000 note edges, which is
 * sub-pixel at any framing, so per-note stripes would mush to flat grey.
 * The 10x10 bundle subdivision is the granularity the eye can actually
 * verify at pallet scale, so that is what gets drawn: a strong seam where
 * one bundle rests on the next, a few faint note-suggestion lines inside
 * the bundle, and the vertical currency strap band.
 */
export function makeBundleUnitTexture(): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = 64;
	canvas.height = 64;
	const ctx = canvas.getContext('2d')!;

	// Paper base — same family as the edge texture, a step deeper so the
	// pallet field holds its green at long framing distances.
	ctx.fillStyle = PAPER_BUNDLE;
	ctx.fillRect(0, 0, 64, 64);

	// Strong inter-bundle seam at the top of the unit (shadow + catch-light
	// pair, matching makeBillEdgeTexture's lamination treatment).
	ctx.fillStyle = SEAM_DARK;
	ctx.fillRect(0, 0, 64, 3);
	ctx.fillStyle = CATCH_LIGHT;
	ctx.fillRect(0, 3, 64, 1);

	// ~8 inner lines suggesting the notes laminated inside the bundle —
	// strong enough to stay visible against the deeper sage base.
	ctx.fillStyle = 'rgba(90, 98, 68, 0.32)';
	for (let i = 1; i <= 8; i++) {
		ctx.fillRect(0, 4 + i * 7, 64, 1);
	}

	// Vertical strap band — the ABA standard BLUE currency strap that bands
	// $100 of $1 notes (per the owner's reference imagery): the single
	// strongest "real cash" cue at pallet distance. Solid desaturated
	// banknote blue with the strap's paler woven center stripe.
	ctx.fillStyle = STRAP_BLUE;
	ctx.fillRect(24, 0, 14, 64);
	ctx.fillStyle = STRAP_BLUE_LIGHT;
	ctx.fillRect(28, 0, 6, 64);

	const texture = new THREE.CanvasTexture(canvas);
	texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

export interface BillMaterials {
	face: THREE.MeshStandardMaterial;
	edge: THREE.MeshStandardMaterial;
}

/** Matte paper materials — bills are not metal, no envMap/metalness needed. */
export function makeBillMaterials(
	faceTexture: THREE.CanvasTexture,
	edgeTexture: THREE.CanvasTexture
): BillMaterials {
	return {
		face: new THREE.MeshStandardMaterial({ map: faceTexture, roughness: 0.85, metalness: 0 }),
		edge: new THREE.MeshStandardMaterial({ map: edgeTexture, roughness: 0.9, metalness: 0 }),
	};
}
