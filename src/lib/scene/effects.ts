/**
 * effects.ts — the live stage's client-only effect objects: dust, the
 * cracked-floor decal, camera shake, the physical depth-of-field pass, the
 * magnifier loupe, and the bone nudges Sat reacts with. Like materials.ts,
 * this module is dynamic-imported by `LiveStage.svelte` after hydration —
 * never in the SSR / first-paint chunk.
 *
 * Every magnitude here is DRIVEN by the tested maths in `drop.ts` and
 * `optics.ts`; this file only draws. Nothing below decides how big an
 * impact is, how much blur a lens gives, or what magnification the loupe
 * declares.
 */

import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { STANDARD_GRAVITY, dustLifetimeS } from './drop.js';
import { magnifiedFovDeg } from './optics.js';

// ── Dust ────────────────────────────────────────────────────────────────────

const DUST_COUNT = 96;

/**
 * A puff of floor dust kicked out from under the cube's footprint on impact.
 * Speeds scale with √(g·edge) and drag/lifetime with √(edge/g), so a speck's
 * puff and a monolith's billow share one shape at their own timescales.
 */
export class Dust {
	readonly points: THREE.Points;
	private readonly pos: Float32Array;
	private readonly vel: Float32Array;
	private readonly age: Float32Array;
	private readonly life: Float32Array;
	private readonly size0: Float32Array;
	private readonly alpha0: Float32Array;
	private readonly sizeAttr: THREE.BufferAttribute;
	private readonly alphaAttr: THREE.BufferAttribute;
	private readonly material: THREE.ShaderMaterial;
	private active = false;

	constructor() {
		const geo = new THREE.BufferGeometry();
		this.pos = new Float32Array(DUST_COUNT * 3);
		this.vel = new Float32Array(DUST_COUNT * 3);
		this.age = new Float32Array(DUST_COUNT);
		this.life = new Float32Array(DUST_COUNT).fill(1);
		this.size0 = new Float32Array(DUST_COUNT);
		this.alpha0 = new Float32Array(DUST_COUNT);
		geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
		this.sizeAttr = new THREE.BufferAttribute(new Float32Array(DUST_COUNT), 1);
		this.alphaAttr = new THREE.BufferAttribute(new Float32Array(DUST_COUNT), 1);
		geo.setAttribute('aSize', this.sizeAttr);
		geo.setAttribute('aAlpha', this.alphaAttr);
		this.material = new THREE.ShaderMaterial({
			uniforms: {
				uColor: { value: new THREE.Color(0.2, 0.18, 0.155) }, // linear; reads as floor dust after tone mapping
				uFocalPx: { value: 800 },
			},
			vertexShader: /* glsl */ `
				attribute float aSize;
				attribute float aAlpha;
				uniform float uFocalPx;
				varying float vAlpha;
				void main() {
					vec4 mv = modelViewMatrix * vec4(position, 1.0);
					gl_Position = projectionMatrix * mv;
					gl_PointSize = aSize * uFocalPx / max(-mv.z, 1e-4);
					vAlpha = aAlpha;
				}`,
			fragmentShader: /* glsl */ `
				uniform vec3 uColor;
				varying float vAlpha;
				void main() {
					float r = length(gl_PointCoord - 0.5) * 2.0;
					float a = vAlpha * (1.0 - smoothstep(0.25, 1.0, r));
					if (a < 0.003) discard;
					gl_FragColor = vec4(uColor, a);
				}`,
			transparent: true,
			depthWrite: false,
		});
		this.points = new THREE.Points(geo, this.material);
		this.points.frustumCulled = false;
		this.points.visible = false;
	}

