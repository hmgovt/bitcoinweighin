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
	 * TieredPricingTable — three-row table for cocaine: producer,
	 * wholesale, retail-pure-equivalent. The wholesale row is highlighted
	 * as the primary tier (drives the headline BTC equivalence).
	 *
	 * Each row uses the tier's pricePerKg (already the methodology-defined
	 * midpoint) for BTC equivalence; the published range is shown alongside.
	 *
	 * Wired up to the cocaine panel in Stage 5.
	 */

	import { formatBtc } from '$lib/format.js';

	let {
		commodityId,
		currentBtc,
		priceData,
		btcPriceUsd
	}: {
		commodityId: string;
		currentBtc: number;
		priceData: CocainePriceData;
		btcPriceUsd: number;
	} = $props();

	const tierOrder = ['producer', 'wholesale', 'retail'] as const;

	function btcEquivalentKg(pricePerKg: number): number {
		if (pricePerKg <= 0 || btcPriceUsd <= 0 || currentBtc <= 0) return 0;
		return (currentBtc * btcPriceUsd) / pricePerKg;
	}

	function formatRange(range: [number, number]): string {
		return `$${range[0].toLocaleString()}–$${range[1].toLocaleString()}/kg`;
	}

	function formatKg(kg: number): string {
		if (kg <= 0) return '—';
		if (kg < 0.001) return `${(kg * 1000).toFixed(2)} g`;
		if (kg < 1) return `${(kg * 1000).toFixed(0)} g`;
		if (kg < 10) return `${kg.toFixed(2)} kg`;
		if (kg < 1000) return `${kg.toFixed(1)} kg`;
		return `${(kg / 1000).toFixed(1)} tonnes`;
	}

	function tierLabel(tier: 'producer' | 'wholesale' | 'retail'): string {
		return tier.charAt(0).toUpperCase() + tier.slice(1);
	}
</script>

<table class="tiered-pricing" data-commodity-id={commodityId}>
	<thead>
		<tr>
			<th class="col-tier">Tier</th>
			<th class="col-range">Price range</th>
			<th class="col-equiv">{formatBtc(currentBtc)} ≈</th>
		</tr>
	</thead>
	<tbody>
		{#each tierOrder as tier (tier)}
			{@const t = priceData.tiers[tier]}
			{@const isPrimary = tier === priceData.primaryTier}
			<tr class:primary={isPrimary}>
				<td class="col-tier">
					{tierLabel(tier)}
					{#if isPrimary}<span class="primary-marker">primary</span>{/if}
				</td>
				<td class="col-range">{formatRange(t.range)}</td>
				<td class="col-equiv">{formatKg(btcEquivalentKg(t.pricePerKg))}</td>
			</tr>
		{/each}
	</tbody>
</table>

<style>
	.tiered-pricing {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9375rem;
		font-variant-numeric: tabular-nums;
	}
	.tiered-pricing th,
	.tiered-pricing td {
		padding: 0.5rem 0.75rem;
		text-align: left;
		border-bottom: 1px solid var(--color-border, rgba(0, 0, 0, 0.1));
	}
	.tiered-pricing th {
		font-weight: 600;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-secondary, #666);
	}
	.col-equiv {
		text-align: right;
	}
	.primary {
		background: var(--color-bg-secondary, rgba(0, 0, 0, 0.03));
		font-weight: 500;
	}
	.primary-marker {
		margin-left: 0.5rem;
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-secondary, #666);
		font-weight: 400;
	}
</style>
