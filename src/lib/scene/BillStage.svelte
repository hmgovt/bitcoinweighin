<!-- src/lib/scene/BillStage.svelte -->
<script lang="ts">
	/**
	 * BillStage — the Cash tab's live WebGL stage. Sibling to LiveStage.svelte
	 * (not an extension of it) because the mesh strategy is different: every
	 * note, strap, bundle and pallet load is a true-size textured box, not a
	 * single scaled cube.
	 *
	 * `noteCount` is drawn exactly, in the units cash is handled in
	 * (`billStack.ts` `cashParts`): a loose stack; straps of 100 in small
	 * piles; bundles of 1,000 in a roughly cubic stack with a shorter last
	 * bundle for the remainder; pallets of 1,000,000 on wooden bases under
	 * shrink-wrap, then, past PALLET_RENDER_CAP, one block of them. Up to
	 * seven of the notes (from the remainder, never a broken unit) lie loose
	 * on the floor — curled, folded, face down — so the note art stays in
	 * frame at every scale. The art itself is printed at runtime from
	 * noteArt.ts (billMaterials.ts); it is deliberately not a reproduction
	 * of genuine Federal Reserve Note artwork. The single-stack height is
	 * told in words, as a line in BillReadout. The camera is the cocaine
	 * stage's money-first shot (`cocaine-scene.ts` `stageCamera`): raised,
	 * framing the load, so the notes' print reads; Sat sits behind a small
	 * pile or beside a larger one, and at monolith scale the shot blends into
	 * the SAME tested rig LiveStage drives its cube from (`M.cameraTransform`
	 * + `M.dogStagePosition` in `./maths.js`).
	 */
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type * as THREE from 'three';
	// The same money-first shot the cocaine stage uses: a raised camera that
	// frames the load, Sat beside it (or behind a small pile), walking out to
	// the foreground only once the load is big.
	import { stageCamera, dogBeside, shotBounds, groundMark, DOG_REACH_M, type Extent } from '../cocaine-scene.js';

	let {
		noteCount = 0,
		staged = $bindable(false),
		ready = $bindable(false),
	}: {
		noteCount?: number;
		/** True when the dog has walked to the foreground (readout honesty line). */
		staged?: boolean;
		/** True once the bill scene has actually rendered a frame AND the Shiba
		 *  has resolved (loaded or failed) — HeroStage gates the X-bot's
		 *  data-commodity attribute on this, so the card screenshotter can never
		 *  capture a blank or dog-less frame mid-hydration. */
		ready?: boolean;
	} = $props();

	const BG = 0x18181b;

	let containerEl: HTMLDivElement | undefined = $state();
	let canvasActive = $state(false);

	let T: typeof THREE | null = null;
	let renderer: THREE.WebGLRenderer | null = null;
	let scene: THREE.Scene | null = null;
	let camera: THREE.PerspectiveCamera | null = null;
	let key: THREE.DirectionalLight | null = null;
	let camPos: THREE.Vector3 | null = null;
	let camAim: THREE.Vector3 | null = null;
	let envTexture: THREE.Texture | null = null;
	let dog: THREE.Object3D | null = null;
	let mixer: THREE.AnimationMixer | null = null;
	let idleAction: THREE.AnimationAction | null = null;

	// Maths / bill-stack / bill-materials modules (dynamic-imported once in
	// hydrate) — held so reframe()/refreshStage()/renderTiered() can reach
	// them without re-importing per call.
	let M: typeof import('./maths.js') | null = null;
	let BS: typeof import('../billStack.js') | null = null;
	let BM: typeof import('./billMaterials.js') | null = null;
	/** Pallet wood and shrink-wrap, shared with the cocaine stage. */
	let cocaineProps: typeof import('./cocaineProps.js') | null = null;
	let maxAnisotropy = 1;

	// Built once in hydrate: every note, strap, bundle and pallet material
	// (billMaterials.ts, printed from noteArt.ts), one true-size note as a
	// box, and the pallet wood and shrink-wrap. `cash` is $state so the
	// tiered-render $effect re-runs once they exist.
	let cash: import('./billMaterials.js').CashMaterials | null = $state(null);
	let noteBox: THREE.BufferGeometry | null = null;
	let palletMats: { wood: THREE.MeshStandardMaterial; film: THREE.MeshPhysicalMaterial } | null = null;
	let sharedMats = new Set<THREE.Material>();
	let groundGeometry: THREE.BufferGeometry | null = null;
	let groundMaterial: THREE.MeshStandardMaterial | null = null;

	let width = 0;
	let height = 0;
	let destroyed = false;
	let rafId = 0;
	let resizeObs: ResizeObserver | null = null;

	function hasWebGL(): boolean {
		try {
			const c = document.createElement('canvas');
			return !!(c.getContext('webgl2') || c.getContext('webgl'));
		} catch {
			return false;
		}
	}


	// Heights of the cash-handling units, metres.
	const T_NOTE = 0.10922 / 1000;
	const STRAP_H = 100 * T_NOTE;
	const BUNDLE_H = 1000 * T_NOTE;
	/** Individually drawn pallets up to this many; past it, one block of them. */
	const PALLET_RENDER_CAP = 60;

	let tierGroup: THREE.Group | null = null;
	/** What `renderTiered` last built: the load's bounds (strays included)
	 *  and whether it's a small loose pile (Sat sits behind it). */
	let extent: Extent = { w: 0.16, d: 0.07, h: 0.001 };
	let loosePile = true;
	/** Less than one whole note: nothing on the floor but Sat. */
	let empty = true;

	/** Deterministic 0–1, so a given amount always lays out the same way. */
	function hash(i: number, k = 0): number {
		const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
		return v - Math.floor(v);
	}

	/** Removes the current tier's group and frees what it alone owns: its
	 *  geometries (never the shared note box) and any material not in the
	 *  shared cash/pallet set, with that material's maps. Shared resources
	 *  are freed once, in `teardown`. */
	function clearTierGroup(): void {
		if (!scene || !tierGroup) return;
		scene.remove(tierGroup);
		const geoms = new Set<THREE.BufferGeometry>();
		const matsToFree = new Set<THREE.Material>();
		tierGroup.traverse((child) => {
			const mesh = child as THREE.Mesh;
			if (!mesh.isMesh) return;
			if (mesh.geometry !== noteBox) geoms.add(mesh.geometry);
			for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
				if (!sharedMats.has(m)) matsToFree.add(m);
			}
		});
		for (const g of geoms) g.dispose();
		for (const m of matsToFree) {
			const sm = m as THREE.MeshStandardMaterial;
			sm.map?.dispose();
			sm.bumpMap?.dispose();
			m.dispose();
		}
		tierGroup = null;
	}

	function instanced(
		geom: THREE.BufferGeometry,
		mat: THREE.Material | THREE.Material[],
		placed: { x: number; y: number; z: number; rotY: number }[],
		shade = 0.05
	): THREE.InstancedMesh {
		const three = T!;
		const mesh = new three.InstancedMesh(geom, mat, Math.max(1, placed.length));
		const m = new three.Matrix4();
		const c = new three.Color();
		placed.forEach((p, i) => {
			m.makeRotationY(p.rotY);
			m.setPosition(p.x, p.y, p.z);
			mesh.setMatrixAt(i, m);
			// Faint per-item tone so identical units don't fuse into one slab.
			c.setScalar(1 - shade + hash(i, 9) * shade);
			mesh.setColorAt(i, c);
		});
		mesh.count = placed.length;
		mesh.instanceMatrix.needsUpdate = true;
		if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		return mesh;
	}

	/** A loose note, curled, folded or crumpled — a plane with the face on
	 *  its front and the back on its back. Length along x. */
	function looseNote(kind: number, L: number, W: number): THREE.Group {
		const three = T!;
		const g = new three.PlaneGeometry(L, W, 28, 8);
		const pos = g.attributes.position;
		for (let i = 0; i < pos.count; i++) {
			const x = pos.getX(i);
			const y = pos.getY(i);
			let z = 0;
			if (kind === 1) z = 0.07 * L * Math.sin(Math.PI * (x / L + 0.5)); // curled along its length
			else if (kind === 2) z = Math.max(0, 0.2 * L * (1 - Math.abs(x) / (L * 0.5))); // folded once
			else if (kind === 3) z = 0.1 * W * Math.sin(Math.PI * (y / W + 0.5)) + 0.004 * Math.sin(x * 90); // curled across, crinkled
			else z = 0.0015 * Math.sin(x * 40 + y * 30); // near-flat
			pos.setZ(i, z);
		}
		pos.needsUpdate = true;
		g.computeVertexNormals();
		g.rotateX(-Math.PI / 2);
		g.computeBoundingBox();
		const group = new three.Group();
		const front = new three.Mesh(g, cash!.looseFace);
		const back = new three.Mesh(g, cash!.looseBack);
		front.castShadow = true;
		front.receiveShadow = back.receiveShadow = true;
		group.add(front, back);
		return group;
	}

	/** `n` loose notes scattered around the load's footprint, taken from the
	 *  count (see billStack.ts `cashParts`) — true size, never enlarged. */
	function addStrays(n: number, L: number, W: number, footprintHalf: number): void {
		for (let i = 0; i < n; i++) {
			const note = looseNote(i % 5, L, W);
			const r = footprintHalf + L * (0.05 + hash(i, 1) * 0.4);
			const a = hash(i, 2) * Math.PI * 2;
			note.rotation.y = hash(i, 3) * Math.PI * 2;
			const faceDown = hash(i, 4) > 0.65;
			if (faceDown) note.rotation.x = Math.PI;
			// Rest it on the floor: its lowest point (the curl's ends face up,
			// its crown face down) just clear of the ground, staggered so
			// overlapping notes never z-fight.
			const bb = (note.children[0] as THREE.Mesh).geometry.boundingBox!;
			const lift = faceDown ? bb.max.y : -bb.min.y;
			note.position.set(Math.cos(a) * r, lift + 0.0003 + i * 0.00015, Math.sin(a) * r);
			tierGroup!.add(note);
		}
	}

	/** A loose stack of `n` notes, a little messy, face up, at (x, z). */
	function looseStack(n: number, x: number, z: number, W: number, L: number): void {
		if (n <= 0) return;
		const placed = Array.from({ length: n }, (_, i) => ({
			x: x + (hash(i, 11) - 0.5) * W * 0.08,
			y: T_NOTE * (i + 0.5),
			z: z + (hash(i, 12) - 0.5) * L * 0.05,
			rotY: (hash(i, 13) - 0.5) * 0.14,
		}));
		tierGroup!.add(instanced(noteBox!, cash!.note, placed, 0.04));
	}

	/**
	 * Build the scene for `count` notes in real cash-handling units and
	 * record its bounds in `extent` for the camera. Exact: see
	 * `cashParts` — strays come out of the count, a remainder is a shorter
	 * bundle or pallet, never a rounded-up whole one.
	 */
	function renderTiered(three: typeof THREE, billStackMod: typeof import('../billStack.js'), count: number): void {
		if (!scene || !cash || !noteBox) return;
		clearTierGroup();
		tierGroup = new three.Group();
		const tier = billStackMod.selectBillTier(Math.floor(count + 1e-6));
		loosePile = tier !== 'bundle' && tier !== 'cube' && tier !== 'pallet';
		empty = !tier;
		if (!tier) {
			scene.add(tierGroup);
			extent = { w: 0.16, d: 0.07, h: 0.001 };
			return;
		}
		const parts = billStackMod.cashParts(count);
		const W = billStackMod.BILL_WIDTH_MM / 1000;
		const L = billStackMod.BILL_LENGTH_MM / 1000;

		// The load's footprint (x, z) and height, m.
		let w = L;
		let d = L;
		let h = T_NOTE;

		if (tier === 'loose') {
			looseStack(parts.loose, 0, 0, W, L);
			// Some floor around a few notes, so the shot doesn't crop them.
			// (A close camera exaggerates the near corner, hence the margin.)
			w = W * 2.3;
			d = L * 1.75;
			h = Math.max(parts.loose * T_NOTE, T_NOTE);
		} else if (tier === 'strap') {
			// Straps in small piles (six high), the loose remainder beside them.
			const perPile = 6;
			const piles = Math.ceil(parts.straps / perPile);
			const cols = piles + (parts.loose ? 1 : 0);
			const pitch = W * 1.25;
			const colX = (c: number) => (c - (cols - 1) / 2) * pitch;
			const placed = [];
			for (let i = 0; i < parts.straps; i++) {
				placed.push({
					x: colX(Math.floor(i / perPile)) + (hash(i, 21) - 0.5) * 0.004,
					y: (i % perPile) * STRAP_H + STRAP_H / 2,
					z: (hash(i, 22) - 0.5) * 0.006,
					rotY: (hash(i, 23) - 0.5) * 0.05,
				});
			}
			tierGroup.add(instanced(new three.BoxGeometry(W, STRAP_H, L), cash.strap, placed, 0.03));
			if (parts.loose) looseStack(parts.loose, colX(piles), 0, W, L);
			w = cols * pitch;
			h = Math.min(parts.straps, perPile) * STRAP_H;
		} else if (tier === 'bundle' || tier === 'cube') {
			// Bundles of 1,000 in a roughly cubic stack, laid a layer at a time
			// so a part-bundle (the remainder) sits last on the top layer.
			const n = parts.bundles + (parts.partialNotes ? 1 : 0);
			const grid = billStackMod.cubicGridDims(n, billStackMod.BILL_WIDTH_MM, billStackMod.BILL_LENGTH_MM, BUNDLE_H * 1000);
			const px = W * 1.06;
			const pz = L * 1.06;
			const slots: { x: number; y: number; z: number; rotY: number }[] = [];
			for (let i = 0; i < n; i++) {
				const perLayer = grid.colsX * grid.colsZ;
				const layer = Math.floor(i / perLayer);
				const j = i % perLayer;
				const ix = j % grid.colsX;
				const iz = Math.floor(j / grid.colsX);
				slots.push({
					x: (ix - (grid.colsX - 1) / 2) * px + (hash(i, 31) - 0.5) * (px - W) * 0.5,
					y: layer * BUNDLE_H * 1.002,
					z: (iz - (grid.colsZ - 1) / 2) * pz + (hash(i, 32) - 0.5) * (pz - L) * 0.5,
					rotY: (hash(i, 33) - 0.5) * 0.03,
				});
			}
			const whole = slots.slice(0, parts.bundles).map((p) => ({ ...p, y: p.y + BUNDLE_H / 2 }));
			if (whole.length) tierGroup.add(instanced(new three.BoxGeometry(W, BUNDLE_H, L), cash.bundle, whole, 0.04));
			if (parts.partialNotes) {
				const h = parts.partialNotes * T_NOTE;
				const p = slots[slots.length - 1];
				const mesh = new three.Mesh(new three.BoxGeometry(W, h, L), cash.partial(parts.partialNotes));
				mesh.position.set(p.x, p.y + h / 2, p.z);
				mesh.rotation.y = p.rotY;
				mesh.castShadow = mesh.receiveShadow = true;
				tierGroup.add(mesh);
			}
			w = grid.colsX * px;
			d = grid.colsZ * pz;
			h = Math.ceil(n / (grid.colsX * grid.colsZ)) * BUNDLE_H;
		} else {
			// Pallets: 10 × 10 × 10 bundles ($1,000,000) on a pallet, under
			// shrink-wrap. A part-load is fewer courses on the last pallet.
			const pw = 10 * W;
			const pl = 10 * L;
			const loadH = 10 * BUNDLE_H;
			const deck = billStackMod.PALLET_DECK_M;
			const pitch = billStackMod.PALLET_PITCH;
			const unitH = deck + loadH;
			const n = parts.pallets + (parts.partialNotes ? 1 : 0);
			if (n <= PALLET_RENDER_CAP) {
				const grid = billStackMod.cubicGridDims(n, pw * 1000 * pitch, pl * 1000 * pitch, unitH * 1000);
				const px = pw * pitch;
				const pz = pl * pitch;
				const slots: { x: number; y: number; z: number; rotY: number }[] = [];
				for (let i = 0; i < n; i++) {
					const perLayer = grid.colsX * grid.colsZ;
					const layer = Math.floor(i / perLayer);
					const j = i % perLayer;
					slots.push({
						x: ((j % grid.colsX) - (grid.colsX - 1) / 2) * px,
						y: layer * unitH,
						z: (Math.floor(j / grid.colsX) - (grid.colsZ - 1) / 2) * pz,
						rotY: (hash(i, 41) - 0.5) * 0.03,
					});
				}
				const woodG = cocaineProps!.makePalletGeometry(pw, pl);
				tierGroup.add(instanced(woodG, palletMats!.wood, slots, 0.1));
				const whole = slots.slice(0, parts.pallets);
				if (whole.length) {
					const loadG = new three.BoxGeometry(pw, loadH, pl);
					loadG.translate(0, deck + loadH / 2, 0);
					tierGroup.add(instanced(loadG, cash.block(10, 10, 10), whole, 0.03));
					const filmG = new three.BoxGeometry(pw + 0.02, loadH + 0.012, pl + 0.02);
					filmG.translate(0, deck + loadH / 2 + 0.003, 0);
					const film = instanced(filmG, palletMats!.film, whole, 0);
					film.castShadow = false;
					film.renderOrder = 2;
					tierGroup.add(film);
				}
				if (parts.partialNotes) {
					const courses = parts.partialNotes / billStackMod.NOTES_PER_PALLET;
					const h = loadH * courses;
					const p = slots[slots.length - 1];
					const g = new three.BoxGeometry(pw, h, pl);
					const mesh = new three.Mesh(g, cash.block(10, 10 * courses, 10));
					mesh.position.set(p.x, p.y + deck + h / 2, p.z);
					mesh.rotation.y = p.rotY;
					mesh.castShadow = mesh.receiveShadow = true;
					tierGroup.add(mesh);
				}
				w = grid.colsX * px;
				d = grid.colsZ * pz;
				h = Math.ceil(n / (grid.colsX * grid.colsZ)) * unitH;
			} else {
				// Past the cap: the pallets as one block, faced with them (the
				// camera is too far out to need each one drawn) — the same pitch
				// as the field, so there's no pop at the crossover. Exact: whole
				// layers, then whole rows, then whole pallets, then the last
				// part-pallet, never rounded up to a full grid.
				const grid = billStackMod.cubicGridDims(n, pw * 1000 * pitch, pl * 1000 * pitch, unitH * 1000);
				const px = pw * pitch;
				const pz = pl * pitch;
				const x0 = -(grid.colsX * px) / 2;
				const z0 = -(grid.colsZ * pz) / 2;
				const perLayer = grid.colsX * grid.colsZ;
				const box = (ix: number, iy: number, iz: number, nx: number, ny: number, nz: number) => {
					if (nx <= 0 || ny <= 0 || nz <= 0) return;
					const m = new three.Mesh(new three.BoxGeometry(nx * px, ny * unitH, nz * pz), cash!.warehouse(nx, ny, nz));
					m.position.set(x0 + (ix + nx / 2) * px, (iy + ny / 2) * unitH, z0 + (iz + nz / 2) * pz);
					m.castShadow = m.receiveShadow = true;
					tierGroup!.add(m);
				};
				const layers = Math.floor(parts.pallets / perLayer);
				const rows = Math.floor((parts.pallets - layers * perLayer) / grid.colsX);
				const last = parts.pallets - layers * perLayer - rows * grid.colsX;
				box(0, 0, 0, grid.colsX, layers, grid.colsZ);
				box(0, layers, 0, grid.colsX, 1, rows);
				box(0, layers, rows, last, 1, 1);
				if (parts.partialNotes) {
					const courses = parts.partialNotes / billStackMod.NOTES_PER_PALLET;
					const hh = loadH * courses;
					const cx = x0 + (last + 0.5) * px;
					const cz = z0 + (rows + 0.5) * pz;
					const cy = layers * unitH;
					const wood = new three.Mesh(cocaineProps!.makePalletGeometry(pw, pl), palletMats!.wood);
					wood.position.set(cx, cy, cz);
					const load = new three.Mesh(new three.BoxGeometry(pw, hh, pl), cash.block(10, 10 * courses, 10));
					load.position.set(cx, cy + deck + hh / 2, cz);
					wood.castShadow = load.castShadow = load.receiveShadow = true;
					tierGroup.add(wood, load);
				}
				w = grid.colsX * px;
				d = grid.colsZ * pz;
				h = Math.ceil(n / perLayer) * unitH;
			}
		}

		if (parts.strays) {
			const footprintHalf = Math.max(w, d) / 2;
			addStrays(parts.strays, L, W, footprintHalf);
			// The ring's outer edge, plus half a note (they're centred on it).
			const reach = 2 * (footprintHalf + L * 0.95);
			w = Math.max(w, reach);
			d = Math.max(d, reach);
		}
		// Built with the notes' length along z; a quarter turn lays them
		// across the frame, face upright to the camera and the banded long
		// sides of straps, bundles and pallets facing it.
		tierGroup.rotation.y = -Math.PI / 2;
		scene.add(tierGroup);
		extent = { w: d, d: w, h };
	}

	let wantPos: THREE.Vector3 | null = null;
	let wantAim: THREE.Vector3 | null = null;
	let prefersReduced = false;
	// True once reframe() has run at least once since the last hydrate — the
	// very first reframe snaps straight to target instead of lerping in from
	// the hardcoded bootstrap camPos (mirrors LiveStage's `update(true)` calls
	// at hydrate and after the dog loads).
	let framedOnce = false;

	function smoothstep(a: number, b: number, x: number): number {
		const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
		return t * t * (3 - 2 * t);
	}

	/** Reframes the camera, the dog, the key light and fog to the load in
	 *  `extent` — the cocaine stage's shot, so the two tabs move alike.
	 *  Small loads: a raised look-down shot with Sat beside (or behind a
	 *  loose pile), in the shot. Wide loads: the same raised shot, Sat
	 *  walking out to the foreground along the line of sight. A block as
	 *  tall as it is wide blends into LiveStage's metal rig — low camera,
	 *  Sat in the foreground, the block treated as a cube. */
	function reframe(three: typeof THREE): void {
		if (!camera || !camPos || !camAim || !wantPos || !wantAim) return;
		const aspect = height > 0 ? width / height : 1;
		const span = Math.max(extent.w, extent.d, extent.h);
		// Behind a loose pile, far enough back that his paws stay off it.
		const beside = loosePile
			? { x: extent.w * 0.35, z: -(extent.d / 2 + DOG_REACH_M * 0.85) }
			: dogBeside(extent, 'bricks');
		const wFg = loosePile ? 0 : smoothstep(2.5, 6, span);
		const shot = shotBounds(extent, loosePile || wFg > 0 ? null : beside);
		const near = stageCamera(shot.extent, aspect, shot.center);
		const cubeLike = extent.h > 0.5 * Math.max(extent.w, extent.d);
		// Nothing to frame: LiveStage's rig, which shows Sat whole.
		const k = M && empty ? 1 : M && cubeLike ? wFg : 0;
		let pos = near.pos;
		let aim = near.aim;
		let dogAt = beside;
		let dogStaged = false;
		if (wFg > 0) {
			const mark = groundMark(near.pos, near.aim, aspect, extent);
			if (mark) dogAt = { x: beside.x + (mark.x - beside.x) * wFg, z: beside.z + (mark.z - beside.z) * wFg };
			dogStaged = wFg > 0.5;
		}
		if (k > 0 && M) {
			const tr = M.cameraTransform(empty ? 0.156 : span);
			const lerp3 = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => ({
				x: a.x + (b.x - a.x) * k,
				y: a.y + (b.y - a.y) * k,
				z: a.z + (b.z - a.z) * k,
			});
			pos = lerp3(near.pos, tr.pos);
			aim = lerp3(near.aim, tr.aim);
			const sp = M.dogStagePosition(empty ? 0.156 : span, tr.pos, tr.aim, aspect);
			dogAt = { x: dogAt.x + (sp.x - dogAt.x) * k, z: dogAt.z + (sp.z - dogAt.z) * k };
			dogStaged = sp.staged && k > 0.5;
		}
		wantPos.set(pos.x, pos.y, pos.z);
		wantAim.set(aim.x, aim.y, aim.z);

		if (dog) {
			dog.position.set(dogAt.x, 0, dogAt.z);
			dog.rotation.y = Math.atan2(-dogAt.x, -dogAt.z); // face the load
			staged = dogStaged;
		} else {
			staged = false;
		}

		const dist = Math.hypot(pos.x - aim.x, pos.y - aim.y, pos.z - aim.z);
		if (key) {
			const s = Math.max(span, 0.6);
			// A lower, raking light for a flat pile, so the curl of the loose
			// notes and the relief of the print read.
			key.position.set(-s * 1.4, s * (loosePile ? 1.3 : 2.2), s * 1.2);
			const sc = key.shadow.camera;
			sc.left = sc.bottom = -s * 1.3;
			sc.right = sc.top = s * 1.3;
			sc.near = s * 0.05;
			sc.far = s * 6;
			sc.updateProjectionMatrix();
			key.shadow.bias = -0.0002;
			key.shadow.normalBias = span < 0.5 ? 0.0004 : 0.02;
		}
		if (scene) scene.fog = new three.Fog(BG, dist * 2.5, dist * 10);

		if (prefersReduced || !framedOnce) {
			camPos.copy(wantPos);
			camAim.copy(wantAim);
		}
		framedOnce = true;
		applyCamera();
	}

	function applyCamera(): void {
		if (!camera || !camPos || !camAim) return;
		camera.position.copy(camPos);
		camera.lookAt(camAim);
		// Near/far track the camera distance, so a scale change dollies the
		// camera without clipping (the stray notes sit 0.3 mm off the floor).
		const dd = camPos.distanceTo(camAim);
		camera.near = Math.max(dd / 200, 0.002);
		camera.far = dd * 80;
		camera.updateProjectionMatrix();
	}

	let running = false;
	const clock = { last: 0 };

	/** Damped dolly loop — matches LiveStage's damping constant so a reframe
	 *  on toggle/slider-move animates with the same feel.
	 *
	 *  NOTE for future verification: this damped dolly needs a live
	 *  requestAnimationFrame loop. Headless/preview environments can freeze
	 *  rAF entirely, leaving the camera stuck at whatever position it last
	 *  had while everything else (DOM, one-shot renders) looks alive —
	 *  screenshots then show a bogus framing. Verify framing changes on the
	 *  prefers-reduced-motion path (which snaps with no rAF) or in a real
	 *  browser. */
	function loop(): void {
		if (!running || destroyed || !T || !camera || !camPos || !camAim || !wantPos || !wantAim) return;
		rafId = requestAnimationFrame(loop);
		const now = performance.now();
		const dt = Math.min((now - clock.last) / 1000 || 0, 0.05);
		clock.last = now;
		const k = 1 - Math.exp(-dt * 3.2); // same damping constant as LiveStage
		camPos.lerp(wantPos, k);
		camAim.lerp(wantAim, k);
		applyCamera();
		mixer?.update(dt); // dog idle animation
		render();
	}

	function startLoop(): void {
		// Reduced-motion: no continuous rAF loop. reframe() already snaps
		// camPos/camAim straight to the target (and updates near/far) on the
		// prefersReduced path, and the render $effect calls render() right
		// after — so the scene is fully correct with zero animated frames,
		// and we avoid burning GPU cycles for users who opted out of motion.
		if (prefersReduced || running || destroyed) return;
		running = true;
		clock.last = performance.now();
		rafId = requestAnimationFrame(loop);
	}
	function stopLoop(): void {
		running = false;
		if (rafId) cancelAnimationFrame(rafId);
		rafId = 0;
	}

	async function hydrate(): Promise<void> {
		if (destroyed || canvasActive || !containerEl) return;

		const [three, gltfMod, moMod, billMaterialsMod, billStackMod, materials, maths, props] = await Promise.all([
			import('three'),
			import('three/addons/loaders/GLTFLoader.js'),
			import('three/addons/libs/meshopt_decoder.module.js'),
			import('./billMaterials.js'),
			import('../billStack.js'),
			import('./materials.js'),
			import('./maths.js'),
			import('./cocaineProps.js'),
		]);
		const { loadNormalizedModel } = await import('./loadNormalizedModel.js');
		if (destroyed || !containerEl) return;
		T = three;
		M = maths;
		BS = billStackMod;
		BM = billMaterialsMod;
		cocaineProps = props;

		width = containerEl.clientWidth || 1;
		height = containerEl.clientHeight || 1;

		renderer = new three.WebGLRenderer({ antialias: true, alpha: false });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(width, height);
		renderer.toneMapping = three.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 1.15;
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = three.PCFSoftShadowMap;
		renderer.domElement.className = 'stage-canvas';
		renderer.domElement.setAttribute('aria-hidden', 'true');
		containerEl.appendChild(renderer.domElement);
		maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

		scene = new three.Scene();
		scene.background = new three.Color(BG);
		envTexture = materials.makeEnvironmentTexture(renderer);
		scene.environment = envTexture;
		// LiveStage runs this env at 1.3, tuned for metals whose envmap
		// REFLECTIONS need the punch. Matte paper (roughness ~0.8, metalness
		// 0) instead integrates the whole softbox as diffuse irradiance, and
		// at that level the pale note paper clips to white and the fine
		// engraving washes out. Exposure 1.15 / env 0.85 keeps the ink legible.
		scene.environmentIntensity = 0.85;

		camera = new three.PerspectiveCamera(maths.FOV_DEG, width / height, 1e-4, 5000);

		key = new three.DirectionalLight(0xfff2dd, 2.2);
		key.castShadow = true;
		key.shadow.mapSize.set(2048, 2048);
		scene.add(key);
		scene.add(new three.AmbientLight(0x404048, 0.4));

		// 60 km ground disc (LiveStage's is 4 km): the pallet field's receding
		// grid and the dog's foreground relocation can both push well past
		// LiveStage's radius, and everything staged must still stand on
		// ground, not void.
		groundGeometry = new three.CircleGeometry(60000, 64).rotateX(-Math.PI / 2);
		groundMaterial = new three.MeshStandardMaterial({ color: 0x202024, roughness: 0.95, metalness: 0 });
		const ground = new three.Mesh(groundGeometry, groundMaterial);
		ground.receiveShadow = true;
		scene.add(ground);

		camPos = new three.Vector3(0.3, 0.15, 0.4);
		camAim = new three.Vector3(0, 0.02, 0);
		wantPos = new three.Vector3();
		wantAim = new three.Vector3();
		camera.position.copy(camPos);
		camera.lookAt(camAim);

		// One true-size note (a box: face up, back down) and every material.
		noteBox = new three.BoxGeometry(
			billStackMod.BILL_WIDTH_MM / 1000,
			billStackMod.BILL_THICKNESS_MM / 1000,
			billStackMod.BILL_LENGTH_MM / 1000
		);
		const woodMap = props.makeWoodTexture();
		const filmMap = props.makeFilmTexture();
		palletMats = {
			wood: new three.MeshStandardMaterial({ map: woodMap, roughness: 0.9 }),
			film: new three.MeshPhysicalMaterial({
				color: 0xffffff,
				map: filmMap,
				transparent: true,
				opacity: 0.24,
				roughness: 0.2,
				clearcoat: 1,
				clearcoatRoughness: 0.15,
				depthWrite: false,
			}),
		};
		const made = billMaterialsMod.makeCashMaterials(maxAnisotropy);
		sharedMats = made.shared();
		sharedMats.add(palletMats.wood);
		sharedMats.add(palletMats.film);
		// Assigning `cash` ($state) lets the tiered $effect render.
		cash = made;

		canvasActive = true;
		render();
		startLoop();

		resizeObs = new ResizeObserver(() => onResize());
		resizeObs.observe(containerEl);

		// Lazy-load the Shiba (meshopt-compressed) after the rest of the scene
		// is up — same load-order as LiveStage.
		loadDog(loadNormalizedModel, three, gltfMod.GLTFLoader, moMod.MeshoptDecoder);
	}

	function loadDog(
		loadNormalizedModel: typeof import('./loadNormalizedModel.js').loadNormalizedModel,
		three: typeof THREE,
		GLTFLoaderCtor: typeof import('three/addons/loaders/GLTFLoader.js').GLTFLoader,
		MeshoptDecoder: typeof import('three/addons/libs/meshopt_decoder.module.js').MeshoptDecoder
	): void {
		loadNormalizedModel(
			three,
			GLTFLoaderCtor,
			MeshoptDecoder,
			'/models/references/shiba_inu/shiba.glb',
			M!.DOG_TOTAL_HEIGHT_M,
			'y',
			(object, animations) => {
				if (destroyed || !scene || !M) return;
				dog = object;
				dog.traverse((o) => {
					if ((o as THREE.Mesh).isMesh) o.castShadow = true;
				});
				scene.add(dog);

				if (animations.length) {
					mixer = new three.AnimationMixer(dog);
					// Clips: play_dead, rollover, shake, sitting, standing. sitting
					// is the resting idle; the others are metal-tab-only easter-egg
					// tricks BillStage doesn't wire up. Select the idle by NAME —
					// animations[0] is play_dead (the dog dies; a shipped prototype
					// bug we must NOT regress).
					const idleClip =
						animations.find((c) => c.name.includes('sitting')) ?? animations[animations.length - 1];
					idleAction = mixer.clipAction(idleClip);
					idleAction.play();
					// Unlike LiveStage (which never hydrates under reduced motion),
					// BillStage does — and startLoop() never runs a rAF loop in that
					// case, so nothing would otherwise call mixer.update() to bake
					// the idle pose onto the skeleton. One manual update(0) here
					// poses the dog statically at hydrate time.
					if (prefersReduced) mixer.update(0);
				}

				// Re-run the current framing so the dog is positioned immediately
				// instead of waiting for the next noteCount change.
				dogResolved = true;
				refreshStage(noteCount);
				updateReady();
			},
			() => {
				/* Dog failed to load — the scene continues without it, same
				   graceful degradation as the bill model's own error path. The
				   ready gate must still open, or the X-bot would wait forever
				   on a dog that is never coming. */
				dogResolved = true;
				updateReady();
			}
		);
	}

	function render(): void {
		if (!renderer || !scene || !camera) return;
		renderer.render(scene, camera);
	}

	function onResize(): void {
		if (!containerEl || !renderer || !camera) return;
		width = containerEl.clientWidth || 1;
		height = containerEl.clientHeight || 1;
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		renderer.setSize(width, height);
		refreshStage(noteCount); // aspect feeds dog staging
		render();
	}

	function teardown(): void {
		stopLoop();
		if (resizeObs) resizeObs.disconnect();

		// Tier-group resources (bundle/pallet box geometry, cloned edge
		// material + its cloned texture, stray-note plane geometries + their
		// shared cloned face material) are owned by whichever renderTiered()
		// call created them, not by this function — free them the same way a
		// tier switch would, before the shared resources below and before
		// renderer.dispose() resets WebGLProperties' tracking (see the note
		// below).
		clearTierGroup();

		// Shared resources, freed once. This MUST run before
		// renderer.dispose(): WebGLRenderer.dispose() resets WebGLProperties'
		// internal WeakMap, so Texture/Material .dispose() calls made afterward
		// can no longer look up their GPU resources and silently no-op.
		cash?.dispose();
		noteBox?.dispose();
		palletMats?.wood.map?.dispose();
		palletMats?.wood.dispose();
		palletMats?.film.map?.dispose();
		palletMats?.film.dispose();
		groundGeometry?.dispose();
		groundMaterial?.dispose();
		// Same ordering requirement as the shared bill resources above: must
		// run before renderer.dispose() resets WebGLProperties' WeakMap.
		envTexture?.dispose();
		mixer?.stopAllAction();

		if (renderer) {
			renderer.domElement.remove();
			renderer.dispose();
		}

		renderer = scene = camera = key = null;
		cash = null;
		noteBox = null;
		palletMats = null;
		sharedMats = new Set();
		groundGeometry = null;
		groundMaterial = null;
		tierGroup = null;
		envTexture = null;
		dog = mixer = idleAction = null;
		staged = false;
		framedOnce = false;
		renderedOnce = false;
		dogResolved = false;
		ready = false;
	}

	onMount(() => {
		if (!browser) return;
		prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (!hasWebGL()) return;
		void hydrate();
		return () => {
			destroyed = true;
			teardown();
		};
	});

	/** Recomputes the tiered render for `count` and reframes the camera + dog
	 *  around the load it built. Called from the reactive effect below on
	 *  every noteCount change, and again once the dog finishes loading (see
	 *  `loadDog`) and on resize (aspect feeds the framing). No-ops until the
	 *  cash materials and the maths/billStack modules are ready. */
	// `ready` = first real frame rendered AND the dog resolved — both flags
	// feed the bindable so the X-bot's screenshot gate (see the prop's doc
	// comment) never opens on a half-hydrated scene.
	let renderedOnce = false;
	let dogResolved = false;
	function updateReady(): void {
		ready = renderedOnce && dogResolved;
	}

	function refreshStage(count: number): void {
		if (!canvasActive || !T || !M || !BS || !BM || !cash) return;
		renderTiered(T, BS, count);
		reframe(T);
		render();
		renderedOnce = true;
		updateReady();
	}

	$effect(() => {
		const count = noteCount;
		if (!canvasActive) return;
		refreshStage(count);
	});
</script>

<div class="bill-stage" bind:this={containerEl}></div>

<style>
	.bill-stage {
		position: relative;
		width: 100%;
		height: clamp(340px, 56vh, 520px);
		overflow: hidden;
		border-radius: 8px;
		background: #18181b;
	}
	.bill-stage :global(canvas.stage-canvas) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
	}
</style>
