<script lang="ts">
	/**
	 * MiningGlobe — where the machines run. A WebGL Earth (NASA Blue Marble,
	 * July 2004, public domain) with thousands of glowing dots modelled from
	 * the regional hashrate shares in mining-clusters.ts (see mining-dots.ts:
	 * they are a density model, not surveyed sites). Drag to spin; the region
	 * chips fly the camera in for a closer look.
	 *
	 * The dots are one THREE.Points draw per layer with additive blending, so
	 * dense regions burn bright the way the real ones do. Land is tested
	 * against the Earth texture itself, so no dot sits in visible water.
	 *
	 * The loop only runs while the globe is on screen and the tab is visible;
	 * reduced motion turns off the spin, the twinkle and the camera flights.
	 */
	import { onMount } from 'svelte';
	import type * as THREE from 'three';
	import { MINING_CLUSTERS, CLUSTER_COLORS, type MiningType } from '$lib/mining-clusters.js';
	import {
		buildIndustrialDots,
		buildSoloDots,
		phPerDot,
		devicesPerSoloDot,
		type IsLand,
		type MiningDot,
	} from '$lib/mining-dots.js';

	let {
		showSoloMiners = false,
		hashrateEh = null,
	}: {
		showSoloMiners?: boolean;
		/** Live network hashrate, for the "1 dot ≈" key. */
		hashrateEh?: number | null;
	} = $props();

	const SOLO_COLOR = '#7dd3fc';
	const FOV = 30;
	const MAX_SIZE = 640;

	interface Region {
		id: string;
		label: string;
		lat: number;
		lng: number;
		dist: number;
	}
	const REGIONS: Region[] = [
		{ id: 'world', label: 'World', lat: 28, lng: -60, dist: 4.25 },
		{ id: 'na', label: 'North America', lat: 41, lng: -96, dist: 2.15 },
		{ id: 'eu', label: 'Europe', lat: 55, lng: 10, dist: 2.1 },
		{ id: 'ru', label: 'Kazakhstan & Russia', lat: 55, lng: 85, dist: 2.3 },
		{ id: 'me', label: 'Middle East & Africa', lat: 20, lng: 45, dist: 2.4 },
		{ id: 'sa', label: 'South America', lat: -24, lng: -60, dist: 2.3 },
		{ id: 'ap', label: 'Asia-Pacific', lat: 8, lng: 110, dist: 2.4 },
	];

	/** Clusters that belong to each region (angular distance from its centre). */
	function regionClusters(r: Region) {
		if (r.id === 'world') return [];
		const reach = r.dist < 2.2 ? 26 : 34;
		return MINING_CLUSTERS.filter((c) => arcDeg(c.lat, c.lng, r.lat, r.lng) < reach).sort(
			(a, b) => b.hashratePct - a.hashratePct
		);
	}

	let containerEl: HTMLDivElement | undefined = $state();
	let canvasHost: HTMLDivElement | undefined = $state();
	let labelEls: (HTMLDivElement | undefined)[] = $state([]);
	let size = $state(400);
	let loading = $state(true);
	let failed = $state(false);
	let regionIdx = $state(0);
	let industrialCount = $state(0);
	let soloCount = $state(0);
	let hovered = $state<number | null>(null);
	let tipX = $state(0);
	let tipY = $state(0);

	// View state: the point under the camera, and camera distance.
	let viewLat = REGIONS[0].lat;
	let viewLng = REGIONS[0].lng;
	let dist = REGIONS[0].dist;
	let tween: { from: [number, number, number]; to: [number, number, number]; t0: number; ms: number } | null = null;

	let T: typeof THREE | null = null;
	let renderer: THREE.WebGLRenderer | null = null;
	let scene: THREE.Scene | null = null;
	let camera: THREE.PerspectiveCamera | null = null;
	let globe: THREE.Group | null = null;
	let indMat: THREE.ShaderMaterial | null = null;
	let soloMat: THREE.ShaderMaterial | null = null;
	const disposables: { dispose(): void }[] = [];
	let clusterVecs: THREE.Vector3[] = [];

	let rafId = 0;
	let running = false;
	let last = 0;
	let dirty = true;
	let inView = false;
	let tabVisible = true;
	let reduced = false;
	let dragging = $state(false);
	let pointerInside = false;
	let dragFrom: { x: number; y: number; lat: number; lng: number } | null = null;
	let soloOpacity = 0;

	// ── Geometry helpers ───────────────────────────────────────────────────
	const D2R = Math.PI / 180;

	function arcDeg(la1: number, ln1: number, la2: number, ln2: number): number {
		const c =
			Math.sin(la1 * D2R) * Math.sin(la2 * D2R) +
			Math.cos(la1 * D2R) * Math.cos(la2 * D2R) * Math.cos((ln1 - ln2) * D2R);
		return Math.acos(Math.max(-1, Math.min(1, c))) / D2R;
	}

	/** lat/lng → unit-sphere xyz, lng 0 facing +z, east towards +x. */
	function toXYZ(lat: number, lng: number, r = 1): [number, number, number] {
		const la = lat * D2R;
		const ln = lng * D2R;
		return [r * Math.cos(la) * Math.sin(ln), r * Math.sin(la), r * Math.cos(la) * Math.cos(ln)];
	}

	function hexRgb(hex: string): [number, number, number] {
		return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
	}

	function easeInOut(t: number): number {
		return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
	}

	// ── Land mask from the Earth texture ───────────────────────────────────
	function landMask(img: HTMLImageElement): IsLand {
		const W = 1024;
		const H = 512;
		const c = document.createElement('canvas');
		c.width = W;
		c.height = H;
		const g = c.getContext('2d', { willReadFrequently: true });
		if (!g) return () => true;
		g.drawImage(img, 0, 0, W, H);
		const px = g.getImageData(0, 0, W, H).data;
		return (lat, lng) => {
			const x = Math.min(W - 1, Math.max(0, Math.floor(((lng + 180) / 360) * W)));
			const y = Math.min(H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * H)));
			const i = (y * W + x) * 4;
			const r = px[i];
			const gg = px[i + 1];
			const b = px[i + 2];
			// Water in Blue Marble: blue-dominant and not bright (bright = ice/snow).
			return !(b >= r + 10 && b > gg && (r + gg + b) / 3 < 120);
		};
	}

	function loadImage(src: string): Promise<HTMLImageElement> {
		return new Promise((res, rej) => {
			const img = new Image();
			img.decoding = 'async';
			img.onload = () => res(img);
			img.onerror = rej;
			img.src = src;
		});
	}

	// ── Shaders ───────────────────────────────────────────────────────────
	const EARTH_VS = /* glsl */ `
		varying vec2 vUv;
		varying vec3 vN;
		varying vec3 vView;
		void main() {
			vUv = uv;
			vN = normalize(normalMatrix * normal);
			vec4 mv = modelViewMatrix * vec4(position, 1.0);
			vView = normalize(-mv.xyz);
			gl_Position = projectionMatrix * mv;
		}`;
	const EARTH_FS = /* glsl */ `
		uniform sampler2D map;
		varying vec2 vUv;
		varying vec3 vN;
		varying vec3 vView;
		void main() {
			vec3 c = texture2D(map, vUv).rgb;
			// Night-side look: deeper oceans, muted land, so the dots carry the image.
			float water = step(c.r + 0.04, c.b) * step(c.g, c.b) * step((c.r + c.g + c.b) / 3.0, 0.47);
			float lum = dot(c, vec3(0.299, 0.587, 0.114));
			c = mix(vec3(lum), c, 0.8);
			c *= mix(0.62, 0.34, water);
			vec3 L = normalize(vec3(-0.5, 0.6, 0.65));
			float diff = 0.45 + 0.75 * max(dot(vN, L), 0.0);
			c *= diff;
			float rim = pow(1.0 - max(dot(vN, vView), 0.0), 3.0);
			c += vec3(0.18, 0.36, 0.75) * rim * 0.35;
			gl_FragColor = vec4(c, 1.0);
		}`;
	const ATMO_VS = /* glsl */ `
		varying vec3 vN;
		void main() {
			vN = normalize(normalMatrix * normal);
			gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		}`;
	const ATMO_FS = /* glsl */ `
		varying vec3 vN;
		void main() {
			float k = pow(max(0.64 - dot(vN, vec3(0.0, 0.0, 1.0)), 0.0), 3.0);
			gl_FragColor = vec4(vec3(0.35, 0.6, 1.0) * k * 1.1, 1.0);
		}`;
	const DOT_VS = /* glsl */ `
		attribute vec3 aColor;
		attribute float aW;
		attribute float aSeed;
		uniform float uPx;
		uniform float uSize;
		uniform float uTime;
		uniform float uTwinkle;
		varying vec3 vColor;
		varying float vA;
		void main() {
			vec4 mv = modelViewMatrix * vec4(position, 1.0);
			vec3 n = normalize(normalMatrix * position);
			float facing = dot(n, normalize(-mv.xyz));
			float tw = 1.0 - uTwinkle * 0.35 * (0.5 + 0.5 * sin(uTime * (0.6 + aSeed * 1.8) + aSeed * 40.0));
			vA = smoothstep(0.0, 0.3, facing) * (0.45 + 0.55 * aW) * tw;
			vColor = aColor;
			gl_PointSize = facing > 0.0 ? max(1.4, uSize * (0.6 + 0.8 * aW) * uPx / -mv.z) : 0.0;
			gl_Position = projectionMatrix * mv;
		}`;
	const DOT_FS = /* glsl */ `
		uniform float uOpacity;
		varying vec3 vColor;
		varying float vA;
		void main() {
			float r = length(gl_PointCoord - 0.5) * 2.0;
			if (r > 1.0) discard;
			float core = smoothstep(0.32, 0.0, r);
			float halo = exp(-r * r * 6.0) * 0.4;
			vec3 c = mix(vColor, vec3(1.0, 0.94, 0.82), core * 0.3) * (core + halo);
			gl_FragColor = vec4(c * vA * uOpacity, 1.0);
		}`;

	function dotMaterial(three: typeof THREE): THREE.ShaderMaterial {
		const m = new three.ShaderMaterial({
			uniforms: {
				uPx: { value: 1 },
				uSize: { value: 0.012 },
				uTime: { value: 0 },
				uTwinkle: { value: 1 },
				uOpacity: { value: 1 },
			},
			vertexShader: DOT_VS,
			fragmentShader: DOT_FS,
			blending: three.AdditiveBlending,
			depthTest: false,
			depthWrite: false,
			transparent: true,
		});
		disposables.push(m);
		return m;
	}

	function dotPoints(three: typeof THREE, dots: MiningDot[], color: (d: MiningDot) => [number, number, number], mat: THREE.ShaderMaterial) {
		const pos = new Float32Array(dots.length * 3);
		const col = new Float32Array(dots.length * 3);
		const w = new Float32Array(dots.length);
		const seed = new Float32Array(dots.length);
		dots.forEach((d, i) => {
			pos.set(toXYZ(d.lat, d.lng, 1.002), i * 3);
			col.set(color(d), i * 3);
			w[i] = d.w;
			seed[i] = ((i * 2654435761) >>> 0) / 4294967296;
		});
		const g = new three.BufferGeometry();
		g.setAttribute('position', new three.BufferAttribute(pos, 3));
		g.setAttribute('aColor', new three.BufferAttribute(col, 3));
		g.setAttribute('aW', new three.BufferAttribute(w, 1));
		g.setAttribute('aSeed', new three.BufferAttribute(seed, 1));
		disposables.push(g);
		const p = new three.Points(g, mat);
		p.frustumCulled = false;
		return p;
	}

	// ── Setup ─────────────────────────────────────────────────────────────
	async function init() {
		if (!canvasHost) return;
		let three: typeof THREE;
		let img: HTMLImageElement;
		try {
			const big = size * Math.min(window.devicePixelRatio || 1, 2) > 640;
			[three, img] = await Promise.all([
				import('three'),
				loadImage(big ? '/images/earth-4k.webp' : '/images/earth-2k.webp'),
			]);
		} catch {
			failed = true;
			loading = false;
			return;
		}
		if (!canvasHost) return;
		T = three;
		try {
			renderer = new three.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
		} catch {
			failed = true;
			loading = false;
			return;
		}
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		renderer.setClearColor(0x000000, 0);
		canvasHost.appendChild(renderer.domElement);

		scene = new three.Scene();
		camera = new three.PerspectiveCamera(FOV, 1, 0.1, 50);
		globe = new three.Group();
		globe.rotation.order = 'XYZ';
		scene.add(globe);

		const tex = new three.Texture(img);
		tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
		tex.needsUpdate = true;
		disposables.push(tex);

		// three's sphere puts lng 0 at +x; turn it so lng 0 faces +z like toXYZ.
		const earthGeo = new three.SphereGeometry(1, 96, 64).rotateY(-Math.PI / 2);
		const earthMat = new three.ShaderMaterial({ uniforms: { map: { value: tex } }, vertexShader: EARTH_VS, fragmentShader: EARTH_FS });
		disposables.push(earthGeo, earthMat);
		globe.add(new three.Mesh(earthGeo, earthMat));

		const atmoGeo = new three.SphereGeometry(1.045, 64, 48);
		const atmoMat = new three.ShaderMaterial({
			vertexShader: ATMO_VS,
			fragmentShader: ATMO_FS,
			side: three.BackSide,
			blending: three.AdditiveBlending,
			transparent: true,
			depthWrite: false,
		});
		disposables.push(atmoGeo, atmoMat);
		scene.add(new three.Mesh(atmoGeo, atmoMat));

		const isLand = landMask(img);
		const ind = buildIndustrialDots(isLand);
		const solo = buildSoloDots(isLand);
		industrialCount = ind.length;
		soloCount = solo.length;
		const typeRgb = Object.fromEntries(
			Object.entries(CLUSTER_COLORS).map(([k, v]) => [k, hexRgb(v)])
		) as Record<MiningType, [number, number, number]>;
		indMat = dotMaterial(three);
		soloMat = dotMaterial(three);
		soloMat.uniforms.uSize.value = 0.008;
		const soloRgb = hexRgb(SOLO_COLOR);
		globe.add(dotPoints(three, solo, () => soloRgb, soloMat));
		globe.add(dotPoints(three, ind, (d) => typeRgb[d.type], indMat));
		clusterVecs = MINING_CLUSTERS.map((c) => new three.Vector3(...toXYZ(c.lat, c.lng, 1.002)));

		if (reduced) {
			indMat.uniforms.uTwinkle.value = 0;
			soloMat.uniforms.uTwinkle.value = 0;
		}
		soloOpacity = showSoloMiners ? 1 : 0;
		resize();
		loading = false;
		dirty = true;
		renderFrame(performance.now());
		sync();
	}

	function resize() {
		if (!renderer || !camera) return;
		renderer.setSize(size, size, true);
		camera.aspect = 1;
		camera.updateProjectionMatrix();
		const px = renderer.getDrawingBufferSize(new T!.Vector2()).y / (2 * Math.tan((FOV / 2) * D2R));
		if (indMat) indMat.uniforms.uPx.value = px;
		if (soloMat) soloMat.uniforms.uPx.value = px;
		dirty = true;
	}

	// ── Loop ──────────────────────────────────────────────────────────────
	function sync() {
		const want = inView && tabVisible && !!renderer;
		if (want && !running) {
			running = true;
			last = 0;
			rafId = requestAnimationFrame(tick);
		} else if (!want && running) {
			running = false;
			cancelAnimationFrame(rafId);
		}
	}

	function tick(now: number) {
		if (!running) return;
		rafId = requestAnimationFrame(tick);
		const busy = dragging || !!tween;
		// Idle spin is slow; 30fps is indistinguishable and half the work.
		if (!busy && last && now - last < 1000 / 30) return;
		const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
		last = now;

		if (tween) {
			const t = Math.min(1, (now - tween.t0) / tween.ms);
			const e = easeInOut(t);
			viewLat = tween.from[0] + (tween.to[0] - tween.from[0]) * e;
			viewLng = tween.from[1] + (tween.to[1] - tween.from[1]) * e;
			dist = tween.from[2] + (tween.to[2] - tween.from[2]) * e;
			if (t >= 1) tween = null;
			dirty = true;
		} else if (!reduced && !dragging && !pointerInside && regionIdx === 0) {
			viewLng -= 6 * dt;
			dirty = true;
		}

		const want = showSoloMiners ? 1 : 0;
		if (soloOpacity !== want) {
			soloOpacity = reduced ? want : soloOpacity + Math.sign(want - soloOpacity) * Math.min(Math.abs(want - soloOpacity), dt * 3);
			dirty = true;
		}
		if (!reduced) dirty = true; // twinkle
		if (dirty) renderFrame(now);
	}

	function renderFrame(now: number) {
		if (!renderer || !scene || !camera || !globe || !indMat || !soloMat) return;
		dirty = false;
		globe.rotation.set(viewLat * D2R, -viewLng * D2R, 0);
		camera.position.set(0, 0, dist);
		camera.lookAt(0, 0, 0);
		const t = now / 1000;
		indMat.uniforms.uTime.value = t;
		soloMat.uniforms.uTime.value = t;
		// Zoomed in, each dot covers fewer pixels of the world — shrink them a little.
		const zoomK = 0.75 + 0.25 * ((dist - 2) / 2.25);
		indMat.uniforms.uSize.value = 0.011 * zoomK;
		soloMat.uniforms.uSize.value = 0.0075 * zoomK;
		indMat.uniforms.uOpacity.value = 1 - 0.4 * soloOpacity;
		soloMat.uniforms.uOpacity.value = soloOpacity;
		renderer.render(scene, camera);
		placeLabels();
	}

	// ── Labels ────────────────────────────────────────────────────────────
	interface Projected {
		x: number;
		y: number;
		facing: number;
	}

	function project(i: number): Projected | null {
		if (!globe || !camera || !T) return null;
		const v = clusterVecs[i].clone().applyMatrix4(globe.matrixWorld);
		const n = v.clone().normalize();
		const toCam = camera.position.clone().sub(v).normalize();
		const facing = n.dot(toCam);
		v.project(camera);
		return { x: ((v.x + 1) / 2) * size, y: ((1 - v.y) / 2) * size, facing };
	}

	const labelOrder = MINING_CLUSTERS.map((_, i) => i).sort(
		(a, b) => MINING_CLUSTERS[b].hashratePct - MINING_CLUSTERS[a].hashratePct
	);

	function placeLabels() {
		if (!globe) return;
		globe.updateMatrixWorld();
		const zoomed = dist < 3;
		const minPct = zoomed ? 0 : 3.5;
		// Keep clear of the region title.
		const boxes: [number, number, number, number][] = regionIdx !== 0 ? [[0, 0, size, 52]] : [];
		for (const i of labelOrder) {
			const el = labelEls[i];
			if (!el) continue;
			const c = MINING_CLUSTERS[i];
			const p = project(i);
			let show = !!p && p.facing > 0.3 && (c.hashratePct >= minPct || hovered === i);
			if (show && p) {
				const w = c.name.length * 6.2 + 14;
				const box: [number, number, number, number] = [p.x + 6, p.y - 22, p.x + 6 + w, p.y - 4];
				if (box[2] > size - 8 || box[1] < 8 || p.x < 8 || p.y > size - 8) show = false;
				else if (hovered !== i && boxes.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) show = false;
				if (show) boxes.push(box);
				el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
				el.style.opacity = show ? String(Math.min(1, (p.facing - 0.3) * 4)) : '0';
			} else {
				el.style.opacity = '0';
			}
		}
	}

	// ── Interaction ───────────────────────────────────────────────────────
	function flyTo(i: number) {
		regionIdx = i;
		const r = REGIONS[i];
		// Shortest way round in longitude.
		let toLng = r.lng;
		while (toLng - viewLng > 180) toLng -= 360;
		while (toLng - viewLng < -180) toLng += 360;
		if (reduced) {
			viewLat = r.lat;
			viewLng = toLng;
			dist = r.dist;
			dirty = true;
			if (!running) renderFrame(performance.now());
			return;
		}
		tween = { from: [viewLat, viewLng, dist], to: [r.lat, toLng, r.dist], t0: performance.now(), ms: 1500 };
	}

	function onPointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		dragFrom = { x: e.clientX, y: e.clientY, lat: viewLat, lng: viewLng };
		tween = null;
	}

	function onPointerMove(e: PointerEvent) {
		if (!canvasHost) return;
		pointerInside = e.pointerType === 'mouse';
		if (dragFrom) {
			const dx = e.clientX - dragFrom.x;
			const dy = e.clientY - dragFrom.y;
			if (!dragging && Math.hypot(dx, dy) > 4) {
				dragging = true;
				canvasHost.setPointerCapture(e.pointerId);
			}
			if (dragging) {
				// Degrees per pixel shrink as the camera closes in.
				const k = (90 / size) * ((dist - 1) / 3.25);
				viewLng = dragFrom.lng - dx * k;
				viewLat = Math.max(-75, Math.min(80, dragFrom.lat + dy * k));
				hovered = null;
				dirty = true;
				if (!running) renderFrame(performance.now());
				return;
			}
		}
		if (e.pointerType !== 'mouse') return;
		const rect = canvasHost.getBoundingClientRect();
		const mx = e.clientX - rect.left;
		const my = e.clientY - rect.top;
		let best: number | null = null;
		let bestD = 20;
		for (let i = 0; i < MINING_CLUSTERS.length; i++) {
			const p = project(i);
			if (!p || p.facing < 0.2) continue;
			const d = Math.hypot(p.x - mx, p.y - my);
			if (d < bestD) {
				bestD = d;
				best = i;
			}
		}
		hovered = best;
		tipX = mx;
		tipY = my;
		dirty = true;
	}

	function onPointerUp(e: PointerEvent) {
		if (dragging && canvasHost?.hasPointerCapture(e.pointerId)) canvasHost.releasePointerCapture(e.pointerId);
		dragging = false;
		dragFrom = null;
	}

	function onPointerLeave() {
		pointerInside = false;
		hovered = null;
		dirty = true;
	}

	function onKey(e: KeyboardEvent) {
		const step = e.shiftKey ? 15 : 5;
		if (e.key === 'ArrowLeft') viewLng -= step;
		else if (e.key === 'ArrowRight') viewLng += step;
		else if (e.key === 'ArrowUp') viewLat = Math.min(80, viewLat + step);
		else if (e.key === 'ArrowDown') viewLat = Math.max(-75, viewLat - step);
		else return;
		e.preventDefault();
		tween = null;
		dirty = true;
		if (!running) renderFrame(performance.now());
	}

	// ── Lifecycle ─────────────────────────────────────────────────────────
	onMount(() => {
		const mql = matchMedia('(prefers-reduced-motion: reduce)');
		reduced = mql.matches;
		const onMql = (e: MediaQueryListEvent) => {
			reduced = e.matches;
			const tw = reduced ? 0 : 1;
			if (indMat) indMat.uniforms.uTwinkle.value = tw;
			if (soloMat) soloMat.uniforms.uTwinkle.value = tw;
			dirty = true;
		};
		mql.addEventListener('change', onMql);

		const onVis = () => {
			tabVisible = document.visibilityState === 'visible';
			sync();
		};
		document.addEventListener('visibilitychange', onVis);
		tabVisible = document.visibilityState === 'visible';

		const ro = new ResizeObserver(([entry]) => {
			const next = Math.floor(Math.min(entry.contentRect.width, MAX_SIZE));
			if (next > 0 && next !== size) {
				size = next;
				resize();
				if (!running) renderFrame(performance.now());
			}
		});
		const io = new IntersectionObserver((entries) => {
			inView = entries.some((e) => e.isIntersecting);
			sync();
		});
		if (containerEl) {
			size = Math.floor(Math.min(containerEl.clientWidth || 400, MAX_SIZE));
			ro.observe(containerEl);
			io.observe(containerEl);
		}
		void init();

		return () => {
			running = false;
			cancelAnimationFrame(rafId);
			ro.disconnect();
			io.disconnect();
			mql.removeEventListener('change', onMql);
			document.removeEventListener('visibilitychange', onVis);
			for (const d of disposables) d.dispose();
			renderer?.dispose();
			renderer?.domElement.remove();
			renderer = null;
		};
	});

	// Solo toggle while the loop is stopped (reduced motion / off-screen).
	$effect(() => {
		void showSoloMiners;
		dirty = true;
		if (!running && reduced) {
			soloOpacity = showSoloMiners ? 1 : 0;
			renderFrame(performance.now());
		}
	});

	const TYPE_LABELS: Record<MiningType, string> = {
		industrial: 'Industrial',
		flare: 'Flare gas',
		hydro: 'Hydro',
		geothermal: 'Geothermal',
		nuclear: 'Nuclear',
	};

	const hoveredData = $derived(hovered !== null ? MINING_CLUSTERS[hovered] : null);
	const region = $derived(REGIONS[regionIdx]);
	const regionNames = $derived(
		regionClusters(region)
			.slice(0, 6)
			.map((c) => c.name)
	);
	const perDot = $derived(hashrateEh && industrialCount ? phPerDot(hashrateEh, industrialCount) : null);
	const perSolo = $derived(soloCount ? Math.round(devicesPerSoloDot(soloCount)) : null);
