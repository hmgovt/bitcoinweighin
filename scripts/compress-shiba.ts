/**
 * compress-shiba.ts — turn the 16 MB uncompressed Sketchfab Shiba source into
 * a ≤3 MB glb the live stage can lazy-load after first interaction.
 *
 * Source (kept on disk for re-export):
 *   static/models/references/shiba_inu/scene.gltf  (+ scene.bin, textures/*)
 *     · single skinned mesh, 19,267 verts
 *     · two 2048² PNG textures (baseColor 6 MB, metallicRoughness 2 MB)
 *     · five baked animations totalling ~5.8 MB of keyframes:
 *         0|play_dead_0, 0|rollover_0, 0|shake_0, 0|sitting_0, 0|standing_0
 *
 * Output:
 *   static/models/references/shiba_inu/shiba.glb
 *
 * Pipeline (gltf-transform `optimize`):
 *   · texture-size 1024 + webp  → the dominant saving (8 MB PNG → ~0.5 MB)
 *   · compress meshopt          → compresses ALL accessors incl. the animation
 *                                 samplers (quantization alone leaves the 5.8 MB
 *                                 of keyframes untouched and blows the budget).
 *                                 Runtime cost: GLTFLoader.setMeshoptDecoder in
 *                                 LiveStage — three ships the decoder.
 *   · simplify OFF              → the dog is a recognisable character; protect
 *                                 the skinned silhouette. Geometry is ~1.5 MB,
 *                                 not the budget problem.
 *
 * Clip NAMES must survive verbatim — the easter egg selects tricks by name
 * (`/play_dead|rollover|shake/`) and the idle by `includes('sitting')`. The
 * verify step below fails loudly if any clip is renamed or dropped.
 */

import { execFileSync } from 'node:child_process';
import { statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SRC = path.join(ROOT, 'static/models/references/shiba_inu/scene.gltf');
const OUT = path.join(ROOT, 'static/models/references/shiba_inu/shiba.glb');
const CLI = path.join(ROOT, 'node_modules/.bin/gltf-transform');

const TARGET_BYTES = 3 * 1024 * 1024; // ≤ 3 MB hard budget (handoff §asset pipeline)
const REQUIRED_CLIPS = ['play_dead', 'rollover', 'shake', 'sitting', 'standing'];

function stripAnsi(s: string): string {
	// eslint-disable-next-line no-control-regex
	return s.replace(/\x1b\[[0-9;]*m/g, '');
}

function fail(message: string): never {
	console.error(`\n✗ compress-shiba: ${message}\n`);
	process.exit(1);
}

function main(): void {
	if (!existsSync(SRC)) fail(`source model not found at ${SRC}`);
	if (!existsSync(CLI)) fail(`gltf-transform CLI not found — run \`npm install\` first`);

	const srcBytes = statSync(SRC).size;
	console.log(`→ optimising ${path.relative(ROOT, SRC)} (${(srcBytes / 1e6).toFixed(2)} MB gltf + external bin/textures)`);

	execFileSync(
		CLI,
		[
			'optimize',
			SRC,
			OUT,
			'--compress', 'meshopt',
			'--simplify', 'false',
			'--texture-compress', 'webp',
			'--texture-size', '1024',
		],
		{ stdio: 'inherit', cwd: ROOT }
	);

	if (!existsSync(OUT)) fail('optimize ran but produced no output file');

	// ── Verify: size budget + the output parses + clips survived ──────────
	const outBytes = statSync(OUT).size;
	const inspect = stripAnsi(execFileSync(CLI, ['inspect', OUT], { cwd: ROOT }).toString());

	const missing = REQUIRED_CLIPS.filter((c) => !inspect.includes(c));
	if (missing.length) {
		fail(`output is missing animation clip(s): ${missing.join(', ')} — easter egg would break`);
	}
	if (!/meshopt/i.test(inspect)) {
		fail('output does not report meshopt compression — animation samplers would be uncompressed');
	}

	const sizeMb = (outBytes / 1e6).toFixed(2);
	if (outBytes > TARGET_BYTES) {
		fail(`output is ${sizeMb} MB, over the 3 MB budget. Drop --texture-size to 512 or raise --meshopt-level.`);
	}

	console.log(`\n✓ ${path.relative(ROOT, OUT)} — ${sizeMb} MB (≤ 3 MB budget; see the optimize summary above for the full source ratio)`);
	console.log(`✓ all five clips present: ${REQUIRED_CLIPS.join(', ')}`);
	console.log(`✓ meshopt compression confirmed (LiveStage registers MeshoptDecoder)\n`);
}

main();
