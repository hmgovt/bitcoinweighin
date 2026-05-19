<script lang="ts">
	/**
	 * QuantityAnchorCard — structured callout under the readout for
	 * gold/silver cube panels. Renders an eyebrow ("FOR SCALE"), the
	 * anchor's displayName (with the leading "≈" stripped — it was
	 * decorative; the card structure is now load-bearing), and the
	 * anchor's description as a blurb. No italic.
	 *
	 * When `selectAnchor()` returns null (no anchor within ±10 % of
	 * `currentMassKg`), the component renders nothing and the surrounding
	 * layout contracts naturally.
	 */

	import anchorsData from '$lib/quantity-anchors.json';
	import { selectAnchor, type QuantityAnchor } from './QuantityAnchorCard.helpers.js';

	let {
		commodityId,
		currentMassKg,
		accent = '#d4a14a',
		eyebrow = 'For scale',
	}: {
		commodityId: string;
		currentMassKg: number;
		/** Commodity accent colour — gold `#d4a14a`, silver `#c5cdd6`. */
		accent?: string;
		/** Eyebrow copy. "For scale" for objects; "For context" for Pu-238. */
		eyebrow?: string;
	} = $props();

	const ANCHORS = anchorsData as Record<string, QuantityAnchor[]>;

	const list = $derived(ANCHORS[commodityId] ?? []);
	const selected = $derived(selectAnchor(list, currentMassKg));

	const headline = $derived(
		selected ? selected.displayName.replace(/^≈\s*/, '') : ''
	);

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

{#if selected}
	<div class="anchor-card" style={accentBgStyle + accentRuleStyle}>
		<div class="anchor-eyebrow" style={accentEyebrowStyle}>{eyebrow}</div>
		<div class="anchor-headline">{headline}</div>
		{#if selected.description}
			<p class="anchor-blurb">{selected.description}</p>
		{/if}
	</div>
{/if}

<style>
	.anchor-card {
		border-left: 2px solid currentColor;
		border-radius: 0 6px 6px 0;
		padding: 14px 18px;
	}

	.anchor-eyebrow {
		font-family: 'Inter Tight', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
		font-weight: 500;
		font-size: 10px;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		opacity: 0.85;
		margin-bottom: 6px;
	}

	.anchor-headline {
		font-family: 'Inter Tight', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
		font-weight: 600;
		font-size: 22px;
		color: #fafafa; /* zinc-50 */
		line-height: 1.2;
		letter-spacing: -0.015em;
	}

	.anchor-blurb {
		font-family: 'Inter Tight', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
		font-weight: 400;
		font-size: 13px;
		color: #71717a; /* zinc-500 */
		margin: 5px 0 0;
		line-height: 1.5;
		letter-spacing: 0.005em;
		max-width: 580px;
	}
</style>
