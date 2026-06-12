<script lang="ts">
	/**
	 * CocaineBrickStack — the cocaine hero visual: a scalable inline-SVG
	 * "stack" that conveys the *number* of part/whole units across five mass
	 * tiers, rendered to "very good infographic" quality so it sits naturally
	 * beside the WebGL metal scenes in the same hero frame.
	 *
	 *   lines → retail bags → 1-kg bricks → pallets → years of global production
	 *
	 * Pure layout maths live in CocaineBrickStack.helpers.ts (unit-tested).
	 * This component is presentation only: it reads `massGrams`, asks the
	 * helpers for counts, then composes the geometry — adaptively sized so low
	 * counts fill the frame rather than floating small/off-centre. No canvas,
	 * no three.js, no deps.
	 *
	 * Palette: bone/ivory wrap (#e8e0d2, the established cocaine accent) with
	 * subtle sheen gradients; zinc stage background (#18181b) to match the live
	 * stage; amber (#f59e0b) reserved for the cut-brick / partial emphasis and
	 * the "×N" overflow magnitude.
	 */

	import {
		selectTier,
		countedLayout,
		productionLayout,
		gridDims,
		formatCount,
		type CocaineTier,
	} from './CocaineBrickStack.helpers.js';

	let { massGrams }: { massGrams: number } = $props();

	/**
	 * Deterministic per-unit jitter (0–1). Hash of index + channel so units get
	 * stable, SSR-safe irregularity — rotation, speck placement, sheen offsets.
	 * Uniformity is what reads as clipart; ±a degree of slouch reads as mass.
	 */
	function jit(i: number, k = 0): number {
		const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
		return s - Math.floor(s);
	}

	const tier = $derived<CocaineTier | null>(selectTier(massGrams));
	const counted = $derived(countedLayout(massGrams));
	const production = $derived(productionLayout(massGrams));

	// ── Palette ──────────────────────────────────────────────────
	const BONE = '#e8e0d2';
	const BONE_DARK = '#b4ab98'; // deepest face / outline
	const AMBER = '#f59e0b';
	const ZINC_LINE = '#3f3f46';

	const VB_W = 800;
	const VB_H = 600;
	const CX = VB_W / 2;

	// ── Surface label per tier (paired with the denomination copy upstream) ──
	const tierLabel = $derived.by(() => {
		switch (tier) {
			case 'lines':
				return 'lines · 30 mg each';
			case 'bags':
				return 'retail bags · ~1 g each';
			case 'bricks':
				return '1-kg pressed bricks';
			case 'pallets':
				return 'pallets · 1,000 bricks each';
			case 'production':
				return 'global annual production';
			default:
				return '';
		}
	});

	// Count label — carries the true precision (partial slivers are suppressed
	// in the helper, so this is where the real magnitude lives).
	const countLabel = $derived.by(() => {
		if (!counted) return null;
		const n = counted.exactCount;
		switch (counted.tier) {
			case 'lines':
				return `${n < 10 ? n.toFixed(1) : formatCount(n)} lines`;
			case 'bags':
				return `${formatCount(n)} bags`;
			case 'bricks':
				return `${n < 10 ? n.toFixed(1) : formatCount(n)} kg`;
			case 'pallets':
				return `${n < 10 ? n.toFixed(1) : formatCount(n)} pallets`;
			default:
				return null;
		}
	});

	const overflowLabel = $derived(
		counted && counted.capped ? `×${formatCount(counted.exactCount)} total` : null
	);

	// ── LINES ────────────────────────────────────────────────────
	interface LineSpec {
		x: number;
		y: number;
		len: number;
		full: boolean;
	}
	const linesGeom = $derived.by<{ lines: LineSpec[]; slab: { x: number; y: number; w: number; h: number } }>(() => {
		if (tier !== 'lines' || !counted) return { lines: [], slab: { x: 0, y: 0, w: 0, h: 0 } };
		const total = counted.renderedUnits;
		const cols = Math.min(4, total);
		const rows = Math.ceil(total / cols);
		// Adaptive geometry: lines grow to fill the slab at low counts.
		const lineLen = cols <= 2 ? 200 : cols === 3 ? 150 : 120;
		const gapX = lineLen + 36;
		const gapY = rows <= 2 ? 78 : 58;
		const blockW = (cols - 1) * gapX + lineLen;
		const blockH = (rows - 1) * gapY;
		const x0 = CX - blockW / 2;
		const y0 = VB_H / 2 - blockH / 2 - 8;
		const lines: LineSpec[] = [];
		for (let i = 0; i < total; i++) {
			const isPartial = !counted.capped && counted.partialFraction > 0 && i === total - 1;
			const col = i % cols;
			const row = Math.floor(i / cols);
			lines.push({
				x: x0 + col * gapX,
				y: y0 + row * gapY,
				len: isPartial ? lineLen * counted.partialFraction : lineLen,
				full: !isPartial,
			});
		}
		const pad = 56;
		return {
			lines,
			slab: { x: x0 - pad, y: y0 - pad, w: blockW + pad * 2, h: blockH + pad * 2 + 8 },
		};
	});

	// ── BAGS ─────────────────────────────────────────────────────
	interface BagSpec {
		x: number;
		y: number;
		w: number;
		h: number;
		fill: number;
	}
	const bagsGeom = $derived.by<BagSpec[]>(() => {
		if (tier !== 'bags' || !counted) return [];
		const total = counted.renderedUnits;
		const { cols, rows } = gridDims(total, 10);
		// Adaptive bag size: fewer bags → bigger bags, so a handful fills the frame.
		const maxCellW = (VB_W - 120) / cols;
		const maxCellH = (VB_H - 150) / rows;
		const cell = Math.min(maxCellW, maxCellH, 110);
		const bagW = cell * 0.66;
		const bagH = cell * 0.78;
		const gridW = cols * cell;
		const gridH = rows * cell;
		const x0 = CX - gridW / 2 + (cell - bagW) / 2;
		const y0 = VB_H / 2 - gridH / 2 + (cell - bagH) / 2 - 6;
		const out: BagSpec[] = [];
		for (let i = 0; i < total; i++) {
			const isPartial = !counted.capped && counted.partialFraction > 0 && i === total - 1;
			const col = i % cols;
			const row = Math.floor(i / cols);
			out.push({
				x: x0 + col * cell,
				y: y0 + row * cell,
				w: bagW,
				h: bagH,
				fill: isPartial ? counted.partialFraction : 1,
			});
		}
		return out;
	});

	// ── BRICKS ───────────────────────────────────────────────────
	// 2.5-D taped blocks stacked in courses like a pallet load. Adaptive
	// dimensions keep low counts large and centred; the trailing brick can be
	// a vertical "cut" block at partialFraction of width.
	interface BrickSpec {
		col: number;
		row: number;
		cut: number; // 1 = whole, <1 = cut block (fraction of width)
	}
	const bricksLayout = $derived.by(() => {
		if (tier !== 'bricks' || !counted) {
			return { bricks: [] as BrickSpec[], perRow: 8, bw: 78, bh: 30, depth: 16, gx: 8, gy: 10, ox: 0, oy: 0, rows: 0 };
		}
		const total = counted.renderedUnits;
		// Choose a per-row count that yields a pleasing near-rectangular stack,
		// fewer per row when there are few bricks so each brick is large.
		const perRow = total <= 3 ? total : total <= 6 ? 3 : total <= 12 ? 4 : total <= 24 ? 6 : 8;
		const rows = Math.ceil(total / perRow);
		const bricks: BrickSpec[] = [];
		for (let i = 0; i < total; i++) {
			const isPartial = !counted.capped && counted.partialFraction > 0 && i === total - 1;
			bricks.push({ col: i % perRow, row: Math.floor(i / perRow), cut: isPartial ? counted.partialFraction : 1 });
		}
		// Size bricks to fill ~74% of the frame given the row/col counts.
		const availW = VB_W * 0.74;
		const availH = VB_H * 0.6;
		const depthRatio = 0.32; // depth as a fraction of brick height
		let bw = Math.min(132, (availW - (perRow - 1) * 10) / perRow);
		let bh = bw * 0.4;
		const depth = bh * depthRatio;
		const gx = bw * 0.1;
		const gy = bh * 0.34;
		// Constrain to vertical space too.
		const stackHRaw = rows * (bh + gy) + depth;
		if (stackHRaw > availH) {
			const k = availH / stackHRaw;
			bw *= k;
			bh *= k;
		}
		const d = bh * depthRatio;
		const gxx = bw * 0.1;
		const gyy = bh * 0.34;
		const stackW = perRow * bw + (perRow - 1) * gxx;
		const stackH = rows * (bh + gyy);
		const ox = CX - (stackW + d) / 2;
		const oy = VB_H / 2 - (stackH + d) / 2 + d;
		return { bricks, perRow, bw, bh, depth: d, gx: gxx, gy: gyy, ox, oy, rows };
	});

	// ── PALLETS ──────────────────────────────────────────────────
	interface PalletSpec {
		col: number;
		row: number;
		fill: number; // 0–1 stack height
	}
	const palletsLayout = $derived.by(() => {
		if (tier !== 'pallets' || !counted) {
			return { pallets: [] as PalletSpec[], perRow: 6, pw: 96, ph: 70, gx: 18, gy: 30, ox: 0, oy: 0 };
		}
		const total = counted.renderedUnits;
		const perRow = total <= 2 ? total : total <= 4 ? 2 : total <= 9 ? 3 : total <= 16 ? 4 : 6;
		const rows = Math.ceil(total / perRow);
		const pallets: PalletSpec[] = [];
		for (let i = 0; i < total; i++) {
			const isPartial = !counted.capped && counted.partialFraction > 0 && i === total - 1;
			pallets.push({ col: i % perRow, row: Math.floor(i / perRow), fill: isPartial ? counted.partialFraction : 1 });
		}
		const availW = VB_W * 0.78;
		const availH = VB_H * 0.62;
		let pw = Math.min(150, (availW - (perRow - 1) * (perRow > 3 ? 18 : 30)) / perRow);
		let ph = pw * 0.72;
		const gx = perRow > 3 ? pw * 0.18 : pw * 0.3;
		const gy = ph * 0.42;
		const gridHRaw = rows * (ph + gy);
		if (gridHRaw > availH) {
			const k = availH / gridHRaw;
			pw *= k;
			ph *= k;
		}
		const gxx = perRow > 3 ? pw * 0.18 : pw * 0.3;
		const gyy = ph * 0.42;
		const gridW = perRow * pw + (perRow - 1) * gxx;
		const gridH = rows * (ph + gyy);
		const ox = CX - gridW / 2;
		const oy = VB_H / 2 - gridH / 2 + 8;
		return { pallets, perRow, pw, ph, gx: gxx, gy: gyy, ox, oy };
	});
