<script lang="ts">
	import { onMount } from 'svelte';
	import { system } from '$lib/stores/system.js';
	import type { UnitSystem } from '$lib/stores/system.js';

	const TONNES_TO_SHORT_TONS = 1.10231;
	// Inline mass estimate: (EH/s × 1e6 TH/s per EH/s) ÷ 150 TH/s per ASIC × 13.5 kg ÷ 1000 → tonnes
	const massForEh = (eh: number) => (eh * 1e6 / 150) * 13.5 / 1000;

	interface Pt { ts: number; eh: number; }

	let pts = $state<Pt[]>([]);
	let loading = $state(true);
	let svgEl: SVGSVGElement | undefined = $state();
	let hoverPt = $state<Pt | null>(null);
	let hoverSvgX = $state(0);
	let hoverSvgY = $state(0);

	// SVG viewBox
	const VW = 260, VH = 240;
	const PL = 26, PR = 4, PT = 8, PB = 22;
	const IW = VW - PL - PR;
	const IH = VH - PT - PB;

	onMount(async () => {
		try {
			const res = await fetch('https://mempool.space/api/v1/mining/hashrate/all');
			if (!res.ok) throw new Error('bad response');
			const json = await res.json();
			const START_TS = new Date(2014, 0, 1).getTime() / 1000;
			pts = (json.hashrates as { timestamp: number; avgHashrate: number }[])
				.filter(d => d.timestamp >= START_TS && d.avgHashrate > 0)
				.map(d => ({ ts: d.timestamp * 1000, eh: d.avgHashrate / 1e18 }));
		} catch {
			// fail silently — chart section just won't render
		} finally {
			loading = false;
		}
	});

	// Y-axis upper bound = actual peak across all data + 15% headroom.
	// Using the *last* point clipped intermediate peaks (e.g. mid-2025) and
	// pushed the latest reading right up against the top edge with no
	// visual breathing room. Hashrate isn't monotonic — the recent ATH may
	// not be today's value.
	const ehPeak = $derived(pts.length ? Math.max(...pts.map((p) => p.eh)) : 1);
	const ehCeiling = $derived(ehPeak * 1.15);

	// Log-scale y, linear x (time)
	function xOf(ts: number): number {
		const t0 = pts[0].ts, t1 = pts[pts.length - 1].ts;
		return PL + ((ts - t0) / (t1 - t0)) * IW;
	}
	function yOf(eh: number): number {
		const logMin = Math.log10(Math.max(pts[0].eh, 1e-18));
		const logMax = Math.log10(ehCeiling);
		const t = (Math.log10(Math.max(eh, 1e-18)) - logMin) / (logMax - logMin);
		return VH - PB - Math.max(0, Math.min(1, t)) * IH;
	}
	// Inverse y → EH/s (for y-axis labels)
	function ehAtY(y: number): number {
		const logMin = Math.log10(Math.max(pts[0].eh, 1e-18));
		const logMax = Math.log10(ehCeiling);
		const t = (VH - PB - y) / IH;
		return Math.pow(10, logMin + t * (logMax - logMin));
	}

	const linePath = $derived(
		pts.length < 2 ? '' :
		pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(p.ts).toFixed(1)},${yOf(p.eh).toFixed(1)}`).join(' ')
	);

	const areaPath = $derived(
		pts.length < 2 ? '' :
		`M${xOf(pts[0].ts).toFixed(1)},${VH - PB} ` +
		pts.map(p => `L${xOf(p.ts).toFixed(1)},${yOf(p.eh).toFixed(1)}`).join(' ') +
		` L${xOf(pts[pts.length - 1].ts).toFixed(1)},${VH - PB} Z`
	);

	// Year ticks every 2 years
	const yearTicks = $derived.by(() => {
		if (pts.length < 2) return [] as { year: number; x: number }[];
		const y0 = new Date(pts[0].ts).getFullYear();
		const y1 = new Date(pts[pts.length - 1].ts).getFullYear();
		const ticks: { year: number; x: number }[] = [];
		for (let y = Math.ceil(y0 / 2) * 2; y <= y1; y += 2) {
			const ts = new Date(y, 0, 1).getTime();
			if (ts >= pts[0].ts && ts <= pts[pts.length - 1].ts) {
				ticks.push({ year: y, x: xOf(ts) });
			}
		}
		return ticks;
	});

	// Y-axis labels at round EH/s values. Stops include 1000 so it's
	// available once peak crosses ~870 EH/s; 0.98 ceiling lets a label
	// just below the headroom band still render.
	const yAxisLabels = $derived.by(() => {
		if (pts.length < 2) return [] as { label: string; y: number }[];
		const stops = [1, 10, 100, 500, 1000];
		const logMax = Math.log10(ehCeiling);
		return stops
			.filter(eh => {
				const logMin = Math.log10(Math.max(pts[0].eh, 1e-18));
				const t = (Math.log10(eh) - logMin) / (logMax - logMin);
				return t > 0.02 && t < 0.98;
			})
			.map(eh => ({ label: `${eh}`, y: yOf(eh) }));
	});

	// Hover: find nearest data point to mouse x
	function onMouseMove(e: MouseEvent) {
		if (!svgEl || pts.length < 2) return;
		const rect = svgEl.getBoundingClientRect();
		const svgX = ((e.clientX - rect.left) / rect.width) * VW;
		const t0 = pts[0].ts, t1 = pts[pts.length - 1].ts;
		const fraction = Math.max(0, Math.min(1, (svgX - PL) / IW));
		const targetTs = t0 + fraction * (t1 - t0);
		let closest = pts[0];
		let minDist = Infinity;
		for (const p of pts) {
			const d = Math.abs(p.ts - targetTs);
			if (d < minDist) { minDist = d; closest = p; }
		}
		hoverPt = closest;
		hoverSvgX = xOf(closest.ts);
		hoverSvgY = yOf(closest.eh);
	}

	function onMouseLeave() { hoverPt = null; }

	// Tooltip positioning: place it in the quadrant opposite the cursor
	// so it never covers the curve near the hovered point. The naming is
	// "where the cursor is" so the consumed class flips to the opposite.
	const cursorOnLeft = $derived(hoverPt ? hoverSvgX <= VW / 2 : true);
	const cursorOnTop = $derived(hoverPt ? hoverSvgY <= VH / 2 : false);

	const hoverDate = $derived(
		hoverPt
			? new Date(hoverPt.ts).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
			: ''
	);

	function fmtMass(tonnes: number, sys: UnitSystem): string {
		if (sys === 'imperial') {
			const st = tonnes * TONNES_TO_SHORT_TONS;
			if (st >= 1_000_000) return `${(st / 1_000_000).toFixed(2)}M short tons`;
			if (st >= 1_000) return `${Math.round(st / 1000).toLocaleString('en-US')}k short tons`;
			return `${st.toFixed(0)} short tons`;
		}
		if (tonnes >= 1_000_000) return `${(tonnes / 1_000_000).toFixed(2)}M tonnes`;
		if (tonnes >= 1_000) return `${Math.round(tonnes / 1000).toLocaleString('en-US')}k tonnes`;
		return `${tonnes.toFixed(0)} tonnes`;
	}
</script>

{#if loading}
	<div class="spark-loading">loading history…</div>
{:else if pts.length >= 2}
	<div class="spark-wrap">
		<div class="spark-label">Hashrate history</div>
		<div class="spark-svg-wrap">
			<svg
				bind:this={svgEl}
				viewBox="0 0 {VW} {VH}"
				class="spark-svg"
				onmousemove={onMouseMove}
				onmouseleave={onMouseLeave}
				aria-label="Bitcoin network hashrate history since 2014"
				role="img"
			>
				<defs>
					<linearGradient id="hw-fill" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="#f59e0b" stop-opacity="0.28" />
						<stop offset="100%" stop-color="#f59e0b" stop-opacity="0.02" />
					</linearGradient>
				</defs>

				<!-- Baseline -->
				<line x1={PL} y1={VH - PB} x2={VW - PR} y2={VH - PB} stroke="#27272a" stroke-width="0.6" />

				<!-- Y-axis labels -->
				{#each yAxisLabels as { label, y }}
					<line x1={PL - 3} y1={y} x2={PL} y2={y} stroke="#3f3f46" stroke-width="0.5" />
					<text x={PL - 5} y={y + 2.5} text-anchor="end" fill="#3f3f46" font-size="6.5">{label}</text>
				{/each}

				<!-- Y-axis unit label -->
				<text
					x={5} y={PT + IH / 2}
					text-anchor="middle"
					fill="#3f3f46"
					font-size="6"
					transform="rotate(-90, 5, {PT + IH / 2})"
				>EH/s</text>

				<!-- Area fill -->
				<path d={areaPath} fill="url(#hw-fill)" />

				<!-- Line -->
				<path d={linePath} fill="none" stroke="#f59e0b" stroke-width="1.2" stroke-linejoin="round" />

				<!-- Year ticks -->
				{#each yearTicks as tick}
					<line x1={tick.x} y1={VH - PB} x2={tick.x} y2={VH - PB + 3} stroke="#3f3f46" stroke-width="0.5" />
					<text x={tick.x} y={VH - 5} text-anchor="middle" fill="#52525b" font-size="7">{tick.year}</text>
				{/each}

				<!-- Hover crosshair -->
				{#if hoverPt}
					<line
						x1={hoverSvgX} y1={PT}
						x2={hoverSvgX} y2={VH - PB}
						stroke="#71717a" stroke-width="0.8" stroke-dasharray="2,2"
					/>
					<circle cx={hoverSvgX} cy={hoverSvgY} r="2.5" fill="#f59e0b" />
				{/if}
			</svg>

			<!-- Hover tooltip -->
			{#if hoverPt}
				<div
					class="spark-tt"
					class:spark-tt--right={cursorOnLeft}
					class:spark-tt--left={!cursorOnLeft}
					class:spark-tt--bottom={cursorOnTop}
					class:spark-tt--top={!cursorOnTop}
				>
					<div class="spark-tt-date">{hoverDate}</div>
					<div class="spark-tt-hash">{hoverPt.eh >= 1 ? hoverPt.eh.toFixed(0) : hoverPt.eh.toFixed(3)} EH/s</div>
					<div class="spark-tt-mass">{fmtMass(massForEh(hoverPt.eh), $system)}</div>
				</div>
			{/if}
		</div>
		<div class="spark-hint">hover to see hashweight at any point in time</div>
	</div>
{/if}

<style>
	.spark-wrap {
		width: 100%;
	}
	.spark-label {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #52525b;
		margin-bottom: 6px;
	}
	.spark-svg-wrap {
		position: relative;
	}
	.spark-svg {
		width: 100%;
		height: auto;
		display: block;
		cursor: crosshair;
		overflow: visible;
	}
	.spark-tt {
		position: absolute;
		background: #18181b;
		border: 1px solid #3f3f46;
		border-radius: 5px;
		padding: 6px 9px;
		pointer-events: none;
		min-width: 108px;
		z-index: 5;
	}
	.spark-tt--right { left: 30px; }
	.spark-tt--left  { right: 4px; }
	.spark-tt--top    { top: 6px; }
	/* Bottom offset clears the x-axis year labels (~22px viewBox PB + label) */
	.spark-tt--bottom { bottom: 30px; }
	.spark-tt-date {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 10px;
		color: #71717a;
		margin-bottom: 2px;
	}
	.spark-tt-hash {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 13px;
		font-weight: 600;
		color: #f4f4f5;
	}
	.spark-tt-mass {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 11px;
		color: #fbbf24;
		margin-top: 2px;
	}
	.spark-hint {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 9px;
		color: #3f3f46;
		margin-top: 4px;
		text-align: right;
	}
	.spark-loading {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 11px;
		color: #3f3f46;
		padding: 8px 0;
	}
</style>
