<script lang="ts">
	/**
	 * £1 coin reference — rendered at actual physical size (23.43 mm)
	 * using CSS mm units. Suppressed when the active stage has
	 * suppressCoinRef: true (dust stage bakes the coin into its sprite).
	 */

	let {
		suppressed = false,
	}: {
		suppressed?: boolean;
	} = $props();
</script>

{#if !suppressed}
	<div class="coin-ref">
		<div class="coin-disc">
			<span class="coin-label">£1</span>
		</div>
		<div class="coin-badge">actual size</div>
	</div>
{/if}

<style>
	.coin-ref {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		flex-shrink: 0;
	}

	.coin-disc {
		width: 23.43mm;
		height: 23.43mm;
		border-radius: 50%;
		border: 1.5px solid #a3a3a3;
		background: linear-gradient(135deg, #d4d4d8, #a1a1aa);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.coin-label {
		font-size: 8px;
		font-weight: 600;
		color: #52525b;
	}

	.coin-badge {
		font-size: 8px;
		color: #71717a;
		letter-spacing: 0.03em;
	}
</style>
