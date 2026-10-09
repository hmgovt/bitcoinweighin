<!-- src/lib/scene/OilStage.svelte -->
<script lang="ts">
	/**
	 * OilStage — the Oil tab's live stage. The fuel a sum of bitcoin buys,
	 * drawn at true size in the container that suits it (ladder in ../oil.ts):
	 *
	 *   tank   — up to four mid-size cars, bodies drawn see-through so the
	 *            55-litre tank under the rear seat shows its fuel level;
	 *   drums  — up to 20,000 55-gallon drums, four to a pallet;
	 *   tanker — up to ten VLCC supertankers (330 m, 2 million barrels), the
	 *            deck cut away so the oil in the hold shows at its true depth;
	 *   field  — a 40 × 40 grid of pump jacks standing for Prudhoe Bay's 13.2
	 *            billion barrels, lit as the amount claims them.
	 *
	 * Everything is built procedurally (no model files but Sat, who stands
	 * by the cars and drums for scale). Instanced meshes keep the drums and
	 * jacks to a handful of draw calls; changing the amount moves instance
	 * counts and a fill height, nothing is rebuilt.
	 */
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type * as THREE from 'three';
	import {
		CAR_TANK_L,
		FIELD_SIDE,
		MAX_CARS,
		MAX_DRUMS,
		MAX_TANKERS,
		VLCC_L,
		oilScene,
		type Fuel,
		type OilScene,
	} from '../oil.js';
	import { fitDistance } from './landPatch.js';

	let {
		litres = 0,
		fuel = 'crude',
		staged = $bindable(false),
		ready = $bindable(false),
	}: {
		/** Fuel bought, litres (btc × price ÷ USD per litre, see oil.ts). */
		litres?: number;
		fuel?: Fuel;
		staged?: boolean;
		ready?: boolean;
	} = $props();

	const BG = 0x18181b;
	const ORANGE = 0xf7931a;

	/** Liquid colours: crude near-black, diesel amber, gasoline pale straw. */
	const LIQUID: Record<Fuel, { color: number; emissive: number }> = {
		crude: { color: 0x1c130b, emissive: 0x3a220c },
		diesel: { color: 0xc98f12, emissive: 0x4a3205 },
		gasoline: { color: 0xead27e, emissive: 0x4a3f18 },
	};
	/** Drum paint by the US fuel-can convention: red gasoline, yellow diesel; crude in blue steel. */
	const DRUM_PAINT: Record<Fuel, number> = { crude: 0x23466e, diesel: 0xd2a019, gasoline: 0xb3261e };

	// ── Real dimensions, metres ──────────────────────────────────
	const CAR = { len: 4.7, wid: 1.82, wheelR: 0.33, pitch: 2.7 };
	// The 55 L tank under the rear seat: 0.46 × 0.2 × 0.6 m = 0.0552 m³.
	const TANK = { x: -0.95, y: 0.36, len: 0.46, h: 0.2, wid: 0.6 };
	// 55-gal drum: 572 mm across, 851 mm tall; a 1.2 m pallet of four.
	const DRUM = { r: 0.286, h: 0.851, pallet: 1.2, palletH: 0.144, pitch: 1.5 };
	// VLCC: 330 m × 60 m, 30 m keel to deck, 21 m loaded draught. The hold is
	// one open box 225 × 54 m, floor 2.5 m above the keel: 2 million barrels
	// (317,975 m³) stand 26.2 m deep in it.
	const SHIP = { aft: -165, fwd: 165, beam: 60, keel: -21, deck: 9, holdX0: -110, holdX1: 115, holdW: 54, pitch: 100 };
	const SHIP_FLOOR = SHIP.keel + 2.5;
	const HOLD_AREA = (SHIP.holdX1 - SHIP.holdX0) * SHIP.holdW;
	// Pump jacks on a 30 m grid.
	const JACK_PITCH = 30;

	let containerEl: HTMLDivElement | undefined = $state();
	let loading = $state(true);
	let noWebGL = $state(false);
	let caption = $state('');

	let T: typeof THREE | null = null;
	let renderer: THREE.WebGLRenderer | null = null;
	let scene: THREE.Scene | null = null;
	let camera: THREE.PerspectiveCamera | null = null;
	let dog: THREE.Object3D | null = null;
	let mixer: THREE.AnimationMixer | null = null;
	const disposables: { dispose(): void }[] = [];

	// Stage groups and the parts that move with the amount.
	let ground: THREE.Mesh | null = null;
	let groundMat: THREE.MeshStandardMaterial | null = null;
	let carsGroup: THREE.Group | null = null;
	const cars: { root: THREE.Group; fuel: THREE.Mesh }[] = [];
	let drums: THREE.InstancedMesh | null = null;
	let lids: THREE.InstancedMesh | null = null;
	let pallets: THREE.InstancedMesh | null = null;
	let drumsSide = -1;
	let shipsGroup: THREE.Group | null = null;
	const ships: { root: THREE.Group; oil: THREE.Mesh }[] = [];
	let water: THREE.Mesh | null = null;
	let waterCount = -1;
	let hullShape: THREE.Shape | null = null;
	let fieldGroup: THREE.Group | null = null;
	let jacksLit: THREE.InstancedMesh | null = null;
	let jacksDark: THREE.InstancedMesh | null = null;
	let pads: THREE.InstancedMesh | null = null;
	/** Field cells in fill order: a square growing from the near corner. */
	let fieldOrder: [number, number][] = [];

	let liquidMat: THREE.MeshStandardMaterial | null = null;
	let drumMat: THREE.MeshStandardMaterial | null = null;

	let width = 1;
	let height = 1;
	let destroyed = false;
	let rafId = 0;
	let running = false;
	let last = 0;
	let t0 = 0;
	let prefersReduced = false;
	let framedOnce = false;
	let dogResolved = false;
	let renderedOnce = false;
	let camPos: THREE.Vector3 | null = null;
	let camAim: THREE.Vector3 | null = null;
	let wantPos: THREE.Vector3 | null = null;
	let wantAim: THREE.Vector3 | null = null;
	let resizeObs: ResizeObserver | null = null;
	/** What the camera frames: a box (x0, x1, z0, z1, height) and an elevation. */
	let frame = { x0: -1, x1: 1, z0: -1, z1: 1, h: 1, elevDeg: 25, margin: 1.15 };

	function hasWebGL(): boolean {
		try {
			const c = document.createElement('canvas');
			return !!(c.getContext('webgl2') || c.getContext('webgl'));
		} catch {
			return false;
		}
	}

	function updateReady(): void {
		ready = renderedOnce && dogResolved;
	}

	function track<X extends { dispose(): void }>(x: X): X {
		disposables.push(x);
		return x;
	}

	// ── Builders ─────────────────────────────────────────────────

	function std(three: typeof THREE, color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
		return track(new three.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra }));
	}

	function buildCars(three: typeof THREE): void {
		if (!scene || !liquidMat) return;
		carsGroup = new three.Group();
		const ghost = std(three, 0xb4bac4, { transparent: true, opacity: 0.22, depthWrite: false, roughness: 0.3 });
		const glass = std(three, 0x9fb7d0, { transparent: true, opacity: 0.12, depthWrite: false, roughness: 0.1 });
		const edge = track(new three.LineBasicMaterial({ color: 0xc9cdd4, transparent: true, opacity: 0.55 }));
		const tyre = std(three, 0x1b1b1e, { roughness: 0.95 });
		const tankEdge = track(new three.LineBasicMaterial({ color: 0xfafafa }));
		const tankShell = std(three, 0x71717a, { transparent: true, opacity: 0.18, depthWrite: false });

		// Body: a sill-height lower box, a cabin, a sloped bonnet and boot.
		const lower = track(new three.BoxGeometry(CAR.len, 0.62, CAR.wid));
		const cabin = track(new three.BoxGeometry(2.45, 0.56, CAR.wid - 0.16));
		const wheel = track(new three.CylinderGeometry(CAR.wheelR, CAR.wheelR, 0.22, 22).rotateX(Math.PI / 2));
		const shell = track(new three.BoxGeometry(TANK.len, TANK.h, TANK.wid));
		const fuelGeo = track(new three.BoxGeometry(TANK.len - 0.02, 1, TANK.wid - 0.02));
		const lowerEdges = track(new three.EdgesGeometry(lower));
		const cabinEdges = track(new three.EdgesGeometry(cabin));
		const shellEdges = track(new three.EdgesGeometry(shell));

		for (let k = 0; k < MAX_CARS; k++) {
			const root = new three.Group();
			const body = new three.Mesh(lower, ghost);
			body.position.y = 0.18 + 0.31;
			const top = new three.Mesh(cabin, glass);
			top.position.set(-0.25, 0.8 + 0.28, 0);
			const le = new three.LineSegments(lowerEdges, edge);
			le.position.copy(body.position);
			const ce = new three.LineSegments(cabinEdges, edge);
			ce.position.copy(top.position);
			root.add(body, top, le, ce);
			for (const [x, z] of [
				[1.42, 0.8],
				[1.42, -0.8],
				[-1.42, 0.8],
				[-1.42, -0.8],
			]) {
				const w = new three.Mesh(wheel, tyre);
				w.position.set(x, CAR.wheelR, z);
				root.add(w);
			}
			const tankBox = new three.Mesh(shell, tankShell);
			tankBox.position.set(TANK.x, TANK.y + TANK.h / 2, 0);
			const tankLines = new three.LineSegments(shellEdges, tankEdge);
			tankLines.position.copy(tankBox.position);
			const fuelMesh = new three.Mesh(fuelGeo, liquidMat);
			fuelMesh.renderOrder = 2;
			root.add(fuelMesh, tankBox, tankLines);
			root.position.set(0, 0, -k * CAR.pitch);
			carsGroup.add(root);
			cars.push({ root, fuel: fuelMesh });
		}
		scene.add(carsGroup);
	}

	function buildDrums(three: typeof THREE): void {
		if (!scene || !drumMat) return;
		const body = track(new three.CylinderGeometry(DRUM.r, DRUM.r, DRUM.h, 18));
		// Two rolling hoops, as on a real drum.
		const lidGeo = track(new three.CylinderGeometry(DRUM.r * 0.93, DRUM.r * 0.93, 0.012, 18));
		const pal = track(new three.BoxGeometry(DRUM.pallet, DRUM.palletH, DRUM.pallet));
		drums = new three.InstancedMesh(body, drumMat, MAX_DRUMS);
		lids = new three.InstancedMesh(lidGeo, std(three, 0x8f939b, { metalness: 0.4, roughness: 0.5 }), MAX_DRUMS);
		pallets = new three.InstancedMesh(pal, std(three, 0x8a6a45, { roughness: 1 }), Math.ceil(MAX_DRUMS / 4));
		for (const m of [drums, lids, pallets]) {
			m.frustumCulled = false;
			m.count = 0;
			scene.add(m);
		}
	}

	/** Lay out `n` drums four to a pallet, the pallets in a square growing away from the camera. */
	function layDrums(three: typeof THREE, n: number): void {
		if (!drums || !lids || !pallets) return;
		const nPal = Math.ceil(n / 4);
		const side = Math.max(1, Math.ceil(Math.sqrt(nPal)));
		if (side !== drumsSide || drums.count < n) {
			drumsSide = side;
			const m = new three.Matrix4();
			const total = Math.min(MAX_DRUMS, side * side * 4);
			for (let p = 0; p < Math.ceil(total / 4); p++) {
				const px = -(p % side) * DRUM.pitch;
				const pz = -Math.floor(p / side) * DRUM.pitch;
				m.makeTranslation(px, DRUM.palletH / 2, pz);
				pallets.setMatrixAt(p, m);
				for (let d = 0; d < 4; d++) {
					const i = p * 4 + d;
					if (i >= MAX_DRUMS) break;
					const dx = (d % 2 ? 1 : -1) * 0.3;
					const dz = (d < 2 ? 1 : -1) * 0.3;
					m.makeTranslation(px + dx, DRUM.palletH + DRUM.h / 2, pz + dz);
					drums.setMatrixAt(i, m);
					m.makeTranslation(px + dx, DRUM.palletH + DRUM.h + 0.006, pz + dz);
					lids.setMatrixAt(i, m);
				}
			}
			drums.instanceMatrix.needsUpdate = true;
			lids.instanceMatrix.needsUpdate = true;
			pallets.instanceMatrix.needsUpdate = true;
		}
		drums.count = n;
		lids.count = n;
		pallets.count = nPal;
	}

	function buildShips(three: typeof THREE): void {
		if (!scene || !liquidMat) return;
		shipsGroup = new three.Group();
		const { aft, fwd, beam } = SHIP;
		const hb = beam / 2;
		// Plan view: square-ish transom, parallel midbody, a rounded bow.
		const shape = new three.Shape();
		shape.moveTo(aft + 6, -hb);
		shape.lineTo(fwd - 50, -hb);
		shape.bezierCurveTo(fwd - 15, -hb, fwd, -hb * 0.55, fwd, 0);
		shape.bezierCurveTo(fwd, hb * 0.55, fwd - 15, hb, fwd - 50, hb);
		shape.lineTo(aft + 6, hb);
		shape.quadraticCurveTo(aft, hb, aft, hb - 6);
		shape.lineTo(aft, -hb + 6);
		shape.quadraticCurveTo(aft, -hb, aft + 6, -hb);
		hullShape = shape.clone();
		const hole = new three.Path();
		hole.moveTo(SHIP.holdX0, -SHIP.holdW / 2);
		hole.lineTo(SHIP.holdX0, SHIP.holdW / 2);
		hole.lineTo(SHIP.holdX1, SHIP.holdW / 2);
		hole.lineTo(SHIP.holdX1, -SHIP.holdW / 2);
		hole.closePath();
		shape.holes.push(hole);
		// Extrude keel to deck; (x, y, z) → (x, z, −y) stands it upright.
		const hull = track(
			new three.ExtrudeGeometry(shape, { depth: SHIP.deck - SHIP.keel, bevelEnabled: false, curveSegments: 16 })
		);
		hull.rotateX(-Math.PI / 2);
		hull.translate(0, SHIP.keel, 0);
		const deckMat = std(three, 0x7a3b2c, { roughness: 0.9 });
		// Mid grey, so the dark oil line shows against the hold's walls.
		const hullMat = std(three, 0x5a5f69, { roughness: 0.7, side: three.DoubleSide });
		const floor = track(new three.PlaneGeometry(SHIP.holdX1 - SHIP.holdX0, SHIP.holdW).rotateX(-Math.PI / 2));
		floor.translate((SHIP.holdX0 + SHIP.holdX1) / 2, SHIP_FLOOR, 0);
		const floorMat = std(three, 0x3c3d44);
		const oilGeo = track(new three.BoxGeometry(SHIP.holdX1 - SHIP.holdX0 - 0.2, 1, SHIP.holdW - 0.2));
		// Accommodation block and funnel at the stern.
		const house = track(new three.BoxGeometry(16, 26, 42));
		house.translate(aft + 20, SHIP.deck + 13, 0);
		const funnel = track(new three.BoxGeometry(8, 12, 9));
		funnel.translate(aft + 12, SHIP.deck + 30, 0);
		const houseMat = std(three, 0xe4e4e7, { roughness: 0.6 });
		const funnelMat = std(three, ORANGE, { roughness: 0.6 });
		// A frame round the hold's cut edge, so the cutaway reads as one.
		const rim = track(
			new three.EdgesGeometry(new three.BoxGeometry(SHIP.holdX1 - SHIP.holdX0, 0.01, SHIP.holdW))
		);
		rim.translate((SHIP.holdX0 + SHIP.holdX1) / 2, SHIP.deck + 0.05, 0);
		const rimMat = track(new three.LineBasicMaterial({ color: 0xfafafa, transparent: true, opacity: 0.7 }));

		for (let k = 0; k < MAX_TANKERS; k++) {
			const root = new three.Group();
			root.add(
				new three.Mesh(hull, [deckMat, hullMat]),
				new three.Mesh(floor, floorMat),
				new three.Mesh(house, houseMat),
				new three.Mesh(funnel, funnelMat),
				new three.LineSegments(rim, rimMat)
			);
			const oil = new three.Mesh(oilGeo, liquidMat);
			root.add(oil);
			root.position.z = -k * SHIP.pitch;
			shipsGroup.add(root);
			ships.push({ root, oil });
		}
		scene.add(shipsGroup);
	}

	/** The sea, with a hole cut where each of the first `n` hulls sits, so the open holds stay dry. */
	function layWater(three: typeof THREE, n: number): void {
		if (!scene || !hullShape || n === waterCount) return;
		waterCount = n;
		if (water) {
			scene.remove(water);
			water.geometry.dispose();
		}
		const sea = new three.Shape();
		const R = 30000;
		sea.moveTo(-R, -R);
		sea.lineTo(R, -R);
		sea.lineTo(R, R);
		sea.lineTo(-R, R);
		sea.closePath();
		const pts = hullShape.getPoints(12);
		for (let k = 0; k < n; k++) {
			// Scene z = −shape y, so a hull at z = −k·pitch sits at shape y = +k·pitch.
			const off = k * SHIP.pitch;
			sea.holes.push(new three.Path(pts.map((p) => new three.Vector2(p.x, p.y + off))));
		}
		const g = new three.ShapeGeometry(sea).rotateX(-Math.PI / 2);
		const mat = (water?.material as THREE.Material | undefined) ?? std(three, 0x0b1a2a, { roughness: 0.35, metalness: 0.1 });
		water = new three.Mesh(g, mat);
		water.frustumCulled = false;
		scene.add(water);
	}

	function buildField(three: typeof THREE, mergeGeometries: (g: THREE.BufferGeometry[]) => THREE.BufferGeometry | null): void {
		if (!scene) return;
		fieldGroup = new three.Group();
		const box = (w: number, h: number, d: number, x: number, y: number, z: number, rz = 0) =>
			new three.BoxGeometry(w, h, d).rotateZ(rz).translate(x, y, z);
		// A beam pump about 8 m long and 6.5 m tall, rocking on its samson post.
		const parts = [
			box(7.5, 0.35, 1.8, 0, 0.18, 0), // skid
			box(0.35, 5.4, 0.35, -0.3, 3.0, 0.55, 0.12), // samson post, two legs
			box(0.35, 5.4, 0.35, -0.3, 3.0, -0.55, 0.12),
			box(8.0, 0.5, 0.4, 0.2, 5.9, 0, 0.06), // walking beam
			box(0.7, 2.4, 0.5, 4.2, 5.2, 0, 0.12), // horsehead
			box(1.6, 1.6, 0.5, -3.0, 1.5, 0), // crank and counterweight
			box(0.08, 4.4, 0.08, 4.45, 2.4, 0), // polished rod
			box(0.6, 0.9, 0.6, 4.45, 0.45, 0), // wellhead
			box(1.6, 1.0, 1.2, -3.2, 0.85, 1.2), // motor
		];
		const jackGeo = mergeGeometries(parts);
		for (const p of parts) p.dispose();
		if (!jackGeo) return;
		track(jackGeo);
		const padGeo = track(new three.BoxGeometry(1, 0.08, 1));
		const N = FIELD_SIDE * FIELD_SIDE;
		// Lit jacks stand dark on their orange pads; the rest are pale grey.
		jacksLit = new three.InstancedMesh(jackGeo, std(three, 0x2a241c, { roughness: 0.6 }), N);
		jacksDark = new three.InstancedMesh(jackGeo, std(three, 0x6b6b74, { roughness: 0.8 }), N);
		pads = new three.InstancedMesh(
			padGeo,
			track(new three.MeshBasicMaterial({ color: ORANGE, transparent: true, opacity: 0.55, toneMapped: false })),
			N
		);
		// Fill order: a square growing from the near corner, shell by shell.
		fieldOrder = [];
		for (let i = 0; i < FIELD_SIDE; i++) for (let j = 0; j < FIELD_SIDE; j++) fieldOrder.push([i, j]);
		fieldOrder.sort((a, b) => {
			const sa = Math.max(a[0], a[1]);
			const sb = Math.max(b[0], b[1]);
			if (sa !== sb) return sa - sb;
			return a[0] + a[1] * 0.001 - (b[0] + b[1] * 0.001);
		});
		for (const m of [jacksLit, jacksDark, pads]) {
			m.frustumCulled = false;
			m.count = 0;
			fieldGroup.add(m);
		}
		scene.add(fieldGroup);
	}

	function cellPos(c: [number, number]): [number, number] {
		return [-c[0] * JACK_PITCH, -c[1] * JACK_PITCH];
	}

	function layField(three: typeof THREE, s: OilScene): void {
		if (!jacksLit || !jacksDark || !pads) return;
		const m = new three.Matrix4();
		const lit = s.count;
		const facing = new three.Quaternion().setFromAxisAngle(new three.Vector3(0, 1, 0), Math.PI / 5);
		const one = new three.Vector3(1, 1, 1);
		for (let k = 0; k < fieldOrder.length; k++) {
			const [x, z] = cellPos(fieldOrder[k]);
			m.compose(new three.Vector3(x, 0, z), facing, one);
			if (k < lit) {
				jacksLit.setMatrixAt(k, m);
				// The pad's area is the jack's share: the last one part-lit.
				const f = k === lit - 1 && s.exact < fieldOrder.length ? s.lastFill : 1;
				const side = 22 * Math.sqrt(Math.max(f, 0.02));
				m.compose(new three.Vector3(x, 0.05, z), new three.Quaternion(), new three.Vector3(side, 1, side));
				pads.setMatrixAt(k, m);
			} else jacksDark.setMatrixAt(k - lit, m);
		}
		jacksLit.count = lit;
		pads.count = lit;
		jacksDark.count = fieldOrder.length - lit;
		for (const im of [jacksLit, jacksDark, pads]) im.instanceMatrix.needsUpdate = true;
	}

	// ── Apply an amount ──────────────────────────────────────────

	let lastKind = '';
	let lastFieldKey = '';

	function refresh(L: number): void {
		const three = T;
		if (!three || !scene || !carsGroup || !drums || !shipsGroup || !fieldGroup || !groundMat || !ground) return;
		const s = oilScene(L);
		const kind = s.kind;
		carsGroup.visible = kind === 'tank';
		drums.visible = lids!.visible = pallets!.visible = kind === 'drums';
		shipsGroup.visible = kind === 'tanker';
		fieldGroup.visible = kind === 'field';
		ground.visible = kind !== 'tanker';
		if (water) water.visible = kind === 'tanker';
		groundMat.color.setHex(kind === 'field' ? 0x3d3a2f : 0x2a2a2f);
		if (dog) dog.visible = kind === 'tank' || kind === 'drums';

		if (kind === 'tank') {
			cars.forEach((c, k) => {
				const on = k < s.count;
				c.root.visible = on;
				const f = k < s.count - 1 ? 1 : s.lastFill;
				const h = Math.max(TANK.h * f, 0.002);
				c.fuel.scale.y = h;
				c.fuel.position.set(TANK.x, TANK.y + h / 2, 0);
			});
			// Sat by the first car's front wheel.
			dog?.position.set(CAR.len / 2 + 0.7, 0, 1.0);
			dog?.rotation.set(0, -Math.PI / 2 + 0.5, 0);
			const zBack = -(s.count - 1) * CAR.pitch - CAR.wid / 2;
			frame = { x0: -CAR.len / 2, x1: CAR.len / 2 + 1.1, z0: zBack, z1: CAR.wid / 2 + 0.4, h: 1.45, elevDeg: 24, margin: 1.12 };
			caption = `Mid-size car · ${CAR_TANK_L} L tank under the rear seat, drawn in place`;
		} else if (kind === 'drums') {
			layDrums(three, s.count);
			const nPal = Math.ceil(s.count / 4);
			const side = Math.max(1, Math.ceil(Math.sqrt(nPal)));
			const rows = Math.ceil(nPal / side);
			const half = DRUM.pallet / 2;
			dog?.position.set(1.1, 0, 1.1);
			dog?.rotation.set(0, Math.PI * 1.25, 0);
			frame = {
				x0: -(side - 1) * DRUM.pitch - half,
				x1: half + 1.4,
				z0: -(rows - 1) * DRUM.pitch - half,
				z1: half + 1.4,
				h: DRUM.palletH + DRUM.h,
				elevDeg: 28 + Math.min(14, Math.log10(s.count) * 4),
				margin: 1.1,
			};
			caption = '55-gallon steel drums (208 L), four to a pallet';
		} else if (kind === 'tanker') {
			layWater(three, s.count);
			ships.forEach((sh, k) => {
				sh.root.visible = k < s.count;
				const f = k < s.count - 1 ? 1 : s.lastFill;
				const depth = Math.max((f * VLCC_L) / 1000 / HOLD_AREA, 0.05);
				sh.oil.scale.y = depth;
				sh.oil.position.set((SHIP.holdX0 + SHIP.holdX1) / 2, SHIP_FLOOR + depth / 2, 0);
			});
			frame = {
				x0: SHIP.aft,
				x1: SHIP.fwd,
				z0: -(s.count - 1) * SHIP.pitch - SHIP.beam / 2,
				z1: SHIP.beam / 2,
				h: SHIP.deck + 40,
				// Low enough over a single ship to see the oil line on the hold's far wall.
				elevDeg: s.count === 1 ? 24 : 32,
				margin: 1.08,
			};
			caption = 'VLCC supertanker, 330 m · deck cut away: the oil stands at its true depth in the hold';
		} else {
			const key = `${s.count}:${s.count === FIELD_SIDE * FIELD_SIDE ? 1 : s.lastFill.toFixed(3)}`;
			if (key !== lastFieldKey) {
				lastFieldKey = key;
				layField(three, s);
			}
			const side = Math.ceil(Math.sqrt(s.count));
			const span = Math.min(FIELD_SIDE, side + 2);
			frame = {
				x0: -(span - 1) * JACK_PITCH - 10,
				x1: 12,
				z0: -(span - 1) * JACK_PITCH - 10,
				z1: 12,
				h: 7,
				elevDeg: 30 + Math.min(14, side / 3),
				margin: 1.05,
			};
			caption = 'Pump jacks · each stands for 1/1,600 of Prudhoe Bay’s 13.2 billion barrels';
		}
		if (kind !== lastKind) {
			lastKind = kind;
			// A rung change cuts rather than flies: there's nothing to see between a car and a tanker.
			framedOnce = false;
		}
		reframe(0);
		render();
		renderedOnce = true;
		updateReady();
	}

	/** Aim the camera at `frame`, from the south-east, swayed `swayRad` round the vertical. */
	function reframe(swayRad: number): void {
		if (!camera || !camPos || !camAim || !wantPos || !wantAim) return;
		const aspect = height > 0 ? width / height : 1;
		const { x0, x1, z0, z1, h, elevDeg, margin } = frame;
		const elev = (elevDeg * Math.PI) / 180;
		const az = (38 * Math.PI) / 180 + swayRad;
		const back: [number, number, number] = [Math.sin(az) * Math.cos(elev), Math.sin(elev), Math.cos(az) * Math.cos(elev)];
		const right: [number, number, number] = [Math.cos(az), 0, -Math.sin(az)];
		const up: [number, number, number] = [-Math.sin(az) * Math.sin(elev), Math.cos(elev), -Math.cos(az) * Math.sin(elev)];
		const cx = (x0 + x1) / 2;
		const cz = (z0 + z1) / 2;
		const cy = h * 0.4;
		const corners: [number, number, number][] = [];
		for (const x of [x0, x1]) for (const z of [z0, z1]) for (const y of [0, h]) corners.push([x - cx, y - cy, z - cz]);
		const dist = fitDistance(corners, back, right, up, (35 * Math.PI) / 180, aspect, margin);
		wantAim.set(cx, cy, cz);
		wantPos.set(cx + back[0] * dist, cy + back[1] * dist, cz + back[2] * dist);
		if (prefersReduced || !framedOnce) {
			camPos.copy(wantPos);
			camAim.copy(wantAim);
			applyCamera();
		}
		framedOnce = true;
	}

	function applyCamera(): void {
		if (!camera || !camPos || !camAim || !scene) return;
		camera.position.copy(camPos);
		camera.lookAt(camAim);
		const d = camPos.distanceTo(camAim);
		camera.near = Math.max(d / 500, 0.02);
		camera.far = d * 30 + 2000;
		camera.updateProjectionMatrix();
		const fog = scene.fog as THREE.Fog | null;
		if (fog) {
			fog.near = d * 1.6;
			fog.far = d * 7;
		}
	}

	function render(): void {
		if (renderer && scene && camera) renderer.render(scene, camera);
	}

	function loop(): void {
		if (!running || destroyed || !camPos || !camAim || !wantPos || !wantAim) return;
		rafId = requestAnimationFrame(loop);
		const now = performance.now();
		const dt = Math.min((now - last) / 1000 || 0, 0.05);
		last = now;
		// A slow sway round the scene, so it reads as solid.
		reframe(Math.sin((now - t0) / 9000) * 0.16);
		const k = 1 - Math.exp(-dt * 3.2);
		const d0 = camPos.distanceTo(camAim);
		const d1 = wantPos.distanceTo(wantAim);
		camAim.lerp(wantAim, k);
		const dir = camPos.clone().sub(camAim).normalize().lerp(wantPos.clone().sub(wantAim).normalize(), k).normalize();
		const d = Math.exp(Math.log(Math.max(d0, 1e-3)) + (Math.log(Math.max(d1, 1e-3)) - Math.log(Math.max(d0, 1e-3))) * k);
		camPos.copy(camAim).addScaledVector(dir, d);
		applyCamera();
		mixer?.update(dt);
		render();
	}

	function applyFuel(f: Fuel): void {
		if (!liquidMat || !drumMat) return;
		liquidMat.color.setHex(LIQUID[f].color);
		liquidMat.emissive.setHex(LIQUID[f].emissive);
		drumMat.color.setHex(DRUM_PAINT[f]);
	}

	async function hydrate(): Promise<void> {
		if (destroyed || !containerEl) return;
		const [three, gltfMod, moMod, bguMod, materials, maths] = await Promise.all([
			import('three'),
			import('three/addons/loaders/GLTFLoader.js'),
			import('three/addons/libs/meshopt_decoder.module.js'),
			import('three/addons/utils/BufferGeometryUtils.js'),
			import('./materials.js'),
			import('./maths.js'),
		]);
		const { loadNormalizedModel } = await import('./loadNormalizedModel.js');
		if (destroyed || !containerEl) return;
		T = three;

		width = containerEl.clientWidth || 1;
		height = containerEl.clientHeight || 1;
		renderer = new three.WebGLRenderer({ antialias: true, alpha: false, logarithmicDepthBuffer: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(width, height);
		renderer.toneMapping = three.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 1.1;
		renderer.domElement.className = 'stage-canvas';
		renderer.domElement.setAttribute('aria-hidden', 'true');
		containerEl.appendChild(renderer.domElement);

		scene = new three.Scene();
		scene.background = new three.Color(BG);
		scene.fog = new three.Fog(BG, 50, 400);
		const env = materials.makeEnvironmentTexture(renderer);
		disposables.push(env);
		scene.environment = env;
		scene.environmentIntensity = 0.6;
		const sun = new three.DirectionalLight(0xfff0dc, 2.4);
		sun.position.set(0.5, 0.85, 0.35);
		scene.add(sun, new three.HemisphereLight(0xcfdcff, 0x1a1a1d, 0.75));

		camera = new three.PerspectiveCamera(maths.FOV_DEG, width / height, 0.05, 100000);
		camPos = new three.Vector3(6, 3, 6);
		camAim = new three.Vector3(0, 0.5, 0);
		wantPos = new three.Vector3();
		wantAim = new three.Vector3();

		groundMat = std(three, 0x2a2a2f, { roughness: 1 });
		ground = new three.Mesh(track(new three.PlaneGeometry(60000, 60000).rotateX(-Math.PI / 2)), groundMat);
		ground.position.y = -0.001;
		scene.add(ground);

		liquidMat = std(three, LIQUID.crude.color, { roughness: 0.12, metalness: 0.05, emissive: new three.Color(LIQUID.crude.emissive) });
		drumMat = std(three, DRUM_PAINT.crude, { roughness: 0.45, metalness: 0.35 });
		buildCars(three);
		buildDrums(three);
		buildShips(three);
		buildField(three, bguMod.mergeGeometries);
		applyFuel(fuel);
		loading = false;

		resizeObs = new ResizeObserver(() => {
			if (!containerEl || !renderer || !camera) return;
			width = containerEl.clientWidth || 1;
			height = containerEl.clientHeight || 1;
			camera.aspect = width / height;
			renderer.setSize(width, height);
			framedOnce = false;
			refresh(litres);
		});
		resizeObs.observe(containerEl);

		refresh(litres);
		if (!prefersReduced) {
			running = true;
			last = t0 = performance.now();
			rafId = requestAnimationFrame(loop);
		}

		loadNormalizedModel(
			three,
			gltfMod.GLTFLoader,
			moMod.MeshoptDecoder,
			'/models/references/shiba_inu/shiba.glb',
			maths.DOG_TOTAL_HEIGHT_M,
			'y',
			(object, animations) => {
				if (destroyed || !scene) return;
				dog = object;
				scene.add(dog);
				if (animations.length) {
					mixer = new three.AnimationMixer(dog);
					const idle = animations.find((c) => c.name.includes('sitting')) ?? animations[animations.length - 1];
					mixer.clipAction(idle).play();
					if (prefersReduced) mixer.update(0);
				}
				dogResolved = true;
				refresh(litres);
			},
			() => {
				dogResolved = true;
				updateReady();
			}
		);
	}

	function teardown(): void {
		running = false;
		cancelAnimationFrame(rafId);
		resizeObs?.disconnect();
		mixer?.stopAllAction();
		water?.geometry.dispose();
		for (const d of disposables) d.dispose();
		disposables.length = 0;
		for (const m of [drums, lids, pallets, jacksLit, jacksDark, pads]) m?.dispose();
		if (renderer) {
			renderer.domElement.remove();
			renderer.dispose();
		}
		renderer = scene = camera = null;
		carsGroup = shipsGroup = fieldGroup = null;
		drums = lids = pallets = jacksLit = jacksDark = pads = null;
		cars.length = 0;
		ships.length = 0;
		water = null;
		dog = mixer = null;
		staged = false;
		ready = false;
	}

	onMount(() => {
		if (!browser) return;
		prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (!hasWebGL()) {
			noWebGL = true;
			loading = false;
			ready = true;
			return;
		}
		void hydrate();
		return () => {
			destroyed = true;
			teardown();
		};
	});

	$effect(() => {
		const L = litres;
		if (!T) return;
		refresh(L);
	});

	$effect(() => {
		const f = fuel;
		if (!T) return;
		applyFuel(f);
		render();
	});
</script>

<div class="oil-stage" bind:this={containerEl}>
	{#if loading}
		<div class="oil-note">Filling up…</div>
	{:else if noWebGL}
		<div class="oil-note">The 3-D scene couldn't load here; the figures below still hold.</div>
	{/if}
	{#if caption && !noWebGL}
		<div class="oil-caption">{caption}</div>
	{/if}
</div>

<style>
	.oil-stage {
		position: relative;
		width: 100%;
		height: clamp(340px, 56vh, 520px);
		overflow: hidden;
		border-radius: 8px;
		background: #18181b;
	}
	.oil-stage :global(canvas.stage-canvas) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
	}
	.oil-note {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 16px;
		text-align: center;
		font: 500 13px/1.4 'Inter Tight', system-ui, sans-serif;
		color: #a1a1aa;
		z-index: 1;
	}
	.oil-caption {
		position: absolute;
		left: 10px;
		right: 10px;
		bottom: 8px;
		z-index: 1;
		font: 500 10px/1.3 'JetBrains Mono', ui-monospace, monospace;
		color: rgba(161, 161, 170, 0.8);
		pointer-events: none;
	}
</style>
