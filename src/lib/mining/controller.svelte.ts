/**
 * Owns the /mining page's single simulation: the pipeline, its clock, the
 * canvas and the sound. Components read its runes; `rev` bumps (at most once
 * a frame) whenever the pipeline changed, so anything that reads pipeline
 * state through `rev` re-renders with it.
 */
import { BLOCKS } from './blocks.js';
import { CoreCanvas, type Level, type View } from './core-canvas.js';
import { fmtDur, n0 } from './format.js';
import { HashPipeline, type Result } from './pipeline.js';
import { MiningSound, type Zone } from './sound.js';
import type { Token } from './sha256.js';
import { clamp01 } from './palette.js';

export const SPEEDS = [1, 4, 15, 60, 240, 1000];
export const CLOCK_HZ = 5e8;
export const S21_HS = 234e12;

type Umami = { track: (event: string, data?: Record<string, string | number>) => void };
export const track = (event: string, data?: Record<string, string | number>): void => {
	try { (window as unknown as { umami?: Umami }).umami?.track(event, data); } catch { /* analytics is best-effort */ }
};

export class MiningController {
	readonly pipe: HashPipeline;
	readonly reduced: boolean;
	readonly sound: MiningSound;
	readonly t0 = typeof performance !== 'undefined' ? performance.now() : 0;

	rev = $state(0);
	speedIdx = $state(1);
	playing = $state(true);
	sel = $state(3);
	view = $state<View>('silicon');
	level = $state<Level>('core');
	soundOn = $state(false);
	/** One-line narration under the controls. */
	status = $state('');
	/** Set when this template's block has been found; drives the "found" panel. */
	winTok = $state<Token | null>(null);

	lastTick = 0;
	flashT = -1e9;
	canvas: CoreCanvas | null = null;
	canvasVisible = true;
	private raf = 0;
	private prev = 0;
	private acc = 0;
	private dirty = true;
	private ratios: Record<'dive' | 'pipeline', number> = { dive: 0, pipeline: 0 };
	private io: IntersectionObserver | null = null;

	constructor() {
		this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		this.pipe = new HashPipeline(BLOCKS, {
			onShare: () => { this.flashT = performance.now(); },
			onFound: (tok) => this.onFound(tok),
		});
		this.sound = new MiningSound(() => ({
			playing: this.playing,
			found: this.pipe.found,
			speed: this.speed,
			clock: this.pipe.clock,
			activity: () => this.pipe.totalActivity().act,
		}), this.reduced);
		this.soundOn = this.sound.on;
		// Start with some real results already on the output tape.
		for (let i = 0; i < 40; i++) this.pipe.tick();
		if (this.reduced) {
			this.playing = false;
			this.status = 'Paused because your system prefers reduced motion. Press Play, or step one clock at a time.';
		} else this.status = this.defaultStatus();
	}

	get speed(): number { return SPEEDS[this.speedIdx]; }

	defaultStatus(): string {
		return `Mining block ${n0(this.pipe.tpl.height)}'s template from a random nonce. At this clock, the expected wait for a block is ${fmtDur(this.pipe.tpl.expected / this.speed)}. The universe is 1.4 × 10¹⁰ years old.`;
	}

	/** Pulse (0–1) of the switching-activity glow, decaying between clock ticks. */
	pulse(now: number): number {
		if (!this.playing) return 0.85;
		if (this.speed > 15) return 0.8;
		return 1 - 0.5 * clamp01((now - this.lastTick) / (1000 / this.speed));
	}

	attachCanvas(el: HTMLCanvasElement, width: number): void {
		this.canvas = new CoreCanvas(el, this.pipe, () => ({
			sel: this.sel, playing: this.playing, speed: this.speed, lastTick: this.lastTick, flashT: this.flashT, reduced: this.reduced,
		}));
		this.canvas.onLevel = (lv) => { this.level = lv; };
		this.canvas.view = this.view;
		this.canvas.layout(width);
	}

	/** Track where the reader is, so the right sounds play. */
	observeZone(zone: 'dive' | 'pipeline', el: HTMLElement): () => void {
		if (!this.io) {
			this.io = new IntersectionObserver((es) => {
				for (const e of es) {
					const z = (e.target as HTMLElement).dataset.zone as 'dive' | 'pipeline';
					this.ratios[z] = e.isIntersecting ? e.intersectionRatio : 0;
				}
				const zone: Zone = this.ratios.dive > 0.4 ? 'dive' : this.ratios.pipeline > 0.12 ? 'pipeline' : 'none';
				this.sound.setZone(zone);
			}, { threshold: [0, 0.12, 0.25, 0.4, 0.6, 0.8, 1] });
		}
		el.dataset.zone = zone;
		this.io.observe(el);
		return () => this.io?.unobserve(el);
	}

