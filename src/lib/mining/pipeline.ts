/**
 * A single fully pipelined SHA-256d hash core: 128 stages (64 rounds × 2
 * passes), one nonce in each, one finished hash out per clock.
 *
 * Pure state — no DOM, no timers. The /mining page drives `tick()` from its
 * animation loop and reads the fields back to draw.
 */
import { IV, Sig0, Sig1, makeToken, parseTemplate, type HeaderSource, type MiningTemplate, type Token } from './sha256.js';

export const DEPTH = 128;
/** Deliberately easy share target so shares are visible at page speed. */
export const SHARE_BITS = 8;
/** What a pool would ask of an S21-class miner: ~one share every 5 s at 234 TH/s ≈ 2⁵⁰ hashes. */
export const POOL_SHARE_BITS = 50;
/** Where replay places the winning nonce, so it has a visible walk down the pipeline. */
export const REPLAY_STATION = 24;
const TAPE_LEN = 12;

export type Verdict = 'discard' | 'share' | 'block';
export interface Result { tok: Token; v: Verdict }
export type TapeRow =
	| { divider: false; nonce: number; hex: string; zeros: number; v: Verdict }
	| { divider: true; text: string };

export interface PipelineEvents {
	onFound?(tok: Token): void;
	onShare?(tok: Token): void;
}

