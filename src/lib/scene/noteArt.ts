/**
 * noteArt — the $1 note's printed faces, drawn on canvas. Pure 2-D drawing
 * (no three.js), so it can be previewed on its own.
 *
 * Realistic in the ways that read at a glance — cotton-linen paper with red
 * and blue security fibres, fine-line engraved border work, lathe-work
 * rosettes, an engraved (hatched) portrait, a black seal and a green one,
 * green serial numbers, a green back with a big ONE, a centre fold and a
 * little wear — and deliberately NOT a reproduction of genuine Federal
 * Reserve Note artwork (docs/handoff/14-cash.md): the portrait is Sat, the
 * site's Shiba, the seals are original (the green one carries the site's
 * cast-weight mark), and the wording is abridged.
 */

export const NOTE_ASPECT = 155.956 / 66.294;

export const PAPER = '#e3e4d4';
export const FACE_INK = '#1c211d';
export const GREEN_INK = '#2d6746';
export const BACK_INK = '#2c6444';

/** Stable 0–1 hash (same as cocaine-scene's), so a note always prints the same. */
function h(i: number, k = 0): number {
	const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
	return s - Math.floor(s);
}

/** Paper: an off-white cotton-linen tone, faint mottling, and the red and
 *  blue security fibres every US note carries. */
export function drawPaper(g: CanvasRenderingContext2D, W: number, H: number, seed: number): void {
	g.fillStyle = PAPER;
	g.fillRect(0, 0, W, H);
	const img = g.getImageData(0, 0, W, H);
	const d = img.data;
	for (let i = 0; i < W * H; i++) {
		const n = (h(i, seed) - 0.5) * 7;
		d[i * 4] += n;
		d[i * 4 + 1] += n;
		d[i * 4 + 2] += n * 0.8;
	}
	g.putImageData(img, 0, 0);
	const fibres = Math.round((W * H) / 9000);
	for (let i = 0; i < fibres; i++) {
		const x = h(i, seed + 1) * W;
		const y = h(i, seed + 2) * H;
		const a = h(i, seed + 3) * Math.PI * 2;
		const l = 6 + h(i, seed + 4) * 12;
		g.strokeStyle = h(i, seed + 5) > 0.5 ? 'rgba(170,40,50,0.45)' : 'rgba(40,70,160,0.45)';
		g.lineWidth = 0.9;
		g.beginPath();
		g.moveTo(x, y);
		g.quadraticCurveTo(x + Math.cos(a + 0.8) * l * 0.6, y + Math.sin(a + 0.8) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l);
		g.stroke();
	}
}

/** A lathe-work rosette: several interleaved epitrochoids — the looping,
 *  woven pattern an engraver's geometric lathe cuts. */
export function rosette(
	g: CanvasRenderingContext2D,
	cx: number,
	cy: number,
	R: number,
	ink: string,
	opts: { petals?: number; layers?: number; lw?: number; inner?: number } = {}
): void {
	const n = opts.petals ?? 18;
	const layers = opts.layers ?? 5;
	const inner = opts.inner ?? 0.35;
	g.strokeStyle = ink;
	g.lineWidth = opts.lw ?? 0.7;
	for (let L = 0; L < layers; L++) {
		// Epitrochoid: a circle of radius b rolling round one of radius a = n·b,
		// pen at distance c. Scaled so the outermost loop touches R.
		const c = 0.6 + (0.8 * L) / Math.max(1, layers - 1);
		const b = 1;
		const a = n * b;
		const outer = a + b + c;
		const innerR = a + b - c;
		const k = (R - R * inner) / (outer - innerR);
		const off = R - k * outer;
		const rot = (L * Math.PI) / (n * layers);
		g.beginPath();
		const N = n * 60;
		for (let st = 0; st <= N; st++) {
			const t = (st / N) * Math.PI * 2;
			const x0 = (a + b) * Math.cos(t) - c * Math.cos(((a + b) / b) * t);
			const y0 = (a + b) * Math.sin(t) - c * Math.sin(((a + b) / b) * t);
			const r = Math.hypot(x0, y0);
			const ang = Math.atan2(y0, x0) + rot;
			const rr = off + k * r;
			const x = cx + Math.cos(ang) * rr;
			const y = cy + Math.sin(ang) * rr;
			if (st) g.lineTo(x, y);
			else g.moveTo(x, y);
		}
		g.stroke();
	}
}