	/** Kick a puff out from under a cube of `edge` metres. */
	emit(edge: number, intensity: number): void {
		if (intensity < 0.04) return;
		const half = edge / 2;
		const speed0 = Math.sqrt(STANDARD_GRAVITY * edge) * (0.45 + 1.4 * intensity);
		const life = dustLifetimeS(edge);
		const alpha = Math.min(0.42, 0.08 + 0.4 * intensity);
		for (let i = 0; i < DUST_COUNT; i++) {
			// A point on the footprint's perimeter, pushed outward along the
			// face normal with a little splay.
			const side = i % 4;
			const u = Math.random() * 2 - 1;
			let x = side === 0 ? half : side === 1 ? -half : u * half;
			let z = side === 2 ? half : side === 3 ? -half : u * half;
			let nx = side === 0 ? 1 : side === 1 ? -1 : u * 0.35;
			let nz = side === 2 ? 1 : side === 3 ? -1 : u * 0.35;
			const nl = Math.hypot(nx, nz) || 1;
			nx /= nl;
			nz /= nl;
			const s = speed0 * (0.55 + Math.random() * 0.6);
			const j = i * 3;
			this.pos[j] = x;
			this.pos[j + 1] = edge * 0.02 * Math.random();
			this.pos[j + 2] = z;
			this.vel[j] = nx * s;
			this.vel[j + 1] = s * (0.08 + Math.random() * 0.35);
			this.vel[j + 2] = nz * s;
			this.age[i] = 0;
			this.life[i] = life * (0.55 + Math.random() * 0.45);
			this.size0[i] = edge * (0.12 + Math.random() * 0.22) * (0.6 + intensity);
			this.alpha0[i] = alpha * (0.5 + Math.random() * 0.5);
		}
		this.active = true;
		this.points.visible = true;
	}

	update(dt: number, focalPx: number): void {
		if (!this.active) return;
		this.material.uniforms.uFocalPx.value = focalPx;
		let alive = 0;
		const sizes = this.sizeAttr.array as Float32Array;
		const alphas = this.alphaAttr.array as Float32Array;
		for (let i = 0; i < DUST_COUNT; i++) {
			this.age[i] += dt;
			const k = this.age[i] / this.life[i];
			const j = i * 3;
			if (k >= 1) {
				alphas[i] = 0;
				continue;
			}
			alive++;
			const drag = Math.exp((-dt * 3.2) / this.life[i]);
			this.vel[j] *= drag;
			this.vel[j + 1] = this.vel[j + 1] * drag - STANDARD_GRAVITY * 0.05 * dt;
			this.vel[j + 2] *= drag;
			this.pos[j] += this.vel[j] * dt;
			this.pos[j + 1] = Math.max(this.pos[j + 1] + this.vel[j + 1] * dt, 0);
			this.pos[j + 2] += this.vel[j + 2] * dt;
			sizes[i] = this.size0[i] * (1 + 1.6 * k);
			alphas[i] = this.alpha0[i] * (1 - k) * (1 - k);
		}
		(this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
		this.sizeAttr.needsUpdate = true;
		this.alphaAttr.needsUpdate = true;
		if (!alive) {
			this.active = false;
			this.points.visible = false;
		}
	}

	clear(): void {
		this.active = false;
		this.points.visible = false;
	}

	dispose(): void {
		this.points.geometry.dispose();
		this.material.dispose();
	}
}

// ── Cracked floor ───────────────────────────────────────────────────────────

/** Radial crack pattern around a central footprint, drawn once on a canvas. */
function makeCrackTexture(): THREE.CanvasTexture {
	const S = 1024;
	const c = document.createElement('canvas');
	c.width = c.height = S;
	const ctx = c.getContext('2d')!;
	ctx.clearRect(0, 0, S, S);
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	const mid = S / 2;
	const foot = S / 3.2 / 2; // the cube's half-footprint in texture px (plane = 3.2 edges)
	const branch = (x: number, y: number, ang: number, len: number, w: number, depth: number) => {
		ctx.strokeStyle = `rgba(6, 6, 8, ${0.6 + 0.35 * (w / 7)})`;
		ctx.lineWidth = w;
		ctx.beginPath();
		ctx.moveTo(x, y);
		let px = x;
		let py = y;
		const steps = 6 + Math.floor(Math.random() * 5);
		for (let s = 0; s < steps; s++) {
			ang += (Math.random() - 0.5) * 0.7;
			const l = len / steps;
			px += Math.cos(ang) * l;
			py += Math.sin(ang) * l;
			ctx.lineTo(px, py);
			if (depth < 2 && Math.random() < 0.28) {
				branch(px, py, ang + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6), len * 0.45, w * 0.6, depth + 1);
				ctx.strokeStyle = `rgba(6, 6, 8, ${0.6 + 0.35 * (w / 7)})`;
				ctx.lineWidth = w;
				ctx.beginPath();
				ctx.moveTo(px, py);
			}
		}
		ctx.stroke();
	};
	const n = 16;
	for (let i = 0; i < n; i++) {
		const ang = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
		// Start on the footprint's square edge along this angle.
		const cx = Math.cos(ang);
		const cy = Math.sin(ang);
		const t = foot / Math.max(Math.abs(cx), Math.abs(cy));
		branch(mid + cx * t, mid + cy * t, ang, (S / 2 - foot) * (0.55 + Math.random() * 0.4), 7, 0);
	}
	// A crushed rim hugging the footprint.
	ctx.strokeStyle = 'rgba(6, 6, 8, 0.7)';
	ctx.lineWidth = 8;
	ctx.strokeRect(mid - foot - 3, mid - foot - 3, foot * 2 + 6, foot * 2 + 6);
	const tex = new THREE.CanvasTexture(c);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.anisotropy = 4;
	return tex;
}

