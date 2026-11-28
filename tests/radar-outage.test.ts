import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, isTransient } from '../scripts/radar/api';

// Each test loads a fresh copy of sweep.ts, whose first import pulls in the whole facts and
// card-model graph. That took over the default 5s on a cold CI runner (and finished in
// ~140ms on a warm laptop), so warm it once up front and give the tests room.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });
beforeAll(async () => { await import('../scripts/radar/sweep'); });

const NOW = '2026-11-23T12:00:00Z'; // 12:00 in London: inside the radar's window
const NOW_SEC = Date.parse(NOW) / 1000;
const LAST_SWEEP = NOW_SEC - 900;

const gateway503 = () => new Response('<html>Bad gateway</html>', { status: 503, statusText: 'Service Unavailable' });
const emptySearch = () => new Response(JSON.stringify({ tweets: [], has_next_page: false }), { status: 200 });

/**
 * Every sweep also reads the site's prices.json for its fact sheet, so the stub
 * answers that from disk and sends only TwitterAPI.io's calls to `twitterapi`.
 */
const upstream = (twitterapi: () => Response) =>
	vi.fn(async (url: string | URL | Request) =>
		String(url).includes('api.twitterapi.io')
			? twitterapi()
			: new Response(readFileSync('static/data/prices.json', 'utf8'), { status: 200 }));

describe('isTransient', () => {
	it('rides out an upstream that is struggling or unreachable', () => {
		for (const status of [0, 429, 500, 503]) expect(isTransient(new ApiError('x', status))).toBe(true);
	});
	it('does not ride out a bad key, missing credits or a plain error', () => {
		for (const status of [400, 401, 402, 403, 404]) expect(isTransient(new ApiError('x', status))).toBe(false);
		expect(isTransient(new Error('TWITTERAPI_IO_KEY is not set'))).toBe(false);
	});
});

describe('a sweep while TwitterAPI.io is failing', () => {
	let dir: string;
	let statePath: string;
	let ghOutput: string;
	const saved = process.argv;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), 'radar-outage-'));
		statePath = join(dir, 'state.json');
		ghOutput = join(dir, 'gh-output');
		writeFileSync(ghOutput, '');
		process.argv = [saved[0], saved[1], `--state=${statePath}`, `--out=${join(dir, 'out')}`, `--now=${NOW}`];
		// setImmediate stays real so file reads can finish while the backoff timers are faked.
		vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] });
		vi.stubEnv('TWITTERAPI_IO_KEY', 'test-key');
		vi.stubEnv('TWITTERAPI_IO_GAP_MS', '0');
		vi.stubEnv('GITHUB_OUTPUT', ghOutput);
		vi.spyOn(console, 'log').mockImplementation(() => {});
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});
	afterEach(() => {
		process.argv = saved;
		vi.useRealTimers();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	const seed = (extra: Record<string, unknown> = {}) =>
		writeFileSync(statePath, JSON.stringify({ lastSweepSec: LAST_SWEEP, pending: {}, alerted: {}, days: {}, recentReplies: [], ...extra }));
	const state = () => JSON.parse(readFileSync(statePath, 'utf8'));
	const outputs = () => readFileSync(ghOutput, 'utf8');

	/**
	 * Runs main() while stepping the faked retry backoffs until it settles. Bounded by real
	 * time, not a step count: on a busy CI runner the real file reads between backoffs can
	 * outlast a fixed number of steps, which left main() waiting on a timer nobody advanced.
	 * performance.now() isn't faked here (only setTimeout and Date are).
	 */
	async function run(main: () => Promise<void>) {
		let done = false;
		const p = main().finally(() => { done = true; });
		p.catch(() => {});
		const start = performance.now();
		while (!done && performance.now() - start < 25_000) {
			await vi.advanceTimersByTimeAsync(5_000);
			await new Promise((r) => setImmediate(r));
		}
		return p;
	}
	async function load() {
		vi.resetModules();
		return (await import('../scripts/radar/sweep')).main;
	}

	it('carries on: no failure, the sweep time held, the failure counted', async () => {
		seed();
		vi.stubGlobal('fetch', upstream(gateway503));
		await run(await load());
		expect(state().lastSweepSec).toBe(LAST_SWEEP);
		expect(state().searchFailures).toBe(1);
		expect(outputs()).not.toContain('outage=');
		expect(JSON.parse(readFileSync(join(dir, 'out', 'candidates.json'), 'utf8')).candidates).toEqual([]);
	});

	it('turns one run red per outage, once enough sweeps in a row have failed', async () => {
		const { ESCALATE_AFTER } = await import('../scripts/radar/sweep');
		seed({ searchFailures: ESCALATE_AFTER - 1 });
		vi.stubGlobal('fetch', upstream(gateway503));
		const main = await load();

		await run(main);
		expect(outputs()).toContain('outage=long');
		expect(state().outageFlagged).toBe(true);
		expect(state().searchFailures).toBe(ESCALATE_AFTER);

		writeFileSync(ghOutput, '');
		await run(main);
		expect(outputs()).not.toContain('outage=');
		expect(state().searchFailures).toBe(ESCALATE_AFTER + 1);
	});

	it('a clean search ends the outage and moves the sweep time forward', async () => {
		seed({ searchFailures: 20, outageFlagged: true });
		vi.stubGlobal('fetch', upstream(emptySearch));
		await run(await load());
		expect(state().searchFailures).toBe(0);
		expect(state().outageFlagged).toBe(false);
		expect(state().lastSweepSec).toBe(NOW_SEC);
	});

	it('still fails on a bad key, which no amount of waiting fixes', async () => {
		seed();
		vi.stubGlobal('fetch', upstream(() => new Response(JSON.stringify({ status: 'error', msg: 'Invalid API key' }), { status: 401 })));
		await expect(run(await load())).rejects.toThrow('401');
		expect(state().searchFailures).toBeUndefined();
	});
});
