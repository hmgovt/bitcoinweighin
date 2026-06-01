<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import {
		geoOrthographic,
		geoPath,
		geoGraticule,
		type GeoProjection,
		type GeoPath,
	} from 'd3-geo';
	import { feature } from 'topojson-client';
	import type { Topology, Objects } from 'topojson-specification';
	import {
		MINING_CLUSTERS,
		SOLO_DOTS,
		CLUSTER_COLORS,
		type MiningType,
	} from '$lib/mining-clusters.js';

	let {
		showSoloMiners = false,
	}: {
		showSoloMiners?: boolean;
	} = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let containerEl: HTMLDivElement | undefined = $state();
	let ctx: CanvasRenderingContext2D | null = null;

	// Globe dimensions — set from container via ResizeObserver.
	let size = $state(480);
	let dpr = 1;

	// World topology — loaded once.
	let worldFeature: ReturnType<typeof feature> | null = null;
	let topoLoaded = $state(false);

	// Animation state.
	let rotation = $state(65); // start facing Americas (~65°W)
	let animFrame = 0;
	let isHovered = false;
	let hoveredCluster: string | null = null;
	let tooltipX = $state(0);
	let tooltipY = $state(0);

	// Speed: degrees per frame at 60fps.
	const ROT_SPEED = 0.12;

	onMount(async () => {
		dpr = window.devicePixelRatio || 1;

		// Fit globe to container.
		const ro = new ResizeObserver(([entry]) => {
			const w = entry.contentRect.width;
			size = Math.floor(Math.min(w, 540));
			resizeCanvas();
		});
		if (containerEl) ro.observe(containerEl);

		// Load world borders TopoJSON.
		try {
			const res = await fetch('/world-110m.json');
			const topo: Topology<Objects> = await res.json();
			// world-atlas countries-110m has 'countries' object.
			const obj = (topo.objects as Record<string, unknown>).countries
				?? (topo.objects as Record<string, unknown>).land;
			if (obj) {
				worldFeature = feature(topo, obj as Parameters<typeof feature>[1]);
				topoLoaded = true;
			}
		} catch (e) {
			console.warn('MiningGlobe: could not load world-110m.json', e);
		}

		animate();

		return () => {
			ro.disconnect();
			cancelAnimationFrame(animFrame);
		};
	});

	onDestroy(() => { if (browser) cancelAnimationFrame(animFrame); });

	function resizeCanvas() {
		if (!canvas) return;
		canvas.width = size * dpr;
		canvas.height = size * dpr;
		canvas.style.width = `${size}px`;
		canvas.style.height = `${size}px`;
		ctx = canvas.getContext('2d');
		if (ctx) ctx.scale(dpr, dpr);
	}

	function animate() {
		if (!isHovered) rotation = (rotation + ROT_SPEED) % 360;
		draw();
		animFrame = requestAnimationFrame(animate);
	}

	function makeProjection(): GeoProjection {
		return geoOrthographic()
			.scale(size / 2 - 4)
			.translate([size / 2, size / 2])
			.rotate([rotation, -20, 0]) // slight tilt southward for better view
			.clipAngle(90);
	}

	function draw() {
		if (!ctx) return;
		const r = size / 2;
		const cx = size / 2;
		const cy = size / 2;

		ctx.clearRect(0, 0, size, size);

		const proj = makeProjection();
		const path = geoPath(proj, ctx);
		const graticule = geoGraticule().step([20, 20]);

		// ── Sphere fill (deep ocean gradient) ───────────────────────────────
		const ocean = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.05, cx, cy, r);
		ocean.addColorStop(0, '#1e3a5f');
		ocean.addColorStop(1, '#0a1628');
		ctx.beginPath();
		path({ type: 'Sphere' } as GeoJSON.GeoJsonObject);
		ctx.fillStyle = ocean;
		ctx.fill();

		// ── Graticule (subtle grid) ──────────────────────────────────────────
		ctx.beginPath();
		path(graticule());
		ctx.strokeStyle = 'rgba(255,255,255,0.04)';
		ctx.lineWidth = 0.5;
		ctx.stroke();

		// ── Country fills ────────────────────────────────────────────────────
		if (worldFeature) {
			ctx.beginPath();
			path(worldFeature as GeoJSON.GeoJsonObject);
			ctx.fillStyle = 'rgba(55, 80, 120, 0.5)';
			ctx.fill();
			ctx.strokeStyle = 'rgba(120, 160, 220, 0.25)';
			ctx.lineWidth = 0.4;
			ctx.stroke();
		}

		// ── Sphere rim ───────────────────────────────────────────────────────
		ctx.beginPath();
		path({ type: 'Sphere' } as GeoJSON.GeoJsonObject);
		ctx.strokeStyle = 'rgba(100, 150, 220, 0.35)';
		ctx.lineWidth = 1.5;
		ctx.stroke();

		// ── Atmospheric glow ─────────────────────────────────────────────────
		const atmo = ctx.createRadialGradient(cx, cy, r - 4, cx, cy, r + 12);
		atmo.addColorStop(0, 'rgba(80, 140, 255, 0.15)');
		atmo.addColorStop(1, 'rgba(80, 140, 255, 0)');
		ctx.beginPath();
		ctx.arc(cx, cy, r + 12, 0, Math.PI * 2);
		ctx.fillStyle = atmo;
		ctx.fill();

		// ── Solo miner diffuse field (behind industrial) ─────────────────────
		if (showSoloMiners) {
			for (const dot of SOLO_DOTS) {
				if (!isPointVisible(dot.lat, dot.lng, proj)) continue;
				const coords = proj([dot.lng, dot.lat]);
				if (!coords) continue;
				const [x, y] = coords;
				ctx.beginPath();
				ctx.arc(x, y, 1.5, 0, Math.PI * 2);
				ctx.fillStyle = 'rgba(56, 189, 248, 0.5)'; // sky-400
				ctx.fill();
			}
		}

		// ── Industrial mining clusters ────────────────────────────────────────
		const dimClusters = showSoloMiners;
		for (const cluster of MINING_CLUSTERS) {
			if (!isPointVisible(cluster.lat, cluster.lng, proj)) continue;
			const coords = proj([cluster.lng, cluster.lat]);
			if (!coords) continue;
			const [x, y] = coords;

			const baseRadius = Math.sqrt(cluster.hashratePct) * 10;
			const color = CLUSTER_COLORS[cluster.type as MiningType];
			const alpha = dimClusters ? 0.35 : 1;

			// Outer halo
			const glowR = baseRadius * 2.2;
			const glow = ctx.createRadialGradient(x, y, 0, x, y, glowR);
			glow.addColorStop(0, hexToRgba(color, 0.45 * alpha));
			glow.addColorStop(0.5, hexToRgba(color, 0.15 * alpha));
			glow.addColorStop(1, hexToRgba(color, 0));
			ctx.beginPath();
			ctx.arc(x, y, glowR, 0, Math.PI * 2);
			ctx.fillStyle = glow;
			ctx.fill();

			// Core dot
			const coreR = Math.max(2, baseRadius * 0.28);
			ctx.beginPath();
			ctx.arc(x, y, coreR, 0, Math.PI * 2);
			ctx.fillStyle = hexToRgba(color, 0.9 * alpha);
			ctx.fill();
		}
	}

	// ── Point visibility (spherical law of cosines for orthographic hemisphere) ─
	// d3-geo rotate([λr, φr]) means the visible centre is at geographic coords
	// (-λr, -φr) — so we must negate both rotation values to get the camera centre.
	function isPointVisible(lat: number, lng: number, proj: GeoProjection): boolean {
		const rotate = proj.rotate();
		const λc = -rotate[0] * Math.PI / 180;
		const φc = -(rotate[1] ?? 0) * Math.PI / 180;
		const λ = lng * Math.PI / 180;
		const φ = lat * Math.PI / 180;
		const cosD = Math.sin(φc) * Math.sin(φ) + Math.cos(φc) * Math.cos(φ) * Math.cos(λ - λc);
		return cosD > 0.05;
	}

	// ── Hex colour → rgba string ─────────────────────────────────────────────
	function hexToRgba(hex: string, alpha: number): string {
		const r = parseInt(hex.slice(1, 3), 16);
		const g = parseInt(hex.slice(3, 5), 16);
		const b = parseInt(hex.slice(5, 7), 16);
		return `rgba(${r},${g},${b},${alpha})`;
	}

	// ── Mouse interaction ────────────────────────────────────────────────────
	function onMouseMove(e: MouseEvent) {
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const mx = e.clientX - rect.left;
		const my = e.clientY - rect.top;
		isHovered = true;
		hoveredCluster = null;

		const proj = makeProjection();
		for (const cluster of MINING_CLUSTERS) {
			if (!isPointVisible(cluster.lat, cluster.lng, proj)) continue;
			const coords = proj([cluster.lng, cluster.lat]);
			if (!coords) continue;
			const [x, y] = coords;
			const dist = Math.hypot(mx - x, my - y);
			if (dist < Math.max(10, Math.sqrt(cluster.hashratePct) * 10)) {
				hoveredCluster = cluster.id;
				tooltipX = mx;
				tooltipY = my;
				break;
			}
		}
	}

	function onMouseLeave() {
		isHovered = false;
		hoveredCluster = null;
	}

	$effect(() => {
		if (canvas && size) resizeCanvas();
	});

	const hoveredData = $derived(
		hoveredCluster ? MINING_CLUSTERS.find(c => c.id === hoveredCluster) : null
	);

	const TYPE_LABELS: Record<MiningType, string> = {
		industrial: 'Industrial',
		flare:      'Gas flare',
		hydro:      'Hydro',
		geothermal: 'Geothermal',
		nuclear:    'Nuclear',
	};