	start(): void {
		this.prev = performance.now();
		const frame = (now: number) => {
			const dt = Math.min(0.25, (now - this.prev) / 1000);
			this.prev = now;
			if (this.playing) {
				this.acc += dt * this.speed;
				let n = Math.min(200, Math.floor(this.acc));
				this.acc -= Math.floor(this.acc);
				while (n-- > 0 && this.playing) this.tick();
			}
			// Redraw only when something changed, or while the switching glow is fading between slow ticks.
			const cv = this.canvas;
			if (cv && this.canvasVisible && (this.dirty || cv.invalid || cv.animating || (this.playing && this.speed <= 15))) cv.draw(now);
			if (this.dirty) { this.rev++; this.dirty = false; }
			this.sound.update();
			this.raf = requestAnimationFrame(frame);
		};
		this.raf = requestAnimationFrame(frame);
	}

	destroy(): void {
		cancelAnimationFrame(this.raf);
		this.io?.disconnect();
		this.sound.destroy();
	}

	tick(): Result | null {
		const res = this.pipe.tick();
		this.lastTick = performance.now();
		this.dirty = true;
		this.sound.onTick(res);
		return res;
	}

	// ── controls ─────────────────────────────────────────────────────────

	setPlaying(p: boolean): void { if (!this.pipe.found) this.playing = p; }
	step(): void {
		if (this.pipe.found) return;
		this.playing = false;
		this.tick();
	}
	setSpeed(i: number): void {
		this.speedIdx = i;
		if (!this.pipe.found && this.pipe.tracked === null) this.status = this.defaultStatus();
	}
	select(s: number): void { this.sel = Math.max(0, Math.min(127, s)); this.dirty = true; }
	setCanvasVisible(v: boolean): void {
		this.canvasVisible = v;
		if (v && this.canvas) this.canvas.invalid = true;
	}
	setView(v: View, width = this.canvas?.width ?? 800): void {
		this.view = v;
		this.canvas?.setView(v, width);
		this.dirty = true;
	}
	zoomTo(lv: Level): void { this.canvas?.zoomTo(lv, this.sel, this.reduced); }
	setSound(on: boolean): void {
		this.sound.setOn(on);
		this.soundOn = this.sound.on;
		if (this.soundOn) track('mining-sound-on');
	}

	replay(): void {
		this.pipe.startReplay();
		if (this.speedIdx < 2) this.speedIdx = 2;
		this.status = `Replaying. The gold-outlined stage holds nonce 0x${(this.pipe.tpl.nonce >>> 0).toString(16).padStart(8, '0')}, the one that won block ${n0(this.pipe.tpl.height)}. On the way through it looks like every other stage.`;
		this.playing = true;
		this.dirty = true;
		track('mining-replay', { block: this.pipe.tpl.height });
	}

	private onFound(tok: Token): void {
		this.playing = false;
		this.winTok = tok;
		this.status = `Block ${n0(this.pipe.tpl.height)} found at clock ${n0(this.pipe.clock)}. The core has already moved on: the stages behind it are still busy with nonces that can't matter now.`;
	}

	cleanJobs(): void {
		const r = this.pipe.cleanJobs();
		if (!r) return;
		this.winTok = null;
		this.sound.flush();
		const h = r.prev.hash;
		this.status = `clean_jobs: block ${n0(r.prev.height)} is found, so all ${r.flushed} hashes in flight were thrown away. The new template's previous-block field is ${h.slice(0, 12)}…${h.slice(-6)}, the hash just found. The pipeline refills from the left, and the first new result appears in 128 clocks (256 ns on silicon).`;
		this.playing = true;
		this.dirty = true;
	}

	/** The 3D dive reached the core: show the same die in 2D, then zoom into the core. */
	handoffFromDive(): void {
		if (this.view !== 'silicon') this.setView('silicon');
		this.canvas?.setLevel('die');
		window.setTimeout(() => this.zoomTo('core'), this.reduced ? 0 : 1100);
		track('mining-dive-complete');
	}
}