</script>

<div class="mg" bind:this={containerEl}>
	<div class="stage" style:width="{size}px" style:height="{size}px">
		<!-- Drag or arrow keys turn the globe. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
		<div
			class="canvas-host"
			bind:this={canvasHost}
			role="application"
			aria-roledescription="globe"
			tabindex="0"
			aria-label="Globe of modelled Bitcoin mining density: thousands of dots, brightest over Texas, Kazakhstan, Siberia, Québec and the Gulf. Drag or use arrow keys to turn it."
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
			onpointerleave={onPointerLeave}
			onkeydown={onKey}
		></div>

		<div class="labels" aria-hidden="true">
			{#each MINING_CLUSTERS as c, i (c.id)}
				<div class="label" bind:this={labelEls[i]}>
					<span class="pin" style:background={CLUSTER_COLORS[c.type]}></span>
					<span class="pill">{c.name}</span>
				</div>
			{/each}
		</div>

		{#if regionIdx !== 0}
			<div class="region-title" aria-live="polite">
				<div class="rt-name">{region.label}</div>
				{#if regionNames.length}
					<div class="rt-sub">{regionNames.join(' · ')}</div>
				{/if}
			</div>
		{/if}

		{#if loading}
			<div class="wait" aria-hidden="true"></div>
		{:else if failed}
			<div class="wait wait--failed">Globe needs WebGL</div>
		{/if}

		{#if hoveredData && !dragging}
			<div class="tip" style:left="{Math.min(tipX + 14, size - 180)}px" style:top="{tipY - 8}px">
				<div class="tt-name">{hoveredData.name}</div>
				<div class="tt-type" style:color={CLUSTER_COLORS[hoveredData.type]}>{TYPE_LABELS[hoveredData.type]}</div>
				<div class="tt-pct">~{hoveredData.hashratePct}% of hashrate</div>
				{#if hoveredData.note}<div class="tt-note">{hoveredData.note}</div>{/if}
			</div>
		{/if}
	</div>

	<div class="chips" role="group" aria-label="Fly to a region">
		{#each REGIONS as r, i (r.id)}
			<button type="button" class="chip" class:chip--on={regionIdx === i} aria-pressed={regionIdx === i} onclick={() => flyTo(i)}>
				{r.label}
			</button>
		{/each}
	</div>

	<div class="key">
		<div class="legend">
			{#each Object.entries(CLUSTER_COLORS) as [type, color] (type)}
				<span class="lg"><span class="lg-dot" style:background={color} style:box-shadow="0 0 6px {color}"></span>{TYPE_LABELS[type as MiningType]}</span>
			{/each}
			{#if showSoloMiners}
				<span class="lg"><span class="lg-dot" style:background={SOLO_COLOR} style:box-shadow="0 0 6px {SOLO_COLOR}"></span>Solo / home</span>
			{/if}
		</div>
		<p class="scale">
			{#if industrialCount}
				{industrialCount.toLocaleString('en-US')} dots{#if perDot}, each ≈ {Math.round(perDot).toLocaleString('en-US')} PH/s{/if}.
				{#if showSoloMiners && perSolo}Blue: each ≈ {perSolo} home miners.{/if}
				Modelled from regional hashrate shares, not surveyed sites. Earth: NASA Blue Marble.
			{/if}
		</p>
	</div>
</div>

<style>
	.mg {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.stage {
		position: relative;
		max-width: 100%;
	}
	.canvas-host {
		position: absolute;
		inset: 0;
		cursor: grab;
		touch-action: pan-y;
		border-radius: 14px;
		outline: none;
		/* Zoomed in, the Earth runs off the square: feather the edges. */
		-webkit-mask-image:
			linear-gradient(to right, transparent, #000 5%, #000 95%, transparent),
			linear-gradient(to bottom, transparent, #000 5%, #000 95%, transparent);
		-webkit-mask-composite: source-in;
		mask-image:
			linear-gradient(to right, transparent, #000 5%, #000 95%, transparent),
			linear-gradient(to bottom, transparent, #000 5%, #000 95%, transparent);
		mask-composite: intersect;
	}
	.canvas-host:active {
		cursor: grabbing;
	}
	/* The mask would clip a ring on the host itself. */
	.stage:has(.canvas-host:focus-visible) {
		outline: 2px solid #f7931a;
		outline-offset: 2px;
		border-radius: 14px;
	}
	.canvas-host :global(canvas) {
		display: block;
	}
	.wait {
		position: absolute;
		inset: 4%;
		border-radius: 50%;
		background: radial-gradient(circle at 35% 35%, #1b2a3f, #070b12);
	}
	.wait--failed {
		display: grid;
		place-items: center;
		font: 12px var(--mono, ui-monospace, monospace);
		color: #71717a;
	}
	.labels {
		position: absolute;
		inset: 0;
		pointer-events: none;
		overflow: hidden;
	}
	.label {
		position: absolute;
		left: 0;
		top: 0;
		opacity: 0;
		transition: opacity 0.25s;
		will-change: transform, opacity;
	}
	.pin {
		position: absolute;
		left: -2px;
		top: -2px;
		width: 4px;
		height: 4px;
		border-radius: 50%;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.6);
	}
	.pill {
		position: absolute;
		left: 6px;
		top: -22px;
		white-space: nowrap;
		padding: 2px 6px;
		border-radius: 4px;
		background: rgba(9, 9, 11, 0.72);
		border: 1px solid rgba(255, 255, 255, 0.14);
		font: 600 10px/1.3 'JetBrains Mono', ui-monospace, monospace;
		color: #f4f4f5;
		backdrop-filter: blur(2px);
	}
	.region-title {
		position: absolute;
		top: 4px;
		left: 0;
		right: 0;
		text-align: center;
		pointer-events: none;
		text-shadow: 0 1px 8px rgba(0, 0, 0, 0.9);
	}
	.rt-name {
		font: 800 clamp(18px, 4.5vw, 26px) / 1.1 var(--sans, system-ui, sans-serif);
		letter-spacing: -0.01em;
		color: #fbbf24;
	}
	.rt-sub {
		margin-top: 3px;
		font: 10px/1.4 'JetBrains Mono', ui-monospace, monospace;
		color: #d4d4d8;
		padding: 0 12px;
	}
	.tip {
		position: absolute;
		pointer-events: none;
		background: #18181b;
		border: 1px solid #3f3f46;
		border-radius: 6px;
		padding: 8px 10px;
		min-width: 140px;
		z-index: 10;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
	}
	.tt-name {
		font-size: 12px;
		font-weight: 600;
		color: #f4f4f5;
		margin-bottom: 3px;
	}
	.tt-type {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.tt-pct {
		font-size: 11px;
		color: #a1a1aa;
	}
	.tt-note {
		margin-top: 4px;
		font-size: 11px;
		color: #71717a;
		font-style: italic;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 6px;
		margin-top: 10px;
	}
	.chip {
		font: 11px/1 'JetBrains Mono', ui-monospace, monospace;
		padding: 6px 9px;
		border-radius: 999px;
		border: 1px solid var(--rule, #3f3f46);
		background: transparent;
		color: var(--ink-2, #a1a1aa);
		cursor: pointer;
	}
	.chip:hover {
		color: var(--ink, #f4f4f5);
	}
	.chip--on {
		border-color: #f59e0b;
		color: #fbbf24;
		background: rgba(245, 158, 11, 0.1);
	}
	.key {
		width: 100%;
		margin-top: 12px;
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 4px 12px;
	}
	.lg {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font: 10px 'JetBrains Mono', ui-monospace, monospace;
		color: var(--ink-2, #a1a1aa);
	}
	.lg-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
	}
	.scale {
		margin: 6px 0 0;
		text-align: center;
		font: 10px/1.5 'JetBrains Mono', ui-monospace, monospace;
		color: var(--ink-3, #71717a);
	}
</style>