/** Fine interference waves across an area — the pale lathe-work ground
 *  under a note's printing. */
function groundWaves(g: CanvasRenderingContext2D, W: number, H: number, ink: string, pitch: number): void {
	g.strokeStyle = ink;
	g.lineWidth = 0.55;
	for (let y = -H * 0.1; y < H * 1.1; y += pitch) {
		g.beginPath();
		for (let x = 0; x <= W; x += 3) {
			const yy = y + Math.sin(x / (W * 0.045) + y / (H * 0.09)) * pitch * 1.6 + Math.sin(x / (W * 0.013)) * pitch * 0.35;
			if (x) g.lineTo(x, yy);
			else g.moveTo(x, yy);
		}
		g.stroke();
	}
}

/** Guilloche band along a rectangle's edge: phase-shifted waves filling a
 *  strip of the given width. */
function borderBand(g: CanvasRenderingContext2D, x: number, y: number, w: number, hh: number, band: number, ink: string, lines = 7): void {
	g.strokeStyle = ink;
	g.lineWidth = 0.8;
	const per = (x0: number, y0: number, x1: number, y1: number) => {
		const len = Math.hypot(x1 - x0, y1 - y0);
		const ux = (x1 - x0) / len;
		const uy = (y1 - y0) / len;
		const nx = -uy;
		const ny = ux;
		for (let k = 0; k < lines; k++) {
			const ph = (k / lines) * Math.PI * 2;
			g.beginPath();
			for (let s = 0; s <= len; s += 2) {
				const off = band / 2 + (band / 2 - 1.5) * Math.sin(s / 7 + ph) * Math.cos(s / 31 + ph * 0.5);
				const px = x0 + ux * s + nx * off;
				const py = y0 + uy * s + ny * off;
				if (s) g.lineTo(px, py);
				else g.moveTo(px, py);
			}
			g.stroke();
		}
	};
	per(x, y, x + w, y);
	per(x + w, y, x + w, y + hh);
	per(x + w, y + hh, x, y + hh);
	per(x, y + hh, x, y);
	g.lineWidth = 2;
	g.strokeRect(x, y, w, hh);
	g.lineWidth = 1.2;
	g.strokeRect(x + band, y + band, w - 2 * band, hh - 2 * band);
}

/**
 * Sat, engraved: a Shiba's head and ruff in three-quarter profile, built
 * from hatching whose weight follows a light from the upper left — the
 * intaglio portrait, with a dog in it. (Which is also what keeps this a
 * picture of a banknote rather than a copy of one.)
 */
