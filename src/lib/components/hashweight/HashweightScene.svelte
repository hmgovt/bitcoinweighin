<script lang="ts">
	/**
	 * "The pile": every mining machine on the network stacked into one cube,
	 * drawn to true scale beside a person, a 40-ft shipping container and
	 * RMS Titanic (keel to funnel tops, out of the water). A side elevation
	 * with a little oblique depth on the cube. The camera is a pure function
	 * of the cube's edge — it frames the person and container while the pile
	 * is small and pulls back to take in the Titanic as it grows — so
	 * scrubbing the timeline animates it for free.
	 *
	 * Drawn in real pixels (the viewBox tracks the element's size) so the
	 * labels stay legible at every width.
	 */
	import { formatLength, formatNum } from '$lib/format.js';
	import { system } from '$lib/stores/system.js';
	import { CONTAINER_M, TITANIC_HEIGHT_M, TITANIC_LENGTH_M } from '$lib/hashweight/fleet.js';

	let {
		edgeM,
		machines,
		tileMm = [195, 290],
	}: {
		/** Edge of the cube of machines, m. */
		edgeM: number;
		machines: number;
		/** Face of one machine as stacked (width × height, mm) — drawn when zoomed in. */
		tileMm?: [number, number];
	} = $props();

	const uid = $props.id();

	let w = $state(1000);
	let h = $derived(Math.round(Math.min(460, Math.max(250, w * 0.44))));

	const PERSON_M = 1.75;
	const TOP_PAD = 46;
	const GROUND_PAD = 34;

	const e = $derived(Math.max(edgeM, 0.5));
	// Oblique depth of the cube's top and side faces.
	const dx = $derived(e * 0.3);
	const dy = $derived(e * 0.17);

	// World layout (m, x to the right, y up from the ground).
	const LEFT = -4.2;
	const PERSON_X = -2.6;
	const contX = $derived(e + dx + Math.max(2.5, e * 0.1));
	const shipX = $derived(contX + CONTAINER_M[0] + Math.max(6, e * 0.15));

	const ground = $derived(h - GROUND_PAD);
	const usable = $derived(ground - TOP_PAD);

	function smoothstep(a: number, b: number, x: number): number {
		const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
		return t * t * (3 - 2 * t);
	}

	/** Titanic's share of the framing: 0 for a small pile, 1 once it rivals the ship. */
	const shipK = $derived(smoothstep(14, 30, e));
	/** px per metre. */
	const s = $derived.by(() => {
		const fitH = (usable * 0.82) / (e + dy);
		const small = Math.min(fitH, (w - 8) / (contX + CONTAINER_M[0] + 2.5 - LEFT));
		const ship = Math.min((usable * 0.82) / Math.max(e + dy, TITANIC_HEIGHT_M), (w - 8) / (shipX + TITANIC_LENGTH_M + 4 - LEFT));
		return Math.exp(Math.log(small) * (1 - shipK) + Math.log(ship) * shipK);
	});

	const X = (x: number) => (x - LEFT) * s;
	const Y = (y: number) => ground - y * s;

	// ── The cube ────────────────────────────────────────────────
	const cube = $derived.by(() => {
		const x0 = X(0);
		const x1 = X(e);
		const yt = Y(e);
		const ddx = dx * s;
		const ddy = dy * s;
		return {
			x0,
			x1,
			yt,
			front: `M${x0},${ground}V${yt}H${x1}V${ground}Z`,
			top: `M${x0},${yt}L${x0 + ddx},${yt - ddy}H${x1 + ddx}L${x1},${yt}Z`,
			side: `M${x1},${ground}V${yt}L${x1 + ddx},${yt - ddy}V${ground - ddy}Z`,
			dimY: yt - ddy - 12,
			ddx,
		};
	});

	// One machine's face, for the stacking grid.
	const tile = $derived({ w: (tileMm[0] / 1000) * s, h: (tileMm[1] / 1000) * s });
	const gridOpacity = $derived(Math.min(1, Math.max(0, (tile.w - 2.5) / 6)));
	const showFans = $derived(tile.w > 11);

	// ── Person ──────────────────────────────────────────────────
	// A 1.75 m figure, drawn in metres (x from 0 to 0.5).
	const PERSON_PATH: [number, number][] = [
		[0.08, 1.47], [0.42, 1.47], [0.48, 1.4], [0.5, 0.86], [0.43, 0.86], [0.42, 1.3], [0.4, 1.3],
		[0.39, 0], [0.27, 0], [0.26, 0.85], [0.24, 0.85], [0.23, 0], [0.11, 0], [0.1, 1.3], [0.08, 1.3],
		[0.07, 0.86], [0, 0.86], [0.02, 1.4],
	];
	const person = $derived({
		d: 'M' + PERSON_PATH.map(([x, y]) => `${X(PERSON_X + x).toFixed(1)},${Y(y).toFixed(1)}`).join('L') + 'Z',
		cx: X(PERSON_X + 0.25),
		cy: Y(1.62),
		r: Math.max(0.12 * s, 0.4),
		top: Y(PERSON_M),
		px: PERSON_M * s,
	});

	// ── Container ───────────────────────────────────────────────
	const container = $derived.by(() => {
		const x0 = X(contX);
		const x1 = X(contX + CONTAINER_M[0]);
		const yt = Y(CONTAINER_M[2]);
		const step = 0.3 * s;
		const ribs: number[] = [];
		if (step >= 3) for (let x = x0 + step; x < x1 - step / 2; x += step) ribs.push(x);
		return { x0, x1, yt, ribs, wpx: x1 - x0 };
	});

	// ── RMS Titanic, bow to the left, out of the water ──────────
	// Profile in metres from the bow (x) and the keel (y). Length 269 m,
	// waterline 10.5 m, boat deck ~29 m, funnel tops 53 m.
	const HULL: [number, number][] = [
		[2, 21.5], [0, 19], [2.5, 7], [8, 1], [13, 0], [243, 0], [255, 3.5], [265, 11], [269, 19.5], [268, 21],
		[200, 19.2], [120, 19], [60, 19.4],
	];
	const SUPER: [number, number][] = [
		[34, 19.2], [34, 30.5], [44, 30.5], [44, 28.5], [222, 28.5], [222, 19.2],
	];
	const FUNNELS = [70, 106, 142, 178];
	const ship = $derived.by(() => {
		const px = (x: number, y: number) => `${X(shipX + x).toFixed(1)},${Y(y).toFixed(1)}`;
		const poly = (pts: [number, number][]) => 'M' + pts.map(([x, y]) => px(x, y)).join('L') + 'Z';
		const funnels = FUNNELS.map((c) => {
			const rake = 3;
			const w = 7;
			return {
				body: poly([[c - w / 2, 28.5], [c - w / 2 + rake, 53], [c + w / 2 + rake, 53], [c + w / 2, 28.5]]),
				cap: poly([[c - w / 2 + rake * 0.82, 48.6], [c - w / 2 + rake, 53], [c + w / 2 + rake, 53], [c + w / 2 + rake * 0.82, 48.6]]),
			};
		});
		return {
			hull: poly(HULL),
			waterY: Y(10.5),
			superstructure: poly(SUPER),
			funnels,
			masts: [
				[X(shipX + 24), Y(21), X(shipX + 25.5), Y(62)],
				[X(shipX + 238), Y(20), X(shipX + 239.5), Y(59)],
			],
			x0: X(shipX),
			x1: X(shipX + TITANIC_LENGTH_M),
			top: Y(TITANIC_HEIGHT_M),
		};
	});

	/** The ship only fades in once most of it is in frame. */
	const shipVis = $derived(smoothstep(0.6, 0.97, (w - ship.x0) / Math.max(1, ship.x1 - ship.x0)));

	function roundLength(m: number): string {
		const ft = m * 3.28084;
		if ($system === 'imperial') return ft >= 10 ? `${Math.round(ft).toLocaleString('en-US')} ft` : formatLength(m, 'imperial');
		return m >= 10 ? `${Math.round(m)} m` : `${m.toFixed(1)} m`;
	}
	const edgeLabel = $derived(roundLength(e));
	const machinesLabel = $derived(
		machines >= 1e6 ? `${formatNum(+(machines / 1e6).toFixed(machines >= 1e7 ? 0 : 1))} million machines` : `${Math.round(machines).toLocaleString('en-US')} machines`
	);