const randU32 = () => (Math.random() * 4294967296) >>> 0;
const popcnt = (x: number): number => {
	x = x - ((x >>> 1) & 0x55555555);
	x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
	return Math.imul((x + (x >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24;
};

export interface StageActivity { bits: number; tog: number; act: number }
export interface LogicActivity {
	sig1: number; ch: number; csa1: number; addE: number;
	sig0: number; maj: number; addA: number; msched: number; wires: number;
	nE: number; nA: number;
}

export class HashPipeline {
	readonly templates: MiningTemplate[];
	tplIdx = 0;
	stations: (Token | null)[] = new Array(DEPTH).fill(null);
	/** The token that left the last stage on the most recent clock. */
	lastOut: Token | null = null;
	nextNonce = 0;
	clock = 0;
	total = 0;
	shares = 0;
	maxZeros = 0;
	counts = new Array<number>(257).fill(0);
	tape: TapeRow[] = [];
	last: Result | null = null;
	/** Nonce highlighted during a replay. */
	tracked: number | null = null;
	found = false;
	replayed = false;
	/** Nonce latched into the chip's result buffer after a find. */
	fifoNonce: number | null = null;
	private events: PipelineEvents;

	constructor(sources: HeaderSource[], events: PipelineEvents = {}) {
		this.templates = sources.map(parseTemplate);
		this.events = events;
		this.prefill(randU32());
	}

	get tpl(): MiningTemplate { return this.templates[this.tplIdx]; }
	get hasNextTemplate(): boolean { return this.tplIdx < this.templates.length - 1; }

	/** Does the header, with its winning nonce, reproduce the published block hash? */
	verify(tpl: MiningTemplate = this.tpl): { ok: boolean; hex: string } {
		const hex = makeToken(tpl, tpl.nonce).hex;
		return { ok: hex === tpl.hash, hex };
	}

	/** Fill every stage, oldest nonce at the far end, as if the core had been running. */
	prefill(base: number): void {
		for (let i = 0; i < DEPTH; i++) this.stations[i] = makeToken(this.tpl, (base + DEPTH - 1 - i) >>> 0);
		this.nextNonce = (base + DEPTH) >>> 0;
		this.lastOut = null;
	}

	private pushTape(row: TapeRow): void {
		this.tape.unshift(row);
		if (this.tape.length > TAPE_LEN) this.tape.pop();
	}

	/** One clock: every nonce moves a stage; one finished hash reaches the comparator. */
	tick(): Result | null {
		const out = this.stations[DEPTH - 1];
		for (let i = DEPTH - 1; i > 0; i--) this.stations[i] = this.stations[i - 1];
		this.stations[0] = makeToken(this.tpl, this.nextNonce);
		this.nextNonce = (this.nextNonce + 1) >>> 0;
		this.clock++;
		this.lastOut = out;
		this.last = out ? this.evaluate(out) : null;
		return this.last;
	}

	private evaluate(tok: Token): Result {
		this.total++;
		this.counts[tok.zeros]++;
		if (tok.zeros > this.maxZeros) this.maxZeros = tok.zeros;
		const v: Verdict = tok.hex <= this.tpl.targetHex ? 'block' : tok.zeros >= SHARE_BITS ? 'share' : 'discard';
		this.pushTape({ divider: false, nonce: tok.nonce, hex: tok.hex, zeros: tok.zeros, v });
		if (v === 'share') { this.shares++; this.events.onShare?.(tok); }
		if (v === 'block') {
			this.found = true;
			this.tracked = null;
			this.fifoNonce = tok.nonce;
			this.events.onFound?.(tok);
		}
		return { tok, v };
	}

	/** Rewind the counter to just before this template's real winning nonce. */
	startReplay(): void {
		this.replayed = true;
		this.prefill((this.tpl.nonce - (DEPTH - 1 - REPLAY_STATION)) >>> 0);
		this.tracked = this.tpl.nonce;
		this.pushTape({
			divider: true,
			text: `Replay: counter set ${DEPTH - 1 - REPLAY_STATION} nonces before block ${this.tpl.height.toLocaleString('en-US')}'s winning nonce, 0x${(this.tpl.nonce >>> 0).toString(16).padStart(8, '0')}.`,
		});
	}

	/** A new block arrived: throw away everything in flight and start the next template. */
	cleanJobs(): { flushed: number; prev: MiningTemplate } | null {
		if (!this.hasNextTemplate) return null;
		const flushed = this.stations.filter(Boolean).length;
		const prev = this.tpl;
		this.tplIdx++;
		this.stations.fill(null);
		this.tracked = null;
		this.found = false;
		this.replayed = false;
		this.last = null;
		this.lastOut = null;
		this.fifoNonce = null;
		this.nextNonce = randU32();
		this.pushTape({ divider: true, text: `clean_jobs: ${flushed} in-flight hashes discarded. New template: block ${this.tpl.height.toLocaleString('en-US')}.` });
		return { flushed, prev };
	}

	/** Clocks until the first result after a flush (0 when the pipeline is full). */
	refillWait(): number {
		for (let i = DEPTH - 1; i >= 0; i--) if (this.stations[i]) return DEPTH - i;
		return DEPTH;
	}

	// ── Flip-flops and switching activity ────────────────────────────────────
	// A stage's flip-flops hold 24 words after its round: state A–H (k 0–7),
	// then a 16-word message window W[r+1 … r+16] (k 8–23).

	flopWord(tok: Token, s: number, k: number): number {
		const r = s % 64;
		if (k < 8) return (s < 64 ? tok.s1 : tok.s2)[r * 8 + k];
		return (s < 64 ? tok.w1 : tok.w2)[r + 1 + (k - 8)];
	}

	/** Words past round 64, and padding that is identical for every hash, need no flip-flops. */
	flopExists(s: number, k: number): boolean {
		if (k < 8) return true;
		const j = (s % 64) + 1 + (k - 8);
		if (j > 63) return false;
		if (s < 64 && j >= 4 && j <= 15) return false;
		if (s >= 64 && j >= 8 && j <= 15) return false;
		return true;
	}

	/** On the previous clock, stage s held the token that is now one stage further on. */
	prevAt(s: number): Token | null {
		return s < DEPTH - 1 ? this.stations[s + 1] : this.lastOut;
	}

	stageActivity(s: number): StageActivity {
		const tok = this.stations[s];
		const p = this.prevAt(s);
		let bits = 0;
		let tog = 0;
		for (let k = 0; k < 24; k++) {
			if (!this.flopExists(s, k)) continue;
			bits += 32;
			if (tok && p) tog += popcnt(this.flopWord(tok, s, k) ^ this.flopWord(p, s, k));
		}
		return { bits, tog, act: tok && p ? tog / bits : 0 };
	}

	/** Fraction of all the core's flip-flops that flipped on the last clock. */
	totalActivity(): { tog: number; bits: number; act: number } {
		let tog = 0;
		let bits = 0;
		for (let s = 0; s < DEPTH; s++) { const a = this.stageActivity(s); tog += a.tog; bits += a.bits; }
		return { tog, bits, act: bits ? tog / bits : 0 };
	}

	private roundIO(tok: Token, s: number) {
		const r = s % 64;
		const st = s < 64 ? tok.s1 : tok.s2;
		const W = s < 64 ? tok.w1 : tok.w2;
		const inp = r === 0 ? (s < 64 ? this.tpl.midstate : IV) : st.subarray((r - 1) * 8, r * 8);
		const out = st.subarray(r * 8, r * 8 + 8);
		const [a, b, c, d, e, f, g] = [inp[0], inp[1], inp[2], inp[3], inp[4], inp[5], inp[6]];
		return {
			sig1: Sig1(e), ch: (e & f) ^ (~e & g), sig0: Sig0(a), maj: (a & b) ^ (a & c) ^ (b & c),
			t1: (out[4] - d) | 0, nE: out[4], nA: out[0],
			wires: [out[1], out[2], out[3], out[5], out[6], out[7]],
			wn: r + 16 <= 63 ? W[r + 16] : 0,
		};
	}

	/** How many output bits of each logic block flipped on the last clock (0–1). */
	logicActivity(s: number): LogicActivity | null {
		const tok = this.stations[s];
		const p = this.prevAt(s);
		if (!tok || !p) return null;
		const x = this.roundIO(tok, s);
		const y = this.roundIO(p, s);
		const f = (u: number, v: number) => popcnt(u ^ v) / 32;
		let wt = 0;
		for (let i = 0; i < 6; i++) wt += popcnt(x.wires[i] ^ y.wires[i]);
		return {
			sig1: f(x.sig1, y.sig1), ch: f(x.ch, y.ch), csa1: f(x.t1, y.t1), addE: f(x.nE, y.nE),
			sig0: f(x.sig0, y.sig0), maj: f(x.maj, y.maj), addA: f(x.nA, y.nA), msched: f(x.wn, y.wn),
			wires: wt / 192, nE: x.nE, nA: x.nA,
		};
	}
}