</script>

<div class="brick-stack" data-tier={tier ?? 'empty'}>
	<svg
		viewBox="0 0 {VB_W} {VB_H}"
		width="100%"
		role="img"
		aria-label="Scaled depiction of {countLabel ?? tierLabel}"
		preserveAspectRatio="xMidYMid meet"
	>
		<defs>
			<!-- Stage background — matches the LiveStage #18181b frame. -->
			<radialGradient id="bs-bg" cx="0.5" cy="0.42" r="0.75">
				<stop offset="0" stop-color="#1f1f23" />
				<stop offset="1" stop-color="#161618" />
			</radialGradient>
			<!-- Wrap sheen on bone faces (top-lit). -->
			<linearGradient id="bs-bone-top" x1="0" y1="0" x2="0.4" y2="1">
				<stop offset="0" stop-color="#f2ecdf" />
				<stop offset="1" stop-color="#ddd4c3" />
			</linearGradient>
			<linearGradient id="bs-bone-front" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color="#e2dac9" />
				<stop offset="0.5" stop-color="#d6cdba" />
				<stop offset="1" stop-color="#c5bca8" />
			</linearGradient>
			<linearGradient id="bs-bone-side" x1="0" y1="0" x2="1" y2="0">
				<stop offset="0" stop-color="#bdb4a0" />
				<stop offset="1" stop-color="#a99f8b" />
			</linearGradient>
			<linearGradient id="bs-cut-front" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color="#f6f1e6" />
				<stop offset="1" stop-color="#e7dfce" />
			</linearGradient>
			<!-- Tape band — slight tonal variation across its width. -->
			<linearGradient id="bs-tape" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color="#a99f88" />
				<stop offset="0.5" stop-color="#8d8470" />
				<stop offset="1" stop-color="#9a917c" />
			</linearGradient>
			<!-- Soft elliptical ground shadow. -->
			<radialGradient id="bs-shadow" cx="0.5" cy="0.5" r="0.5">
				<stop offset="0" stop-color="#000000" stop-opacity="0.42" />
				<stop offset="0.7" stop-color="#000000" stop-opacity="0.16" />
				<stop offset="1" stop-color="#000000" stop-opacity="0" />
			</radialGradient>
			<!-- Realism kit: powder, glass, plastic film, sheen sweeps, AO, wood. -->
			<linearGradient id="bs-powder" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color="#f4eee1" />
				<stop offset="1" stop-color="#d3c9b4" />
			</linearGradient>
			<linearGradient id="bs-glass" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color="#1d1d22" />
				<stop offset="0.12" stop-color="#101014" />
				<stop offset="1" stop-color="#0a0a0c" />
			</linearGradient>
			<linearGradient id="bs-plastic" x1="0" y1="0" x2="0.25" y2="1">
				<stop offset="0" stop-color="#ffffff" stop-opacity="0.16" />
				<stop offset="0.45" stop-color="#ffffff" stop-opacity="0.04" />
				<stop offset="1" stop-color="#ffffff" stop-opacity="0.1" />
			</linearGradient>
			<linearGradient id="bs-sheen-d" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0" stop-color="#ffffff" stop-opacity="0" />
				<stop offset="0.5" stop-color="#ffffff" stop-opacity="0.32" />
				<stop offset="1" stop-color="#ffffff" stop-opacity="0" />
			</linearGradient>
			<linearGradient id="bs-sheen-v" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color="#ffffff" stop-opacity="0.3" />
				<stop offset="1" stop-color="#ffffff" stop-opacity="0" />
			</linearGradient>
			<linearGradient id="bs-ao" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color="#000000" stop-opacity="0" />
				<stop offset="1" stop-color="#000000" stop-opacity="0.35" />
			</linearGradient>
			<linearGradient id="bs-wood" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color="#6b5b46" />
				<stop offset="0.5" stop-color="#54462f" />
				<stop offset="1" stop-color="#473b2c" />
			</linearGradient>
			<!-- Powder grain: clipped fractal noise multiplied over the source. -->
			<filter id="bs-grain" x="-5%" y="-5%" width="110%" height="110%">
				<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" result="n" />
				<feColorMatrix in="n" type="saturate" values="0" result="g" />
				<feComponentTransfer in="g" result="ga">
					<feFuncA type="table" tableValues="0 0.5" />
				</feComponentTransfer>
				<feComposite in="ga" in2="SourceGraphic" operator="in" result="gc" />
				<feBlend in="SourceGraphic" in2="gc" mode="multiply" />
			</filter>
			<!-- Ragged powder edges: low-frequency displacement. -->
			<filter id="bs-rough" x="-8%" y="-40%" width="116%" height="180%">
				<feTurbulence type="fractalNoise" baseFrequency="0.07 0.28" numOctaves="2" seed="7" result="d" />
				<feDisplacementMap in="SourceGraphic" in2="d" scale="5" xChannelSelector="R" yChannelSelector="G" />
			</filter>
			<clipPath id="bs-clip-frame">
				<rect x="0" y="0" width={VB_W} height={VB_H} rx="8" />
			</clipPath>
		</defs>

		<g clip-path="url(#bs-clip-frame)">
			<rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#bs-bg)" />

			{#if tier === 'lines'}
				{@const slab = linesGeom.slab}
				<!-- Glass cut-surface: gradient slab, rim light, soft inner edge. -->
				<rect x={slab.x} y={slab.y} width={slab.w} height={slab.h} rx="10" fill="url(#bs-glass)" stroke={ZINC_LINE} stroke-width="1" />
				<rect x={slab.x + 3} y={slab.y + 2.5} width={slab.w - 6} height="2.5" rx="1.2" fill="#ffffff" opacity="0.06" />
				<rect x={slab.x} y={slab.y} width={slab.w} height={slab.h} rx="10" fill="none" stroke="#ffffff" stroke-width="0.6" opacity="0.05" />
				{#each linesGeom.lines as l, i (i)}
					<rect x={l.x + 3} y={l.y + 14} width={Math.max(0, l.len - 6)} height="7" rx="3.5" fill="#000" opacity="0.3" />
					<!-- Powder body: displaced edges + grain pass, chalky not vector. -->
					<g filter="url(#bs-rough)">
						<rect
							x={l.x}
							y={l.y}
							width={l.len}
							height="11"
							rx="5"
							fill={l.full ? 'url(#bs-powder)' : AMBER}
							opacity={l.full ? 0.97 : 0.95}
						/>
					</g>
					<g filter="url(#bs-grain)">
						<rect x={l.x} y={l.y} width={l.len} height="11" rx="5" fill={l.full ? BONE : AMBER} opacity="0.5" />
					</g>
					<rect x={l.x + l.len * 0.12} y={l.y + 1.5} width={l.len * 0.3} height="3" rx="1.5" fill="#fff" opacity="0.22" />
					<!-- Residue specks scattered around each line (deterministic). -->
					{#each Array(6) as _, si (si)}
						<circle
							cx={l.x + jit(i * 7 + si, 3) * l.len}
							cy={l.y + 10 + jit(i * 7 + si, 4) * 18}
							r={0.7 + jit(i * 7 + si, 5) * 1.1}
							fill={l.full ? BONE : AMBER}
							opacity={0.12 + jit(i * 7 + si, 6) * 0.2}
						/>
					{/each}
				{/each}

			{:else if tier === 'bags'}
				{#each bagsGeom as b, i (i)}
					{@const r = Math.min(10, b.w * 0.16)}
					{@const rot = (jit(i, 1) - 0.5) * 5}
					{@const powTop = b.h * 0.96 - b.h * 0.78 * b.fill}
					<ellipse cx={b.x + b.w / 2} cy={b.y + b.h + 7} rx={b.w * 0.52} ry={b.w * 0.12} fill="url(#bs-shadow)" />
					<g transform="translate({b.x},{b.y}) rotate({rot}, {b.w / 2}, {b.h / 2})">
						<!-- bag void behind the powder -->
						<rect x="0" y={b.h * 0.1} width={b.w} height={b.h * 0.9} rx={r} fill="#101012" stroke="#000" stroke-width="0.6" opacity="0.9" />
						<!-- powder mound: wavy settled top + grain -->
						<g filter="url(#bs-grain)">
							<path
								d="M {b.w * 0.08} {powTop + b.h * 0.05}
									Q {b.w * 0.3} {powTop - b.h * 0.04} {b.w * 0.55} {powTop + b.h * 0.02}
									Q {b.w * 0.78} {powTop + b.h * 0.07} {b.w * 0.92} {powTop}
									L {b.w * 0.92} {b.h * 0.9}
									Q {b.w * 0.92} {b.h * 0.98} {b.w * 0.8} {b.h * 0.98}
									L {b.w * 0.2} {b.h * 0.98}
									Q {b.w * 0.08} {b.h * 0.98} {b.w * 0.08} {b.h * 0.9}
									Z"
								fill={b.fill < 1 ? AMBER : 'url(#bs-powder)'}
								opacity={b.fill < 1 ? 0.92 : 1}
							/>
						</g>
						<!-- plastic film over everything: translucent body + wrinkles + sheen -->
						<rect x="0" y={b.h * 0.1} width={b.w} height={b.h * 0.9} rx={r} fill="url(#bs-plastic)" opacity="0.5" />
						<path d="M {b.w * 0.18} {b.h * 0.22} Q {b.w * 0.1} {b.h * 0.5} {b.w * 0.22} {b.h * 0.88}" fill="none" stroke="#fff" stroke-width="1" opacity="0.1" />
						<path d="M {b.w * 0.62} {b.h * 0.2} Q {b.w * 0.74} {b.h * 0.46} {b.w * 0.6} {b.h * 0.8}" fill="none" stroke="#fff" stroke-width="0.8" opacity="0.08" />
						<rect x={b.w * 0.14} y={b.h * 0.16} width={b.w * 0.12} height={b.h * 0.62} rx={b.w * 0.06} fill="url(#bs-sheen-v)" opacity="0.5" />
						<!-- press-seal: dark band + two catching rails -->
						<rect x={b.w * 0.06} y="0" width={b.w * 0.88} height={b.h * 0.12} rx="2.5" fill="#26262b" />
						<line x1={b.w * 0.06} y1={b.h * 0.045} x2={b.w * 0.94} y2={b.h * 0.045} stroke="#fff" opacity="0.25" stroke-width="0.8" />
						<line x1={b.w * 0.06} y1={b.h * 0.085} x2={b.w * 0.94} y2={b.h * 0.085} stroke="#fff" opacity="0.12" stroke-width="0.8" />
						<rect x="0" y={b.h * 0.1} width={b.w} height={b.h * 0.9} rx={r} fill="none" stroke="#fff" stroke-width="0.8" opacity="0.14" />
					</g>
				{/each}

			{:else if tier === 'bricks'}
				{@const L = bricksLayout}
				{@const bw = L.bw}
				{@const bh = L.bh}
				{@const depth = L.depth}
				{#each L.bricks as b, i (b.col + '-' + b.row)}
					{@const x = L.ox + b.col * (bw + L.gx)}
					{@const y = L.oy + b.row * (bh + L.gy)}
					{@const w = bw * b.cut}
					{@const isCut = b.cut < 1}
					{@const rot = (jit(i, 7) - 0.5) * 1.8}
					<!-- ground shadow under the bottom course only -->
					{#if b.row === L.rows - 1}
						<ellipse cx={x + w / 2 + depth / 2} cy={y + bh + 7} rx={w * 0.6} ry={bh * 0.2} fill="url(#bs-shadow)" />
					{/if}
					<g transform="translate({x},{y}) rotate({rot}, {w / 2}, {bh / 2})">
						<!-- top face (parallelogram) -->
						<polygon points="0,0 {w},0 {w + depth},{-depth} {depth},{-depth}" fill="url(#bs-bone-top)" />
						<!-- right face -->
						<polygon points="{w},0 {w + depth},{-depth} {w + depth},{bh - depth} {w},{bh}" fill="url(#bs-bone-side)" />
						<!-- front face: cut bricks expose pressed powder (heavy grain) -->
						<rect x="0" y="0" width={w} height={bh} fill={isCut ? 'url(#bs-cut-front)' : 'url(#bs-bone-front)'} />
						{#if isCut}
							<g filter="url(#bs-grain)"><rect x="0" y="0" width={w} height={bh} fill="#efe8da" opacity="0.85" /></g>
						{:else}
							<g filter="url(#bs-grain)"><rect x="0" y="0" width={w} height={bh} fill="url(#bs-bone-front)" opacity="0.35" /></g>
						{/if}
						<!-- film wrap: diagonal sheen sweep + top-face glint + crease lines -->
						<polygon points="{w * 0.12},0 {w * 0.34},0 {w * 0.22},{bh} {w * 0.04},{bh}" fill="url(#bs-sheen-d)" opacity="0.5" />
						<polygon points="{w * 0.3 + depth * 0.6},{-depth * 0.6} {w * 0.6 + depth * 0.6},{-depth * 0.6} {w * 0.54 + depth * 0.3},{-depth * 0.3} {w * 0.24 + depth * 0.3},{-depth * 0.3}" fill="#fff" opacity="0.1" />
						<path d="M {w * 0.55} 2 Q {w * (0.55 + (jit(i, 8) - 0.5) * 0.12)} {bh * 0.4} {w * 0.52} {bh - 2}" fill="none" stroke="#fff" stroke-width="0.8" opacity="0.07" />
						<path d="M {w * 0.8} 2 Q {w * 0.73} {bh * 0.5} {w * 0.82} {bh - 2}" fill="none" stroke="#fff" stroke-width="0.7" opacity="0.06" />
						<!-- tape banding: vertical wraps with a glossy centre strip -->
						{#if b.cut > 0.28}
							<rect x={w * 0.3 - bw * 0.022} y="0" width={bw * 0.044} height={bh} fill="url(#bs-tape)" opacity="0.75" />
							<rect x={w * 0.3 - bw * 0.004} y="0" width={bw * 0.008} height={bh} fill="#fff" opacity="0.28" />
							<rect x={w * 0.68 - bw * 0.022} y="0" width={bw * 0.044} height={bh} fill="url(#bs-tape)" opacity="0.75" />
							<rect x={w * 0.68 - bw * 0.004} y="0" width={bw * 0.008} height={bh} fill="#fff" opacity="0.28" />
							<polygon points="{w * 0.3 - bw * 0.022},0 {w * 0.3 + bw * 0.022},0 {w * 0.3 + bw * 0.022 + depth},{-depth} {w * 0.3 - bw * 0.022 + depth},{-depth}" fill="url(#bs-tape)" opacity="0.55" />
						{/if}
						<!-- horizontal tape with gloss line -->
						<rect x="0" y={bh * 0.44} width={w} height={bh * 0.1} fill="url(#bs-tape)" opacity="0.6" />
						<rect x="0" y={bh * 0.475} width={w} height={bh * 0.018} fill="#fff" opacity="0.25" />
						<!-- top edge highlight + bottom AO so the brick has weight -->
						<rect x="1" y="0" width={Math.max(0, w - 2)} height={bh * 0.07} fill="#fff" opacity="0.2" />
						<rect x="0" y={bh * 0.85} width={w} height={bh * 0.15} fill="url(#bs-ao)" opacity="0.5" />
						{#if isCut}
							<!-- cut-face emphasis: amber score edge + crumble at the base -->
							<rect x={w - bw * 0.03} y="0" width={bw * 0.03} height={bh} fill={AMBER} opacity="0.92" />
							<polygon points="{w},0 {w + depth},{-depth} {w + depth},{bh - depth} {w},{bh}" fill="none" stroke={AMBER} stroke-width="1.2" opacity="0.6" />
							{#each Array(5) as _, si (si)}
								<circle cx={w - 2 - jit(si, 9) * 12} cy={bh - 2 - jit(si, 10) * 6} r={0.7 + jit(si, 11)} fill="#efe8da" opacity="0.5" />
							{/each}
						{:else}
							<rect x="0.5" y="0.5" width={Math.max(0, w - 1)} height={bh - 1} fill="none" stroke="#2c2a25" stroke-width="0.8" opacity="0.35" />
						{/if}
					</g>
				{/each}

			{:else if tier === 'pallets'}
				{@const L = palletsLayout}
				{@const pw = L.pw}
				{@const ph = L.ph}
				{#each L.pallets as p (p.col + '-' + p.row)}
					{@const x = L.ox + p.col * (pw + L.gx)}
					{@const y = L.oy + p.row * (ph + L.gy)}
					{@const courses = 4}
					{@const filledCourses = Math.max(1, Math.round(courses * p.fill))}
					{@const courseH = ph / courses}
					{@const wrapTop = ph - filledCourses * courseH}
					<ellipse cx={x + pw / 2} cy={y + ph + 18} rx={pw * 0.62} ry={ph * 0.12} fill="url(#bs-shadow)" />
					<g transform="translate({x},{y})">
						{#each Array(courses) as _, ci (ci)}
							{@const filled = ci >= courses - filledCourses}
							{@const cy = ph - (ci + 1) * courseH}
							{#if filled}
								<rect
									x="0"
									y={cy}
									width={pw}
									height={courseH - 1.5}
									fill={p.fill < 1 ? 'url(#bs-cut-front)' : 'url(#bs-bone-front)'}
									stroke={BONE_DARK}
									stroke-width="0.6"
								/>
								<!-- running-bond seams: alternate courses offset half a brick -->
								{#if ci % 2 === 0}
									<line x1={pw / 3} y1={cy} x2={pw / 3} y2={cy + courseH - 1.5} stroke={BONE_DARK} stroke-width="0.6" opacity="0.55" />
									<line x1={(pw / 3) * 2} y1={cy} x2={(pw / 3) * 2} y2={cy + courseH - 1.5} stroke={BONE_DARK} stroke-width="0.6" opacity="0.55" />
								{:else}
									<line x1={pw / 6} y1={cy} x2={pw / 6} y2={cy + courseH - 1.5} stroke={BONE_DARK} stroke-width="0.6" opacity="0.55" />
									<line x1={pw / 2} y1={cy} x2={pw / 2} y2={cy + courseH - 1.5} stroke={BONE_DARK} stroke-width="0.6" opacity="0.55" />
									<line x1={(pw * 5) / 6} y1={cy} x2={(pw * 5) / 6} y2={cy + courseH - 1.5} stroke={BONE_DARK} stroke-width="0.6" opacity="0.55" />
								{/if}
								<rect x="0" y={cy} width={pw} height={courseH * 0.14} fill="#fff" opacity="0.08" />
							{/if}
						{/each}
						<!-- shrink-wrap: translucent film over the stack + sheen + straps -->
						<rect x={-pw * 0.02} y={wrapTop - 2} width={pw * 1.04} height={filledCourses * courseH + 2} rx="3" fill="url(#bs-plastic)" opacity="0.45" />
						<polygon points="{pw * 0.1},{wrapTop} {pw * 0.3},{wrapTop} {pw * 0.16},{ph} {pw * -0.02},{ph}" fill="url(#bs-sheen-d)" opacity="0.4" />
						<rect x={-pw * 0.02} y={wrapTop - 2} width={pw * 1.04} height={filledCourses * courseH + 2} rx="3" fill="none" stroke="#fff" stroke-width="0.7" opacity="0.12" />
						<rect x={pw * 0.3} y={wrapTop - 4} width={pw * 0.025} height={filledCourses * courseH + 6} fill="#26262b" opacity="0.8" />
						<rect x={pw * 0.66} y={wrapTop - 4} width={pw * 0.025} height={filledCourses * courseH + 6} fill="#26262b" opacity="0.8" />
						<!-- wooden pallet: three slats + bearer blocks -->
						<rect x={-pw * 0.04} y={ph} width={pw * 1.08} height={ph * 0.045} rx="1" fill="url(#bs-wood)" />
						<rect x={-pw * 0.04} y={ph + ph * 0.055} width={pw * 1.08} height={ph * 0.045} rx="1" fill="url(#bs-wood)" opacity="0.92" />
						<rect x={-pw * 0.04} y={ph + ph * 0.11} width={pw * 1.08} height={ph * 0.045} rx="1" fill="url(#bs-wood)" opacity="0.85" />
						<rect x={-pw * 0.04} y={ph + ph * 0.155} width={pw * 0.1} height={ph * 0.09} fill="#3a3128" />
						<rect x={pw / 2 - pw * 0.05} y={ph + ph * 0.155} width={pw * 0.1} height={ph * 0.09} fill="#3a3128" />
						<rect x={pw * 0.94} y={ph + ph * 0.155} width={pw * 0.1} height={ph * 0.09} fill="#3a3128" />
						{#if p.fill < 1}
							<rect x={-pw * 0.02} y={wrapTop - 2} width={pw * 1.04} height="2.5" fill={AMBER} opacity="0.85" />
						{/if}
					</g>
				{/each}

			{:else if tier === 'production'}
				{@const years = production?.years ?? 0}
				<!-- Receding horizon of pallet silhouettes, with the years figure as hero. -->
				{@const silhouettes = 14}
				{#each Array(silhouettes) as _, i (i)}
					{@const sx = 64 + i * 51}
					{@const fade = 0.5 - i * 0.028}
					<g transform="translate({sx}, 372)" opacity={Math.max(0.06, fade)}>
						<rect x="0" y="0" width="40" height="74" rx="2" fill="url(#bs-bone-front)" />
						<rect x="0" y="0" width="40" height="74" fill="none" stroke={BONE_DARK} stroke-width="0.6" />
						<rect x="-3" y="74" width="46" height="7" fill={ZINC_LINE} />
					</g>
				{/each}
				<text x={CX} y="188" text-anchor="middle" class="prod-figure" fill={BONE}>
					{years >= 1 ? years.toFixed(1) : (years * 100).toFixed(0) + '%'}
				</text>
				<text x={CX} y="234" text-anchor="middle" class="prod-sub" fill={AMBER}>
					{years >= 1 ? 'years of global production' : 'of one year of global production'}
				</text>

			{:else}
				<text x={CX} y={VB_H / 2} text-anchor="middle" class="empty-note" fill="#52525b">—</text>
			{/if}

			<!-- Count label (hero precision), upper-left. -->
			{#if countLabel}
				<text x="32" y="48" class="count-label" fill="#d4cdbb">{countLabel}</text>
			{/if}
			<!-- Tier caption (forensic register, lower-left). -->
			{#if tier}
				<text x="32" y={VB_H - 26} class="surface-label" fill="#71717a">{tierLabel}</text>
			{/if}
			<!-- Overflow magnitude label (amber, lower-right) when a tier caps. -->
			{#if overflowLabel}
				<text x={VB_W - 32} y={VB_H - 26} text-anchor="end" class="overflow-label" fill={AMBER}>{overflowLabel}</text>
			{/if}
		</g>
	</svg>
</div>

<style>
	.brick-stack {
		position: relative;
		width: 100%;
		/* Reserve the same vertical footprint as the LiveStage frame so the
		   tab swap causes zero layout shift. */
		height: clamp(340px, 56vh, 520px);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		border-radius: 8px;
		background: #18181b;
	}
	.brick-stack svg {
		display: block;
		width: 100%;
		height: 100%;
	}
	.count-label {
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-size: 22px;
		font-weight: 600;
		letter-spacing: -0.01em;
		font-variant-numeric: tabular-nums;
	}
	.surface-label,
	.overflow-label {
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-size: 14px;
		letter-spacing: 0.04em;
	}
	.prod-figure {
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-size: 96px;
		font-weight: 700;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}
	.prod-sub {
		font-family: 'Inter Tight', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
		font-size: 19px;
		font-weight: 500;
		letter-spacing: 0.01em;
	}
	.empty-note {
		font-size: 48px;
	}
</style>
