/**
 * radar-trigger: starts the reply radar (.github/workflows/radar.yml) every 15
 * minutes through the day.
 *
 * GitHub runs scheduled workflows late, or not at all, when it's busy: in its
 * first week the radar's every-15-minutes schedule ran 3 to 5 times a day. A
 * Cloudflare Cron Trigger is punctual, so this Worker asks GitHub to run the
 * workflow (workflow_dispatch) on Cloudflare's clock instead. The radar itself
 * is unchanged: sweep.ts still does nothing outside 09:00–23:30 London, and the
 * workflow still runs one at a time.
 *
 * Secret: GH_TOKEN, a fine-grained GitHub token for hmgovt/bitcoinweighin with
 * Actions: Read and write (nothing else). Schedule: wrangler.toml, or the
 * Worker's Triggers settings when set up in the dashboard (README.md).
 * There is deliberately no way to start a run over HTTP.
 *
 * Plain JavaScript so it can be pasted into the Cloudflare dashboard as is.
 */

const DISPATCH = 'https://api.github.com/repos/hmgovt/bitcoinweighin/actions/workflows/radar.yml/dispatches';

/**
 * Ask GitHub to run the radar workflow on main.
 * @param {string} token
 * @param {typeof fetch} [fetcher]
 */
export async function dispatch(token, fetcher = fetch) {
	const r = await fetcher(DISPATCH, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			// GitHub refuses API requests without a User-Agent.
			'User-Agent': 'bitcoinweighin-radar-trigger',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ ref: 'main' }),
	});
	// 204 means the run is queued. Anything else fails the cron event, which
	// shows in the Worker's logs and its Cron Events list in the dashboard.
	if (r.status !== 204) throw new Error(`GitHub dispatch failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
}

export default {
	/**
	 * @param {ScheduledController} _event
	 * @param {{ GH_TOKEN?: string }} env
	 * @param {ExecutionContext} ctx
	 */
	async scheduled(_event, env, ctx) {
		if (!env.GH_TOKEN) throw new Error('GH_TOKEN is not set');
		ctx.waitUntil(dispatch(env.GH_TOKEN));
	},
	async fetch() {
		return new Response('Not found', { status: 404 });
	},
};
