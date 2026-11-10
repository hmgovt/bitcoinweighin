/**
 * The Moon ride's scene (maths in `../moonRide.ts`): the Cash tab's notes
 * restacked as one column, and a camera ride up it.
 *
 * Two passes, because the ride spans nine orders of magnitude:
 *  - the near pass is the stage's own scene, in metres: the column (drawn
 *    as a segment around the camera — a box reaching 194,000 km would put
 *    vertices so far out that float32 can't place a 66 mm column near the
 *    camera), Sat, the studio floor, and true-scale silhouettes of tall
 *    things for the lower decades;
 *  - the far pass, in kilometres: the Earth (painted from the site's own
 *    world-110m map), its atmosphere, the Moon, stars, and in the closing
 *    view the stack drawn as a line with the markers ticked beside it.
 * The far pass is drawn first, the depth buffer cleared, then the near.
 */
import type * as THREE from 'three';
import {
	RIDE_MARKERS,
	RIDE_START_M,
	MOON_M,
	rideTiming,
	climbAltitude,
	endViewTopM,
	markerPassed,
	type RideMarker,
} from '../moonRide.js';
import { FOV_DEG, AZIMUTH_RAD } from './maths.js';

type V3 = { x: number; y: number; z: number };

const EARTH_R_KM = 6371;
const MOON_R_KM = 1737.4;
/** Where the column stands on the globe: New York, 40.7° N 74.0° W. */
const SITE = { lat: 40.7, lon: -74.0 };
/** Camera distance from the column's axis while climbing, m. */
const CLIMB_OFF_M = 0.8;
/** The climb looks this far right of the column, so it sits left of centre. */
const LOOK_RIGHT_RAD = (12 * Math.PI) / 180;
const HALF_FOV = ((FOV_DEG / 2) * Math.PI) / 180;

export type RidePhase = 'lift' | 'climb' | 'crest' | 'pull' | 'done';

export interface RideLabel {
	text: string;
	x: number;
	y: number;
	kind: 'stack' | 'marker' | 'next' | 'body';
	/** For `body`: the ring's radius, px. */
	r?: number;
}

export interface RideState {
	phase: RidePhase;
	/** Camera altitude, m. */
	altM: number;
	/** How much of the stack is below the camera, m. */
	belowM: number;
	passed: RideMarker | null;
	/** Screen-space labels for the closing view (px from the stage's top-left). */
	labels: RideLabel[];
}

export interface MoonRide {
	readonly active: boolean;
	start(heightM: number, from: { pos: V3; aim: V3 }, reduced: boolean): void;
	/** Stand Sat at the column's foot (he may finish loading mid-ride). */
	placeDog(): void;
	/** Jump to `t` seconds into the ride (tests and reduced motion). */
	seek(t: number): void;
	update(dt: number, width: number, height: number): RideState;
	render(): void;
	stop(): void;
	dispose(): void;
}

export interface RideDeps {
	renderer: THREE.WebGLRenderer;
	scene: THREE.Scene;
	camera: THREE.PerspectiveCamera;
	column: { materials: THREE.Material[]; span(bottomM: number, lengthM: number): void };
	noteW: number;
	noteL: number;
	/** Hidden for the ride (the pile). */
	hide: () => THREE.Object3D[];
	/** The studio floor, faded out as the Earth takes over. */
	ground: THREE.Mesh;
	dog: () => THREE.Object3D | null;
	/** Formats a length for the closing view's labels (the page's unit system). */
	formatLength: (m: number) => string;
}

