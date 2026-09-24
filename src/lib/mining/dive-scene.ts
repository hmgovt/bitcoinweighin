/**
 * The /mining dive: hashboard → one chip → the package taken apart → the die
 * turned over → into one core. A three.js scene lit per docs/3d-visual-direction.md
 * (large soft key, subtle rim, very low fill, strong contact shadows).
 *
 * Dimensions are illustrative (Bitmain publishes no datasheets); the layer
 * stack follows flip-chip packaging, which teardown analysis shows recent
 * Bitmain chips use. The die face shares its floorplan with the 2D silicon view.
 */
import * as THREE from 'three';
import { dieLayout, type NRect } from './die-layout.js';
import { clamp01, ease, lerp, mulberry } from './palette.js';

export interface DiveOptions {
	stage: HTMLElement;
	canvas: HTMLCanvasElement;
	labels: HTMLElement;
	fade: HTMLElement;
	reduced: boolean;
	/** Live data for the die face glow. */
	live: () => { activity: number; clock: number; pulse: number };
	/** Fires whenever the step changes (instant = no animation, e.g. a reset). */
	onBeat: (i: number, instant: boolean) => void;
	/** The dive reached the core — hand over to the 2D view. */
	onHandoff: () => void;
}

export interface DiveController {
	goToBeat(i: number, instant?: boolean): void;
	readonly beat: number;
	destroy(): void;
}

interface Cam { tx: number; ty: number; tz: number; r: number; az: number; el: number; e: number; f: number }

const STATE = [{ e: 0, f: 0 }, { e: 0, f: 0 }, { e: 1, f: 0 }, { e: 1, f: 1 }, { e: 1, f: 1 }];

