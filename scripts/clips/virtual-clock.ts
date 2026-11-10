/**
 * virtual-clock.ts — frame-exact capture of the site's WebGL scenes.
 *
 * Once `start()` is called, performance.now() only moves when `advance()`
 * says so, and animation-frame callbacks wait in a queue until then — so a
 * slow software renderer draws exactly one frame per captured frame, never
 * in between, and every frame is exactly 1/fps of animation apart. Until
 * `start()` the page runs on real time (loading, workers, first frames).
 */
import type { Page } from 'playwright';

export async function installVirtualClock(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const realNow = performance.now.bind(performance);
		const realRaf = window.requestAnimationFrame.bind(window);
		const w = window as unknown as { __vt: number | null; __flush: () => void; __present: () => Promise<void> };
		const queue: FrameRequestCallback[] = [];
		w.__vt = null;
		performance.now = () => w.__vt ?? realNow();
		window.requestAnimationFrame = (cb) => {
			if (w.__vt === null) return realRaf(() => cb(performance.now()));
			queue.push(cb);
			return 0;
		};
		w.__flush = () => {
			for (const cb of queue.splice(0)) cb(performance.now());
		};
		w.__present = () => new Promise((r) => realRaf(() => r()));
	});
}

/** Freeze the clock at the current real time; from now on only advance() moves it. */
export async function startVirtualClock(page: Page): Promise<void> {
	await page.evaluate(() => {
		const w = window as unknown as { __vt: number | null };
		w.__vt = performance.now();
	});
}

/**
 * Move the clock by `ms` and render one frame — unless `skip()` (evaluated
 * in the page after the move) says the frame is hidden anyway. Returns
 * whether it was skipped.
 */
export function advance(page: Page, ms: number, skip?: string): Promise<boolean> {
	return page.evaluate(
		async ({ ms, skip }) => {
			const w = window as unknown as { __vt: number; __flush: () => void; __present: () => Promise<void> };
			w.__vt += ms;
			// eslint-disable-next-line no-new-func
			if (skip && new Function(`return (${skip})`)()) return true;
			w.__flush();
			await w.__present();
			return false;
		},
		{ ms, skip }
	);
}
