import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// api() keeps its pacing state at module level, so each test loads a fresh copy.
async function load() {
	vi.resetModules();
	return (await import('../scripts/radar/api')).api;
}

const ok = () => new Response(JSON.stringify({ tweets: [] }), { status: 200 });
const gateway503 = () => new Response('<html>Bad gateway</html>', { status: 503, statusText: 'Service Unavailable' });

describe('radar api() against a flaky upstream', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubEnv('TWITTERAPI_IO_KEY', 'test-key');
		vi.stubEnv('TWITTERAPI_IO_GAP_MS', '0');
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('retries a 503 and returns the answer that follows', async () => {
		const fetchMock = vi.fn().mockResolvedValueOnce(gateway503()).mockResolvedValueOnce(ok());
		vi.stubGlobal('fetch', fetchMock);
		const api = await load();
		const out = api('/tweet/advanced_search?q=x');
		await vi.advanceTimersByTimeAsync(20_000);
		expect(await out).toEqual({ tweets: [] });
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('gives up after two retries and says what came back', async () => {
		const fetchMock = vi.fn().mockImplementation(async () => gateway503());
		vi.stubGlobal('fetch', fetchMock);
		const api = await load();
		const out = api('/tweet/advanced_search?q=x').catch((e: Error) => e);
		await vi.advanceTimersByTimeAsync(20_000);
		const err = await out;
		expect(err).toBeInstanceOf(Error);
		expect((err as Error).message).toBe('/tweet/advanced_search: 503 Service Unavailable <html>Bad gateway</html>');
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it('does not retry a client error, and reports its message', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'error', msg: 'bad key' }), { status: 401 }));
		vi.stubGlobal('fetch', fetchMock);
		const api = await load();
		await expect(api('/tweets?tweet_ids=1')).rejects.toThrow('/tweets: 401 bad key');
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('still retries a 429 once', async () => {
		const fetchMock = vi.fn().mockResolvedValueOnce(new Response('', { status: 429 })).mockResolvedValueOnce(ok());
		vi.stubGlobal('fetch', fetchMock);
		const api = await load();
		const out = api('/tweets?tweet_ids=1');
		await vi.advanceTimersByTimeAsync(20_000);
		expect(await out).toEqual({ tweets: [] });
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});
