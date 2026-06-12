/**
 * materials.ts — gold / silver / PuO₂ cube materials, the procedural
 * roughness-variation map, and the warm-softbox studio environment. Ported
 * VERBATIM from `prototypes/live-scene.html` (the PBR values were iterated to
 * portfolio quality in the prototype and cross-check `assets/materials-reference.md`).
 *
 * Client-only: `makeRoughnessMap` touches `document` for the canvas noise, so
 * this module is imported solely by `LiveStage.svelte` after the island
 * hydrates — never during SSR.
 *
 * The Pu material ships with `emissiveIntensity: 0`; `LiveStage` drives the
 * thermal glow per-frame from `puGlowRamp` (maths.ts). Materials stay static;
 * the maths stays pure and tested.
 */

import * as THREE from 'three';

/**
 * Procedural roughness map. A flat roughness reads as paint; this canvas
 * echoes materials-reference's procedural 0.08–0.22 band so the metal has
 * patches of polish and patches of duller cast under the high-contrast rig.
 */
export function makeRoughnessMap(): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = 256;
	const ctx = canvas.getContext('2d')!;
	ctx.fillStyle = '#8a8a8a';
	ctx.fillRect(0, 0, 256, 256);
	for (let i = 0; i < 48; i++) {
		const x = Math.random() * 256;
		const y = Math.random() * 256;
		const r = 18 + Math.random() * 60;
		const v = Math.floor(95 + Math.random() * 125);
		const g = ctx.createRadialGradient(x, y, 0, x, y, r);
		g.addColorStop(0, `rgba(${v},${v},${v},0.9)`);
		g.addColorStop(1, 'rgba(138,138,138,0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc(x, y, r, 0, 7);
		ctx.fill();
	}
	const map = new THREE.CanvasTexture(canvas);
	map.wrapS = map.wrapT = THREE.RepeatWrapping;
	return map;
}

export interface CubeMaterials {
	gold: THREE.MeshPhysicalMaterial;
	silver: THREE.MeshPhysicalMaterial;
	pu238: THREE.MeshPhysicalMaterial;
}

/**
 * The three cube materials, keyed by commodity id. Gold and silver are
 * metals reflecting the softbox rig; PuO₂ is a near-black ceramic whose
 * thermal emission (driven in the loop) does the talking.
 */
export function makeMaterials(roughMap: THREE.CanvasTexture): CubeMaterials {
	const gold = new THREE.MeshPhysicalMaterial({
		color: new THREE.Color(0.95, 0.6, 0.12), // materials-reference base, lifted
		metalness: 1.0,
		roughness: 0.26, // × the map → ~0.10–0.23 effective
		roughnessMap: roughMap,
		envMapIntensity: 1.6,
	});
	const silver = new THREE.MeshPhysicalMaterial({
		color: new THREE.Color(0.78, 0.78, 0.76), // materials-reference silver
		metalness: 1.0,
		roughness: 0.26,
		roughnessMap: roughMap,
		envMapIntensity: 1.5,
	});
	// PuO₂ fuel: dark ceramic, not metal — near-black charcoal, matte, barely
	// reflective. emissive colour + intensity scale with cube size in the loop
	// (puGlowRamp); the point light + bloom give the radiative halo. Environment
	// dims on the Pu tab — fuel pellets are photographed in dark labs.
	const pu238 = new THREE.MeshPhysicalMaterial({
		color: new THREE.Color(0.07, 0.07, 0.08),
		metalness: 0.05,
		roughness: 0.7,
		roughnessMap: roughMap,
		envMapIntensity: 0.4,
		emissive: new THREE.Color(0.8, 0.18, 0.02),
		emissiveIntensity: 0,
	});
	return { gold, silver, pu238 };
}

/**
 * The bullion-photo studio environment: one big warm softbox, an overhead
 * wash, a front fill, a hot rim strip, a cool dim fill, and a warm floor
 * bounce, in an otherwise dark room. RoomEnvironment's neutral grey wash is
 * why earlier builds read muddy — most reflection directions here hit a panel.
 */
export function makeGoldEnv(): THREE.Scene {
	const env = new THREE.Scene();
	const panel = (
		w: number,
		h: number,
		rgb: [number, number, number],
		intensity: number,
		pos: [number, number, number]
	) => {
		const m = new THREE.Mesh(
			new THREE.PlaneGeometry(w, h),
			new THREE.MeshBasicMaterial({
				color: new THREE.Color(...rgb).multiplyScalar(intensity),
				side: THREE.DoubleSide,
			})
		);
		m.position.set(...pos);
		m.lookAt(0, 0, 0);
		env.add(m);
	};
	panel(8, 5, [1.0, 0.84, 0.58], 9, [-4, 5, 4]); // warm key softbox
	panel(10, 6, [1.0, 0.88, 0.62], 4, [0, 8, 2]); // overhead wash
	panel(6, 3, [0.95, 0.74, 0.46], 2.5, [0, 1.5, 8]); // front fill
	panel(0.9, 6, [1.0, 0.92, 0.72], 14, [5, 3, -5]); // hot rim strip
	panel(5, 4, [0.55, 0.58, 0.66], 1.6, [6, 2, 2]); // cool dim fill
	panel(8, 8, [0.62, 0.42, 0.18], 1.4, [0, -3, 0]); // warm floor bounce
	return env;
}

/**
 * Pre-filtered environment texture (PMREM) from the softbox rig. Caller owns
 * the renderer; dispose the returned texture and the PMREMGenerator on teardown.
 */
export function makeEnvironmentTexture(renderer: THREE.WebGLRenderer): THREE.Texture {
	const pmrem = new THREE.PMREMGenerator(renderer);
	const texture = pmrem.fromScene(makeGoldEnv(), 0.02).texture;
	pmrem.dispose();
	return texture;
}
