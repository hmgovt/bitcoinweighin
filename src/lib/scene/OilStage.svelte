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
	 * Whatever the fuel, what you bought is drawn in bitcoin orange — the
	 * fuel in the tank, the drums' contents, the oil in the hold, the claimed
	 * part of the field — and a gauge on the stage reads how full the last
	 * container is.
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
		PRUDHOE_L,
		VLCC_L,
		formatVolume,
		oilScene,
		type OilScene,
	} from '../oil.js';
	import { fitDistance } from './landPatch.js';
	import { system } from '../stores/system.js';
	import { formatNum } from '../format.js';

	let {
		litres = 0,
		staged = $bindable(false),
		ready = $bindable(false),
	}: {
		/** Fuel bought, litres (btc × price ÷ USD per litre, see oil.ts). */
		litres?: number;
		staged?: boolean;
		ready?: boolean;
	} = $props();

	const BG = 0x18181b;

	/** What you bought, in every container: bitcoin orange. */
	const FUEL_ORANGE = 0xf7931a;

	// ── Real dimensions, metres ──────────────────────────────────
	// A mid-size sedan: 4.7 m long, 1.82 m wide, 2.75 m wheelbase, 1.58 m track, 215/55 R17 tyres.
	const CAR = { len: 4.73, wid: 1.82, wheelR: 0.335, wb: 2.75, track: 1.58, pitch: 2.9 };
	// The 55 L tank under the rear bench: a 0.46 × 0.80 m plan with 6 cm
	// corners (0.3649 m²), 0.1507 m deep — 0.0550 m³.
	const TANK = { x: -0.86, y: 0.22, len: 0.46, h: 0.1507, wid: 0.8 };
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
	/** What the on-stage gauge reads: the rung, and how full its last container is. */
	let gaugeState = $state<{ kind: OilScene['kind']; count: number; fill: number } | null>(null);

	function pct(f: number): string {
		if (f >= 0.995) return 'Full';
		const p = f * 100;
		return `${p >= 1 ? Math.round(p) : p < 0.1 ? '<0.1' : p.toFixed(1)}% full`;
	}

	/** The gauge's words, in the reader's units: a fuel dial for the car, a bar for the rest. */
	const gauge = $derived.by(() => {
		const g = gaugeState;
		if (!g) return null;
		const vol = (L: number) => formatVolume(L, $system);
		const before = g.count - 1;
		switch (g.kind) {
			case 'tank':
				return {
					dial: true,
					fill: g.fill,
					title: g.count > 1 ? `Car ${g.count} of ${g.count}` : 'Fuel gauge',
					detail:
						`${pct(g.fill)} · ${vol(g.fill * CAR_TANK_L)} of ${vol(CAR_TANK_L)}` +
						(before ? ` · ${before} full tank${before > 1 ? 's' : ''} beside it` : ''),
				};
			case 'drums':
				return {
					dial: false,
					fill: g.fill,
					title: before ? `Drum ${formatNum(g.count)}` : 'The drum',
					detail: `${pct(g.fill)}` + (before ? ` · ${formatNum(before)} full drum${before > 1 ? 's' : ''} before it` : ''),
				};
			case 'tanker':
				return {
					dial: false,
					fill: g.fill,
					title: before ? `Tanker ${g.count}’s hold` : 'The hold',
					detail: `${pct(g.fill)} · ${vol(g.fill * VLCC_L)}` + (before ? ` · ${before} full tanker${before > 1 ? 's' : ''}` : ''),
				};
			case 'field': {
				const f = Math.min(1, g.fill);
				return {
					dial: false,
					fill: f,
					title: 'Prudhoe Bay',
					detail:
						f >= 1
							? 'All 13.2 billion barrels claimed'
							: `${f >= 0.1 ? Math.round(f * 100) : (f * 100).toPrecision(2)}% of its 13.2 billion barrels claimed`,
				};
			}
		}
	});

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
	let drumFuel: THREE.InstancedMesh | null = null;
	/** The drum currently drawn part-full, reset to full when the count moves. */
	let partDrum = -1;
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

	/** The fuel's top surface — exactly #f7931a, unlit — and its sides a shade deeper. */
	let liquidMat: THREE.MeshBasicMaterial | null = null;
	let liquidTop: THREE.MeshBasicMaterial | null = null;
	let drumMat: THREE.MeshPhysicalMaterial | null = null;

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
	let frame = { x0: -1, x1: 1, z0: -1, z1: 1, h: 1, elevDeg: 25, margin: 1.15, azDeg: 38 };

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

	/** A plan-view rounded rectangle (x × z), for the moulded tank. */
	function roundedRect(three: typeof THREE, w: number, d: number, r: number): THREE.Shape {
		const sh = new three.Shape();
		const x = w / 2;
		const y = d / 2;
		sh.moveTo(-x + r, -y);
		sh.lineTo(x - r, -y);
		sh.quadraticCurveTo(x, -y, x, -y + r);
		sh.lineTo(x, y - r);
		sh.quadraticCurveTo(x, y, x - r, y);
		sh.lineTo(-x + r, y);
		sh.quadraticCurveTo(-x, y, -x, y - r);
		sh.lineTo(-x, -y + r);
		sh.quadraticCurveTo(-x, -y, -x + r, -y);
		return sh;
	}

	/** Extrude a plan shape upward from y = 0 to y = h: (x, y, z) → (x, z, −y). */
	function upExtrude(three: typeof THREE, shape: THREE.Shape, h: number): THREE.BufferGeometry {
		return new three.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 6 }).rotateX(-Math.PI / 2);
	}

	/** Extrude a side-profile shape (x along the car, y up) to `width`, centred across the car. */
	function sideExtrude(three: typeof THREE, shape: THREE.Shape, width: number, bevel: number): THREE.BufferGeometry {
		const g = new three.ExtrudeGeometry(shape, {
			depth: width - 2 * bevel,
			bevelEnabled: true,
			bevelThickness: bevel,
			bevelSize: bevel * 0.8,
			bevelSegments: 4,
			curveSegments: 20,
		});
		g.translate(0, 0, -(width - 2 * bevel) / 2);
		return g;
	}

	/** A soft contact shadow, drawn once to a canvas. */
	function blobTexture(three: typeof THREE): THREE.Texture {
		const c = document.createElement('canvas');
		c.width = 128;
		c.height = 64;
		const g = c.getContext('2d')!;
		const grad = g.createRadialGradient(64, 32, 4, 64, 32, 62);
		grad.addColorStop(0, 'rgba(0,0,0,0.75)');
		grad.addColorStop(0.55, 'rgba(0,0,0,0.45)');
		grad.addColorStop(1, 'rgba(0,0,0,0)');
		g.setTransform(1, 0, 0, 0.5, 0, 16);
		g.fillStyle = grad;
		g.fillRect(0, 0, 128, 128);
		return track(new three.CanvasTexture(c));
	}

	function buildCars(three: typeof THREE): void {
		if (!scene || !liquidMat) return;
		carsGroup = new three.Group();
		const { wb, track: tr, wheelR } = CAR;
		const ax = wb / 2;

		// ── Materials: an x-ray car — paint and glass see-through, the
		// running gear, seats and tank solid enough to read through them.
		const paint = track(
			new three.MeshPhysicalMaterial({
				color: 0x9aa4b2,
				metalness: 0.55,
				roughness: 0.28,
				clearcoat: 1,
				clearcoatRoughness: 0.12,
				transparent: true,
				opacity: 0.2,
				depthWrite: false,
			})
		);
		const glass = track(
			new three.MeshPhysicalMaterial({
				color: 0x1e2a36,
				metalness: 0,
				roughness: 0.05,
				clearcoat: 1,
				transparent: true,
				opacity: 0.3,
				depthWrite: false,
			})
		);
		const outline = track(new three.LineBasicMaterial({ color: 0xd4d8de, transparent: true, opacity: 0.4 }));
		const tyreMat = std(three, 0x141416, { roughness: 0.92 });
		const rimMat = std(three, 0xc9ced6, { metalness: 0.9, roughness: 0.28 });
		const hubMat = std(three, 0x2a2b30, { metalness: 0.6, roughness: 0.5 });
		const steel = std(three, 0x55585f, { metalness: 0.7, roughness: 0.45 });
		const seatMat = std(three, 0x3a3b42, { transparent: true, opacity: 0.4, depthWrite: false, roughness: 0.9 });
		const headMat = std(three, 0xf4f6fa, { emissive: new three.Color(0xdfe8ff), emissiveIntensity: 0.6, roughness: 0.2 });
		const tailMat = std(three, 0x7a0d0d, { emissive: new three.Color(0xb3121b), emissiveIntensity: 0.5, roughness: 0.3 });
		// Moulded HDPE fuel tank, natural (milky) plastic, translucent so the fuel level shows.
		const hdpe = std(three, 0xd9d5ca, { transparent: true, opacity: 0.22, depthWrite: false, roughness: 0.5 });
		const tankLine = track(new three.LineBasicMaterial({ color: 0xf4f4f5, transparent: true, opacity: 0.85 }));
		const neckMat = std(three, 0x2b2d31, { roughness: 0.6 });

		// ── Body: a sedan's side profile, wheel arches cut, edges rounded.
		const archR = wheelR + 0.06;
		const body = new three.Shape();
		body.moveTo(2.25, 0.3);
		body.lineTo(ax + archR, 0.3);
		body.absarc(ax, 0.3, archR, 0, Math.PI, false);
		body.lineTo(-ax + archR, 0.3);
		body.absarc(-ax, 0.3, archR, 0, Math.PI, false);
		body.lineTo(-2.26, 0.3);
		body.quadraticCurveTo(-2.36, 0.32, -2.36, 0.5); // rear bumper
		body.lineTo(-2.34, 0.78);
		body.quadraticCurveTo(-2.32, 0.95, -2.12, 0.98); // boot lid lip
		body.lineTo(-1.42, 1.0);
		body.lineTo(1.0, 0.97); // beltline
		body.quadraticCurveTo(1.7, 0.94, 2.1, 0.84); // bonnet
		body.quadraticCurveTo(2.36, 0.78, 2.37, 0.6); // nose
		body.lineTo(2.35, 0.38);
		body.quadraticCurveTo(2.33, 0.3, 2.25, 0.3);
		const bodyGeo = track(sideExtrude(three, body, CAR.wid, 0.08));
		const bodyEdges = track(new three.EdgesGeometry(bodyGeo, 28));

		// Glasshouse: rear screen, roof, windscreen.
		const house = new three.Shape();
		house.moveTo(-1.42, 0.98);
		house.quadraticCurveTo(-1.05, 1.32, -0.62, 1.42);
		house.lineTo(0.28, 1.44);
		house.quadraticCurveTo(0.6, 1.42, 1.02, 0.96);
		house.lineTo(-1.42, 0.98);
		const houseGeo = track(sideExtrude(three, house, CAR.wid - 0.2, 0.06));
		const houseEdges = track(new three.EdgesGeometry(houseGeo, 28));

		// Wheels: tyre, dark hub, five silver spokes and a rim lip.
		const tyreGeo = track(new three.CylinderGeometry(wheelR, wheelR, 0.215, 36).rotateX(Math.PI / 2));
		const hubGeo = track(new three.CylinderGeometry(0.205, 0.205, 0.222, 30).rotateX(Math.PI / 2));
		const lipGeo = track(new three.TorusGeometry(0.205, 0.016, 8, 36));
		const spokeGeo = track(new three.BoxGeometry(0.05, 0.4, 0.226));
		const capGeo = track(new three.CylinderGeometry(0.045, 0.045, 0.23, 16).rotateX(Math.PI / 2));

		// Lights, seats, axles and exhaust.
		const headGeo = track(new three.BoxGeometry(0.04, 0.07, 0.36));
		const tailGeo = track(new three.BoxGeometry(0.05, 0.1, 0.42));
		const cushion = track(new three.BoxGeometry(0.52, 0.12, 0.5));
		const backrest = track(new three.BoxGeometry(0.12, 0.6, 0.5));
		const bench = track(new three.BoxGeometry(0.52, 0.12, 1.4));
		const benchBack = track(new three.BoxGeometry(0.12, 0.58, 1.4));
		const axleGeo = track(new three.CylinderGeometry(0.03, 0.03, tr, 10).rotateX(Math.PI / 2));
		const exhaustGeo = track(
			new three.TubeGeometry(
				new three.CatmullRomCurve3([
					new three.Vector3(1.6, 0.3, -0.25),
					new three.Vector3(0.4, 0.2, -0.3),
					new three.Vector3(-0.5, 0.2, -0.5),
					new three.Vector3(-1.6, 0.22, -0.5),
					new three.Vector3(-2.38, 0.26, -0.55),
				]),
				40,
				0.03,
				8
			)
		);

		// ── The tank: a moulded saddle tank across the car under the rear
		// bench, 0.46 m long × 0.80 m wide × 0.151 m deep with 6 cm
		// corners — 55 litres. Fuel is the same plan, inset, at its level.
		const tankShape = roundedRect(three, TANK.len, TANK.wid, 0.06);
		const tankGeo = track(upExtrude(three, tankShape, TANK.h));
		const tankEdges = track(new three.EdgesGeometry(tankGeo, 30));
		const fuelGeo = track(upExtrude(three, roundedRect(three, TANK.len - 0.012, TANK.wid - 0.012, 0.054), 1));
		const strapGeo = track(new three.BoxGeometry(0.04, 0.006, TANK.wid + 0.08));
		const pumpGeo = track(new three.CylinderGeometry(0.06, 0.06, 0.03, 20));
		// Filler neck: from the tank's right shoulder up to the fuel door.
		const doorX = -1.72;
		const neckGeo = track(
			new three.TubeGeometry(
				new three.CatmullRomCurve3([
					new three.Vector3(TANK.x - 0.12, TANK.y + TANK.h - 0.01, TANK.wid / 2 - 0.08),
					new three.Vector3(TANK.x - 0.35, TANK.y + TANK.h + 0.06, TANK.wid / 2 + 0.02),
					new three.Vector3(doorX + 0.1, 0.72, CAR.wid / 2 - 0.12),
					new three.Vector3(doorX, 0.8, CAR.wid / 2 - 0.02),
				]),
				32,
				0.022,
				10
			)
		);
		const doorGeo = track(new three.CircleGeometry(0.085, 28));
		const doorRing = track(new three.EdgesGeometry(new three.CircleGeometry(0.09, 28)));
		const blob = track(
			new three.MeshBasicMaterial({ map: blobTexture(three), transparent: true, depthWrite: false, toneMapped: false })
		);
		const blobGeo = track(new three.PlaneGeometry(CAR.len * 1.25, CAR.wid * 1.6).rotateX(-Math.PI / 2));

		for (let k = 0; k < MAX_CARS; k++) {
			const root = new three.Group();
			const shadow = new three.Mesh(blobGeo, blob);
			shadow.position.y = 0.004;
			shadow.renderOrder = -1;
			const shell = new three.Mesh(bodyGeo, paint);
			const glassHouse = new three.Mesh(houseGeo, glass);
			shell.renderOrder = glassHouse.renderOrder = 3;
			root.add(
				shadow,
				shell,
				glassHouse,
				new three.LineSegments(bodyEdges, outline),
				new three.LineSegments(houseEdges, outline)
			);

			for (const [x, side] of [
				[ax, 1],
				[ax, -1],
				[-ax, 1],
				[-ax, -1],
			]) {
				const w = new three.Group();
				w.add(new three.Mesh(tyreGeo, tyreMat), new three.Mesh(hubGeo, hubMat), new three.Mesh(capGeo, rimMat));
				for (let i = 0; i < 5; i++) {
					const sp = new three.Mesh(spokeGeo, rimMat);
					sp.rotation.z = (i * 2 * Math.PI) / 5;
					w.add(sp);
				}
				for (const f of [-1, 1]) {
					const lip = new three.Mesh(lipGeo, rimMat);
					lip.position.z = f * 0.11;
					w.add(lip);
				}
				w.position.set(x, wheelR, (side * tr) / 2);
				root.add(w);
			}
			for (const x of [ax, -ax]) {
				const a = new three.Mesh(axleGeo, steel);
				a.position.set(x, wheelR, 0);
				root.add(a);
			}
			root.add(new three.Mesh(exhaustGeo, steel));
			for (const z of [-0.62, 0.62]) {
				const h = new three.Mesh(headGeo, headMat);
				h.position.set(2.305, 0.69, z * 0.95);
				const t = new three.Mesh(tailGeo, tailMat);
				t.position.set(-2.325, 0.84, z);
				root.add(h, t);
			}
			// Front seats and the rear bench (over the tank).
			for (const z of [-0.42, 0.42]) {
				const c = new three.Mesh(cushion, seatMat);
				c.position.set(0.15, 0.56, z);
				const b = new three.Mesh(backrest, seatMat);
				b.position.set(-0.17, 0.88, z);
				b.rotation.z = 0.18;
				root.add(c, b);
			}
			const rb = new three.Mesh(bench, seatMat);
			rb.position.set(-0.85, 0.58, 0);
			const rbb = new three.Mesh(benchBack, seatMat);
			rbb.position.set(-1.18, 0.9, 0);
			rbb.rotation.z = 0.25;
			root.add(rb, rbb);

			// Tank, straps, pump flange, filler neck and fuel door.
			const tankMesh = new three.Mesh(tankGeo, hdpe);
			tankMesh.position.set(TANK.x, TANK.y, 0);
			tankMesh.renderOrder = 2;
			const tankOutline = new three.LineSegments(tankEdges, tankLine);
			tankOutline.position.copy(tankMesh.position);
			const fuelMesh = new three.Mesh(fuelGeo, [liquidTop!, liquidMat]);
			fuelMesh.position.set(TANK.x, TANK.y + 0.006, 0);
			root.add(fuelMesh, tankMesh, tankOutline);
			for (const dx of [-0.13, 0.13]) {
				const st = new three.Mesh(strapGeo, steel);
				st.position.set(TANK.x + dx, TANK.y - 0.004, 0);
				root.add(st);
			}
			const pump = new three.Mesh(pumpGeo, neckMat);
			pump.position.set(TANK.x + 0.05, TANK.y + TANK.h + 0.015, -0.12);
			root.add(pump, new three.Mesh(neckGeo, neckMat));
			const door = new three.Mesh(doorGeo, std(three, 0x6b7280, { metalness: 0.6, roughness: 0.35 }));
			door.position.set(doorX, 0.8, CAR.wid / 2 + 0.005);
			const ring = new three.LineSegments(doorRing, tankLine);
			ring.position.copy(door.position);
			root.add(door, ring);

			root.position.set(0, 0, -k * CAR.pitch);
			carsGroup.add(root);
			cars.push({ root, fuel: fuelMesh });
		}
		scene.add(carsGroup);
	}

	function buildDrums(three: typeof THREE): void {
		if (!scene || !drumMat || !liquidMat) return;
		// Steel drums drawn see-through, the fuel inside at its level.
		const body = track(new three.CylinderGeometry(DRUM.r, DRUM.r, DRUM.h, 20));
		const fuelGeo = track(new three.CylinderGeometry(DRUM.r * 0.95, DRUM.r * 0.95, 1, 20).translate(0, 0.5, 0));
		const pal = track(new three.BoxGeometry(DRUM.pallet, DRUM.palletH, DRUM.pallet));
		drumFuel = new three.InstancedMesh(fuelGeo, [liquidMat, liquidTop!, liquidMat], MAX_DRUMS);
		drums = new three.InstancedMesh(body, drumMat, MAX_DRUMS);
		drums.renderOrder = 2;
		pallets = new three.InstancedMesh(pal, std(three, 0x8a6a45, { roughness: 1 }), Math.ceil(MAX_DRUMS / 4));
		for (const m of [drumFuel, drums, pallets]) {
			m.frustumCulled = false;
			m.count = 0;
			scene.add(m);
		}
	}

	/** Centre of drum `i` on the floor, for a yard `side` pallets square. */
	function drumAt(i: number, side: number): [number, number] {
		const p = Math.floor(i / 4);
		const d = i % 4;
		return [-(p % side) * DRUM.pitch + (d % 2 ? 1 : -1) * 0.3, -Math.floor(p / side) * DRUM.pitch + (d < 2 ? 1 : -1) * 0.3];
	}

	const DRUM_FULL_H = DRUM.h - 0.03;

	function setDrumFuel(three: typeof THREE, i: number, side: number, fill: number): void {
		if (!drumFuel) return;
		const [x, z] = drumAt(i, side);
		const m = new three.Matrix4().compose(
			new three.Vector3(x, DRUM.palletH + 0.015, z),
			new three.Quaternion(),
			new three.Vector3(1, fill > 0.002 ? DRUM_FULL_H * fill : 1e-6, 1)
		);
		drumFuel.setMatrixAt(i, m);
		drumFuel.instanceMatrix.needsUpdate = true;
	}

	/** Lay out `n` drums four to a pallet, the pallets in a square growing away from the camera; the last `lastFill` full. */
	function layDrums(three: typeof THREE, n: number, lastFill: number): void {
		if (!drums || !drumFuel || !pallets) return;
		const nPal = Math.ceil(n / 4);
		const side = Math.max(1, Math.ceil(Math.sqrt(nPal)));
		if (side !== drumsSide) {
			drumsSide = side;
			partDrum = -1;
			const m = new three.Matrix4();
			const total = Math.min(MAX_DRUMS, side * side * 4);
			for (let p = 0; p < Math.ceil(total / 4); p++) {
				m.makeTranslation(-(p % side) * DRUM.pitch, DRUM.palletH / 2, -Math.floor(p / side) * DRUM.pitch);
				pallets.setMatrixAt(p, m);
			}
			for (let i = 0; i < total; i++) {
				const [x, z] = drumAt(i, side);
				m.makeTranslation(x, DRUM.palletH + DRUM.h / 2, z);
				drums.setMatrixAt(i, m);
				setDrumFuel(three, i, side, 1);
			}
			drums.instanceMatrix.needsUpdate = true;
			pallets.instanceMatrix.needsUpdate = true;
		}
		// Only the last drum is part-full: refill the one that was, then lower this one.
		if (partDrum >= 0 && partDrum !== n - 1) setDrumFuel(three, partDrum, side, 1);
		setDrumFuel(three, n - 1, side, lastFill);
		partDrum = n - 1;
		drums.count = n;
		drumFuel.count = n;
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
		// Deck in tanker green; orange is kept for the oil alone.
		const deckMat = std(three, 0x4d5a4c, { roughness: 0.9 });
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
		const funnelMat = std(three, 0x1f2024, { roughness: 0.6 });
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
			const oil = new three.Mesh(oilGeo, [liquidMat, liquidMat, liquidTop!, liquidMat, liquidMat, liquidMat]);
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
			track(new three.MeshBasicMaterial({ color: FUEL_ORANGE, transparent: true, opacity: 0.85, toneMapped: false })),
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
		drums.visible = drumFuel!.visible = pallets!.visible = kind === 'drums';
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
				// Under ~0.1 L there's nothing to see: a film would claim more than is there.
				c.fuel.visible = f > 0.002;
				c.fuel.scale.y = Math.max((TANK.h - 0.012) * f, 0.0005);
			});
			// Seen from the rear right quarter, the fuel-door side; Sat sits by the boot.
			dog?.position.set(-CAR.len / 2 - 0.45, 0, CAR.wid / 2 + 0.25);
			dog?.rotation.set(0, Math.PI * 0.85, 0);
			const zBack = -(s.count - 1) * CAR.pitch - CAR.wid / 2;
			frame = { x0: -CAR.len / 2 - 0.7, x1: CAR.len / 2, z0: zBack, z1: CAR.wid / 2 + 0.4, h: 1.45, elevDeg: 27, margin: 1.04, azDeg: -48 };
			caption = `Mid-size sedan, drawn see-through · its ${CAR_TANK_L} L tank sits under the rear bench, filled to the true level`;
		} else if (kind === 'drums') {
			layDrums(three, s.count, s.lastFill);
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
				azDeg: 38,
			};
			caption = '55-gallon steel drums (208 L), four to a pallet, drawn see-through';
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
				azDeg: 38,
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
				azDeg: 38,
			};
			caption = 'Pump jacks · each stands for 1/1,600 of Prudhoe Bay’s 13.2 billion barrels';
		}
		gaugeState =
			L > 0
				? { kind, count: s.count, fill: kind === 'field' ? L / PRUDHOE_L : s.lastFill }
				: null;
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
		const { x0, x1, z0, z1, h, elevDeg, margin, azDeg } = frame;
		const elev = (elevDeg * Math.PI) / 180;
		const az = (azDeg * Math.PI) / 180 + swayRad;
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

		// Unlit and not tone-mapped, so lighting can't wash it towards yellow;
		// the sides a shade deeper than the surface, so a level reads as a level.
		liquidMat = track(new three.MeshBasicMaterial({ color: 0xd2770c, toneMapped: false, fog: false }));
		liquidTop = track(new three.MeshBasicMaterial({ color: FUEL_ORANGE, toneMapped: false, fog: false }));
		drumMat = track(
			new three.MeshPhysicalMaterial({
				color: 0xa7adb6,
				metalness: 0.6,
				roughness: 0.35,
				clearcoat: 0.6,
				transparent: true,
				opacity: 0.3,
				depthWrite: false,
			})
		);
		buildCars(three);
		buildDrums(three);
		buildShips(three);
		buildField(three, bguMod.mergeGeometries);
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
		for (const m of [drums, drumFuel, pallets, jacksLit, jacksDark, pads]) m?.dispose();
		if (renderer) {
			renderer.domElement.remove();
			renderer.dispose();
		}
		renderer = scene = camera = null;
		carsGroup = shipsGroup = fieldGroup = null;
		drums = drumFuel = pallets = jacksLit = jacksDark = pads = null;
		partDrum = -1;
		drumsSide = -1;
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

