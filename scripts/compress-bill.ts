// scripts/compress-bill.ts
/**
 * compress-bill.ts — strip the watermarked stock-photo texture baked into
 * the source one_dollar_bill.glb and compress the remaining geometry-only
 * mesh. The bill's visible face is assigned at runtime by
 * src/lib/scene/billMaterials.ts (a procedural CanvasTexture) — the shipped
 * glb never carries the original photo, so the watermark can never reach
 * the browser. See docs/handoff/14-cash.md ("3D model") for the full story.
 *
 * Source: assets/blender/one_dollar_bill.glb
 *   · single mesh, 24 verts / 12 tris, thin box, doubleSided
 *   · baseColorTexture: 1024x1024 JPEG, watermarked stock photo — DROPPED
 *   · modeled at exactly 2x true scale (a Sketchfab unit-scale artifact) —
 *     NOT corrected here; the runtime loader normalizes scale by measured
 *     bounding box (see src/lib/scene/loadNormalizedModel.ts), the same
 *     technique already used for the Shiba model.
 *
 * Output: static/models/references/one_dollar_bill/bill.glb
 */

import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { execFileSync } from 'node:child_process';
import { statSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SRC = path.join(ROOT, 'assets/blender/one_dollar_bill.glb');
const STRIPPED = path.join(ROOT, 'static/models/references/one_dollar_bill/_stripped.glb');
const OUT = path.join(ROOT, 'static/models/references/one_dollar_bill/bill.glb');
const CLI = path.join(ROOT, 'node_modules/.bin/gltf-transform');

const TARGET_BYTES = 100 * 1024; // 100 KB — geometry-only, no animation, no texture

function fail(message: string): never {
	console.error(`\n✗ compress-bill: ${message}\n`);
	process.exit(1);
}

async function stripTexture(): Promise<void> {
	const io = new NodeIO();
	const doc = await io.read(SRC);
	const textures = doc.getRoot().listTextures();
	if (textures.length === 0) {
		fail('source has no textures to strip — check SRC still points at the Sketchfab export');
	}
	for (const mat of doc.getRoot().listMaterials()) {
		mat.setBaseColorTexture(null);
	}
	for (const tex of textures) tex.dispose();
	mkdirSync(path.dirname(STRIPPED), { recursive: true });
	await io.write(STRIPPED, doc);
}

async function verify(): Promise<void> {
	const outBytes = statSync(OUT).size;
	const sizeKb = (outBytes / 1024).toFixed(1);
	if (outBytes > TARGET_BYTES) {
		fail(`output is ${sizeKb} KB, over the ${TARGET_BYTES / 1024} KB budget.`);
	}

	// The optimize step (below) meshopt-compresses OUT and quantizes its
	// attributes, so reading it back requires both extensions registered
	// (plus the meshopt decoder dependency) — a bare NodeIO throws "Missing
	// required extension" on EXT_meshopt_compression / KHR_mesh_quantization
	// otherwise.
	//
	// MeshoptDecoder's WASM module is assigned inside an async
	// WebAssembly.instantiate(...) callback, so it must be awaited before
	// constructing a NodeIO that depends on it — otherwise io.read() can
	// race the WASM load and throw a confusing TypeError instead of failing
	// clearly. See @gltf-transform/extensions' documented usage pattern.
	await MeshoptDecoder.ready;
	const io = new NodeIO()
		.registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
		.registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
	const doc = await io.read(OUT);
	const textures = doc.getRoot().listTextures();
	if (textures.length > 0) {
		fail(
			`output still has ${textures.length} texture(s) — the watermarked source image was not fully stripped`
		);
	}
	const meshes = doc.getRoot().listMeshes();
	if (meshes.length === 0) {
		fail('output has no meshes — the geometry was lost somewhere in the pipeline');
	}

	console.log(`\n✓ ${path.relative(ROOT, OUT)} — ${sizeKb} KB (≤ ${TARGET_BYTES / 1024} KB budget)`);
	console.log('✓ zero embedded textures (watermarked source image stripped)');
	console.log(`✓ ${meshes.length} mesh(es) present\n`);
}

async function main(): Promise<void> {
	if (!existsSync(SRC)) fail(`source model not found at ${SRC}`);
	if (!existsSync(CLI)) fail('gltf-transform CLI not found — run `npm install` first');

	await stripTexture();
	if (!existsSync(STRIPPED)) fail('texture-strip step ran but produced no intermediate file');

	execFileSync(CLI, ['optimize', STRIPPED, OUT, '--compress', 'meshopt', '--simplify', 'false'], {
		stdio: 'inherit',
		cwd: ROOT,
	});
	if (!existsSync(OUT)) fail('optimize ran but produced no output file');

	await verify();
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
