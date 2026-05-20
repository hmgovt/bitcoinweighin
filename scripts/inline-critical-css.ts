/**
 * Postbuild: inline render-blocking <link rel="stylesheet"> tags into <style>
 * blocks in every prerendered HTML page.
 *
 * Why:
 *   SvelteKit's adapter-static emits two CSS files per page (Tailwind base +
 *   the page-specific component styles). Both are render-blocking link tags
 *   on Slow 4G that add ~150–200 ms of critical-path latency. Inlining moves
 *   the CSS into the HTML payload (which is already brotli-encoded by CF),
 *   eliminating the secondary round-trip before first paint.
 *
 *   The trade-off is repeat-visit cache: external CSS is cached separately
 *   and reused across navigations. For this site — primarily single-page
 *   visits, small CSS — the FCP/LCP win outweighs the cache loss.
 *
 * Safety:
 *   - Only inlines CSS files under the build directory; absolute external
 *     URLs are left as-is.
 *   - Skips any single CSS file > 100 KB raw (defensive — would balloon HTML).
 *   - Re-runnable: looks only for matching <link rel="stylesheet"> tags so
 *     a second pass is a no-op.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const BUILD_DIR = join(REPO_ROOT, 'build');

const MAX_INLINE_BYTES = 100_000;

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, entry.name);
		if (entry.isDirectory()) walk(p, out);
		else if (entry.isFile() && entry.name.endsWith('.html')) out.push(p);
	}
	return out;
}

function resolveHref(href: string, htmlPath: string): string | null {
	if (/^https?:\/\//i.test(href)) return null; // external — skip
	if (href.startsWith('./')) return resolve(dirname(htmlPath), href);
	if (href.startsWith('/')) return resolve(BUILD_DIR, '.' + href);
	return resolve(dirname(htmlPath), href);
}

const linkRe = /<link\s+href="([^"]+\.css)"\s+rel="stylesheet"\s*\/?>/g;

let totalInlined = 0;
let totalBytes = 0;

const htmlFiles = walk(BUILD_DIR);
for (const htmlPath of htmlFiles) {
	const original = readFileSync(htmlPath, 'utf-8');
	let inlinedHere = 0;
	let bytesHere = 0;

	const updated = original.replace(linkRe, (match, href: string) => {
		const cssPath = resolveHref(href, htmlPath);
		if (!cssPath) return match;
		try {
			const stat = statSync(cssPath);
			if (stat.size > MAX_INLINE_BYTES) return match;
			const css = readFileSync(cssPath, 'utf-8');
			inlinedHere += 1;
			bytesHere += stat.size;
			return `<style>${css}</style>`;
		} catch {
			return match;
		}
	});

	if (inlinedHere > 0) {
		writeFileSync(htmlPath, updated);
		const rel = htmlPath.slice(REPO_ROOT.length + 1);
		console.log(`  ${rel}: inlined ${inlinedHere} stylesheet(s), ${bytesHere} B`);
		totalInlined += inlinedHere;
		totalBytes += bytesHere;
	}
}

console.log(`\nInlined ${totalInlined} stylesheet reference(s), ${totalBytes} B total.`);
