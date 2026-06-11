import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			// 404.html: Cloudflare Pages serves this with a real 404 status for
			// unmatched paths AND disables its SPA fallback — without it every
			// typo URL returned the homepage as a 200 soft-404 (SEO audit I3).
			fallback: '404.html',
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
