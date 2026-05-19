<script lang="ts" module>
	export type CocaineTier = {
		pricePerKg: number;
		range: [number, number];
		purityAssumption: string;
		asOfDate: string;
		source: string;
	};

	export type CocainePriceData = {
		tiers: Record<'producer' | 'wholesale' | 'retail', CocaineTier>;
		primaryTier: 'producer' | 'wholesale' | 'retail';
		sources: string[];
		methodology: string;
		notes: string;
	};
</script>

<script lang="ts">
	/**
	 * TieredPricingTable — three-column grid: Wholesale (primary) ·
	 * Retail (street-purity) · Retail · pure-equivalent. Each column
	 * shows the USD value of the current BTC at that market tier.
	 *
	 * Wholesale anchors the headline equivalence and is rendered larger.
	 * Retail-street-purity is derived from the pure-adjusted retail tier
	 * by undoing the ~40 % purity assumption (UNODC / DEA standard).
	 */

	let {
		commodityId,
		currentBtc,
		priceData,
		btcPriceUsd,
		accent = '#e8e0d2',
	}: {
		commodityId: string;
		currentBtc: number;
		priceData: CocainePriceData;
		btcPriceUsd: number;
		accent?: string;
	} = $props();

	// Implied street purity for the retail tier — UNODC / EMCDDA 2024
	// document a 30-50 % range; midpoint 0.40 used to derive the
	// "street-purity" column from the pure-adjusted retail price.
	const STREET_PURITY = 0.4;

	const wholesalePerKg = $derived(priceData.tiers.wholesale.pricePerKg);
	const retailPurePerKg = $derived(priceData.tiers.retail.pricePerKg);
	const retailStreetPerKg = $derived(retailPurePerKg * STREET_PURITY);

	// Mass of cocaine the BTC buys at the canonical (wholesale) tier.
	const usdValue = $derived(currentBtc * btcPriceUsd);
	const massKg = $derived(wholesalePerKg > 0 ? usdValue / wholesalePerKg : 0);

	const wholesaleUsd = $derived(massKg * wholesalePerKg);
	const retailStreetUsd = $derived(massKg * retailStreetPerKg);
	const retailPureUsd = $derived(massKg * retailPurePerKg);

	function formatUsd(v: number): string {
		if (v <= 0) return '$0';
		if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
		if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
		if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
		if (v >= 1000) return `$${Math.round(v / 1000).toLocaleString('en-US')}K`;
		if (v >= 1) return `$${Math.round(v).toLocaleString('en-US')}`;
		return `$${v.toFixed(2)}`;
	}
</script>

<div class="tiered-pricing" data-commodity-id={commodityId}>
	<div class="col col-primary">
		<div class="label" style="color: {accent};">Wholesale</div>
		<div class="value value-primary">{formatUsd(wholesaleUsd)}</div>
		<div class="sub">UNODC midpoint · ≥80% pure</div>
	</div>
	<div class="col">
		<div class="label">Retail</div>
		<div class="value">{formatUsd(retailStreetUsd)}</div>
		<div class="sub">DEA · street-purity</div>
	</div>
	<div class="col">
		<div class="label">Retail · pure-equivalent</div>
		<div class="value">{formatUsd(retailPureUsd)}</div>
		<div class="sub">Adjusted to 100%</div>
	</div>
</div>

<style>
	.tiered-pricing {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 0;
		font-family: 'Inter Tight', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
		font-variant-numeric: tabular-nums;
	}
	.col {
		padding: 0 18px;
		border-left: 1px solid #27272a; /* zinc-800 */
		min-width: 0;
	}
	.col:first-child {
		padding-left: 0;
		border-left: none;
	}
	.col:last-child {
		padding-right: 0;
	}
	.label {
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: #52525b; /* zinc-600 */
		margin-bottom: 6px;
	}
	.value {
		font-weight: 600;
		font-size: 22px;
		color: #a1a1aa; /* zinc-400 */
		line-height: 1;
		letter-spacing: -0.012em;
	}
	.value-primary {
		font-size: 28px;
		color: #fafafa; /* zinc-50 */
	}
	.sub {
		font-size: 11px;
		font-weight: 400;
		color: #52525b; /* zinc-600 */
		margin-top: 5px;
		line-height: 1.4;
	}

	@media (max-width: 540px) {
		.tiered-pricing {
			grid-template-columns: 1fr;
		}
		.col {
			padding: 0;
			border-left: none;
			border-top: 1px solid #27272a;
			padding-top: 14px;
			margin-top: 14px;
		}
		.col:first-child {
			border-top: none;
			padding-top: 0;
			margin-top: 0;
		}
	}
</style>