function engravedSat(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, ink: string): void {
	const P = (x: number, y: number): [number, number] => [cx + x * s, cy + y * s];
	// Head facing left: chest, throat, snout, brow, two upright ears, the
	// back of the neck — smooth curves through key points.
	const head = new Path2D();
	head.moveTo(...P(-0.7, 1.0));
	head.bezierCurveTo(...P(-0.62, 0.62), ...P(-0.42, 0.34), ...P(-0.4, 0.2));
	head.bezierCurveTo(...P(-0.52, 0.12), ...P(-0.7, 0.06), ...P(-0.8, -0.04));
	head.bezierCurveTo(...P(-0.86, -0.1), ...P(-0.84, -0.17), ...P(-0.76, -0.19));
	head.bezierCurveTo(...P(-0.62, -0.22), ...P(-0.48, -0.26), ...P(-0.38, -0.36));
	head.bezierCurveTo(...P(-0.38, -0.5), ...P(-0.36, -0.66), ...P(-0.3, -0.8));
	head.bezierCurveTo(...P(-0.2, -0.66), ...P(-0.1, -0.54), ...P(-0.04, -0.5));
	head.bezierCurveTo(...P(0.04, -0.62), ...P(0.12, -0.76), ...P(0.2, -0.86));
	head.bezierCurveTo(...P(0.3, -0.66), ...P(0.34, -0.44), ...P(0.36, -0.3));
	head.bezierCurveTo(...P(0.48, -0.06), ...P(0.56, 0.3), ...P(0.62, 0.52));
	head.bezierCurveTo(...P(0.66, 0.7), ...P(0.7, 0.86), ...P(0.72, 1.0));
	head.closePath();

	/** 0 = paper-light, 1 = darkest. Light from the upper left. */
	const tone = (dx: number, dy: number) => {
		let t = 0.42 + 0.5 * (dx + 0.25) + 0.18 * Math.max(0, -dy - 0.35);
		const muzzle = Math.hypot((dx + 0.6) / 0.26, (dy + 0.04) / 0.13);
		if (muzzle < 1) t -= 0.6 * (1 - muzzle * muzzle);
		const cheek = Math.hypot((dx + 0.22) / 0.2, (dy - 0.1) / 0.16);
		if (cheek < 1) t -= 0.45 * (1 - cheek * cheek);
		const chest = Math.hypot((dx + 0.05) / 0.4, (dy - 0.66) / 0.34);
		if (chest < 1) t -= 0.55 * (1 - chest * chest);
		const brow = Math.hypot((dx + 0.3) / 0.1, (dy + 0.3) / 0.05);
		if (brow < 1) t -= 0.3 * (1 - brow);
		return Math.min(1, Math.max(0, t));
	};

	g.save();
	g.clip(head);
	g.fillStyle = PAPER;
	g.fillRect(cx - s, cy - s, 2 * s, 2 * s);
	g.strokeStyle = ink;
	const step = Math.max(2.2, s / 44);
	// Main hatching: gently curved lines, weight by tone.
	for (let y = cy - s; y < cy + s; y += step) {
		let last = -1;
		g.beginPath();
		for (let x = cx - s; x <= cx + s; x += 2) {
			const dx = (x - cx) / s;
			const dy = (y - cy) / s;
			const w = 0.15 + tone(dx, dy) * 2.6;
			if (Math.abs(w - last) > 0.2) {
				g.stroke();
				g.lineWidth = w;
				g.beginPath();
				g.moveTo(x, y + dx * dx * s * 0.04);
				last = w;
			}
			g.lineTo(x + 2, y + dx * dx * s * 0.04 + Math.sin(x * 0.16 + y * 0.05) * 0.6);
		}
		g.stroke();
	}
	// Cross-hatching in the shadows.
	for (let k = -2 * s; k < 2 * s; k += step * 1.4) {
		g.beginPath();
		let on = false;
		for (let t = 0; t <= 2 * s; t += 2) {
			const x = cx - s + t;
			const y = cy - s + t * 0.9 + k;
			const dx = (x - cx) / s;
			const dy = (y - cy) / s;
			if (tone(dx, dy) > 0.68) {
				if (!on) g.moveTo(x, y);
				else g.lineTo(x, y);
				on = true;
			} else on = false;
		}
		g.lineWidth = 0.7;
		g.stroke();
	}
	g.restore();

	g.strokeStyle = ink;
	g.lineWidth = 1.8;
	g.stroke(head);
	g.fillStyle = ink;
	// Eye with a catch-light.
	const [ex, ey] = P(-0.34, -0.22);
	g.beginPath();
	g.ellipse(ex, ey, s * 0.058, s * 0.034, -0.35, 0, Math.PI * 2);
	g.fill();
	g.fillStyle = PAPER;
	g.beginPath();
	g.arc(ex - s * 0.018, ey - s * 0.01, s * 0.011, 0, Math.PI * 2);
	g.fill();
	g.fillStyle = ink;
	// Nose and mouth.
	const [nx, ny] = P(-0.8, -0.12);
	g.beginPath();
	g.ellipse(nx, ny, s * 0.055, s * 0.045, 0.2, 0, Math.PI * 2);
	g.fill();
	g.lineWidth = 1.6;
	g.beginPath();
	g.moveTo(...P(-0.79, -0.06));
	g.bezierCurveTo(...P(-0.72, 0.02), ...P(-0.6, 0.06), ...P(-0.5, 0.04));
	g.stroke();
	// Inner ears.
	g.lineWidth = 1.2;
	for (const [a0, a1, a2] of [
		[P(-0.3, -0.72), P(-0.2, -0.56), P(-0.3, -0.5)],
		[P(0.19, -0.78), P(0.26, -0.5), P(0.12, -0.52)],
	] as const) {
		g.beginPath();
		g.moveTo(...a0);
		g.quadraticCurveTo(...a1, ...a2);
		g.stroke();
	}
}

