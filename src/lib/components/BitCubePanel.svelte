<script lang="ts">
	const BTC_HARD_CAP = 21_000_000;
	const S = 100;   // outer cube half-width in SVG user units
	const CX = 110;  // SVG centre x
	const CY = 8;    // outer cube top-vertex y

	let {
		btcAmount,
		circulatingSupply,
	}: { btcAmount: number; circulatingSupply: number } = $props();

	const sCirc = $derived(S * Math.cbrt(Math.min(circulatingSupply, BTC_HARD_CAP) / BTC_HARD_CAP));

	const S_MIN = 6; // minimum inner-cube edge in SVG units (visibility clamp)
	const sRaw  = $derived(S * Math.cbrt(Math.min(btcAmount, BTC_HARD_CAP) / BTC_HARD_CAP));
	const sInner = $derived(Math.max(S_MIN, sRaw));
	const isClamped = $derived(sRaw < S_MIN);

	// Each inner cube shares the same 3D centre as the outer; offset its
	// top-vertex so that cy_inner + sInner = CY + S (the shared screen centre).
	const cyCirc  = $derived(CY + (S - sCirc));
	const cyInner = $derived(CY + (S - sInner));

	// Returns the SVG polygon `points` string for one face of an isometric cube.
	// (cx, cy) = screen position of the cube's "top" vertex (highest point of shape).
	// s = edge length in SVG user units.
	function poly(cx: number, cy: number, s: number, face: 'top' | 'right' | 'left'): string {
		const h = s * 0.5;         // sin(30°) component
		const s2 = s * 2;
		const sh = s * 1.5;
		if (face === 'top')   return `${cx},${cy} ${cx + s},${cy + h} ${cx},${cy + s} ${cx - s},${cy + h}`;
		if (face === 'right') return `${cx + s},${cy + h} ${cx},${cy + s} ${cx},${cy + s2} ${cx + s},${cy + sh}`;
		/* left */              return `${cx - s},${cy + h} ${cx},${cy + s} ${cx},${cy + s2} ${cx - s},${cy + sh}`;
	}

	const pctCap  = $derived((btcAmount / BTC_HARD_CAP) * 100);
	const pctCirc = $derived((btcAmount / circulatingSupply) * 100);
	const circMinedPct = $derived((circulatingSupply / BTC_HARD_CAP) * 100);
	const unmined = $derived(BTC_HARD_CAP - circulatingSupply);
	const edgePct = $derived(sRaw / S * 100);

	function fmtPct(p: number): string {
		if (p >= 100) return '100%';
		if (p >= 1) return p.toFixed(4) + '%';
		// Show enough decimal places to reveal the first 3 significant figures.
		const mag = Math.floor(Math.log10(Math.max(p, 1e-16)));
		const decimals = Math.min(-mag + 2, 14);
		return p.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '') + '%';
	}

	function fmtBtc(n: number): string {
		if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
		if (n >= 1_000)     return Math.round(n).toLocaleString('en-US');
		if (n >= 1)         return n.toFixed(4).replace(/\.?0+$/, '');
		return n.toFixed(8).replace(/0+$/, '');
	}
</script>

