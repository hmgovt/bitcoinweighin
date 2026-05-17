import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: undefined,
			precompress: false,
			strict: true
		}),
		prerender: {
			// Static dataset artifacts under /data/v{X.Y}/ don't have HTML index
			// pages — Cloudflare Pages serves the files directly. The /api/
			// directory is similarly file-only. Warn rather than fail so links
			// to those paths from the /data page don't block the build.
			handleHttpError: ({ path, message }) => {
				if (path.startsWith('/data/v') || path.startsWith('/api/')) return;
				throw new Error(message);
			}
		}
	}
};

export default config;