/** A seal with a saw-toothed rim. */
function spikySeal(g: CanvasRenderingContext2D, cx: number, cy: number, R: number, ink: string, teeth = 64): void {
	g.fillStyle = ink;
	g.beginPath();
	for (let i = 0; i <= teeth * 2; i++) {
		const a = (i / (teeth * 2)) * Math.PI * 2;
		const r = i % 2 ? R : R * 0.9;
		const x = cx + Math.cos(a) * r;
		const y = cy + Math.sin(a) * r;
		if (i) g.lineTo(x, y);
		else g.moveTo(x, y);
	}
	g.fill();
	g.fillStyle = PAPER;
	g.beginPath();
	g.arc(cx, cy, R * 0.78, 0, Math.PI * 2);
	g.fill();
	g.strokeStyle = ink;
	g.lineWidth = 1.2;
	g.beginPath();
	g.arc(cx, cy, R * 0.74, 0, Math.PI * 2);
	g.stroke();
}

/** The site's cast-weight mark, in outline, for the green seal. */
function weightGlyph(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, ink: string): void {
	g.save();
	g.translate(cx - s / 2, cy - s / 2);
	g.scale(s / 64, s / 64);
	g.fillStyle = ink;
	g.fillRect(25, 10, 14, 13);
	g.beginPath();
	g.moveTo(13.6, 21);
	g.lineTo(50.4, 21);
	g.lineTo(60.7, 55.8);
	g.lineTo(3.3, 55.8);
	g.closePath();
	g.fill();
	g.fillStyle = PAPER;
	g.font = 'bold 30px Georgia, "DejaVu Serif", serif';
	g.textAlign = 'center';
	g.textBaseline = 'middle';
	g.fillText('B', 32, 41);
	g.restore();
}

function serif(px: number, weight = 'bold'): string {
	return `${weight} ${px}px Georgia, "Times New Roman", "DejaVu Serif", serif`;
}

/** Soft wear: a centre fold, a little grime toward the edges. */
function wear(g: CanvasRenderingContext2D, W: number, H: number, seed: number): void {
	const fx = W * (0.5 + (h(seed, 40) - 0.5) * 0.04);
	const grd = g.createLinearGradient(fx - 14, 0, fx + 14, 0);
	grd.addColorStop(0, 'rgba(0,0,0,0)');
	grd.addColorStop(0.45, 'rgba(0,0,0,0.07)');
	grd.addColorStop(0.55, 'rgba(255,255,255,0.1)');
	grd.addColorStop(1, 'rgba(0,0,0,0)');
	g.fillStyle = grd;
	g.fillRect(fx - 14, 0, 28, H);
	const v = g.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.6);
	v.addColorStop(0, 'rgba(90,80,50,0)');
	v.addColorStop(1, 'rgba(90,80,50,0.12)');
	g.fillStyle = v;
	g.fillRect(0, 0, W, H);
}