const smooth = (a: number, b: number, x: number) => {
	const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
};
/** smoothstep over log10(x). */
const logSmooth = (a: number, b: number, x: number) => smooth(Math.log10(a), Math.log10(b), Math.log10(Math.max(x, 1e-9)));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Silhouettes of tall things, unit height, x in units of height. */
const SHAPES: Record<string, number[][]> = {
	liberty: [
		[-0.3, 0], [0.3, 0], [0.24, 0.1], [0.15, 0.11], [0.14, 0.48], [0.085, 0.49], [0.075, 0.6],
		[0.06, 0.74], [0.055, 0.82], [0.07, 0.84], [0.075, 0.96], [0.095, 0.985], [0.08, 1], [0.06, 0.985],
		[0.065, 0.96], [0.055, 0.86], [0.035, 0.86], [0.03, 0.885], [0, 0.9], [-0.03, 0.885], [-0.035, 0.86],
		[-0.055, 0.83], [-0.07, 0.76], [-0.08, 0.7], [-0.075, 0.6], [-0.085, 0.49], [-0.14, 0.48],
		[-0.15, 0.11], [-0.24, 0.1],
	],
	eiffel: [
		[-0.19, 0], [-0.12, 0], [-0.07, 0.07], [0, 0.095], [0.07, 0.07], [0.12, 0], [0.19, 0], [0.11, 0.17],
		[0.125, 0.18], [0.115, 0.19], [0.06, 0.36], [0.07, 0.37], [0.06, 0.38], [0.02, 0.84], [0.025, 0.86],
		[0.01, 0.9], [0.004, 1], [-0.004, 1], [-0.01, 0.9], [-0.025, 0.86], [-0.02, 0.84], [-0.06, 0.38],
		[-0.07, 0.37], [-0.06, 0.36], [-0.115, 0.19], [-0.125, 0.18], [-0.11, 0.17],
	],
	burj: [
		[-0.07, 0], [0.07, 0], [0.065, 0.2], [0.05, 0.21], [0.048, 0.4], [0.036, 0.41], [0.034, 0.55],
		[0.025, 0.56], [0.023, 0.67], [0.015, 0.68], [0.013, 0.76], [0.007, 0.77], [0.005, 0.86],
		[0.0015, 1], [-0.0015, 1], [-0.004, 0.88], [-0.01, 0.8], [-0.012, 0.73], [-0.02, 0.72],
		[-0.022, 0.62], [-0.032, 0.61], [-0.034, 0.47], [-0.045, 0.46], [-0.047, 0.3], [-0.06, 0.29],
		[-0.062, 0.14],
	],
	everest: [
		[-1.6, 0], [-1.35, 0.3], [-1.2, 0.26], [-1.02, 0.5], [-0.86, 0.44], [-0.7, 0.66], [-0.55, 0.6],
		[-0.4, 0.78], [-0.26, 0.74], [-0.12, 0.9], [0, 1], [0.08, 0.95], [0.18, 0.86], [0.3, 0.96],
		[0.4, 0.84], [0.55, 0.78], [0.7, 0.6], [0.85, 0.68], [1.0, 0.5], [1.2, 0.54], [1.4, 0.3], [1.6, 0],
	],
};

/** Where each silhouette stands: its marker, distance from the column (m)
 *  and bearing right of the line from the camera to the column. */
const SILHOUETTES: { id: string; marker: string; distM: number; bearingDeg: number }[] = [
	{ id: 'liberty', marker: 'liberty', distM: 230, bearingDeg: 30 },
	{ id: 'eiffel', marker: 'eiffel', distM: 820, bearingDeg: 4 },
	{ id: 'burj', marker: 'burj', distM: 2_100, bearingDeg: 26 },
	{ id: 'everest', marker: 'everest', distM: 30_000, bearingDeg: 14 },
];