<section class="bcp" aria-label="Bitcoin supply cube">

	<div class="bcp-header">
		<h2 class="bcp-title">Your Share of the Supply</h2>
		<p class="bcp-subtitle">
			Three nested cubes — proportional by volume: the 21M hard cap, the coins already mined,
			and your amount.{isClamped ? ' Inner cube boosted for visibility.' : ''}
		</p>
	</div>

	<div class="bcp-layout">

		<!-- Isometric cube visualisation -->
		<div class="bcp-viz">
			<svg viewBox="0 0 220 220" class="bcp-svg" aria-hidden="true">
				<defs>
					<filter id="bcp-glow" x="-150%" y="-150%" width="400%" height="400%">
						<feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur"/>
						<feMerge>
							<feMergeNode in="blur"/>
							<feMergeNode in="SourceGraphic"/>
						</feMerge>
					</filter>
				</defs>

				<!-- Circulating supply cube (amber, semi-transparent) -->
				<polygon points={poly(CX, cyCirc, sCirc, 'left')}  class="circ-left"  />
				<polygon points={poly(CX, cyCirc, sCirc, 'right')} class="circ-right" />
				<polygon points={poly(CX, cyCirc, sCirc, 'top')}   class="circ-top"   />

				<!-- Slider amount cube (bright amber), optionally glowing when clamped -->
				<g filter={isClamped ? 'url(#bcp-glow)' : undefined}>
					<polygon points={poly(CX, cyInner, sInner, 'left')}  class="inner-left"  />
					<polygon points={poly(CX, cyInner, sInner, 'right')} class="inner-right" />
					<polygon points={poly(CX, cyInner, sInner, 'top')}   class="inner-top"   />
				</g>

				<!-- 21M hard-cap wireframe (drawn last so it sits on top) -->
				<polygon points={poly(CX, CY, S, 'left')}  class="outer-wire" />
				<polygon points={poly(CX, CY, S, 'right')} class="outer-wire" />
				<polygon points={poly(CX, CY, S, 'top')}   class="outer-wire" />
			</svg>
		</div>

		<!-- Stats -->
		<div class="bcp-stats">

			<div class="legend-row">
				<span class="dot dot--outer" aria-hidden="true"></span>
				<div>
					<div class="stat-label">21M hard cap</div>
					<div class="stat-value">21,000,000 BTC</div>
					<div class="stat-sub">The maximum that can ever exist</div>
				</div>
			</div>

			<div class="legend-row">
				<span class="dot dot--circ" aria-hidden="true"></span>
				<div>
					<div class="stat-label">Circulating supply</div>
					<div class="stat-value">{fmtBtc(circulatingSupply)} BTC</div>
					<div class="stat-sub">
						{circMinedPct.toFixed(2)}% mined · {fmtBtc(unmined)} BTC unmined
					</div>
				</div>
			</div>

			<div class="stat-divider"></div>

			<div class="legend-row">
				<span class="dot dot--inner" aria-hidden="true"></span>
				<div>
					<div class="stat-label">Your amount</div>
					<div class="stat-value stat-value--amber">{fmtBtc(btcAmount)} BTC</div>
				</div>
			</div>

			<div class="fraction-block">
				<div class="fraction-row">
					<span class="fraction-label">of hard cap</span>
					<span class="fraction-value">{fmtPct(pctCap)}</span>
				</div>
				<div class="fraction-row">
					<span class="fraction-label">of circulating</span>
					<span class="fraction-value">{fmtPct(pctCirc)}</span>
				</div>
				{#if isClamped}
					<div class="fraction-row fraction-row--dim">
						<span class="fraction-label">edge vs outer cube</span>
						<span class="fraction-value">{edgePct.toFixed(4)}%</span>
					</div>
				{/if}
			</div>

		</div>
	</div>

</section>

<style>
	.bcp {
		background: #09090b;
		border-radius: 12px;
		padding: 28px 24px;
		margin-bottom: 48px;
	}

	.bcp-header {
		margin-bottom: 24px;
	}
	.bcp-title {
		font-family: 'Inter Tight', 'Inter', sans-serif;
		font-size: 22px;
		font-weight: 600;
		color: #f4f4f5;
		margin: 0 0 6px 0;
		letter-spacing: -0.02em;
	}
	.bcp-subtitle {
		font-size: 14px;
		color: #71717a;
		margin: 0;
		line-height: 1.5;
		max-width: 540px;
	}

	.bcp-layout {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}
	@media (min-width: 540px) {
		.bcp-layout {
			flex-direction: row;
			align-items: flex-start;
			gap: 32px;
		}
		.bcp-viz {
			flex: 0 0 220px;
		}
		.bcp-stats {
			flex: 1 1 0;
			min-width: 0;
		}
	}

	.bcp-svg {
		width: 100%;
		max-width: 220px;
		display: block;
	}

	/* ── SVG face colours ─────────────────────────── */

	/* Outer wireframe — 21M hard cap (dashed zinc) */
	.outer-wire {
		fill: none;
		stroke: #52525b;
		stroke-width: 1.5;
		stroke-dasharray: 7 4;
	}

	/* Circulating supply — amber, semi-transparent, 3-face lighting */
	.circ-top   { fill: rgba(180,  83,  9, 0.32); stroke: rgba(217, 119,  6, 0.55); stroke-width: 0.8; }
	.circ-right { fill: rgba(146,  64, 14, 0.25); stroke: rgba(180,  83,  9, 0.45); stroke-width: 0.8; }
	.circ-left  { fill: rgba(120,  53, 15, 0.20); stroke: rgba(146,  64, 14, 0.38); stroke-width: 0.8; }

	/* Slider amount — bright amber, opaque */
	.inner-top   { fill: #fbbf24; stroke: #f59e0b; stroke-width: 0.8; }
	.inner-right { fill: #d97706; stroke: #b45309; stroke-width: 0.8; }
	.inner-left  { fill: #b45309; stroke: #92400e; stroke-width: 0.8; }

	/* ── Legend dots ──────────────────────────────── */
	.legend-row {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		margin-bottom: 14px;
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 2px;
		flex-shrink: 0;
		margin-top: 3px;
	}
	.dot--outer {
		background: transparent;
		border: 1.5px dashed #52525b;
	}
	.dot--circ {
		background: rgba(180, 83, 9, 0.65);
		border: 1px solid rgba(217, 119, 6, 0.7);
	}
	.dot--inner {
		background: #fbbf24;
		border: 1px solid #d97706;
	}

	/* ── Stat typography ──────────────────────────── */
	.stat-label {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #52525b;
		margin-bottom: 3px;
	}
	.stat-value {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-variant-numeric: tabular-nums;
		font-size: 16px;
		font-weight: 600;
		color: #f5f0e6;
		line-height: 1.2;
	}
	.stat-value--amber {
		font-size: 22px;
		color: #fbbf24;
	}
	.stat-sub {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 11px;
		color: #52525b;
		margin-top: 2px;
	}
	.stat-divider {
		height: 1px;
		background: #27272a;
		margin: 12px 0 14px;
	}

	/* ── Fraction readout ─────────────────────────── */
	.fraction-block {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 10px;
	}
	.fraction-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
	}
	.fraction-row--dim .fraction-label,
	.fraction-row--dim .fraction-value {
		color: #3f3f46;
	}
	.fraction-label {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 11px;
		color: #52525b;
	}
	.fraction-value {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-variant-numeric: tabular-nums;
		font-size: 14px;
		font-weight: 600;
		color: #a1a1aa;
	}
</style>