/** The face: black intaglio, green seal and serials. */
export function drawNoteFace(g: CanvasRenderingContext2D, W: number, H: number, seed = 1): void {
	drawPaper(g, W, H, seed);
	const u = H / 435; // design units scale with height
	const cx = W / 2;
	const cy = H / 2;

	// Pale lathe-work ground across the whole note.
	g.globalAlpha = 0.5;
	groundWaves(g, W, H, '#8d9a8a', 7 * u);
	g.globalAlpha = 1;

	borderBand(g, 12 * u, 12 * u, W - 24 * u, H - 24 * u, 22 * u, FACE_INK, 6);

	// Corner "1"s in lathe-work rosettes.
	g.textAlign = 'center';
	g.textBaseline = 'middle';
	for (const [nx, ny] of [
		[78 * u, 78 * u],
		[W - 78 * u, 78 * u],
		[78 * u, H - 78 * u],
		[W - 78 * u, H - 78 * u],
	] as const) {
		g.fillStyle = PAPER;
		g.beginPath();
		g.arc(nx, ny, 40 * u, 0, Math.PI * 2);
		g.fill();
		rosette(g, nx, ny, 40 * u, FACE_INK, { petals: 16, layers: 4, lw: 0.9 * u, inner: 0.55 });
		g.fillStyle = PAPER;
		g.beginPath();
		g.arc(nx, ny, 22 * u, 0, Math.PI * 2);
		g.fill();
		g.fillStyle = FACE_INK;
		g.font = serif(34 * u);
		g.fillText('1', nx, ny + 2 * u);
	}

	// The portrait oval: a lathe-work ring, fine cross-hatched ground, a bust.
	const ow = 118 * u;
	const oh = 142 * u;
	g.save();
	g.beginPath();
	g.ellipse(cx, cy, ow, oh, 0, 0, Math.PI * 2);
	g.clip();
	g.fillStyle = '#d9dbc9';
	g.fillRect(cx - ow, cy - oh, ow * 2, oh * 2);
	g.strokeStyle = 'rgba(28,33,29,0.35)';
	g.lineWidth = 0.6;
	for (let k = -oh * 2; k < oh * 2; k += 4.5 * u) {
		g.beginPath();
		g.moveTo(cx - ow, cy + k);
		g.lineTo(cx + ow, cy + k + ow * 0.6);
		g.stroke();
	}
	engravedSat(g, cx + 6 * u, cy + 6 * u, 118 * u, FACE_INK);
	g.restore();
	g.strokeStyle = FACE_INK;
	for (let r = 0; r < 5; r++) {
		g.lineWidth = r === 0 || r === 4 ? 2.2 * u : 0.7 * u;
		g.beginPath();
		g.ellipse(cx, cy, ow + r * 3.2 * u, oh + r * 3.2 * u, 0, 0, Math.PI * 2);
		g.stroke();
	}

	// Seals: black on the left, green (with the weight mark) on the right.
	spikySeal(g, cx - 250 * u, cy + 10 * u, 50 * u, FACE_INK);
	rosette(g, cx - 250 * u, cy + 10 * u, 34 * u, FACE_INK, { petals: 12, layers: 3, lw: 0.8 * u, inner: 0.5 });
	g.fillStyle = FACE_INK;
	g.font = serif(26 * u);
	g.fillText('W', cx - 250 * u, cy + 12 * u);

	g.globalAlpha = 0.92;
	spikySeal(g, cx + 250 * u, cy + 26 * u, 48 * u, GREEN_INK, 48);
	rosette(g, cx + 250 * u, cy + 26 * u, 32 * u, GREEN_INK, { petals: 10, layers: 3, lw: 0.8 * u, inner: 0.6 });
	weightGlyph(g, cx + 250 * u, cy + 24 * u, 34 * u, GREEN_INK);
	g.globalAlpha = 1;

	// Serial numbers, green.
	g.fillStyle = GREEN_INK;
	g.font = `bold ${24 * u}px "Courier New", "DejaVu Sans Mono", monospace`;
	g.fillText(`W ${String(21000000 - (seed % 97) * 1117).padStart(8, '0')} B`, W - 250 * u, 98 * u);
	g.fillText(`W ${String(21000000 - (seed % 97) * 1117).padStart(8, '0')} B`, 250 * u, H - 98 * u);

	// Wording (abridged, engraved serif).
	g.fillStyle = FACE_INK;
	g.font = serif(32 * u);
	g.fillText('THE UNITED STATES', cx, 56 * u);
	g.font = serif(22 * u);
	g.fillText('ONE DOLLAR', cx, H - 52 * u);
	g.font = serif(15 * u, 'italic');
	g.fillText('this note is weighed, not signed', cx, H - 30 * u);

	wear(g, W, H, seed);
}

