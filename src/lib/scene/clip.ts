/**
 * clip.ts — the "Make a clip" recorder's pieces: container format choice,
 * the vertical frame layout (title above, live 3-D square in the middle,
 * readout below), and the synthesised impact thud.
 *
 * The clip is the same WebGL stage the page shows, recorded in real time —
 * nothing pre-rendered, nothing faked. `LiveStage` owns the timeline, the
 * MediaRecorder and the sound (the modelled landing from `impact-sound.ts`,
 * always mixed into the file — even when the page itself is muted); this
 * module only lays out and draws the frame.
 */

export interface ClipInfo {
	/** "1 BTC of gold" */
	headline: string;
	/** "1.35 lb" */
	massPrimary: string;
	/** "613.4 g" */
	massSecondary: string;
	/** "$84,550 · Sep 24, 2026" */
	valueLine: string;
	/** "Falls 254 ms · hits with 1.91 kJ · peaks at 207 tons of force for 0.9 ms" */
	dropLine: string;
	/** Canonical share URL for this exact state. */
	shareUrl: string;
	/** File name stem, e.g. "bitcoinweighin-1btc-gold-2026-09-24". */
	fileStem: string;
	/** Commodity accent colour (hex). */
	accent: string;
}

/** Loupe overlay geometry, in the scene render's own pixel space. */
export interface ClipLoupe {
	x: number;
	y: number;
	size: number;
	m: number;
	cx: number;
	cy: number;
}

export const CLIP_W = 1080;
export const CLIP_H = 1920;
/** The 3-D scene renders square, into the middle of the vertical frame. */
export const CLIP_SCENE = 1080;
export const CLIP_SCENE_Y = 340;
export const CLIP_FPS = 30;
/** Timeline, seconds: the cube hangs at its drop height, is released at
 *  CLIP_RELEASE_S, and the clip ends at CLIP_DURATION_S. */
export const CLIP_RELEASE_S = 1.1;
export const CLIP_DURATION_S = 8;
const END_CARD_S = 6.6;

/** First container this browser can record: MP4 where available (plays
 *  everywhere, uploads everywhere), WebM otherwise. Null = can't record. */
export function pickMimeType(): string | null {
	if (typeof MediaRecorder === 'undefined') return null;
	const candidates = [
		'video/mp4;codecs=avc1.42E01F,mp4a.40.2',
		'video/mp4;codecs=avc1,mp4a',
		'video/mp4',
		'video/webm;codecs=vp9,opus',
		'video/webm;codecs=vp8,opus',
		'video/webm',
	];
	for (const c of candidates) {
		try {
			if (MediaRecorder.isTypeSupported(c)) return c;
		} catch {
			/* keep looking */
		}
	}
	return null;
}

/** Make sure the page fonts are ready before the first frame is drawn, so
 *  the clip never opens in a fallback face. Never throws; gives up quickly. */
export async function loadClipFonts(): Promise<void> {
	if (typeof document === 'undefined' || !document.fonts) return;
	const wants = [`700 104px ${SANS}`, `600 30px ${SANS}`, `500 38px ${MONO}`];
	await Promise.race([
		Promise.all(wants.map((f) => document.fonts.load(f).catch(() => []))),
		new Promise((r) => setTimeout(r, 800)),
	]);
}

export function canRecordClips(): boolean {
	return (
		typeof HTMLCanvasElement !== 'undefined' &&
		typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
		typeof AudioContext !== 'undefined' &&
		pickMimeType() !== null
	);
}

export function fileExtension(mime: string): string {
	return mime.startsWith('video/mp4') ? 'mp4' : 'webm';
}

const SANS = "'Inter Tight', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', ui-monospace, monospace";

function setSpacing(ctx: CanvasRenderingContext2D, px: number): void {
	// letterSpacing is widely but not universally supported on 2-D canvas.
	if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, family: string, maxW: number): number {
	let s = size;
	ctx.font = `${weight} ${s}px ${family}`;
	while (s > 24 && ctx.measureText(text).width > maxW) {
		s -= 4;
		ctx.font = `${weight} ${s}px ${family}`;
	}
	return s;
}

function easeOutBack(k: number): number {
	const c = 1.4;
	return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
}

/**
 * Compose one frame. `scene` is the live WebGL canvas, rendered at
 * CLIP_SCENE × CLIP_SCENE this frame. `t` is seconds since the clip began;
 * `impactT` is when the cube first hit the floor (null until then).
 */