function earthTexture(three: typeof THREE): { tex: THREE.CanvasTexture; paint: () => Promise<void> } {
	const c = document.createElement('canvas');
	c.width = 2048;
	c.height = 1024;
	const g = c.getContext('2d')!;
	const ocean = () => {
		const grad = g.createLinearGradient(0, 0, 0, c.height);
		grad.addColorStop(0, '#16324f');
		grad.addColorStop(0.5, '#0f3a63');
		grad.addColorStop(1, '#16324f');
		g.fillStyle = grad;
		g.fillRect(0, 0, c.width, c.height);
	};
	ocean();
	const tex = new three.CanvasTexture(c);
	tex.colorSpace = three.SRGBColorSpace;
	tex.anisotropy = 4;
	return {
		tex,
		async paint() {
			const [{ geoEquirectangular, geoPath }, { feature }] = await Promise.all([
				import('d3-geo'),
				import('topojson-client'),
			]);
			const topo = await (await fetch('/world-110m.json')).json();
			const land = feature(topo, topo.objects.land);
			const proj = geoEquirectangular()
				.scale(c.width / (2 * Math.PI))
				.translate([c.width / 2, c.height / 2]);
			// Land on its own layer, so the arid belts and ice tint only land.
			const lc = document.createElement('canvas');
			lc.width = c.width;
			lc.height = c.height;
			const lg = lc.getContext('2d')!;
			const path = geoPath(proj, lg);
			lg.beginPath();
			path(land as Parameters<typeof path>[0]);
			lg.fillStyle = '#5b6f45';
			lg.fill();
			lg.globalCompositeOperation = 'source-atop';
			const band = (lat0: number, lat1: number, color: string) => {
				const y0 = ((90 - lat1) / 180) * c.height;
				const y1 = ((90 - lat0) / 180) * c.height;
				lg.fillStyle = color;
				lg.fillRect(0, y0, c.width, y1 - y0);
			};
			band(15, 33, 'rgba(176,150,98,0.75)');
			band(-32, -18, 'rgba(176,150,98,0.55)');
			band(60, 90, 'rgba(200,205,200,0.5)');
			band(-90, -62, '#e4ebee');
			band(72, 90, '#e4ebee');
			ocean();
			g.drawImage(lc, 0, 0);
			tex.needsUpdate = true;
		},
	};
}

function moonTexture(three: typeof THREE): THREE.CanvasTexture {
	const c = document.createElement('canvas');
	c.width = 1024;
	c.height = 512;
	const g = c.getContext('2d')!;
	g.fillStyle = '#9a9a95';
	g.fillRect(0, 0, c.width, c.height);
	let s = 11;
	const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
	for (let i = 0; i < 14; i++) {
		g.fillStyle = `rgba(80,80,78,${0.35 + rnd() * 0.3})`;
		g.beginPath();
		g.ellipse(rnd() * c.width, 120 + rnd() * 280, 40 + rnd() * 110, 25 + rnd() * 70, rnd() * 3, 0, Math.PI * 2);
		g.fill();
	}
	for (let i = 0; i < 260; i++) {
		const x = rnd() * c.width;
		const y = rnd() * c.height;
		const r = 2 + Math.pow(rnd(), 3) * 26;
		g.strokeStyle = 'rgba(210,210,205,0.35)';
		g.lineWidth = Math.max(1, r * 0.2);
		g.beginPath();
		g.arc(x, y, r, 0, Math.PI * 2);
		g.stroke();
		g.fillStyle = 'rgba(60,60,58,0.25)';
		g.beginPath();
		g.arc(x + r * 0.15, y + r * 0.15, r * 0.8, 0, Math.PI * 2);
		g.fill();
	}
	const tex = new three.CanvasTexture(c);
	tex.colorSpace = three.SRGBColorSpace;
	return tex;
}