/** The back: green, a big ONE between two rosettes. */
export function drawNoteBack(g: CanvasRenderingContext2D, W: number, H: number, seed = 2): void {
	drawPaper(g, W, H, seed + 50);
	const u = H / 435;
	const cx = W / 2;
	const cy = H / 2;
	g.globalAlpha = 0.45;
	groundWaves(g, W, H, '#7fa08a', 7 * u);
	g.globalAlpha = 1;
	borderBand(g, 12 * u, 12 * u, W - 24 * u, H - 24 * u, 24 * u, BACK_INK, 7);
	for (const x of [cx - 300 * u, cx + 300 * u]) {
		rosette(g, x, cy, 98 * u, BACK_INK, { petals: 24, layers: 6, lw: 0.8 * u, inner: 0.3 });
		g.fillStyle = PAPER;
		g.beginPath();
		g.arc(x, cy, 30 * u, 0, Math.PI * 2);
		g.fill();
		g.fillStyle = BACK_INK;
		g.font = serif(40 * u);
		g.textAlign = 'center';
		g.textBaseline = 'middle';
		g.fillText('1', x, cy + 2 * u);
	}
	// ONE, outlined in fine lines.
	g.font = serif(150 * u);
	g.textAlign = 'center';
	g.textBaseline = 'middle';
	g.fillStyle = '#c9d2bf';
	g.fillText('ONE', cx, cy + 6 * u);
	g.lineWidth = 2.2 * u;
	g.strokeStyle = BACK_INK;
	g.strokeText('ONE', cx, cy + 6 * u);
	g.fillStyle = BACK_INK;
	g.font = serif(26 * u);
	g.fillText('ONE', cx, 60 * u);
	g.fillText('ONE', cx, H - 58 * u);
	for (const [nx, ny] of [
		[70 * u, 70 * u],
		[W - 70 * u, 70 * u],
		[70 * u, H - 70 * u],
		[W - 70 * u, H - 70 * u],
	] as const) {
		g.font = serif(44 * u);
		g.fillText('1', nx, ny);
	}
	wear(g, W, H, seed + 3);
}

/**
 * The paper strap that bands 100 notes (ABA standard: blue for $100 of
 * $1s), as seen across the top of a stack — for compositing onto a face.
 * `u0`..`u1` is the band's span along the note's length, 0–1.
 */
export const STRAP_WIDTH_MM = 31.75; // 1.25 in
export const STRAP_BLUE = '#3f6ea9';
export function drawStrapAcross(g: CanvasRenderingContext2D, W: number, H: number): void {
	const bw = (STRAP_WIDTH_MM / 155.956) * W;
	const x0 = W / 2 - bw / 2;
	g.fillStyle = STRAP_BLUE;
	g.fillRect(x0, 0, bw, H);
	g.fillStyle = 'rgba(255,255,255,0.18)';
	g.fillRect(x0, 0, bw, H * 0.012);
	g.fillStyle = 'rgba(0,0,0,0.25)';
	g.fillRect(x0, 0, 2, H);
	g.fillRect(x0 + bw - 2, 0, 2, H);
	g.save();
	g.translate(W / 2, H / 2);
	g.rotate(-Math.PI / 2);
	g.fillStyle = '#eef2f8';
	g.font = `bold ${bw * 0.34}px "Helvetica Neue", Arial, "DejaVu Sans", sans-serif`;
	g.textAlign = 'center';
	g.textBaseline = 'middle';
	g.fillText('$100', 0, 0);
	g.restore();
}

