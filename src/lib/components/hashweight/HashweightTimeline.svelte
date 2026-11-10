<script lang="ts">
	/**
	 * The fleet's weight since 2014 (log scale) — and the scrubber for the
	 * scene above it. Hover (or drag, on touch) previews a date; a click or
	 * tap sets it; arrow keys step a month, Home/End jump to the ends. The
	 * strip underneath shows which machine was the newest on sale in each
	 * era — the model's frontier (fleet.ts MACHINES).
	 */
	import { MACHINES, frontierAt, type FleetPoint } from '$lib/hashweight/fleet.js';

	let {
		series,
		value = null,
		onchange,
		onpreview,
	}: {
		series: FleetPoint[];
		/** Chosen date (ms), or null for the latest point. */
		value?: number | null;
		onchange: (ts: number | null) => void;
		onpreview: (ts: number | null) => void;
	} = $props();

	let w = $state(800);
	const H = 132;
	const PAD_L = 44;
	const PAD_R = 10;
	const PAD_T = 10;
	const PLOT_B = 104;
	const ERA_Y = 112;
	const ERA_H = 16;

	const t0 = $derived(series[0]?.ts ?? 0);
	const t1 = $derived(series[series.length - 1]?.ts ?? 1);
	const massMax = $derived(Math.max(1, ...series.map((p) => p.massKg / 1000)));
	const massMin = $derived(Math.max(1, Math.min(...series.map((p) => Math.max(1, p.massKg / 1000)))));
	const logLo = $derived(Math.floor(Math.log10(massMin)));
	const logHi = $derived(Math.log10(massMax) + 0.12);

	const x = (ts: number) => PAD_L + ((ts - t0) / Math.max(1, t1 - t0)) * (w - PAD_L - PAD_R);
	const y = (t: number) => PLOT_B - ((Math.log10(Math.max(t, 1)) - logLo) / (logHi - logLo)) * (PLOT_B - PAD_T);
	const tsAt = (px: number) => t0 + ((px - PAD_L) / Math.max(1, w - PAD_L - PAD_R)) * (t1 - t0);

	const path = $derived.by(() => {
		if (series.length < 2) return { line: '', area: '' };
		const step = Math.max(1, Math.floor(series.length / Math.max(200, w)));
		const pts: string[] = [];
		for (let i = 0; i < series.length; i += step) pts.push(`${x(series[i].ts).toFixed(1)},${y(series[i].massKg / 1000).toFixed(1)}`);
		const last = series[series.length - 1];
		pts.push(`${x(last.ts).toFixed(1)},${y(last.massKg / 1000).toFixed(1)}`);
		const line = 'M' + pts.join('L');
		return { line, area: `${line}L${x(last.ts).toFixed(1)},${PLOT_B}L${PAD_L},${PLOT_B}Z` };
	});

	const yTicks = $derived.by(() => {
		const out: { y: number; label: string }[] = [];
		for (let k = logLo; k <= Math.floor(logHi); k++) {
			const t = 10 ** k;
			out.push({ y: y(t), label: t >= 1000 ? `${t / 1000}k t` : `${t} t` });
		}
		return out;
	});

	const years = $derived.by(() => {
		const out: { x: number; label: string }[] = [];
		const a = new Date(t0).getUTCFullYear();
		const b = new Date(t1).getUTCFullYear();
		const every = w < 520 ? 4 : 2;
		for (let yr = a + 1; yr <= b; yr++) {
			if (yr % every) continue;
			out.push({ x: x(Date.UTC(yr, 0, 1)), label: String(yr) });
		}
		return out;
	});

	const eras = $derived.by(() => {
		if (series.length < 2) return [];
		const out: { x0: number; x1: number; name: string }[] = [];
		let cur = frontierAt(t0);
		let start = t0;
		for (const m of MACHINES) {
			const ms = Date.UTC(+m.from.slice(0, 4), +m.from.slice(5, 7) - 1, 1);
			if (ms <= t0 || ms > t1 || m.id === cur.id) continue;
			out.push({ x0: x(start), x1: x(ms), name: cur.name.replace('Antminer ', '') });
			cur = m;
			start = ms;
		}
		out.push({ x0: x(start), x1: x(t1), name: cur.name.replace('Antminer ', '') });
		return out;
	});

	let preview = $state<number | null>(null);
	let dragging = false;
	const shown = $derived(preview ?? value ?? t1);
	const cursor = $derived(x(Math.min(t1, Math.max(t0, shown))));
	const cursorPoint = $derived.by(() => {
		let best = series[series.length - 1];
		if (!best) return null;
		let lo = 0;
		let hi = series.length - 1;
		while (hi - lo > 1) {
			const mid = (lo + hi) >> 1;
			if (series[mid].ts <= shown) lo = mid;
			else hi = mid;
		}
		best = Math.abs(series[lo].ts - shown) <= Math.abs(series[hi].ts - shown) ? series[lo] : series[hi];
		return best;
	});

	function pxOf(e: PointerEvent): number {
		const r = (e.currentTarget as SVGElement).getBoundingClientRect();
		return ((e.clientX - r.left) / r.width) * w;
	}
	function clampTs(ts: number): number {
		return Math.min(t1, Math.max(t0, ts));
	}
	function onmove(e: PointerEvent) {
		if (e.pointerType !== 'mouse' && !dragging) return;
		preview = clampTs(tsAt(pxOf(e)));
		onpreview(preview);
	}
	function ondown(e: PointerEvent) {
		dragging = true;
		(e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
		preview = clampTs(tsAt(pxOf(e)));
		onpreview(preview);
	}
	function onup(e: PointerEvent) {
		if (!dragging) return;
		dragging = false;
		const ts = clampTs(tsAt(pxOf(e)));
		preview = null;
		onpreview(null);
		// A click near the right edge means "now".
		onchange(t1 - ts < (t1 - t0) * 0.004 ? null : ts);
	}
	function onleave() {
		if (dragging) return;
		preview = null;
		onpreview(null);
	}
	function onkey(e: KeyboardEvent) {
		const month = 30.44 * 86_400_000;
		const cur = value ?? t1;
		let next: number | null | undefined;
		if (e.key === 'ArrowLeft') next = clampTs(cur - (e.shiftKey ? 12 : 1) * month);
		else if (e.key === 'ArrowRight') next = clampTs(cur + (e.shiftKey ? 12 : 1) * month);
		else if (e.key === 'Home') next = t0;
		else if (e.key === 'End') next = null;
		if (next === undefined) return;
		e.preventDefault();
		onchange(next !== null && next >= t1 ? null : next);
	}

	const dateLabel = (ts: number) =>
		new Date(ts).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
</script>

<div class="tl" bind:clientWidth={w}>
	<svg
		width={w}
		height={H}
		viewBox="0 0 {w} {H}"
		role="slider"
		tabindex="0"
		aria-label="Date"
		aria-valuemin={t0}
		aria-valuemax={t1}
		aria-valuenow={shown}
		aria-valuetext={value === null && preview === null ? 'Now' : dateLabel(shown)}
		onpointermove={onmove}
		onpointerdown={ondown}
		onpointerup={onup}
		onpointercancel={onleave}
		onpointerleave={onleave}
		onkeydown={onkey}
	>
		<defs>
			<linearGradient id="tl-fill" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color="#d4a14a" stop-opacity="0.34" />
				<stop offset="1" stop-color="#d4a14a" stop-opacity="0.02" />
			</linearGradient>
		</defs>

		{#each yTicks as t}
			<line x1={PAD_L} y1={t.y} x2={w - PAD_R} y2={t.y} class="grid" />
			<text x={PAD_L - 6} y={t.y + 3.5} text-anchor="end" class="axis">{t.label}</text>
		{/each}

		<path d={path.area} fill="url(#tl-fill)" />
		<path d={path.line} fill="none" stroke="#d4a14a" stroke-width="1.6" stroke-linejoin="round" />

		{#each eras as era, i}
			<rect x={era.x0 + 0.5} y={ERA_Y} width={Math.max(0, era.x1 - era.x0 - 1)} height={ERA_H} rx="2" class="era" class:era--alt={i % 2 === 1} />
			{#if era.x1 - era.x0 > era.name.length * 6.4 + 8}
				<text x={(era.x0 + era.x1) / 2} y={ERA_Y + 11.5} text-anchor="middle" class="era-lbl">{era.name}</text>
			{/if}
		{/each}

		{#each years as yr}
			<text x={yr.x} y={PLOT_B - 4} text-anchor="middle" class="year">{yr.label}</text>
		{/each}

		{#if cursorPoint}
			<line x1={cursor} y1={PAD_T - 4} x2={cursor} y2={ERA_Y + ERA_H} class="cursor" />
			<circle cx={cursor} cy={y(cursorPoint.massKg / 1000)} r="4" fill="#0e0e10" stroke="#f5d78e" stroke-width="2" />
		{/if}
	</svg>
</div>

<style>
	.tl {
		width: 100%;
		touch-action: pan-y;
	}
	svg {
		display: block;
		cursor: ew-resize;
		outline: none;
		border-radius: 6px;
	}
	svg:focus-visible {
		outline: 2px solid #d4a14a;
		outline-offset: 2px;
	}
	.grid {
		stroke: #232327;
		stroke-width: 1;
	}
	.axis,
	.year {
		font: 10px 'JetBrains Mono', ui-monospace, monospace;
		fill: #52525b;
	}
	.year {
		fill: #71717a;
	}
	.era {
		fill: #1c1f24;
	}
	.era--alt {
		fill: #23272d;
	}
	.era-lbl {
		font: 500 9.5px 'JetBrains Mono', ui-monospace, monospace;
		fill: #8fb3c8;
	}
	.cursor {
		stroke: #f5d78e;
		stroke-width: 1;
		stroke-dasharray: 3 3;
	}
</style>