export function drawClipFrame(
	ctx: CanvasRenderingContext2D,
	scene: CanvasImageSource,
	info: ClipInfo,
	t: number,
	impactT: number | null,
	loupe: ClipLoupe | null
): void {
	const W = CLIP_W;
	ctx.save();
	ctx.fillStyle = '#09090b';
	ctx.fillRect(0, 0, W, CLIP_H);

	// ── Scene square ─────────────────────────────────────────────
	const sy = CLIP_SCENE_Y;
	ctx.save();
	ctx.beginPath();
	ctx.rect(0, sy, CLIP_SCENE, CLIP_SCENE);
	ctx.clip();
	ctx.drawImage(scene, 0, sy, CLIP_SCENE, CLIP_SCENE);
	// Soft fade into the page colour top and bottom.
	const fadeTop = ctx.createLinearGradient(0, sy, 0, sy + 90);
	fadeTop.addColorStop(0, 'rgba(9,9,11,0.9)');
	fadeTop.addColorStop(1, 'rgba(9,9,11,0)');
	ctx.fillStyle = fadeTop;
	ctx.fillRect(0, sy, W, 90);
	const fadeBot = ctx.createLinearGradient(0, sy + CLIP_SCENE - 90, 0, sy + CLIP_SCENE);
	fadeBot.addColorStop(0, 'rgba(9,9,11,0)');
	fadeBot.addColorStop(1, 'rgba(9,9,11,0.9)');
	ctx.fillStyle = fadeBot;
	ctx.fillRect(0, sy + CLIP_SCENE - 90, W, 90);

	if (loupe) {
		// Leader line from the loupe to the speck, plus its declared power.
		const lx = loupe.x + loupe.size / 2;
		const ly = sy + loupe.y + loupe.size / 2;
		const r = loupe.size / 2;
		const ang = Math.atan2(sy + loupe.cy - ly, loupe.cx - lx);
		ctx.strokeStyle = info.accent;
		ctx.globalAlpha = 0.8;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(lx + Math.cos(ang) * r, ly + Math.sin(ang) * r);
		ctx.lineTo(loupe.cx, sy + loupe.cy);
		ctx.stroke();
		ctx.beginPath();
		ctx.arc(loupe.cx, sy + loupe.cy, 9, 0, Math.PI * 2);
		ctx.stroke();
		ctx.globalAlpha = 1;
		ctx.font = `600 30px ${MONO}`;
		ctx.fillStyle = info.accent;
		ctx.textAlign = 'center';
		ctx.fillText(`×${loupe.m.toLocaleString('en-US')}`, lx, ly + r + 40);
	}

	// End card: the scene dims under the URL.
	if (t > END_CARD_S) {
		const k = Math.min((t - END_CARD_S) / 0.5, 1);
		ctx.fillStyle = `rgba(9,9,11,${0.55 * k})`;
		ctx.fillRect(0, sy, W, CLIP_SCENE);
		ctx.globalAlpha = k;
		ctx.textAlign = 'center';
		ctx.fillStyle = '#fafafa';
		ctx.font = `600 64px ${SANS}`;
		ctx.fillText('Weigh your own', W / 2, sy + CLIP_SCENE / 2 - 10);
		ctx.fillStyle = info.accent;
		ctx.font = `600 52px ${MONO}`;
		ctx.fillText('bitcoinweighin.com', W / 2, sy + CLIP_SCENE / 2 + 70);
		ctx.globalAlpha = 1;
	}
	ctx.restore();

	// ── Title block ──────────────────────────────────────────────
	ctx.textAlign = 'center';
	ctx.textBaseline = 'alphabetic';
	ctx.fillStyle = info.accent;
	ctx.font = `600 30px ${SANS}`;
	setSpacing(ctx, 9);
	ctx.fillText('BITCOIN WEIGH-IN', W / 2, 118);
	setSpacing(ctx, 0);

	ctx.fillStyle = '#fafafa';
	fitFont(ctx, info.headline, 700, 104, SANS, W - 120);
	ctx.fillText(info.headline, W / 2, 228);

	ctx.fillStyle = '#71717a';
	ctx.font = `500 40px ${SANS}`;
	ctx.fillText(impactT === null ? 'What does it weigh?' : 'weighs', W / 2, 292);

	// ── Readout block ────────────────────────────────────────────
	const by = sy + CLIP_SCENE;
	if (impactT !== null) {
		const k = Math.min((t - impactT) / 0.35, 1);
		const scale = 0.6 + 0.4 * easeOutBack(k);
		ctx.save();
		ctx.globalAlpha = Math.min(k * 2.5, 1);
		ctx.translate(W / 2, by + 160);
		ctx.scale(scale, scale);
		ctx.fillStyle = '#fafafa';
		fitFont(ctx, info.massPrimary, 700, 150, SANS, W - 140);
		ctx.fillText(info.massPrimary, 0, 0);
		ctx.restore();

		const k2 = Math.min(Math.max((t - impactT - 0.35) / 0.4, 0), 1);
		ctx.globalAlpha = k2;
		ctx.fillStyle = '#a1a1aa';
		ctx.font = `500 52px ${SANS}`;
		ctx.fillText(info.massSecondary, W / 2, by + 236);

		const k3 = Math.min(Math.max((t - impactT - 0.8) / 0.4, 0), 1);
		ctx.globalAlpha = k3;
		ctx.fillStyle = '#d4d4d8';
		ctx.font = `500 38px ${MONO}`;
		ctx.fillText(info.valueLine, W / 2, by + 318);
		ctx.fillStyle = '#71717a';
		fitFont(ctx, info.dropLine, 500, 30, MONO, W - 100);
		ctx.fillText(info.dropLine, W / 2, by + 372);
		ctx.globalAlpha = 1;
	}

	ctx.fillStyle = info.accent;
	ctx.font = `600 36px ${MONO}`;
	ctx.fillText('bitcoinweighin.com', W / 2, CLIP_H - 44);
	ctx.restore();
}