</script>

<div class="oil-stage" bind:this={containerEl}>
	{#if loading}
		<div class="oil-note">Filling up…</div>
	{:else if noWebGL}
		<div class="oil-note">The 3-D scene couldn't load here; the figures below still hold.</div>
	{/if}
	{#if gauge && !noWebGL && !loading}
		<div class="oil-gauge" aria-label="{gauge.title}: {gauge.detail}">
			<div class="g-title">{gauge.title}</div>
			{#if gauge.dial}
				{@const th = Math.PI * (1 - Math.min(1, Math.max(0, gauge.fill)))}
				<svg class="g-dial" viewBox="0 0 120 68" aria-hidden="true">
					<path d="M 12 60 A 48 48 0 0 1 108 60" class="g-track" />
					{#if gauge.fill > 0.002}
						<path
							d="M 12 60 A 48 48 0 0 1 {60 + 48 * Math.cos(th)} {60 - 48 * Math.sin(th)}"
							class="g-arc"
						/>
					{/if}
					{#each [0, 0.25, 0.5, 0.75, 1] as t (t)}
						{@const a = Math.PI * (1 - t)}
						<line
							x1={60 + 40 * Math.cos(a)}
							y1={60 - 40 * Math.sin(a)}
							x2={60 + 34 * Math.cos(a)}
							y2={60 - 34 * Math.sin(a)}
							class="g-tick"
						/>
					{/each}
					<text x="8" y="67" class="g-ef">E</text>
					<text x="106" y="67" class="g-ef">F</text>
					<line x1="60" y1="60" x2={60 + 38 * Math.cos(th)} y2={60 - 38 * Math.sin(th)} class="g-needle" />
					<circle cx="60" cy="60" r="4" class="g-hub" />
				</svg>
			{:else}
				<div class="g-bar"><div class="g-bar-fill" style:width="{Math.min(100, gauge.fill * 100)}%"></div></div>
			{/if}
			<div class="g-detail">{gauge.detail}</div>
		</div>
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
	.oil-gauge {
		position: absolute;
		top: 10px;
		left: 10px;
		z-index: 1;
		width: 168px;
		padding: 8px 10px 9px;
		border-radius: 8px;
		background: rgba(17, 17, 19, 0.72);
		border: 1px solid rgba(247, 147, 26, 0.35);
		backdrop-filter: blur(4px);
		pointer-events: none;
		font-family: 'Inter Tight', system-ui, sans-serif;
	}
	.g-title {
		font-size: 9.5px;
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: #a1a1aa;
	}
	.g-dial {
		display: block;
		width: 100%;
		height: auto;
		margin-top: 4px;
	}
	.g-track {
		fill: none;
		stroke: #3f3f46;
		stroke-width: 7;
		stroke-linecap: round;
	}
	.g-arc {
		fill: none;
		stroke: #f7931a;
		stroke-width: 7;
		stroke-linecap: round;
	}
	.g-tick {
		stroke: #71717a;
		stroke-width: 1.5;
	}
	.g-ef {
		font: 700 9px 'Inter Tight', system-ui, sans-serif;
		fill: #a1a1aa;
	}
	.g-needle {
		stroke: #fafafa;
		stroke-width: 2.5;
		stroke-linecap: round;
	}
	.g-hub {
		fill: #fafafa;
	}
	.g-bar {
		height: 8px;
		margin-top: 7px;
		border-radius: 4px;
		background: #3f3f46;
		overflow: hidden;
	}
	.g-bar-fill {
		height: 100%;
		min-width: 2px;
		background: #f7931a;
		border-radius: 4px;
	}
	.g-detail {
		margin-top: 6px;
		font: 500 11px/1.35 'JetBrains Mono', ui-monospace, monospace;
		color: #fafafa;
		font-variant-numeric: tabular-nums;
	}
	@media (max-width: 520px) {
		.oil-gauge {
			width: 118px;
			padding: 6px 8px 7px;
		}
		.g-dial {
			width: 84px;
		}
		.g-detail {
			font-size: 9.5px;
		}
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