/**
 * A stack's side, edge-on: one repeat unit covering `notes` note edges —
 * off-white paper with each note's edge a hair darker, a few printed-edge
 * slivers, and (on the long sides) the strap's blue band down the middle.
 */
export function drawStackSide(g: CanvasRenderingContext2D, W: number, H: number, notes: number, strap: boolean, seed = 7): void {
	// Paper edges: greyer and greener than the face, since each edge carries
	// a sliver of the ink from both sides.
	g.fillStyle = '#cfd2bf';
	g.fillRect(0, 0, W, H);
	const pitch = H / notes;
	for (let i = 0; i < notes; i++) {
		const y0 = i * pitch;
		const tone = h(i, seed);
		// No stack is perfectly squared: each note's edge wanders a little.
		const amp = pitch * (0.15 + h(i, seed + 1) * 0.35);
		const ph = h(i, seed + 2) * 6.28;
		const lw = Math.max(0.6, pitch * 0.3);
		g.beginPath();
		for (let x = 0; x <= W; x += W / 16) {
			const y = y0 + Math.sin((x / W) * 6.28 * (1 + h(i, seed + 3) * 2) + ph) * amp;
			if (x === 0) g.moveTo(x, y);
			else g.lineTo(x, y);
		}
		g.strokeStyle = tone > 0.82 ? 'rgba(45,85,60,0.32)' : `rgba(38,44,34,${0.1 + tone * 0.14})`;
		g.lineWidth = lw;
		g.stroke();
		// The odd note stands proud and catches the light.
		if (tone < 0.12) {
			g.fillStyle = 'rgba(250,250,240,0.4)';
			g.fillRect(0, y0 + pitch * 0.45, W, Math.max(0.5, pitch * 0.3));
		}
	}
	// Tone drifts across the stack (older and newer notes), low-frequency
	// so it survives mip-mapping when the notes themselves can't be seen.
	for (let k = 0; k < 6; k++) {
		const y = h(k, seed + 9) * H;
		const bh = H * (0.05 + h(k, seed + 10) * 0.15);
		g.fillStyle = h(k, seed + 11) > 0.5 ? 'rgba(255,255,245,0.07)' : 'rgba(30,40,30,0.07)';
		g.fillRect(0, y, W, bh);
	}
	// Where one strap sits on the next, a faint compressed line.
	g.fillStyle = 'rgba(20,25,20,0.25)';
	g.fillRect(0, 0, W, Math.max(1, pitch * 0.8));
	if (strap) {
		const bw = (STRAP_WIDTH_MM / 155.956) * W;
		const x0 = W / 2 - bw / 2;
		g.fillStyle = STRAP_BLUE;
		g.fillRect(x0, 0, bw, H);
		g.fillStyle = 'rgba(255,255,255,0.12)';
		g.fillRect(x0 + bw * 0.1, 0, bw * 0.25, H);
		g.fillStyle = 'rgba(0,0,0,0.25)';
		g.fillRect(x0, 0, 1.5, H);
		g.fillRect(x0 + bw - 1.5, 0, 1.5, H);
		// The band's edge where it folds over the top and bottom notes.
		g.fillStyle = 'rgba(10,20,40,0.35)';
		g.fillRect(x0, 0, bw, Math.max(1, pitch * 0.8));
	}
}

/**
 * One pallet of $1 bundles seen from the side, for the warehouse block
 * past the individually drawn pallets: a 10 × 10 wall of bundle sides (the
 * blue strap bands showing on the long side), shrink-wrap sheen, the
 * wooden pallet under it and the dark aisle to the next pallet. One tile
 * is one pallet pitch; `gapFrac` of its width, and the matching height
 * fraction `deckFrac` at the bottom, are aisle and pallet.
 */