/** The floor drawn cracked once the cube's bearing pressure exceeds the
 *  building code's allowance for bedrock (see `exceedsBedrock`). */
export class Crack {
	readonly mesh: THREE.Mesh;
	private readonly material: THREE.MeshBasicMaterial;
	private target = 0;

	constructor() {
		this.material = new THREE.MeshBasicMaterial({
			map: makeCrackTexture(),
			transparent: true,
			depthWrite: false,
			opacity: 0,
			polygonOffset: true,
			polygonOffsetFactor: -2,
			polygonOffsetUnits: -2,
		});
		this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.material);
		this.mesh.visible = false;
		this.mesh.renderOrder = 1;
	}

	/** Snap the decal to a cube of `edge` metres and fade it in. */
	show(edge: number): void {
		this.mesh.scale.setScalar(edge * 3.2);
		this.mesh.position.y = Math.max(edge * 1e-4, 1e-5);
		this.mesh.rotation.y = Math.random() * Math.PI * 2;
		this.target = 1;
		this.mesh.visible = true;
	}

	hide(): void {
		this.target = 0;
	}

	update(dt: number): void {
		const o = this.material.opacity;
		const rate = this.target > o ? 14 : 3;
		this.material.opacity = o + (this.target - o) * (1 - Math.exp(-dt * rate));
		if (this.target === 0 && this.material.opacity < 0.01) {
			this.material.opacity = 0;
			this.mesh.visible = false;
		}
	}

	dispose(): void {
		this.material.map?.dispose();
		this.material.dispose();
		this.mesh.geometry.dispose();
	}
}

// ── Camera shake ────────────────────────────────────────────────────────────

interface Kick {
	t0: number;
	amp: number;
	decay: number;
	freq: number;
	phase: [number, number, number];
}

/**
 * Angular camera shake — pitch/yaw/roll offsets applied after `lookAt`, so a
 * given kick reads the same at every scale. Heavier impacts shake slower.
 */
export class Shaker {
	private kicks: Kick[] = [];

	kick(now: number, amplitudeRad: number, decayS: number, intensity: number): void {
		if (amplitudeRad <= 0) return;
		this.kicks.push({
			t0: now,
			amp: amplitudeRad,
			decay: decayS,
			freq: 22 - 13 * Math.min(Math.max(intensity, 0), 1),
			phase: [Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28],
		});
	}

