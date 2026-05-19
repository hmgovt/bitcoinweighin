<script lang="ts">
	/**
	 * Pu238FactCard — slider-position-dependent contextual fact card.
	 * Uses the same eyebrow / headline / blurb structure as
	 * QuantityAnchorCard, but with the Cherenkov-blue accent and a
	 * "FOR CONTEXT" eyebrow (the card describes a class of fact rather
	 * than a comparable object).
	 */

	import { pu238Fact, pu238Blurb } from './Pu238FactCard.helpers.js';

	let {
		currentMassGrams,
		accent = '#7ed4ff',
	}: {
		currentMassGrams: number;
		/** Cherenkov-blue accent — same colour as activity-Ci and melt warning. */
		accent?: string;
	} = $props();

	const headline = $derived(currentMassGrams > 0 ? pu238Fact(currentMassGrams) : null);
	const blurb = $derived(currentMassGrams > 0 ? pu238Blurb(currentMassGrams) : null);

	const accentBgStyle = $derived(`background: ${hexToRgba(accent, 0.07)};`);
	const accentRuleStyle = $derived(`border-left-color: ${accent};`);
	const accentEyebrowStyle = $derived(`color: ${accent};`);

	function hexToRgba(hex: string, alpha: number): string {
		const h = hex.replace('#', '');
		const r = parseInt(h.slice(0, 2), 16);
		const g = parseInt(h.slice(2, 4), 16);
		const b = parseInt(h.slice(4, 6), 16);
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}
</script>

{#if headline}
	<div class="pu238-fact-card" style={accentBgStyle + accentRuleStyle}>
		<div class="pu238-fact-eyebrow" style={accentEyebrowStyle}>For context</div>
		<div class="pu238-fact-headline">{headline}</div>
		{#if blurb}
			<p class="pu238-fact-blurb">{blurb}</p>
		{/if}
	</div>
{/if}

<style>
	.pu238-fact-card {
		border-left: 2px solid currentColor;
		border-radius: 0 6px 6px 0;
		padding: 14px 18px;
	}

	.pu238-fact-eyebrow {
		font-family: 'Inter Tight', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
		font-weight: 500;
		font-size: 10px;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		opacity: 0.85;
		margin-bottom: 6px;
	}

	.pu238-fact-headline {
		font-family: 'Inter Tight', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
		font-weight: 600;
		font-size: 22px;
		color: #fafafa;
		line-height: 1.2;
		letter-spacing: -0.015em;
	}

	.pu238-fact-blurb {
		font-family: 'Inter Tight', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
		font-weight: 400;
		font-size: 13px;
		color: #71717a;
		margin: 5px 0 0;
		line-height: 1.5;
		letter-spacing: 0.005em;
		max-width: 580px;
	}
</style>