export function drawPalletFace(
	g: CanvasRenderingContext2D,
	W: number,
	H: number,
	banded: boolean,
	gapFrac: number,
	deckFrac: number,
	seed = 5
): void {
	g.fillStyle = '#0d0d0f';
	g.fillRect(0, 0, W, H);
	const lw = W * (1 - gapFrac);
	const deckH = H * deckFrac;
	const loadH = H - deckH;
	// The load: ten bundles across, ten high.
	const bw = lw / 10;
	const bh = loadH / 10;
	for (let r = 0; r < 10; r++) {
		for (let k = 0; k < 10; k++) {
			const t = h(r * 10 + k, seed);
			const v = 200 + Math.round(t * 18);
			g.fillStyle = `rgb(${v},${v + 3},${v - 14})`;
			g.fillRect(k * bw + 0.5, r * bh + 0.5, bw - 1, bh - 1);
			// Strap lines within the bundle.
			g.fillStyle = 'rgba(40,48,38,0.18)';
			for (let s = 1; s < 10; s++) g.fillRect(k * bw, r * bh + (s * bh) / 10, bw, 1);
			if (banded) {
				g.fillStyle = STRAP_BLUE;
				g.fillRect(k * bw + bw * 0.4, r * bh + 0.5, bw * 0.2, bh - 1);
			}
		}
	}
	// Shrink-wrap: soft diagonal highlights over the load.
	const grad = g.createLinearGradient(0, 0, lw, loadH);
	grad.addColorStop(0, 'rgba(255,255,255,0.10)');
	grad.addColorStop(0.35, 'rgba(255,255,255,0)');
	grad.addColorStop(0.6, 'rgba(255,255,255,0.08)');
	grad.addColorStop(1, 'rgba(255,255,255,0)');
	g.fillStyle = grad;
	g.fillRect(0, 0, lw, loadH);
	// The pallet: top boards, blocks with the fork openings, bottom boards.
	const y0 = loadH;
	g.fillStyle = '#a57c50';
	g.fillRect(0, y0, lw, deckH * 0.18);
	g.fillRect(0, y0 + deckH * 0.82, lw, deckH * 0.18);
	g.fillStyle = '#2a1d12';
	g.fillRect(0, y0 + deckH * 0.18, lw, deckH * 0.64);
	g.fillStyle = '#8f6a42';
	for (const f of [0, 0.46, 0.92]) g.fillRect(lw * f, y0 + deckH * 0.18, lw * 0.08, deckH * 0.64);
}

/** The same pallet from above: 10 × 10 bundle tops, each with its band. */
export function drawPalletTop(g: CanvasRenderingContext2D, W: number, H: number, gapFrac: number, seed = 6): void {
	g.fillStyle = '#0d0d0f';
	g.fillRect(0, 0, W, H);
	const lw = W * (1 - gapFrac);
	const lh = H * (1 - gapFrac);
	const bw = lw / 10;
	const bh = lh / 10; // bundles run lengthwise down the canvas
	for (let r = 0; r < 10; r++) {
		for (let k = 0; k < 10; k++) {
			const t = h(r * 10 + k, seed);
			const v = 206 + Math.round(t * 16);
			g.fillStyle = `rgb(${v},${v + 3},${v - 12})`;
			g.fillRect(k * bw + 0.5, r * bh + 0.5, bw - 1, bh - 1);
			// A hint of the print: the portrait oval and the dark seal.
			g.fillStyle = 'rgba(40,55,45,0.18)';
			g.beginPath();
			g.ellipse(k * bw + bw / 2, r * bh + bh * 0.5, bw * 0.28, bh * 0.14, 0, 0, Math.PI * 2);
			g.fill();
			g.fillStyle = STRAP_BLUE;
			g.fillRect(k * bw + 0.5, r * bh + bh * 0.4, bw - 1, bh * 0.2);
		}
	}
	const grad = g.createLinearGradient(0, 0, lw, lh);
	grad.addColorStop(0, 'rgba(255,255,255,0.08)');
	grad.addColorStop(0.5, 'rgba(255,255,255,0)');
	grad.addColorStop(1, 'rgba(255,255,255,0.06)');
	g.fillStyle = grad;
	g.fillRect(0, 0, lw, lh);
}