	sample(now: number, out: { x: number; y: number; z: number }): void {
		out.x = out.y = out.z = 0;
		this.kicks = this.kicks.filter((k) => (now - k.t0) / 1000 < k.decay * 6);
		for (const k of this.kicks) {
			const t = (now - k.t0) / 1000;
			const env = k.amp * Math.exp(-t / k.decay);
			const w = 2 * Math.PI * k.freq * t;
			out.x += env * Math.sin(w + k.phase[0]);
			out.y += env * 0.8 * Math.sin(w * 1.13 + k.phase[1]);
			out.z += env * 0.5 * Math.sin(w * 0.87 + k.phase[2]);
		}
	}

	clear(): void {
		this.kicks = [];
	}
}

// ── Physical depth of field ─────────────────────────────────────────────────

/**
 * Post pass that blurs each pixel by the declared lens's real circle of
 * confusion for its depth (see optics.ts). Gather-style bokeh along a golden
 * spiral (after Gustafsson, "Bokeh depth of field in a single pass"). All
 * blur sizes in the shader are RADII in buffer pixels (half the CoC
 * diameter). Background samples may only reach into a nearer pixel within
 * that pixel's own blur radius — Gustafsson allows 2×, which drew a dark
 * outline around an in-focus Sat against the far backdrop.
 *
 * Reads colour AND depth from the composer's read buffer, so the composer
 * must be built with a render target that carries a DepthTexture.
 */
export class PhysicalDofPass extends Pass {
	readonly material: THREE.ShaderMaterial;
	private readonly fsQuad: FullScreenQuad;

	constructor() {
		super();
		this.material = new THREE.ShaderMaterial({
			uniforms: {
				tColor: { value: null },
				tDepth: { value: null },
				cameraNear: { value: 0.1 },
				cameraFar: { value: 100 },
				focusDist: { value: 1 },
				cocScale: { value: 0 },
				maxBlur: { value: 1 },
				radScale: { value: 1 },
				texel: { value: new THREE.Vector2(1, 1) },
			},
			vertexShader: /* glsl */ `
				varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				}`,
			fragmentShader: /* glsl */ `
				#include <packing>
				uniform sampler2D tColor;
				uniform sampler2D tDepth;
				uniform float cameraNear;
				uniform float cameraFar;
				uniform float focusDist;
				uniform float cocScale; // blur RADIUS (px) of a point at infinity
				uniform float maxBlur;  // radius cap (px)
				uniform float radScale;
				uniform vec2 texel;
				varying vec2 vUv;

				float viewDist(vec2 uv) {
					float z = texture2D(tDepth, uv).x;
					return -perspectiveDepthToViewZ(z, cameraNear, cameraFar);
				}
				float coc(float d) {
					return min(cocScale * abs(d - focusDist) / max(d, 1e-6), maxBlur);
				}

				void main() {
					vec4 base = texture2D(tColor, vUv);
					float cd = viewDist(vUv);
					float cs = coc(cd);
					vec3 col = base.rgb;
					float tot = 1.0;
					// Per-pixel spiral rotation + radial jitter (interleaved gradient
					// noise). With one shared pattern, the handful of taps that land
					// inside a small blur radius hit the same neighbours for every
					// pixel, which rings along edges as a dotted dark/light outline.
					float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
					float radius = radScale * (0.5 + 0.5 * ign);
					float ang = ign * 6.2831853;
					for (int i = 0; i < 80; i++) {
						if (radius >= maxBlur) break;
						vec2 tc = vUv + vec2(cos(ang), sin(ang)) * texel * radius;
						vec3 sc = texture2D(tColor, tc).rgb;
						float sd = viewDist(tc);
						float ss = coc(sd);
						if (sd > cd) ss = min(ss, cs);
						float m = smoothstep(radius - 0.5, radius + 0.5, ss);
						col += mix(col / tot, sc, m);
						tot += 1.0;
						ang += 2.39996323;
						radius += radScale / radius;
					}
					gl_FragColor = vec4(col / tot, base.a);
				}`,
			depthTest: false,
			depthWrite: false,
		});
		this.fsQuad = new FullScreenQuad(this.material);
	}