export function createDiveScene(o: DiveOptions): DiveController {
	const { stage, canvas } = o;
	const T = THREE;
	const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
	const narrow = stage.clientWidth < 640;
	renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
	renderer.outputColorSpace = T.SRGBColorSpace;
	renderer.toneMapping = T.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.05;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = T.PCFSoftShadowMap;
	const aniso = renderer.capabilities.getMaxAnisotropy();
	const disposables: { dispose(): void }[] = [];
	const track = <X extends { dispose(): void }>(x: X): X => { disposables.push(x); return x; };

	const BG = 0x0e0e11;
	const scene = new T.Scene();
	scene.background = new T.Color(BG);
	scene.fog = new T.Fog(BG, 125, 270);
	const camera = new T.PerspectiveCamera(28, 1, 0.05, 600);
	const V = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
	const mk = (w: number, h: number) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; };
	const ctex = (cv: HTMLCanvasElement, srgb = true) => {
		const t = track(new T.CanvasTexture(cv));
		if (srgb) t.colorSpace = T.SRGBColorSpace;
		t.anisotropy = aniso;
		return t;
	};
	const Y_AXIS = V(0, 1, 0);
	const mtx = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, ry = 0) =>
		new T.Matrix4().compose(V(x, y, z), new T.Quaternion().setFromAxisAngle(Y_AXIS, ry), V(sx, sy, sz));
	const inst = (geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], list: THREE.Matrix4[], cast = true) => {
		const m = new T.InstancedMesh(geo, mat, list.length);
		list.forEach((mt, i) => m.setMatrixAt(i, mt));
		m.castShadow = cast;
		m.receiveShadow = true;
		m.instanceMatrix.needsUpdate = true;
		scene.add(m);
		return m;
	};

	// Studio: one large warm softbox, a cool rim strip, almost no fill.
	{
		const pm = new T.PMREMGenerator(renderer);
		const env = new T.Scene();
		env.add(new T.Mesh(new T.BoxGeometry(120, 80, 120), new T.MeshBasicMaterial({ color: 0x0a0a0c, side: T.BackSide })));
		const panel = (w: number, h: number, pos: [number, number, number], k: number, hex: number) => {
			const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(hex).multiplyScalar(k), side: T.DoubleSide }));
			m.position.set(...pos);
			m.lookAt(0, 0, 0);
			env.add(m);
		};
		panel(46, 30, [-26, 34, 22], 3.4, 0xfff1e0);
		panel(70, 5, [34, 14, -36], 2.6, 0xdbe5ff);
		panel(16, 16, [30, 26, 30], 0.5, 0xffffff);
		scene.environment = track(pm.fromScene(env, 0.035).texture);
		pm.dispose();
	}
	const key = new T.DirectionalLight(0xfff0de, 2.4);
	key.position.set(-46, 80, 42);
	key.castShadow = true;
	key.shadow.mapSize.set(2048, 2048);
	Object.assign(key.shadow.camera, { left: -72, right: 72, top: 52, bottom: -52, near: 20, far: 230 });
	key.shadow.camera.updateProjectionMatrix();
	key.shadow.bias = -0.0003;
	key.shadow.normalBias = 0.03;
	scene.add(key, key.target);
	const rim = new T.DirectionalLight(0xd4e0ff, 1.1);
	rim.position.set(60, 26, -70);
	scene.add(rim);
	scene.add(new T.HemisphereLight(0xc4ccd6, 0x08080a, 0.2));

	// Chip grid and package dimensions (mm, illustrative).
	const BW = 124, BD = 70, BT = 1.6, ROWS = 4, COLS = 8, PX = 14, PZ = 15;
	const chips: { x: number; z: number }[] = [];
	for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) chips.push({ x: (c - (COLS - 1) / 2) * PX, z: (r - (ROWS - 1) / 2) * PZ });
	const HERO = 2 * COLS + 3;
	const hx = chips[HERO].x;
	const hz = chips[HERO].z;
	const SUB = 9, SUBH = 0.8, DIE = 5.4, DIEH = 0.42, BALLR = 0.24, BALLP = 0.66, NB = 12, NBU = 30;
	const Y_SUB = 0.42 + SUBH / 2;
	const Y_SUBTOP = 0.42 + SUBH;
	const Y_DIE = Y_SUBTOP + 0.1 + DIEH / 2;
	const EX = { balls: 4.2, sub: 7.6, uf: 10.6, bumps: 13.2, die: 16.4, flipRise: 6 };
	const CAPS: [number, number, number][] = [
		[-6.1, -2.2, Math.PI / 2], [-6.1, 2.2, Math.PI / 2], [6.1, -2.2, Math.PI / 2], [6.1, 2.2, Math.PI / 2],
		[-2.2, -6.1, 0], [2.2, -6.1, 0], [-2.2, 6.1, 0], [2.2, 6.1, 0],
	];
	const PKGCAPS: [number, number][] = [[-3.75, -1.5], [-3.75, 1.5], [3.75, -1.5], [3.75, 1.5]];

	// ── textures ─────────────────────────────────────────────────────────
	function paintPcb() {
		const W = narrow ? 1024 : 2048;
		const H = Math.round((W * BD) / BW);
		const s = W / BW;
		const cv = mk(W, H), c = cv.getContext('2d')!;
		const rv = mk(W, H), r = rv.getContext('2d')!;
		const P = (x: number, z: number): [number, number] => [(x + BW / 2) * s, (z + BD / 2) * s];
		c.fillStyle = '#0b1510'; c.fillRect(0, 0, W, H);
		r.fillStyle = '#b4b4b4'; r.fillRect(0, 0, W, H);
		const rnd = mulberry(4242);
		const line = (pts: [number, number][], wmm: number, col: string, rough: string) => {
			for (const [ctx, style] of [[c, col], [r, rough]] as const) {
				ctx.strokeStyle = style; ctx.lineWidth = wmm * s; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath();
				pts.forEach(([x, z], i) => { const [px, py] = P(x, z); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
				ctx.stroke();
			}
		};
		for (const z of [...new Set(chips.map((ch) => ch.z))]) {
			line([[-BW / 2 + 3, z - 6.6], [BW / 2 - 3, z - 6.6]], 1.3, '#14271c', '#585858');
			line([[-BW / 2 + 3, z + 6.8], [BW / 2 - 3, z + 6.8]], 0.5, '#14271c', '#585858');
		}
		chips.forEach((ch, i) => {
			const nx = chips[i + 1];
			if (nx && nx.z === ch.z) line([[ch.x + 4.6, ch.z - 1.4], [nx.x - 4.6, nx.z - 1.4]], 0.24, '#183121', '#555555');
			for (let k = 0; k < 7; k++) {
				const a = rnd() * Math.PI * 2, d = 4 + rnd() * 2;
				const x0 = ch.x + Math.cos(a) * 4.7, z0 = ch.z + Math.sin(a) * 4.7;
				line([[x0, z0], [x0 + Math.cos(a) * d, z0], [x0 + Math.cos(a) * d, z0 + Math.sin(a) * d]], 0.18, '#13281b', '#5a5a5a');
			}
			// Land pads for the ball grid, hidden until the chip lifts.
			c.fillStyle = '#b3914f'; r.fillStyle = '#383838';
			for (let a = 0; a < NB; a++) for (let b = 0; b < NB; b++) {
				const [px, py] = P(ch.x + (a - (NB - 1) / 2) * BALLP, ch.z + (b - (NB - 1) / 2) * BALLP);
				for (const ctx of [c, r]) { ctx.beginPath(); ctx.arc(px, py, 0.2 * s, 0, 7); ctx.fill(); }
			}
		});
		for (let i = 0; i < 800; i++) {
			const x = (rnd() - 0.5) * (BW - 6), z = (rnd() - 0.5) * (BD - 6);
			if (chips.some((ch) => Math.abs(ch.x - x) < 7.2 && Math.abs(ch.z - z) < 7.2)) continue;
			const [px, py] = P(x, z);
			c.fillStyle = '#1e3828'; c.beginPath(); c.arc(px, py, 0.32 * s, 0, 7); c.fill();
			c.fillStyle = '#040806'; c.beginPath(); c.arc(px, py, 0.13 * s, 0, 7); c.fill();
			r.fillStyle = '#4a4a4a'; r.beginPath(); r.arc(px, py, 0.32 * s, 0, 7); r.fill();
		}
		c.strokeStyle = c.fillStyle = 'rgba(222,226,214,0.6)';
		c.lineWidth = 0.15 * s;
		r.strokeStyle = '#d0d0d0';
		r.lineWidth = 0.15 * s;
		c.font = `${Math.round(1.2 * s)}px "JetBrains Mono", monospace`;
		chips.forEach((ch, i) => {
			const [x0, y0] = P(ch.x - 5.3, ch.z - 5.3);
			c.strokeRect(x0, y0, 10.6 * s, 10.6 * s);
			r.strokeRect(x0, y0, 10.6 * s, 10.6 * s);
			c.beginPath(); c.arc(...P(ch.x - 5.95, ch.z - 5.95), 0.32 * s, 0, 7); c.fill();
			c.fillText(`U${i + 1}`, ...P(ch.x + 3.4, ch.z + 7.9));
		});
		c.font = `${Math.round(1.6 * s)}px "JetBrains Mono", monospace`;
		c.fillText('HASH BOARD  ·  CHAIN 1  ·  REV 1.0', ...P(-BW / 2 + 3, BD / 2 - 2.4));
		return { map: ctex(cv), rough: ctex(rv, false) };
	}
	function paintSubstrate() {
		const cv = mk(256, 256), c = cv.getContext('2d')!;
		c.fillStyle = '#2a2b1f'; c.fillRect(0, 0, 256, 256);
		c.strokeStyle = 'rgba(78,80,52,0.55)'; c.lineWidth = 1.2;
		const rnd = mulberry(77);
		for (let i = 0; i < 40; i++) {
			const y = 10 + rnd() * 236;
			c.beginPath(); c.moveTo(0, y); c.lineTo(40 + rnd() * 30, y); c.lineTo(60 + rnd() * 30, y + (rnd() - 0.5) * 30); c.stroke();
		}
		c.fillStyle = '#c9a458';
		c.beginPath(); c.moveTo(8, 8); c.lineTo(28, 8); c.lineTo(8, 28); c.closePath(); c.fill();
		for (let i = 0; i < 9; i++) c.fillRect(46 + i * 20, 238, 7, 7);
		return ctex(cv);
	}
	// Same floorplan as the 2D silicon view's die, so the dive lands on the same picture.
	const dn = dieLayout(520);
	function paintDieFace() {
		const N = narrow ? 1024 : 2048;
		const cv = mk(N, N), c = cv.getContext('2d')!;
		const R = (r: NRect): [number, number, number, number] => [r.x * N, r.y * N, r.w * N, r.h * N];
		const g = c.createLinearGradient(0, 0, N, N);
		g.addColorStop(0, '#2b2331'); g.addColorStop(0.5, '#1c1a21'); g.addColorStop(1, '#2d2420');
		c.fillStyle = g; c.fillRect(0, 0, N, N);
		c.strokeStyle = '#a39a86'; c.lineWidth = N * 0.004; c.strokeRect(N * 0.006, N * 0.006, N * 0.988, N * 0.988);
		c.strokeStyle = '#6d665a'; c.lineWidth = N * 0.002; c.strokeRect(N * 0.012, N * 0.012, N * 0.976, N * 0.976);
		c.fillStyle = '#d3cec4';
		for (const p of dn.pads) c.fillRect(...R(p));
		const rnd = mulberry(99);
		for (const r of dn.cores) {
			const [x, y, w, h] = R(r);
			const split = w * 0.62, rh = Math.max(2, h / 40);
			c.fillStyle = '#3b3024'; c.fillRect(x, y, w, h);
			for (let yy = y + 1; yy < y + h - rh; yy += rh) { c.fillStyle = rnd() > 0.5 ? '#705b3c' : '#5a4932'; c.fillRect(x + 1, yy, split - 2, rh * 0.56); }
			c.fillStyle = 'rgba(214,176,116,0.2)';
			for (let xx = x + 3; xx < x + split; xx += Math.max(3, w / 28)) c.fillRect(xx, y, 1, h);
			const fx = x + split + 1, fw = w - split - 2, rows = Math.max(8, Math.round(h / 4));
			for (let i = 0; i < 8; i++) for (let j = 0; j < rows; j++) {
				c.fillStyle = rnd() > 0.5 ? '#8c7858' : '#78674a';
				c.fillRect(fx + (i * fw) / 8 + 0.5, y + 1 + (j * (h - 2)) / rows + 0.5, fw / 8 - 1, (h - 2) / rows - 1);
			}
			c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
		}
		for (const b of Object.values(dn.blocks)) {
			const [x, y, w, h] = R(b);
			c.fillStyle = '#343c48'; c.fillRect(x, y, w, h);
			for (let yy = y + 2; yy < y + h - 2; yy += 3) { c.fillStyle = rnd() > 0.5 ? '#56647a' : '#475366'; c.fillRect(x + 2, yy, w - 4, 1.6); }
		}
		const e0 = dn.strapInset * N, e1 = N - e0, sw = dn.strapW * N;
		c.fillStyle = 'rgba(190,130,86,0.32)';
		for (const x of dn.xs) c.fillRect(x * N - sw / 2, e0, sw, e1 - e0);
		for (const y of dn.ys) c.fillRect(e0, y * N - sw / 2, e1 - e0, sw);
		c.fillStyle = 'rgba(214,156,106,0.45)';
		for (const x of dn.xs) for (const y of dn.ys) c.fillRect(x * N - sw / 2, y * N - sw / 2, sw, sw);
		return ctex(cv);
	}
	const glowCv = mk(256, 256);
	const gctx = glowCv.getContext('2d')!;
	const glowTex = ctex(glowCv);
	function paintGlow(activity: number, clock: number) {
		const N = 256;
		gctx.fillStyle = '#000';
		gctx.fillRect(0, 0, N, N);
		dn.cores.forEach((r, i) => {
			const n = Math.sin(i * 12.9898 + clock * 78.233) * 43758.5453;
			const a = i === dn.meIdx ? activity : 0.44 + 0.08 * (n - Math.floor(n));
			gctx.fillStyle = `rgba(255,178,110,${(0.42 * a).toFixed(3)})`;
			gctx.fillRect(r.x * N, r.y * N, r.w * N, r.h * N);
		});
		const m = dn.cores[dn.meIdx];
		gctx.strokeStyle = 'rgba(255,255,255,0.95)';
		gctx.lineWidth = 1.6;
		gctx.strokeRect(m.x * N - 1, m.y * N - 1, m.w * N + 2, m.h * N + 2);
		glowTex.needsUpdate = true;
	}

	// ── materials ────────────────────────────────────────────────────────
	const pcbTex = paintPcb();
	const shCv = mk(128, 128);
	const shc = shCv.getContext('2d')!;
	const sg = shc.createRadialGradient(64, 64, 8, 64, 64, 64);
	sg.addColorStop(0, 'rgba(0,0,0,0.8)'); sg.addColorStop(0.5, 'rgba(0,0,0,0.5)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
	shc.fillStyle = sg;
	shc.fillRect(0, 0, 128, 128);
	const M = {
		pcbTop: track(new T.MeshStandardMaterial({ map: pcbTex.map, roughnessMap: pcbTex.rough, roughness: 1, metalness: 0 })),
		pcbEdge: track(new T.MeshStandardMaterial({ color: 0x3b442c, roughness: 0.85 })),
		floor: track(new T.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 1 })),
		sub: track(new T.MeshStandardMaterial({ map: paintSubstrate(), roughness: 0.6, metalness: 0.05 })),
		subSide: track(new T.MeshStandardMaterial({ color: 0x2b2a1f, roughness: 0.8 })),
		dieBack: track(new T.MeshPhysicalMaterial({ color: 0x6c717a, metalness: 0.9, roughness: 0.17, clearcoat: 0.3, clearcoatRoughness: 0.1, envMapIntensity: 0.95 })),
		dieSide: track(new T.MeshStandardMaterial({ color: 0x5b5f67, metalness: 0.7, roughness: 0.45 })),
		solder: track(new T.MeshStandardMaterial({ color: 0xc9c9c6, metalness: 1, roughness: 0.3 })),
		underfill: track(new T.MeshStandardMaterial({ color: 0xa6823f, roughness: 0.45, transparent: true, opacity: 0.62 })),
		capBody: track(new T.MeshStandardMaterial({ color: 0x8a7658, roughness: 0.55 })),
		capEnd: track(new T.MeshStandardMaterial({ color: 0xd2d2d2, metalness: 1, roughness: 0.28 })),
		shadow: track(new T.MeshBasicMaterial({ map: ctex(shCv), transparent: true, depthWrite: false })),
		face: track(new T.MeshPhysicalMaterial({
			map: paintDieFace(), metalness: 0.5, roughness: 0.34, iridescence: 0.65, iridescenceIOR: 1.7, iridescenceThicknessRange: [220, 760],
			emissive: 0xffffff, emissiveMap: glowTex, emissiveIntensity: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4,
		})),
	};
	const subMats = [M.subSide, M.subSide, M.sub, M.subSide, M.subSide, M.subSide];
	const dieMats = [M.dieSide, M.dieSide, M.dieBack, M.dieSide, M.dieSide, M.dieSide];

	// ── floor, board, chips ──────────────────────────────────────────────
	const floor = new T.Mesh(track(new T.PlaneGeometry(900, 900)), M.floor);
	floor.rotation.x = -Math.PI / 2;
	floor.position.y = -BT - 0.02;
	floor.receiveShadow = true;
	scene.add(floor);
	const pcb = new T.Mesh(track(new T.BoxGeometry(BW, BT, BD)), [M.pcbEdge, M.pcbEdge, M.pcbTop, M.pcbEdge, M.pcbEdge, M.pcbEdge]);
	pcb.position.y = -BT / 2;
	pcb.receiveShadow = true;
	scene.add(pcb);

	const others = chips.filter((_, i) => i !== HERO);
	const subGeo = track(new T.BoxGeometry(SUB, SUBH, SUB));
	const dieGeo = track(new T.BoxGeometry(DIE, DIEH, DIE));
	const ufGeo = track(new T.BoxGeometry(DIE + 0.5, 0.12, DIE + 0.5));
	const ballGeo = track(new T.SphereGeometry(BALLR, 10, 6));
	const bumpGeo = track(new T.SphereGeometry(0.07, 6, 4));
	const shGeo = track(new T.PlaneGeometry(15, 15));
	shGeo.rotateX(-Math.PI / 2);
	const capBodyGeo = track(new T.BoxGeometry(1.0, 0.5, 0.5));
	const capEndGeo = track(new T.BoxGeometry(0.2, 0.54, 0.54));
	const pkgBodyGeo = track(new T.BoxGeometry(0.3, 0.3, 0.6));
	const pkgEndGeo = track(new T.BoxGeometry(0.32, 0.32, 0.12));
	const ballGrid = (perimeter: boolean) => {
		const pts: [number, number][] = [];
		for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) {
			if (perimeter && i > 1 && i < NB - 2 && j > 1 && j < NB - 2) continue;
			pts.push([(i - (NB - 1) / 2) * BALLP, (j - (NB - 1) / 2) * BALLP]);
		}
		return pts;
	};
	inst(shGeo, M.shadow, others.map((c) => mtx(c.x, 0.012, c.z)), false).receiveShadow = false;
	inst(subGeo, subMats, others.map((c) => mtx(c.x, Y_SUB, c.z)));
	inst(dieGeo, dieMats, others.map((c) => mtx(c.x, Y_DIE, c.z)));
	inst(ufGeo, M.underfill, others.map((c) => mtx(c.x, Y_SUBTOP + 0.06, c.z)), false);
	const ballList: THREE.Matrix4[] = [];
	for (const c of others) for (const [bx, bz] of ballGrid(true)) ballList.push(mtx(c.x + bx, BALLR * 0.85, c.z + bz, 1, 0.85, 1));
	inst(ballGeo, M.solder, ballList, false);
	const bodies: THREE.Matrix4[] = [], ends: THREE.Matrix4[] = [], pBodies: THREE.Matrix4[] = [], pEnds: THREE.Matrix4[] = [];
	for (const c of chips) for (const [dx, dz, ry] of CAPS) {
		bodies.push(mtx(c.x + dx, 0.25, c.z + dz, 1, 1, 1, ry));
		const ex = Math.cos(ry) * 0.42, ez = -Math.sin(ry) * 0.42;
		ends.push(mtx(c.x + dx + ex, 0.27, c.z + dz + ez, 1, 1, 1, ry), mtx(c.x + dx - ex, 0.27, c.z + dz - ez, 1, 1, 1, ry));
	}
	inst(capBodyGeo, M.capBody, bodies);
	inst(capEndGeo, M.capEnd, ends);
	for (const c of others) for (const [dx, dz] of PKGCAPS) {
		pBodies.push(mtx(c.x + dx, Y_SUBTOP + 0.15, c.z + dz));
		pEnds.push(mtx(c.x + dx, Y_SUBTOP + 0.16, c.z + dz - 0.26), mtx(c.x + dx, Y_SUBTOP + 0.16, c.z + dz + 0.26));
	}
	inst(pkgBodyGeo, M.capBody, pBodies, false);
	inst(pkgEndGeo, M.capEnd, pEnds, false);

	// ── the hero chip, built from separate layers so it can come apart ────
	const hero = new T.Group();
	hero.position.set(hx, 0, hz);
	scene.add(hero);
	const heroShadowMat = track(M.shadow.clone());
	const heroShadow = new T.Mesh(shGeo, heroShadowMat);
	heroShadow.position.y = 0.012;
	hero.add(heroShadow);
	const hBalls = new T.InstancedMesh(ballGeo, M.solder, NB * NB);
	ballGrid(false).forEach(([bx, bz], i) => hBalls.setMatrixAt(i, mtx(bx, BALLR * 0.85, bz, 1, 0.85, 1)));
	const hSub = new T.Group();
	const subMesh = new T.Mesh(subGeo, subMats);
	subMesh.position.y = Y_SUB;
	subMesh.castShadow = subMesh.receiveShadow = true;
	hSub.add(subMesh);
	for (const [dx, dz] of PKGCAPS) {
		const b = new T.Mesh(pkgBodyGeo, M.capBody);
		b.position.set(dx, Y_SUBTOP + 0.15, dz);
		hSub.add(b);
		for (const off of [-0.26, 0.26]) {
			const e = new T.Mesh(pkgEndGeo, M.capEnd);
			e.position.set(dx, Y_SUBTOP + 0.16, dz + off);
			hSub.add(e);
		}
	}
	const hUf = new T.Mesh(ufGeo, M.underfill);
	hUf.position.y = Y_SUBTOP + 0.06;
	const hBumps = new T.InstancedMesh(bumpGeo, M.solder, NBU * NBU);
	const bp = (DIE - 0.5) / (NBU - 1);
	for (let i = 0; i < NBU; i++) for (let j = 0; j < NBU; j++) hBumps.setMatrixAt(i * NBU + j, mtx((i - (NBU - 1) / 2) * bp, Y_SUBTOP + 0.07, (j - (NBU - 1) / 2) * bp));
	const hDie = new T.Group();
	hDie.position.y = Y_DIE;
	const dieMesh = new T.Mesh(dieGeo, dieMats);
	dieMesh.castShadow = dieMesh.receiveShadow = true;
	const face = new T.Mesh(track(new T.PlaneGeometry(DIE, DIE)), M.face);
	face.rotation.x = Math.PI / 2;
	face.position.y = -DIEH / 2 - 0.01;
	hDie.add(dieMesh, face);
	hero.add(hBalls, hSub, hUf, hBumps, hDie);
	const bases = { uf: hUf.position.y };
	function applyState(e: number, f: number) {
		hBalls.position.y = e * EX.balls;
		hSub.position.y = e * EX.sub;
		hUf.position.y = bases.uf + e * EX.uf;
		hBumps.position.y = e * EX.bumps;
		hDie.position.y = Y_DIE + e * EX.die + f * EX.flipRise;
		hDie.rotation.x = f * Math.PI;
		heroShadowMat.opacity = 1 - clamp01(e * 3);
		hero.updateMatrixWorld(true);
	}
	// A point on the die's circuit side, in the same image coordinates as the 2D die (0–1, y down).
	const faceWorld = (u: number, v: number) => face.localToWorld(V((u - 0.5) * DIE, (0.5 - v) * DIE, 0.02));
	const ctr = (r: NRect): [number, number] => [r.x + r.w / 2, r.y + r.h / 2];
	const meC = ctr(dn.cores[dn.meIdx]);
	const anyC = ctr(dn.cores[dn.nx * 8 + 2]);
	const strapC: [number, number] = [dn.xs[0], dn.ys[1] + 0.03];
	const periC = ctr(dn.blocks.ctrl);

	// ── labels ───────────────────────────────────────────────────────────
	let cur: Cam;
	const yDie = () => Y_DIE + cur.e * EX.die + cur.f * EX.flipRise;
	const LABELS: { beats: number[]; side: 'l' | 'r'; text: string; sub: string; at: () => THREE.Vector3 }[] = [
		{ beats: [0], side: 'r', text: 'One mining chip', sub: 'around a hundred per board', at: () => V(hx + SUB / 2, Y_DIE + 0.3, hz + SUB / 2) },
		{ beats: [1], side: 'l', text: 'Silicon die', sub: 'polished back side; circuits face down', at: () => V(hx - DIE / 2, Y_DIE + DIEH / 2, hz - DIE / 2) },
		{ beats: [1], side: 'r', text: 'Package substrate', sub: 'a tiny multilayer circuit board', at: () => V(hx + SUB / 2, Y_SUBTOP, hz + SUB / 2) },
		{ beats: [1], side: 'l', text: 'Capacitors', sub: 'steady the chip’s power supply', at: () => V(hx - 6.1, 0.5, hz + 2.2) },
		{ beats: [2], side: 'r', text: 'Silicon die', sub: 'mounted face-down: flip-chip', at: () => V(hx + DIE / 2, yDie(), hz + DIE / 2) },
		{ beats: [2], side: 'r', text: 'Micro-bumps', sub: 'a dense grid of tiny solder joints', at: () => V(hx + DIE / 2 - 0.25, Y_SUBTOP + 0.07 + cur.e * EX.bumps, hz + DIE / 2 - 0.25) },
		{ beats: [2], side: 'r', text: 'Underfill', sub: 'epoxy that locks the bumps in place', at: () => V(hx + DIE / 2 + 0.25, bases.uf + cur.e * EX.uf, hz + DIE / 2 + 0.25) },
		{ beats: [2], side: 'r', text: 'Substrate', sub: 'fans fine connections out to the ball grid', at: () => V(hx + SUB / 2, Y_SUB + cur.e * EX.sub, hz + SUB / 2) },
		{ beats: [2], side: 'r', text: 'Solder balls', sub: 'attach the package to the board', at: () => V(hx + 3.6, 0.2 + cur.e * EX.balls, hz + 3.6) },
		{ beats: [3], side: 'r', text: 'This core', sub: 'running the pipeline below', at: () => faceWorld(...meC) },
		{ beats: [3], side: 'l', text: 'Hash cores', sub: 'one design, copied across the die', at: () => faceWorld(...anyC) },
		{ beats: [3], side: 'l', text: 'Power grid', sub: 'thick copper straps', at: () => faceWorld(...strapC) },
		{ beats: [3], side: 'r', text: 'Clock, I/O, job distribution', sub: 'the parts that don’t hash', at: () => faceWorld(...periC) },
	];
	const labEls = LABELS.map((L) => {
		const d = document.createElement('div');
		d.className = `lab ${L.side}`;
		const i = document.createElement('i');
		const span = document.createElement('span');
		const small = document.createElement('small');
		span.textContent = L.text;
		small.textContent = L.sub;
		span.appendChild(small);
		d.append(i, span);
		o.labels.appendChild(d);
		return d;
	});
	const tmp = new T.Vector3();
	function updateLabels(settled: boolean) {
		const w = stage.clientWidth;
		const h = stage.clientHeight;
		LABELS.forEach((L, i) => {
			const el = labEls[i];
			let on = settled && L.beats.includes(beat);
			if (on) {
				tmp.copy(L.at()).project(camera);
				if (tmp.z > 1 || Math.abs(tmp.x) > 0.97 || Math.abs(tmp.y) > 0.97) on = false;
				else el.style.transform = `translate(${(((tmp.x + 1) / 2) * w).toFixed(1)}px, ${(((1 - tmp.y) / 2) * h).toFixed(1)}px)`;
			}
			el.classList.toggle('on', on);
		});
	}

	// ── camera choreography ─────────────────────────────────────────────
	applyState(1, 1);
	const meFinal = faceWorld(...meC).toArray() as [number, number, number];
	const dieFinal: [number, number, number] = [hx, Y_DIE + EX.die + EX.flipRise, hz];
	function camFor(i: number): { t: [number, number, number]; r: number; az: number; el: number } {
		const aspect = stage.clientWidth / Math.max(1, stage.clientHeight);
		switch (i) {
			case 0: return { t: [hx * 0.45, 0, hz * 0.4 + 2], r: 100 * Math.max(1, 1.2 / aspect), az: -0.5, el: aspect < 1 ? 0.5 : 0.36 };
			case 1: return { t: [hx, 1.3, hz], r: 30 * Math.max(1, 1.25 / aspect), az: -0.62, el: 0.5 };
			case 2: return { t: [hx, 9.4, hz], r: 50 * Math.max(1, 0.8 / aspect), az: -0.8, el: 0.24 };
			case 3: return { t: dieFinal, r: 17 * Math.max(1, 1.15 / aspect), az: -0.32, el: 1.1 };
			default: return { t: meFinal, r: 0.7, az: -0.32, el: 1.5 };
		}
	}
	const target = (i: number): Cam => {
		const c = camFor(i);
		return { tx: c.t[0], ty: c.t[1], tz: c.t[2], r: c.r, az: c.az, el: c.el, e: STATE[i].e, f: STATE[i].f };
	};
	let beat = 0;
	let from: Cam | null = null;
	let to: Cam = target(0);
	let t0 = 0;
	let dur = 1;
	let dAz = 0;
	let dEl = 0;
	cur = { ...to };
	function goToBeat(i: number, instant = false) {
		o.onBeat(i, instant);
		beat = i;
		to = target(i);
		if (instant || o.reduced) { cur = { ...to }; from = null; }
		else { from = { ...cur, az: cur.az + dAz, el: cur.el + dEl }; t0 = performance.now(); dur = i === 4 ? 2600 : 2100; }
		dAz = 0;
		dEl = 0;
		if (i === 4 && (instant || o.reduced)) handoff();
	}
	function handoff() {
		o.onHandoff();
		window.setTimeout(() => { goToBeat(3, true); o.fade.classList.remove('on'); }, 500);
	}

	// ── input ────────────────────────────────────────────────────────────
	let drag: { x: number; y: number } | null = null;
	const onDown = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); };
	const onMove = (e: PointerEvent) => {
		if (!drag) return;
		dAz -= (e.clientX - drag.x) * 0.006;
		dEl += (e.clientY - drag.y) * 0.004;
		drag.x = e.clientX;
		drag.y = e.clientY;
	};
	const onUp = () => { drag = null; };
	canvas.addEventListener('pointerdown', onDown);
	canvas.addEventListener('pointermove', onMove);
	canvas.addEventListener('pointerup', onUp);
	canvas.addEventListener('pointercancel', onUp);

	const resize = () => {
		const w = stage.clientWidth;
		const h = stage.clientHeight;
		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		if (!from) cur.r = target(beat).r;
	};
	const ro = new ResizeObserver(resize);
	ro.observe(stage);
	resize();

	// ── loop (runs only while the stage is on screen) ───────────────────
	let running = false;
	let raf = 0;
	let glowClock = -1;
	const startT = performance.now();
	function frame(now: number) {
		if (!running) return;
		let settled = true;
		if (from) {
			const p = clamp01((now - t0) / dur);
			const k = ease(p);
			const f = from;
			cur = {
				tx: lerp(f.tx, to.tx, k), ty: lerp(f.ty, to.ty, k), tz: lerp(f.tz, to.tz, k), az: lerp(f.az, to.az, k), el: lerp(f.el, to.el, k),
				e: lerp(f.e, to.e, k), f: lerp(f.f, to.f, k), r: Math.exp(lerp(Math.log(f.r), Math.log(to.r), k)),
			};
			settled = p > 0.8;
			if (beat === 4 && p > 0.76) o.fade.classList.add('on');
			if (p >= 1) { from = null; if (beat === 4) handoff(); }
		}
		applyState(cur.e, cur.f);
		const sway = o.reduced || beat === 4 ? 0 : 0.1 * Math.sin(((now - startT) / 1000) * 0.12);
		const az = cur.az + dAz + sway;
		const el = Math.max(0.05, Math.min(1.53, cur.el + dEl));
		camera.position.set(cur.tx + cur.r * Math.cos(el) * Math.sin(az), cur.ty + cur.r * Math.sin(el), cur.tz + cur.r * Math.cos(el) * Math.cos(az));
		camera.near = Math.max(0.01, Math.min(2, cur.r * 0.02));
		camera.far = cur.r * 4 + 330;
		camera.updateProjectionMatrix();
		camera.lookAt(cur.tx, cur.ty, cur.tz);
		const live = o.live();
		if (live.clock !== glowClock) { glowClock = live.clock; paintGlow(live.activity, live.clock); }
		M.face.emissiveIntensity = 0.5 + 0.9 * live.pulse;
		updateLabels(settled);
		renderer.render(scene, camera);
		raf = requestAnimationFrame(frame);
	}
	const io = new IntersectionObserver(([en]) => {
		if (en.isIntersecting && !running) { running = true; raf = requestAnimationFrame(frame); }
		else if (!en.isIntersecting) { running = false; cancelAnimationFrame(raf); }
	}, { threshold: 0.01 });
	io.observe(stage);
	goToBeat(0, true);

	return {
		goToBeat,
		get beat() { return beat; },
		destroy() {
			running = false;
			cancelAnimationFrame(raf);
			io.disconnect();
			ro.disconnect();
			canvas.removeEventListener('pointerdown', onDown);
			canvas.removeEventListener('pointermove', onMove);
			canvas.removeEventListener('pointerup', onUp);
			canvas.removeEventListener('pointercancel', onUp);
			labEls.forEach((el) => el.remove());
			scene.traverse((obj) => { if (obj instanceof T.InstancedMesh) obj.dispose(); });
			disposables.forEach((d) => d.dispose());
			renderer.dispose();
		},
	};
}
