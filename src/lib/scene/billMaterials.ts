/**
 * Procedural, stylized dollar-bill textures — deliberately NOT a
 * reproduction of genuine Federal Reserve Note artwork (see
 * docs/handoff/14-cash.md, "3D model": the source glb's baked-in texture
 * was a watermarked stock photo of a real note and was stripped in
 * scripts/compress-bill.ts). Canvas-drawn at runtime, same technique as
 * materials.ts's makeRoughnessMap — client-only, imported after hydration.
 */
import * as THREE from 'three';

const PAPER = '#e9e4d3';
const INK = '#2f5d3a';
const MEDALLION_FILL = '#cfc9b0';
const SILHOUETTE = '#8f8a72';

/** The bill's face — top/bottom of a bundle or literal-stack block. */
export function makeBillFaceTexture(): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = 1024;
	canvas.height = 435; // matches the 155.956:66.294 (~2.353:1) bill aspect ratio
	const ctx = canvas.getContext('2d')!;
	const W = canvas.width;
	const H = canvas.height;

	ctx.fillStyle = PAPER;
	ctx.fillRect(0, 0, W, H);

	ctx.strokeStyle = INK;
	ctx.lineWidth = 6;
	ctx.strokeRect(14, 14, W - 28, H - 28);
	ctx.lineWidth = 2;
	ctx.strokeRect(24, 24, W - 48, H - 48);

	ctx.fillStyle = INK;
	ctx.font = 'bold 46px Georgia, serif';
	ctx.textBaseline = 'middle';
	ctx.textAlign = 'left';
	ctx.fillText('$1', 40, 70);
	ctx.textAlign = 'right';
	ctx.fillText('$1', W - 40, 70);
	ctx.textAlign = 'left';
	ctx.fillText('$1', 40, H - 60);
	ctx.textAlign = 'right';
	ctx.fillText('$1', W - 40, H - 60);

	// Abstract portrait medallion — a plain circle + simple silhouette, not
	// a likeness of any real person or engraving.
	ctx.beginPath();
	ctx.arc(W / 2, H / 2, 90, 0, Math.PI * 2);
	ctx.strokeStyle = INK;
	ctx.lineWidth = 3;
	ctx.stroke();
	ctx.fillStyle = MEDALLION_FILL;
	ctx.fill();
	ctx.beginPath();
	ctx.arc(W / 2, H / 2 - 10, 34, 0, Math.PI * 2); // head
	ctx.fillStyle = SILHOUETTE;
	ctx.fill();
	ctx.beginPath();
	ctx.ellipse(W / 2, H / 2 + 55, 46, 34, 0, Math.PI, 0); // shoulders
	ctx.fill();

	ctx.fillStyle = INK;
	ctx.font = 'bold 30px Georgia, serif';
	ctx.textAlign = 'center';
	ctx.fillText('ONE', W / 2, 40);
	ctx.font = '16px Georgia, serif';
	ctx.fillText('UNITED STATES', W / 2, H - 28);

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
	ctx.fillStyle = '#efe9d8';
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
	// grazing angles / roughness 0.9. Contrast against the #efe9d8 paper is
	// deliberately much stronger than a single mid-tone line would give.
	ctx.fillStyle = '#b09f7a';
	ctx.fillRect(0, 0, 32, 2);
	ctx.fillStyle = '#fbf6e8';
	ctx.fillRect(0, 2, 32, 1);

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