	/**
	 * Per-frame lens state. `cocDiameterPx` comes from optics.cocScalePx for
	 * the focus distance (the CoC DIAMETER of a point at infinity, in buffer
	 * px); `capDiameterPx` is the legibility cap, also a diameter.
	 */
	setLens(focusDist: number, near: number, far: number, cocDiameterPx: number, capDiameterPx: number, width: number, height: number): void {
		const u = this.material.uniforms;
		const radiusScale = cocDiameterPx / 2;
		u.focusDist.value = focusDist;
		u.cameraNear.value = near;
		u.cameraFar.value = far;
		u.cocScale.value = radiusScale;
		// Nothing in frame can blur more than ~3× the infinity blur unless it
		// sits closer than S/4 — bounding the loop there keeps sharp shots cheap.
		const maxBlur = Math.min(capDiameterPx / 2, Math.max(radiusScale * 3, 1));
		u.maxBlur.value = maxBlur;
		// Spiral step: ~maxBlur²/(2·radScale) taps, ~72 at most; a 0.6 px floor
		// keeps small blur radii densely sampled.
		u.radScale.value = Math.max(0.6, (maxBlur * maxBlur) / 144);
		(u.texel.value as THREE.Vector2).set(1 / width, 1 / height);
		// Under ~a pixel of blur anywhere, skip the pass entirely.
		this.enabled = radiusScale >= 0.75;
	}

	render(
		renderer: THREE.WebGLRenderer,
		writeBuffer: THREE.WebGLRenderTarget,
		readBuffer: THREE.WebGLRenderTarget
	): void {
		const u = this.material.uniforms;
		u.tColor.value = readBuffer.texture;
		u.tDepth.value = readBuffer.depthTexture;
		renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
		this.fsQuad.render(renderer);
	}

	dispose(): void {
		this.material.dispose();
		this.fsQuad.dispose();
	}
}

// ── Magnifier loupe ─────────────────────────────────────────────────────────

/**
 * A circular inset that re-renders the scene through a narrower field of view
 * from the SAME camera position — true optical magnification — aimed at the
 * cube. Drawn after the main frame, straight onto the default framebuffer, so
 * it also lands in recorded clips.
 */
export class Loupe {
	private rt: THREE.WebGLRenderTarget;
	private readonly cam = new THREE.PerspectiveCamera(10, 1, 0.001, 100);
	private readonly quadScene = new THREE.Scene();
	private readonly quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	private readonly quadMat: THREE.ShaderMaterial;