</script>

<div class="scene" bind:clientWidth={w} style:height="{h}px">
	<svg
		width={w}
		height={h}
		viewBox="0 0 {w} {h}"
		role="img"
		aria-label="Every mining machine on the network stacked into a cube {edgeLabel} on a side, drawn to scale beside a person, a shipping container and the Titanic."
	>
		<defs>
			<linearGradient id="sky-{uid}" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color="#0c0d10" />
				<stop offset="1" stop-color="#15171c" />
			</linearGradient>
			<linearGradient id="floor-{uid}" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color="#1d2026" />
				<stop offset="1" stop-color="#0e0f12" />
			</linearGradient>
			<linearGradient id="front-{uid}" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color="#3a4550" />
				<stop offset="1" stop-color="#262d35" />
			</linearGradient>
			<clipPath id="below-{uid}">
				<rect x="0" y={ship.waterY} width={w} height={h} />
			</clipPath>
			<pattern
				id="grid-{uid}"
				patternUnits="userSpaceOnUse"
				x={cube.x0}
				y={ground}
				width={tile.w}
				height={tile.h}
			>
				<rect x="0" y="0" width={tile.w} height={tile.h} fill="none" stroke="#8fb3c8" stroke-opacity="0.28" stroke-width="0.7" />
				{#if showFans}
					<circle cx={tile.w / 2} cy={tile.h * 0.28} r={tile.w * 0.3} fill="none" stroke="#8fb3c8" stroke-opacity="0.22" stroke-width="0.7" />
					<circle cx={tile.w / 2} cy={tile.h * 0.72} r={tile.w * 0.3} fill="none" stroke="#8fb3c8" stroke-opacity="0.22" stroke-width="0.7" />
				{/if}
			</pattern>
		</defs>

		<rect width={w} height={ground} fill="url(#sky-{uid})" />
		<rect y={ground} width={w} height={h - ground} fill="url(#floor-{uid})" />

		<!-- Titanic -->
		<g class="ship" style:opacity={shipVis}>
			{#each ship.masts as [ax, ay, bx, by]}
				<line x1={ax} y1={ay} x2={bx} y2={by} stroke="#4b525c" stroke-width={Math.max(0.6, 0.5 * s)} />
			{/each}
			{#each ship.funnels as f}
				<path d={f.body} fill="#8a7458" />
				<path d={f.cap} fill="#121316" />
			{/each}
			<path d={ship.superstructure} fill="#6f6d68" />
			<path d={ship.hull} fill="#16181c" stroke="#3a404a" stroke-width="1" />
			<path d={ship.hull} fill="#4a1f1c" clip-path="url(#below-{uid})" />
		</g>

		<!-- Container -->
		<g class="container">
			<rect x={container.x0} y={container.yt} width={container.wpx} height={ground - container.yt} fill="#6b3d24" stroke="#a0643a" stroke-width="1" />
			{#each container.ribs as x}
				<line x1={x} y1={container.yt + 1} x2={x} y2={ground - 1} stroke="#4f2c1a" stroke-width="1" />
			{/each}
		</g>

		<!-- Person -->
		<g class="person" fill="#d4d4d8">
			<path d={person.d} />
			<circle cx={person.cx} cy={person.cy} r={person.r} />
		</g>

		<!-- The pile -->
		<g class="cube">
			<path d={cube.side} fill="#1a2027" stroke="#8fb3c8" stroke-opacity="0.5" stroke-width="1" />
			<path d={cube.top} fill="#4a5764" stroke="#8fb3c8" stroke-opacity="0.5" stroke-width="1" />
			<path d={cube.front} fill="url(#front-{uid})" />
			<path d={cube.front} fill="url(#grid-{uid})" style:opacity={gridOpacity} />
			<path d={cube.front} fill="none" stroke="#8fb3c8" stroke-opacity="0.8" stroke-width="1.2" />
		</g>

		<line x1="0" y1={ground} x2={w} y2={ground} stroke="#3f3f46" stroke-width="1" />

		<!-- Labels -->
		<g class="dim">
			<line x1={cube.x0} y1={cube.dimY} x2={cube.x1} y2={cube.dimY} />
			<line x1={cube.x0} y1={cube.dimY - 4} x2={cube.x0} y2={cube.dimY + 4} />
			<line x1={cube.x1} y1={cube.dimY - 4} x2={cube.x1} y2={cube.dimY + 4} />
		</g>
		<text class="lbl lbl--cube" x={(cube.x0 + cube.x1) / 2} y={cube.dimY - 8} text-anchor="middle">{edgeLabel}</text>
		<text class="lbl lbl--sub" x={cube.x0} y={ground + 20}>{machinesLabel}</text>

		{#if person.px < 34}
			<line class="leader" x1={person.cx} y1={person.top - 2} x2={person.cx} y2={Math.min(person.top - 16, ground - 40)} />
			<text class="lbl" x={Math.max(4, person.cx - 3)} y={Math.min(person.top - 20, ground - 44)}>person</text>
		{:else}
			<text class="lbl" x={Math.max(24, person.cx)} y={person.top - 8} text-anchor="middle">person</text>
		{/if}

		{#if container.wpx >= 26}
			<text class="lbl" x={container.x0} y={container.yt - 8}>40-ft container</text>
		{/if}

		{#if shipVis > 0.05}
			<text class="lbl" x={Math.min(ship.x1, w - 6)} y={ship.top - 10} text-anchor="end" style:opacity={shipVis}>
				RMS Titanic · {roundLength(TITANIC_LENGTH_M)} long
			</text>
		{/if}
	</svg>
</div>

<style>
	.scene {
		position: relative;
		width: 100%;
		overflow: hidden;
	}
	svg {
		display: block;
	}
	.dim line {
		stroke: #8fb3c8;
		stroke-width: 1;
	}
	.leader {
		stroke: #52525b;
		stroke-width: 1;
	}
	.lbl {
		font: 500 11px 'JetBrains Mono', ui-monospace, monospace;
		fill: #a1a1aa;
	}
	.lbl--cube {
		font-size: 13px;
		font-weight: 600;
		fill: #cfe0ea;
	}
	.lbl--sub {
		fill: #71717a;
	}
</style>
