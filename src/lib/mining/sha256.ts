/**
 * SHA-256, one round at a time — the arithmetic inside a Bitcoin mining core.
 *
 * `compress` is a plain SHA-256 compression function that can also record the
 * eight working registers (A–H) after every one of its 64 rounds, which is what
 * the /mining page draws. Everything else here is Bitcoin's use of it: an
 * 80-byte block header, hashed twice, with the first 64 bytes folded into a
 * reusable "midstate" exactly as real mining chips do.
 */

export const K = new Uint32Array([
	0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
	0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
	0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
	0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
	0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
	0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
	0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
	0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** SHA-256's standard starting values. */
export const IV = new Uint32Array([
	0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

export const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));
export const bswap = (x: number): number =>
	(((x & 0xff) << 24) | ((x & 0xff00) << 8) | ((x >>> 8) & 0xff00) | (x >>> 24)) >>> 0;
export const hex8 = (v: number): string => (v >>> 0).toString(16).padStart(8, '0');
export const Sig0 = (a: number): number => rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
export const Sig1 = (e: number): number => rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);

/**
 * Compress one 64-byte block (16 words) from chaining state `H`.
 *
 * @param states when given (length ≥ 512), receives registers A–H after each
 *   round: round t's values sit at `states[t * 8 .. t * 8 + 7]`.
 * @param Wout when given (length ≥ 64), receives the expanded message schedule.
 */
export function compress(
	H: ArrayLike<number>,
	W16: ArrayLike<number>,
	states?: Uint32Array,
	Wout?: Uint32Array
): Uint32Array {
	const W = Wout ?? new Uint32Array(64);
	for (let t = 0; t < 16; t++) W[t] = W16[t];
	for (let t = 16; t < 64; t++) {
		const x = W[t - 15];
		const y = W[t - 2];
		const s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
		const s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
		W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
	}
	let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
	for (let t = 0; t < 64; t++) {
		const T1 = (h + Sig1(e) + ((e & f) ^ (~e & g)) + K[t] + W[t]) | 0;
		const T2 = (Sig0(a) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
		h = g; g = f; f = e; e = (d + T1) | 0; d = c; c = b; b = a; a = (T1 + T2) | 0;
		if (states) {
			const o = t * 8;
			states[o] = a; states[o + 1] = b; states[o + 2] = c; states[o + 3] = d;
			states[o + 4] = e; states[o + 5] = f; states[o + 6] = g; states[o + 7] = h;
		}
	}
	return new Uint32Array([H[0] + a, H[1] + b, H[2] + c, H[3] + d, H[4] + e, H[5] + f, H[6] + g, H[7] + h]);
}

/** Leading zero bits of a big-endian hex string (how Bitcoin displays hashes). */
export function hexZeros(hex: string): number {
	let z = 0;
	for (const ch of hex) {
		const v = parseInt(ch, 16);
		if (v === 0) { z += 4; continue; }
		return z + Math.clz32(v) - 28;
	}
	return z;
}

export interface HeaderSource {
	height: number;
	/** The raw 80-byte header, hex. */
	header: string;
	/** The block's hash as Bitcoin displays it (byte-reversed), hex. */
	hash: string;
}

export interface MiningTemplate extends HeaderSource {
	/** SHA-256 state after the header's first 64 bytes — computed once per job. */
	midstate: Uint32Array;
	/** Block 2 of pass 1: the header's last 16 bytes plus padding, nonce word zeroed. */
	tail: Uint32Array;
	version: number;
	prev: string;
	merkle: string;
	time: number;
	bits: number;
	/** The nonce that actually won this block. */
	nonce: number;
	targetHex: string;
	targetZeros: number;
	difficulty: number;
	/** Expected hashes to find a block at this difficulty (difficulty × 2³²). */
	expected: number;
}

export function parseTemplate(src: HeaderSource): MiningTemplate {
	if (!/^[0-9a-f]{160}$/i.test(src.header)) throw new Error(`block ${src.height}: header must be 80 bytes of hex`);
	const b = new Uint8Array(80);
	for (let i = 0; i < 80; i++) b[i] = parseInt(src.header.substr(i * 2, 2), 16);
	const be = (o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
	const le = (o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
	const revHex = (s: number, e: number) =>
		Array.from(b.slice(s, e)).reverse().map((x) => x.toString(16).padStart(2, '0')).join('');
	const block1 = new Uint32Array(16);
	for (let i = 0; i < 16; i++) block1[i] = be(i * 4);
	const tail = new Uint32Array(16);
	tail[0] = be(64); tail[1] = be(68); tail[2] = be(72); tail[4] = 0x80000000; tail[15] = 640;
	const bits = le(72);
	const exp = bits >>> 24;
	const mant = bits & 0xffffff;
	const targetHex = (mant.toString(16).padStart(6, '0') + '0'.repeat((exp - 3) * 2)).padStart(64, '0');
	const difficulty = (0xffff * Math.pow(2, 208)) / (mant * Math.pow(2, 8 * (exp - 3)));
	return {
		...src,
		midstate: compress(IV, block1),
		tail,
		version: le(0),
		prev: revHex(4, 36),
		merkle: revHex(36, 68),
		time: le(68),
		bits,
		nonce: le(76),
		targetHex,
		targetZeros: hexZeros(targetHex),
		difficulty,
		expected: difficulty * 4294967296,
	};
}

/** One nonce in flight: every round of both SHA-256 passes, recorded. */
export interface Token {
	nonce: number;
	/** Pass 1 registers, 64 rounds × 8. */
	s1: Uint32Array;
	/** Pass 1 message schedule. */
	w1: Uint32Array;
	/** Pass 2 registers, 64 rounds × 8. */
	s2: Uint32Array;
	w2: Uint32Array;
	/** The block hash for this nonce, as Bitcoin displays it. */
	hex: string;
	zeros: number;
	/** The nonce as it enters SHA-256: byte-swapped into message word 3. */
	w3: number;
}

export function makeToken(tpl: MiningTemplate, nonce: number): Token {
	const w = tpl.tail.slice();
	w[3] = bswap(nonce);
	const s1 = new Uint32Array(512);
	const w1 = new Uint32Array(64);
	const d1 = compress(tpl.midstate, w, s1, w1);
	const p = new Uint32Array(16);
	p.set(d1); p[8] = 0x80000000; p[15] = 256;
	const s2 = new Uint32Array(512);
	const w2 = new Uint32Array(64);
	const d2 = compress(IV, p, s2, w2);
	let hex = '';
	for (let i = 7; i >= 0; i--) hex += hex8(bswap(d2[i]));
	return { nonce: nonce >>> 0, s1, w1, s2, w2, hex, zeros: hexZeros(hex), w3: w[3] };
}