export function createMoonRide(three: typeof THREE, deps: RideDeps): MoonRide {
	const { renderer, scene, camera } = deps;
	const owned: { dispose(): void }[] = [];
	const own = <X extends { dispose(): void }>(x: X): X => {
		owned.push(x);
		return x;
	};

	// ── Near pass (metres): the column, silhouettes ─────────────────────
	const near = new three.Group();
	near.visible = false;
	scene.add(near);

	const column = new three.Mesh(own(new three.BoxGeometry(deps.noteW, 1, deps.noteL)), deps.column.materials);
	column.rotation.y = -Math.PI / 2; // across the frame, as the pile lies
	column.frustumCulled = false;
	near.add(column);

	// The climb's view line, from the camera's side of the column.
	const toAxis = new three.Vector3(-Math.sin(AZIMUTH_RAD), 0, -Math.cos(AZIMUTH_RAD));
	const right = new three.Vector3(-toAxis.z, 0, toAxis.x);
	const silMat = own(
		new three.MeshBasicMaterial({
			color: 0x34343c,
			transparent: true,
			fog: false,
			side: three.DoubleSide,
			toneMapped: false,
		})
	);
	const silhouettes: THREE.Mesh[] = [];
	for (const s of SILHOUETTES) {
		const marker = RIDE_MARKERS.find((m) => m.id === s.marker)!;
		const shape = new three.Shape(SHAPES[s.id].map(([x, y]) => new three.Vector2(x, y)));
		const geo = own(new three.ShapeGeometry(shape));
		geo.scale(marker.metres, marker.metres, 1);
		const mesh = new three.Mesh(geo, silMat);
		const b = (s.bearingDeg * Math.PI) / 180;
		const dir = toAxis.clone().multiplyScalar(Math.cos(b)).addScaledVector(right, Math.sin(b));
		mesh.position.set(dir.x * s.distM, 0, dir.z * s.distM);
		mesh.lookAt(0, 0, 0);
		mesh.userData.metres = marker.metres;
		silhouettes.push(mesh);
		near.add(mesh);
	}

	// ── Far pass (kilometres): Earth, Moon, stars, the closing diagram ───
	const far = new three.Scene();
	const farCam = new three.PerspectiveCamera(FOV_DEG, 1, 0.001, 1e6);
	const sun = new three.DirectionalLight(0xfff4e6, 2.6);
	sun.position.set(-0.55, 0.7, 0.45);
	far.add(sun, new three.AmbientLight(0x8090a0, 0.06));

	const earthTex = earthTexture(three);
	own(earthTex.tex);
	const earthMat = own(new three.MeshStandardMaterial({ map: earthTex.tex, roughness: 0.92, metalness: 0 }));
	const earth = new three.Mesh(own(new three.SphereGeometry(EARTH_R_KM, 160, 80)), earthMat);
	earth.position.set(0, -EARTH_R_KM, 0);
	{
		// Turn the site to the top of the globe.
		const lat = (SITE.lat * Math.PI) / 180;
		const phi = ((SITE.lon + 180) * Math.PI) / 180;
		const theta = Math.PI / 2 - lat;
		const p = new three.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
		earth.quaternion.setFromUnitVectors(p, new three.Vector3(0, 1, 0));
	}
	far.add(earth);

	const atmoMat = own(
		new three.ShaderMaterial({
			uniforms: { color: { value: new three.Color(0x7fb2ff) }, strength: { value: 0 } },
			vertexShader: `varying vec3 vN; varying vec3 vV;
				void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);
				vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
				gl_Position = projectionMatrix * mv; }`,
			fragmentShader: `uniform vec3 color; uniform float strength; varying vec3 vN; varying vec3 vV;
				void main(){ float f = pow(1.0 - max(dot(vN, vV), 0.0), 4.0);
				gl_FragColor = vec4(color * f * strength, 1.0); }`,
			transparent: true,
			blending: three.AdditiveBlending,
			depthWrite: false,
		})
	);
	const atmo = new three.Mesh(own(new three.SphereGeometry(EARTH_R_KM * 1.012, 128, 64)), atmoMat);
	atmo.position.copy(earth.position);
	far.add(atmo);

	const moonTex = own(moonTexture(three));
	const moon = new three.Mesh(
		own(new three.SphereGeometry(MOON_R_KM, 96, 48)),
		own(new three.MeshStandardMaterial({ map: moonTex, roughness: 1, metalness: 0 }))
	);
	// Its near side where the readout has always measured "the way to the Moon".
	moon.position.set(0, MOON_M / 1000 + MOON_R_KM, 0);
	far.add(moon);

	const starGeo = own(new three.BufferGeometry());
	{
		const n = 2400;
		const pos = new Float32Array(n * 3);
		const col = new Float32Array(n * 3);
		let s = 7;
		const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
		for (let i = 0; i < n; i++) {
			const u = rnd() * 2 - 1;
			const a = rnd() * Math.PI * 2;
			const r = Math.sqrt(1 - u * u);
			pos.set([r * Math.cos(a) * 9e5, u * 9e5, r * Math.sin(a) * 9e5], i * 3);
			const b = 0.35 + Math.pow(rnd(), 3) * 0.65;
			col.set([b, b, b * (0.9 + rnd() * 0.15)], i * 3);
		}
		starGeo.setAttribute('position', new three.BufferAttribute(pos, 3));
		starGeo.setAttribute('color', new three.BufferAttribute(col, 3));
	}
	const starMat = own(
		new three.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false })
	);
	const stars = new three.Points(starGeo, starMat);
	stars.renderOrder = -1;
	stars.frustumCulled = false;
	far.add(stars);

	// The closing diagram: the stack as a line, markers ticked beside it.
	const diagram = new three.Group();
	far.add(diagram);
	const unitBox = own(new three.BoxGeometry(1, 1, 1));
	const flat = (color: number) =>
		own(new three.MeshBasicMaterial({ color, transparent: true, depthTest: false, toneMapped: false }));
	const lineMat = flat(0xe8e6d8);
	const tickMat = flat(0x8a8a94);
	const nextMat = flat(0xf7931a);
	const stackLine = new three.Mesh(unitBox, lineMat);
	stackLine.renderOrder = 10;
	diagram.add(stackLine);
	const ticks = RIDE_MARKERS.map((m) => {
		const t = new three.Mesh(unitBox, tickMat);
		t.renderOrder = 10;
		t.userData.marker = m;
		diagram.add(t);
		return t;
	});
	const topTick = new three.Mesh(unitBox, nextMat);
	topTick.renderOrder = 11;
	diagram.add(topTick);

	// ── Ride state ──────────────────────────────────────────────────────
	let active = false;
	let H = 0;
	let t = 0;
	let timing = rideTiming(10);
	let total = 0;
	let reduced = false;
	const fromPos = new three.Vector3();
	const fromAim = new three.Vector3();
	const camPos = new three.Vector3();
	const camAim = new three.Vector3();
	let saved: {
		background: THREE.Scene['background'];
		fog: THREE.Scene['fog'];
		hidden: THREE.Object3D[];
		dog: V3 | null;
		dogRotY: number;
		groundOpacity: number;
		groundTransparent: boolean;
	} | null = null;
	let painted = false;
	const sky = new three.Color();
	const STUDIO = new three.Color(0x18181b);
	const SPACE = new three.Color(0x010103);

	let lookRight = LOOK_RIGHT_RAD;
	let climbOff = CLIMB_OFF_M;

	/** Camera pose while climbing at altitude `alt`. */
	function climbPose(alt: number, pos: THREE.Vector3, aim: THREE.Vector3): void {
		const off = lerp(1.35, climbOff, smooth(RIDE_START_M, 6, alt));
		pos.set(-toAxis.x * off, alt, -toAxis.z * off);
		// Level-ish below the clouds, looking a touch down; from space, down
		// far enough to keep the Earth's limb in the lower third of the frame.
		const dip = Math.acos(EARTH_R_KM / (EARTH_R_KM + alt / 1000));
		const low = lerp(-0.26, -0.1, smooth(RIDE_START_M, 4, alt));
		const pitch = Math.min(low, -dip + 0.1);
		const heading = toAxis.clone().multiplyScalar(Math.cos(lookRight)).addScaledVector(right, Math.sin(lookRight));
		aim.set(
			pos.x + heading.x * Math.cos(pitch),
			pos.y + Math.sin(pitch),
			pos.z + heading.z * Math.cos(pitch)
		);
	}

	/** Just over the top note, looking down at it. */
	function crestPose(pos: THREE.Vector3, aim: THREE.Vector3): void {
		pos.set(-toAxis.x * 0.3, H + 0.2, -toAxis.z * 0.3);
		aim.set(0, H, 0);
	}

	/** The closing view: the whole stack side-on (see `endViewTopM`). The
	 *  summary card sits bottom-left on a wide stage and across the bottom
	 *  of a narrow one, so the stack stands right of centre on the first
	 *  and in the upper part of the frame on the second. */
	function endView(aspect: number): { pos: THREE.Vector3; aim: THREE.Vector3; dist: number } {
		const top = endViewTopM(H);
		const narrow = aspect < 1.1;
		let bottom = top > 20 * EARTH_R_KM * 1000 ? -2.4 * EARTH_R_KM * 1000 : 0;
		bottom -= (top - bottom) * (narrow ? 0.75 : 0.06);
		const half = (top - bottom) / 2;
		const dist = (half / Math.tan(HALF_FOV)) * 1.08;
		const halfW = dist * Math.tan(HALF_FOV) * aspect;
		// Screen-x of the stack: right of centre when wide, left when narrow.
		const shift = halfW * (narrow ? 0.62 : -0.12);
		const aim = new three.Vector3(0, bottom + half, 0).addScaledVector(right, shift);
		const pos = aim.clone().addScaledVector(toAxis, -dist);
		return { pos, aim, dist };
	}

	function place(aspect: number): RidePhase {
		const t1 = timing.liftS;
		const t2 = t1 + timing.climbS;
		const t3 = t2 + timing.crestS;
		const t4 = t3 + timing.pullS;
		const p = new three.Vector3();
		const a = new three.Vector3();
		if (t < t1) {
			climbPose(RIDE_START_M, p, a);
			const k = smooth(0, t1, t);
			camPos.lerpVectors(fromPos, p, k);
			camAim.lerpVectors(fromAim, a, k);
			return 'lift';
		}
		if (t < t2) {
			climbPose(climbAltitude((t - t1) / timing.climbS, H), camPos, camAim);
			return 'climb';
		}
		if (t < t3) {
			climbPose(H, p, a);
			const q = new three.Vector3();
			const b = new three.Vector3();
			crestPose(q, b);
			const k = smooth(t2, t3, t);
			camPos.lerpVectors(p, q, k);
			camAim.lerpVectors(a, b, k);
			return 'crest';
		}
		crestPose(p, a);
		const end = endView(aspect);
		const k = smooth(t3, t4, t);
		// Distance moves in log space, so the pull-back covers metres and
		// megametres at the same visual pace; the aim's offset from the top
		// grows with it, keeping the top put on screen as the view widens.
		const d0 = p.distanceTo(a);
		const d = Math.exp(lerp(Math.log(d0), Math.log(end.dist), k));
		const f = (d - d0) / Math.max(end.dist - d0, 1e-9);
		camAim.copy(a).addScaledVector(end.aim.clone().sub(a), f);
		const dir0 = p.clone().sub(a).normalize();
		const dir1 = end.pos.clone().sub(end.aim).normalize();
		const dir = dir0.lerp(dir1, k).normalize();
		camPos.copy(camAim).addScaledVector(dir, d);
		return t < t4 ? 'pull' : 'done';
	}

	function start(heightM: number, from: { pos: V3; aim: V3 }, isReduced: boolean): void {
		H = heightM;
		timing = rideTiming(H);
		total = timing.liftS + timing.climbS + timing.crestS + timing.pullS;
		reduced = isReduced;
		t = reduced ? total : 0;
		fromPos.set(from.pos.x, from.pos.y, from.pos.z);
		fromAim.set(from.aim.x, from.aim.y, from.aim.z);
		if (!active) {
			const hidden = deps.hide().filter((o) => o.visible);
			for (const o of hidden) o.visible = false;
			const dog = deps.dog();
			const gm = deps.ground.material as THREE.MeshStandardMaterial;
			saved = {
				background: scene.background,
				fog: scene.fog,
				hidden,
				dog: dog ? { x: dog.position.x, y: dog.position.y, z: dog.position.z } : null,
				dogRotY: dog ? dog.rotation.y : 0,
				groundOpacity: gm.opacity,
				groundTransparent: gm.transparent,
			};
			gm.transparent = true;
			scene.background = null;
			scene.fog = null;
			placeDog();
		}
		active = true;
		near.visible = true;
		if (!painted) {
			painted = true;
			void earthTex.paint().catch(() => {});
		}
	}

	function placeDog(): void {
		const dog = deps.dog();
		if (!dog) return;
		// Beside the column's foot, facing it.
		dog.position.set(right.x * 0.42 - toAxis.x * 0.1, 0, right.z * 0.42 - toAxis.z * 0.1);
		dog.rotation.y = Math.atan2(-dog.position.x, -dog.position.z);
	}

	function stop(): void {
		if (!active) return;
		active = false;
		near.visible = false;
		renderer.autoClear = true;
		if (saved) {
			scene.background = saved.background;
			scene.fog = saved.fog;
			for (const o of saved.hidden) o.visible = true;
			const dog = deps.dog();
			if (dog && saved.dog) {
				dog.position.set(saved.dog.x, saved.dog.y, saved.dog.z);
				dog.rotation.y = saved.dogRotY;
			}
			const gm = deps.ground.material as THREE.MeshStandardMaterial;
			gm.opacity = saved.groundOpacity;
			gm.transparent = saved.groundTransparent;
			deps.ground.visible = true;
			saved = null;
		}
	}

	const project = new three.Vector3();

	function update(dt: number, width: number, height: number): RideState {
		const aspect = height > 0 ? width / height : 1;
		// A phone's frame is narrow: keep the column nearer the middle.
		lookRight = aspect < 1.1 ? LOOK_RIGHT_RAD * 0.4 : LOOK_RIGHT_RAD;
		climbOff = aspect < 1.1 ? 1.3 : CLIMB_OFF_M;
		if (!reduced) t = Math.min(total, t + dt);
		const phase = place(aspect);
		const alt = Math.max(camPos.y, 0);
		const pulling = phase === 'pull' || phase === 'done';
		const pullK = pulling ? smooth(0.15, 0.8, (t - (total - timing.pullS)) / timing.pullS) : 0;

		// Near camera: tight near plane on the climb, loosening with distance.
		camera.position.copy(camPos);
		camera.lookAt(camAim);
		const axisDist = Math.hypot(camPos.x, camPos.z);
		camera.near = Math.max(0.01, axisDist * 0.02);
		camera.far = Math.max(1e5, axisDist * 40);
		camera.updateProjectionMatrix();

		// The column, as a segment around the camera.
		const reach = Math.max(1, axisDist);
		const bottom = Math.max(0, alt - 40 * reach);
		const topSeg = Math.min(H, alt + 800 * reach);
		const len = Math.max(topSeg - bottom, 1e-4);
		column.scale.y = len;
		column.position.y = bottom + len / 2;
		deps.column.span(bottom, len);
		// Its true width on screen; below ~2 px the diagram's line stands in.
		const colPx = (deps.noteW / (2 * reach * Math.tan(HALF_FOV))) * height;
		column.visible = colPx > 1.2;

		// Studio floor gives way to the Earth; silhouettes leave for the diagram.
		const gm = deps.ground.material as THREE.MeshStandardMaterial;
		// (It also leaves as the pull-back starts: the near pass is drawn over
		// the far one, and the diagram is in the far one.)
		gm.opacity = (1 - logSmooth(2_500, 12_000, alt)) * (1 - pullK);
		deps.ground.visible = gm.opacity > 0.01;
		silMat.opacity = 1 - pullK;
		for (const s of silhouettes) s.visible = silMat.opacity > 0.01;

		// Far camera, same orientation, kilometres.
		farCam.position.copy(camPos).multiplyScalar(0.001);
		farCam.quaternion.copy(camera.quaternion);
		farCam.aspect = aspect;
		const dEarth = farCam.position.distanceTo(earth.position) - EARTH_R_KM;
		const dMoon = farCam.position.distanceTo(moon.position) - MOON_R_KM;
		const dAim = camPos.distanceTo(camAim) * 0.001; // the diagram stands here
		farCam.near = Math.max(1e-6, Math.min(dEarth, dMoon, dAim) * 0.3);
		farCam.far = farCam.position.length() + 1.2e6; // stars sit 900,000 km out
		farCam.updateProjectionMatrix();
		stars.position.copy(farCam.position);

		// Sky: the studio's dark grey to black by the edge of space.
		const space = logSmooth(8_000, 100_000, alt);
		sky.copy(STUDIO).lerp(SPACE, space);
		renderer.setClearColor(sky, 1);
		starMat.opacity = logSmooth(20_000, 120_000, alt);
		atmoMat.uniforms.strength.value = 0.75 * logSmooth(60_000, 600_000, alt);
		// Near the ground the map is far too coarse to show: keep it dark,
		// like the studio floor, until there's a planet to see.
		const planet = logSmooth(8_000, 150_000, alt);
		earthMat.color.setScalar(lerp(0.12, 1, planet));

		// Closing diagram.
		const labels: RideLabel[] = [];
		// The line takes over the moment the true column is too thin to see.
		const lineOn = pulling ? 1 - smooth(1.2, 2.5, colPx) : 0;
		const markOn = pullK;
		diagram.visible = pulling;
		if (diagram.visible) {
			const top = endViewTopM(H) / 1000;
			const pxKm = (2 * camPos.distanceTo(camAim) * 0.001 * Math.tan(HALF_FOV)) / height;
			const hKm = H / 1000;
			lineMat.opacity = lineOn;
			stackLine.visible = lineOn > 0.01;
			stackLine.scale.set(pxKm * 2, hKm, pxKm * 2);
			stackLine.position.set(0, hKm / 2, 0);
			// Ticks run toward the labels (screen right).
			const tickLen = pxKm * 34;
			diagram.rotation.y = Math.atan2(-right.z, right.x);
			const toScreen = (x: number, y: number) => {
				project.set(x, y, 0).applyMatrix4(diagram.matrixWorld).project(farCam);
				return { x: ((project.x + 1) / 2) * width, y: ((1 - project.y) / 2) * height };
			};
			diagram.updateMatrixWorld(true);
			tickMat.opacity = markOn;
			nextMat.opacity = markOn;
			const baseY = toScreen(0, 0).y;
			let lastY = Infinity;
			// Top down, so crowded low markers give way to the higher ones.
			for (let i = ticks.length - 1; i >= 0; i--) {
				const tk = ticks[i];
				const m = tk.userData.marker as RideMarker;
				const mKm = m.metres / 1000;
				const show = mKm <= top && m.id !== 'moon';
				const sp = toScreen(tickLen, mKm);
				const clear =
					Math.abs(sp.y - lastY) > 16 &&
					Math.abs(sp.y - toScreen(tickLen, hKm).y) > 16 &&
					baseY - sp.y > 18;
				tk.visible = show && clear;
				if (!tk.visible) continue;
				tk.scale.set(tickLen, pxKm * 1.2, pxKm * 1.2);
				tk.position.set(tickLen / 2 + pxKm * 3, mKm, 0);
				labels.push({ text: `${capital(m.label)} · ${deps.formatLength(m.metres)}`, x: sp.x + 6, y: sp.y, kind: 'marker' });
				lastY = sp.y;
			}
			topTick.scale.set(tickLen * 1.3, pxKm * 1.6, pxKm * 1.6);
			topTick.position.set((tickLen * 1.3) / 2 + pxKm * 3, hKm, 0);
			const st = toScreen(tickLen * 1.3, hKm);
			labels.push({ text: `Your stack · ${deps.formatLength(H)}`, x: st.x + 6, y: st.y, kind: 'stack' });
			// At this scale the Earth and the Moon are a few pixels across —
			// true size, so ring them to be found.
			const ringBody = (body: THREE.Mesh, rKm: number, text: string) => {
				project.copy(body.position).project(farCam);
				if (project.z > 1) return;
				const rPx = rKm / pxKm;
				if (rPx > 30) return;
				labels.push({
					text,
					x: ((project.x + 1) / 2) * width,
					y: ((1 - project.y) / 2) * height,
					kind: 'body',
					r: Math.max(rPx, 3) + 6,
				});
			};
			if (top * 1000 >= MOON_M) ringBody(moon, MOON_R_KM, 'The Moon');
			if (hKm > 20 * EARTH_R_KM) ringBody(earth, EARTH_R_KM, 'Earth');
			// While he's big enough to see, Sat is the scale bar at the foot.
			const dog = deps.dog();
			if (dog && H < 300) {
				project.set(dog.position.x, 0.56, dog.position.z).project(camera);
				const px = ((project.x + 1) / 2) * width;
				const py = ((1 - project.y) / 2) * height;
				if (project.z < 1 && py > 0 && py < height)
					labels.push({ text: `Sat · ${deps.formatLength(0.52)}`, x: px + 10, y: py - 8, kind: 'marker' });
			}
		}

		return {
			phase,
			altM: alt,
			belowM: Math.min(alt, H),
			passed: phase === 'climb' || phase === 'crest' ? markerPassed(Math.min(alt, H)) : null,
			labels,
		};
	}

	function render(): void {
		renderer.autoClear = false;
		renderer.clear();
		renderer.render(far, farCam);
		renderer.clearDepth();
		renderer.render(scene, camera);
	}

	return {
		get active() {
			return active;
		},
		start,
		placeDog,
		seek(s: number) {
			t = Math.min(total, Math.max(0, s));
		},
		update,
		render,
		stop,
		dispose() {
			stop();
			scene.remove(near);
			for (const m of deps.column.materials.filter((m, i) => i !== 2 && i !== 3)) {
				(m as THREE.MeshStandardMaterial).map?.dispose();
				m.dispose();
			}
			for (const o of owned) o.dispose();
		},
	};
}

function capital(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}
