import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { BLOCKS } from '../src/lib/mining/blocks.ts';
import { FIXTURE_BLOCKS } from './fixtures/mining-blocks.ts';
import { IV, compress, hexZeros, makeToken, parseTemplate } from '../src/lib/mining/sha256.ts';
import { DEPTH, HashPipeline, REPLAY_STATION } from '../src/lib/mining/pipeline.ts';

const sha256d = (buf: Buffer) =>
	Buffer.from(createHash('sha256').update(createHash('sha256').update(buf).digest()).digest()).reverse().toString('hex');

describe('mining SHA-256', () => {
	it('reproduces each real block hash from its header and winning nonce', () => {
		for (const b of [...FIXTURE_BLOCKS, ...BLOCKS]) {
			const tpl = parseTemplate(b);
			expect(makeToken(tpl, tpl.nonce).hex).toBe(b.hash);
		}
	});

	it('matches node:crypto for neighbouring nonces, not just the winner', () => {
		const tpl = parseTemplate(FIXTURE_BLOCKS[0]);
		const header = Buffer.from(FIXTURE_BLOCKS[0].header, 'hex');
		for (const delta of [1, 2, 1000, 0x12345]) {
			const nonce = (tpl.nonce + delta) >>> 0;
			header.writeUInt32LE(nonce, 76);
			expect(makeToken(tpl, nonce).hex).toBe(sha256d(header));
		}
	});

	it('records registers so that IV + round-64 state is the digest', () => {
		const states = new Uint32Array(512);
		const block = new Uint32Array(16).map((_, i) => (i * 0x9e3779b9) >>> 0);
		const d = compress(IV, block, states);
		for (let i = 0; i < 8; i++) expect(d[i]).toBe((IV[i] + states[63 * 8 + i]) >>> 0);
	});

	it('parses header fields and the target', () => {
		const tpl = parseTemplate(FIXTURE_BLOCKS[1]);
		expect(tpl.version).toBe(591200256);
		expect(tpl.time).toBe(1790248805);
		expect(tpl.bits).toBe(386014917);
		expect(tpl.nonce).toBe(3642963308);
		expect(tpl.prev).toBe(FIXTURE_BLOCKS[0].hash);
		expect(tpl.targetZeros).toBe(78);
		expect(tpl.difficulty).toBeCloseTo(132757073449487.52, -3);
		expect(hexZeros(FIXTURE_BLOCKS[1].hash)).toBe(81);
	});
});

describe('HashPipeline', () => {
	it('starts full, so a result leaves on the first clock', () => {
		const p = new HashPipeline(FIXTURE_BLOCKS);
		expect(p.stations.every(Boolean)).toBe(true);
		expect(p.tick()).not.toBeNull();
	});

	it('replays the real find after the winner walks the rest of the pipeline', () => {
		const p = new HashPipeline(FIXTURE_BLOCKS);
		p.startReplay();
		let clocks = 0;
		while (!p.found && clocks < DEPTH) { p.tick(); clocks++; }
		expect(p.found).toBe(true);
		expect(clocks).toBe(DEPTH - REPLAY_STATION);
		expect(p.last?.v).toBe('block');
		expect(p.last?.tok.hex).toBe(FIXTURE_BLOCKS[0].hash);
		expect(p.fifoNonce).toBe(p.templates[0].nonce);
	});

	it('clean_jobs flushes every stage and moves to the next template', () => {
		const p = new HashPipeline(FIXTURE_BLOCKS);
		const r = p.cleanJobs();
		expect(r?.flushed).toBe(DEPTH);
		expect(p.tpl.height).toBe(968390);
		expect(p.stations.every((s) => s === null)).toBe(true);
		expect(p.tick()).toBeNull();
		expect(p.refillWait()).toBe(DEPTH);
		expect(p.cleanJobs()).toBeNull();
	});

	it('rounds 1–3 compute nothing new: the nonce only enters at round 4', () => {
		const p = new HashPipeline(FIXTURE_BLOCKS);
		p.tick();
		for (const s of [0, 1, 2]) {
			const logic = p.logicActivity(s)!;
			for (const k of ['sig1', 'ch', 'sig0', 'maj', 'addA', 'addE', 'wires'] as const) expect(logic[k]).toBe(0);
			// The state registers A–H hold the same value for every nonce.
			const tok = p.stations[s]!, prev = p.prevAt(s)!;
			for (let k = 0; k < 8; k++) expect(p.flopWord(tok, s, k)).toBe(p.flopWord(prev, s, k));
		}
		expect(p.logicActivity(3)!.addE).toBeGreaterThan(0);
		const total = p.totalActivity();
		expect(total.act).toBeGreaterThan(0.3);
		expect(total.act).toBeLessThan(0.6);
	});
});

describe('daily blocks-latest.json', () => {
	it('holds two consecutive, verifiable blocks', () => {
		expect(BLOCKS).toHaveLength(2);
		const [older, newer] = BLOCKS.map(parseTemplate);
		expect(newer.height).toBe(older.height + 1);
		expect(newer.prev).toBe(older.hash);
		for (const b of BLOCKS) expect(sha256d(Buffer.from(b.header, 'hex'))).toBe(b.hash);
		// A real block target demands dozens of leading zero bits.
		expect(older.targetZeros).toBeGreaterThan(60);
	});
});