</script>

<div class="globe-wrap" bind:this={containerEl}>
	<canvas
		bind:this={canvas}
		onmousemove={onMouseMove}
		onmouseleave={onMouseLeave}
		aria-label="Spinning globe showing Bitcoin mining cluster locations"
		role="img"
	></canvas>

	{#if hoveredData}
		<div
			class="globe-tooltip"
			style:left="{tooltipX + 14}px"
			style:top="{tooltipY - 8}px"
		>
			<div class="tt-name">{hoveredData.name}</div>
			<div class="tt-meta">
				<span class="tt-type" style:color={CLUSTER_COLORS[hoveredData.type as MiningType]}>
					{TYPE_LABELS[hoveredData.type as MiningType]}
				</span>
				<span class="tt-pct">~{hoveredData.hashratePct}% hashrate</span>
			</div>
			{#if hoveredData.note}
				<div class="tt-note">{hoveredData.note}</div>
			{/if}
		</div>
	{/if}

	<!-- Legend -->
	<div class="globe-legend">
		{#each Object.entries(CLUSTER_COLORS) as [type, color]}
			<div class="legend-item">
				<span class="legend-dot" style:background={color}></span>
				<span class="legend-label">{TYPE_LABELS[type as MiningType]}</span>
			</div>
		{/each}
		{#if showSoloMiners}
			<div class="legend-item">
				<span class="legend-dot" style:background="#38bdf8" style:opacity="0.5"></span>
				<span class="legend-label">Solo miners</span>
			</div>
		{/if}
	</div>
</div>

<style>
	.globe-wrap {
		position: relative;
		width: 100%;
		display: flex;
		justify-content: center;
		align-items: flex-start;
	}
	canvas {
		display: block;
		cursor: crosshair;
		border-radius: 50%;
	}
	.globe-tooltip {
		position: absolute;
		pointer-events: none;
		background: #18181b;
		border: 1px solid #3f3f46;
		border-radius: 6px;
		padding: 8px 10px;
		min-width: 140px;
		z-index: 10;
	}
	.tt-name {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 12px;
		font-weight: 600;
		color: #f4f4f5;
		margin-bottom: 4px;
	}
	.tt-meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.tt-type {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.tt-pct {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 11px;
		color: #a1a1aa;
	}
	.tt-note {
		margin-top: 4px;
		font-size: 11px;
		color: #71717a;
		font-style: italic;
	}
	.globe-legend {
		position: absolute;
		bottom: 8px;
		left: 8px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.legend-item {
		display: flex;
		align-items: center;
		gap: 5px;
	}
	.legend-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.legend-label {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 10px;
		color: #71717a;
	}
</style>