	constructor() {
		this.rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 });
		this.quadMat = new THREE.ShaderMaterial({
			uniforms: {
				tMap: { value: this.rt.texture },
				sizePx: { value: 128 },
				ringColor: { value: new THREE.Color(0xd4a14a) },
			},
			vertexShader: /* glsl */ `
				varying vec2 vUv;
				void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
			fragmentShader: /* glsl */ `
				uniform sampler2D tMap;
				uniform float sizePx;
				uniform vec3 ringColor;
				varying vec2 vUv;
				void main() {
					vec2 p = vUv * 2.0 - 1.0;
					float r = length(p);
					float aa = 3.0 / sizePx;
					if (r > 1.0) discard;
					gl_FragColor = texture2D(tMap, vUv);
					#include <tonemapping_fragment>
					#include <colorspace_fragment>
					float ringW = 4.0 / sizePx;
					float ring = smoothstep(1.0 - ringW - aa, 1.0 - ringW, r);
					// Soft inner vignette — reads as glass, not a hole.
					gl_FragColor.rgb *= 1.0 - 0.35 * smoothstep(0.55, 1.0, r);
					gl_FragColor.rgb = mix(gl_FragColor.rgb, ringColor, ring);
					gl_FragColor.a = 1.0 - smoothstep(1.0 - aa, 1.0, r);
				}`,
			transparent: true,
			depthTest: false,
			depthWrite: false,
		});
		const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.quadMat);
		quad.frustumCulled = false;
		this.quadScene.add(quad);
	}

	/**
	 * Render the loupe. `rect` is in CSS px with y measured from the canvas
	 * BOTTOM (GL viewport convention); `canvasW/H` are the renderer's CSS size.
	 */
	render(
		renderer: THREE.WebGLRenderer,
		scene: THREE.Scene,
		from: THREE.Vector3,
		target: THREE.Vector3,
		magnification: number,
		rect: { x: number; y: number; size: number },
		canvasW: number,
		canvasH: number,
		ringColor: string
	): void {
		const pr = renderer.getPixelRatio();
		const px = Math.max(2, Math.round(rect.size * pr));
		if (this.rt.width !== px) this.rt.setSize(px, px);

		// Declared power is relative to the MAIN view as seen on screen: the
		// loupe's viewport is only `rect.size` px tall against the stage's
		// `canvasH`, so its field of view narrows by that ratio as well — a
		// ×200 loupe shows the cube 200× larger than the stage does, in pixels.
		const d = from.distanceTo(target);
		this.cam.fov = magnifiedFovDeg((magnification * canvasH) / rect.size);
		this.cam.aspect = 1;
		this.cam.near = Math.max(d * 0.05, 1e-6);
		this.cam.far = d * 400;
		this.cam.position.copy(from);
		this.cam.lookAt(target);
		this.cam.updateProjectionMatrix();

		const prevTarget = renderer.getRenderTarget();
		const prevAuto = renderer.autoClear;
		renderer.setRenderTarget(this.rt);
		renderer.clear();
		renderer.render(scene, this.cam);

		renderer.setRenderTarget(null);
		renderer.autoClear = false;
		this.quadMat.uniforms.sizePx.value = px;
		(this.quadMat.uniforms.ringColor.value as THREE.Color).set(ringColor);
		renderer.setViewport(rect.x, rect.y, rect.size, rect.size);
		renderer.setScissor(rect.x, rect.y, rect.size, rect.size);
		renderer.setScissorTest(true);
		renderer.render(this.quadScene, this.quadCam);
		renderer.setScissorTest(false);
		renderer.setViewport(0, 0, canvasW, canvasH);
		renderer.autoClear = prevAuto;
		renderer.setRenderTarget(prevTarget);
	}

	dispose(): void {
		this.rt.dispose();
		this.quadMat.dispose();
	}
}

// ── Sat's reactions — bone nudges in world space ───────────────────────────

const _pw = new THREE.Quaternion();
const _pwInv = new THREE.Quaternion();
const _rot = new THREE.Quaternion();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _axis = new THREE.Vector3();

/**
 * Rotate `bone` (post-mix, like the gaze override) so the direction from it
 * to `child` swings toward the world-space `toward` vector by `amount`
 * radians (never past it). Works from the bones' live world transforms, so
 * it needs no knowledge of the rig's local axis conventions — ears and tail
 * are nudged "up" or "down" in the world, whatever their joints call up.
 */
export function swingBoneToward(
	bone: THREE.Object3D,
	child: THREE.Object3D,
	toward: THREE.Vector3,
	amount: number
): void {
	if (!bone.parent || amount <= 1e-5) return;
	bone.getWorldPosition(_a);
	child.getWorldPosition(_b);
	_dir.subVectors(_b, _a);
	if (_dir.lengthSq() < 1e-12) return;
	_dir.normalize();
	const angle = Math.min(amount, _dir.angleTo(toward));
	if (angle <= 1e-5) return;
	_axis.crossVectors(_dir, toward);
	if (_axis.lengthSq() < 1e-12) return;
	_axis.normalize();
	// World-space rotation R applied to a bone with world W = P·L gives the
	// new local L' = (P⁻¹·R·P)·L.
	_rot.setFromAxisAngle(_axis, angle);
	bone.parent.getWorldQuaternion(_pw);
	_pwInv.copy(_pw).invert();
	_rot.premultiply(_pwInv).multiply(_pw);
	bone.quaternion.premultiply(_rot);
}
