<!-- src/lib/components/OilReadout.svelte -->
<script lang="ts">
	/**
	 * OilReadout — the Oil tab's readout, under OilStage: the volume, its
	 * weight, which rung of the ladder it fills (tank, drums, supertanker,
	 * oil field), and how long the whole world takes to burn that much.
	 * Maths in $lib/oil.ts.
	 */
	import {
		FUELS,
		LITRES_PER_BARREL,
		PRUDHOE_L,
		VLCC_L,
		formatBarrels,
		formatSpan,
		formatVolume,
		oilScene,
		tankWords,
		worldSeconds,
		type Fuel,
	} from '$lib/oil.js';
	import { formatMass, formatNum } from '$lib/format.js';
	import { system, toggleSystem } from '$lib/stores/system.js';

	let {
		litres = 0,
		fuel = 'crude',
		price = null,
		accent = '#3fb6a8',
	}: {
		litres?: number;
		fuel?: Fuel;
		/** The day's quoted price, in the fuel's own unit (USD per barrel or per US gallon). */
		price?: number | null;
		accent?: string;
	} = $props();

	const spec = $derived(FUELS[fuel]);
	const barrels = $derived(litres / LITRES_PER_BARREL);
	const grams = $derived(litres * spec.densityKgPerL * 1000);
	const s = $derived(oilScene(litres));

	// Weight: the site's usual ladder, then millions/billions of tonnes (or short tons).
	const weight = $derived.by(() => {
		const t = $system === 'imperial' ? grams / 907184.74 : grams / 1e6;
		const unit = $system === 'imperial' ? 'tons' : 'tonnes';
		if (t >= 1e9) return `${(t / 1e9).toFixed(2)} billion ${unit}`;
		if (t >= 1e6) return `${(t / 1e6).toFixed(2)} million ${unit}`;
		return formatMass(grams, $system);
	});
	const of = $derived(
		fuel === 'crude'
			? `${formatBarrels(barrels)} of Brent crude · ${weight}`
			: `of US ${fuel} at the pump · ${weight}`
	);

	function pct(f: number): string {
		const p = f * 100;
		if (p >= 10) return `${Math.round(p)}%`;
		if (p >= 1) return `${p.toFixed(1)}%`;
		return `${p.toPrecision(2)}%`;
	}

	const rung = $derived.by(() => {
		if (!(litres > 0)) return '';
		switch (s.kind) {
			case 'tank':
				return s.exact <= 1
					? `${tankWords(s.exact).replace(/^./, (c) => c.toUpperCase())} in a mid-size car.`
					: `${formatNum(s.exact)} tankfuls for a mid-size car (55 L).`;
			case 'drums':
				return `${formatNum(s.exact)} 55-gallon drums.`;
			case 'tanker':
				return s.exact < 1
					? `${pct(s.exact)} of a supertanker’s cargo (a VLCC carries 2 million barrels).`
					: `Enough to fill ${formatNum(s.exact)} supertankers (2 million barrels each).`;
			case 'field': {
				const f = litres / PRUDHOE_L;
				return f >= 1
					? f >= 1.05
						? `All 13.2 billion barrels Prudhoe Bay has ever produced, ${formatNum(f)} times over.`
						: `All 13.2 billion barrels Prudhoe Bay has ever produced, with ${formatBarrels((litres - PRUDHOE_L) / LITRES_PER_BARREL)} to spare.`
					: `${pct(f)} of everything Prudhoe Bay, North America’s largest oil field, has produced — or ${formatNum(litres / VLCC_L)} supertankers.`;
			}
		}
	});

	const world = $derived(litres > 0 ? `The world gets through that much oil in ${formatSpan(worldSeconds(litres))}.` : '');

	const priceLine = $derived.by(() => {
		if (!(price && price > 0)) return 'No price for this fuel on this date.';
		if (fuel === 'crude')
			return `Brent crude at $${price.toFixed(2)} a barrel — a wholesale spot price, before refining, freight and tax. A barrel is 42 US gallons (159 L); the drums drawn are the 55-gallon kind.`;
		return `US ${fuel} at $${price.toFixed(2)} a gallon — the EIA’s weekly average pump price, taxes included.`;
	});

	function onSwap(e: Event) {
		e.preventDefault();
		toggleSystem();
	}
	function onSwapKey(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggleSystem();
		}
	}
</script>

<div class="oil-readout" style:--accent={accent}>
	<div class="eyebrow">You could buy</div>

	{#if litres > 0}
		<div class="oil-vol" role="button" tabindex="0" title="Click to switch units" onclick={onSwap} onkeydown={onSwapKey}>
			{formatVolume(litres, $system)}
		</div>
		<div class="oil-of">{of}</div>
		<div class="oil-rung">{rung}</div>
		<div class="oil-world">{world}</div>
	{:else}
		<div class="oil-vol oil-empty">—</div>
	{/if}

	<div class="oil-note">{priceLine}</div>

	<div class="oil-rule" aria-hidden="true"></div>

	<p class="sources-footer">
		{spec.source} · VLCC: EIA · Prudhoe Bay: BP Prudhoe Bay Royalty Trust (2024) · world use: IEA ·
		<a href="/methodology#oil" class="link">methodology</a>
	</p>
</div>

<style>
	.oil-readout {
		display: flex;
		flex-direction: column;
		width: 100%;
		font-family: 'Inter Tight', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
		color: #e4e4e7;
	}
	.eyebrow {
		font-size: 10.5px;
		font-weight: 500;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: #52525b;
		margin-bottom: 14px;
	}
	.oil-vol {
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-size: 40px;
		font-weight: 600;
		color: #fafafa;
		line-height: 1.1;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
		cursor: pointer;
		align-self: flex-start;
	}
	.oil-empty {
		color: #52525b;
		cursor: default;
	}
	.oil-of {
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-size: 14px;
		color: #a1a1aa;
		margin-top: 6px;
	}
	.oil-rung {
		font-size: 15px;
		font-weight: 600;
		color: var(--accent);
		margin-top: 10px;
	}
	.oil-world {
		font-size: 13px;
		color: #a1a1aa;
		margin-top: 4px;
	}
	.oil-note {
		font-size: 12px;
		color: #71717a;
		margin: 16px 0 0;
		line-height: 1.5;
		max-width: 60ch;
	}
	.oil-rule {
		height: 1px;
		background: #27272a;
		margin: 14px 0;
	}
	.sources-footer {
		margin: 0;
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-size: 10.5px;
		color: #52525b;
		letter-spacing: 0.04em;
		line-height: 1.6;
	}
	.link {
		color: #71717a;
		text-decoration: underline;
	}
	.link:hover {
		color: #a1a1aa;
	}
</style>
