import { describe, expect, it, vi } from 'vitest';
import worker, { dispatch } from '../workers/radar-trigger/src/index.js';

describe('radar-trigger dispatch', () => {
	it('asks GitHub to run radar.yml on main, with the headers GitHub requires', async () => {
		const fetcher = vi.fn(async () => new Response(null, { status: 204 }));
		await dispatch('t0ken', fetcher as unknown as typeof fetch);
		expect(fetcher).toHaveBeenCalledOnce();
		const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('https://api.github.com/repos/hmgovt/bitcoinweighin/actions/workflows/radar.yml/dispatches');
		expect(init.method).toBe('POST');
		expect(JSON.parse(String(init.body))).toEqual({ ref: 'main' });
		const h = init.headers as Record<string, string>;
		expect(h.Authorization).toBe('Bearer t0ken');
		expect(h['User-Agent']).toBeTruthy();
		expect(h.Accept).toBe('application/vnd.github+json');
	});

	it('fails loudly on anything but 204, so the cron event shows as failed', async () => {
		const fetcher = vi.fn(async () => new Response('Bad credentials', { status: 401 }));
		await expect(dispatch('expired', fetcher as unknown as typeof fetch)).rejects.toThrow(/401 Bad credentials/);
	});

	it('refuses to run without a token, and never starts a run over HTTP', async () => {
		const ctx = { waitUntil: vi.fn() } as never;
		await expect(worker.scheduled({} as never, {}, ctx)).rejects.toThrow(/GH_TOKEN/);
		expect((await worker.fetch()).status).toBe(404);
	});
});
