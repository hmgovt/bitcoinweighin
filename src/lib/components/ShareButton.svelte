<script lang="ts">
	import { onMount } from 'svelte';
	import { btcAmount, selectedDate } from '$lib/stores/url.js';
	import type { Commodity } from '$lib/commodities.js';
	import {
		computeCommodityAmount,
		type DayPrices,
		type PriceData,
	} from '$lib/prices.js';
	import { formatBtc, formatMass, formatMassConsumer } from '$lib/format.js';

	interface Props {
		/** Loaded price dataset; used to compute the readout for the share text. */
		prices: PriceData | null;
		/**
		 * The commodity this button shares. When set, the shared URL carries
		 * ?commodity={id} and the readout/copy quote that commodity. When
		 * omitted, the share is page-level and quotes gold by default.
		 */
		commodity?: Commodity;
		/** Optional inline style overrides (e.g. to absolute-position in a panel). */
		style?: string;
	}

	let { prices, commodity, style }: Props = $props();

	let popoverOpen = $state(false);
	let copyConfirmed = $state(false);
	/**
	 * `true` only on touch-first devices (phones, tablets). Desktop —
	 * including macOS Safari, which technically supports navigator.share
	 * but routes to a thin macOS share sheet (Notes/Reminders/Messages
	 * only) — falls back to the platform popover. Coarse pointer is the
	 * correct signal here, not feature-detection of navigator.share.
	 */
	let useNativeShare = $state(false);
	let buttonEl: HTMLButtonElement | undefined = $state();
	let popoverEl: HTMLDivElement | undefined = $state();

	onMount(() => {
		const coarsePointer =
			typeof window !== 'undefined' &&
			typeof window.matchMedia === 'function' &&
			window.matchMedia('(pointer: coarse)').matches;
		const hasShare = typeof navigator !== 'undefined' && 'share' in navigator;
		useNativeShare = coarsePointer && hasShare;
	});

	// ── Share text composition ─────────────────────────────────

	const dayPrices = $derived<DayPrices | undefined>(
		prices && $selectedDate ? prices[$selectedDate] : undefined,
	);

	const readout = $derived.by(() => {
		const c = commodity;
		if (!c || !dayPrices) return null;
		const amt = computeCommodityAmount($btcAmount, c, dayPrices);
		if (amt === null || !isFinite(amt) || amt <= 0) return null;
		// Pick the right unit vocabulary per commodity. Metals stay in
		// troy oz (the bullion unit); grams-unit commodities switch to
		// kg/tonnes at scale via the consumer ladder.
		if (c.unit === 'troy_oz') {
			const formatted =
				amt >= 1000 ? Math.round(amt).toLocaleString('en-US')
					: amt >= 1 ? amt.toFixed(2)
						: amt.toPrecision(3);
			return `${formatted} troy oz`;
		}
		if (c.unit === 'gram' && c.unitMassGrams) {
			return formatMassConsumer(amt * c.unitMassGrams, 'metric');
		}
		const formatted =
			amt >= 1000 ? Math.round(amt).toLocaleString('en-US')
				: amt >= 1 ? amt.toFixed(2)
					: amt.toPrecision(3);
		return `${formatted} ${c.unit.replace('_', ' ')}`;
	});

	const commodityName = $derived(commodity?.displayName.toLowerCase() ?? 'gold');

	function buildShareText(): string {
		const btc = formatBtc($btcAmount);
		if (!readout) {
			return `What does ${btc} weigh? Find out at Bitcoin Weigh-In.`;
		}
		const templates = [
			`${btc} buys ${readout} of ${commodityName}. What does yours buy?`,
			`${readout} of ${commodityName} — that's what ${btc} gets you today.`,
			`Ever wondered what ${btc} weighs in ${commodityName}? ${readout}.`,
		];
		return templates[Math.floor(Math.random() * templates.length)];
	}

	function getShareUrl(): string {
		// Build a canonical, commodity-aware URL on the current origin so
		// the share lands on the same view the user is looking at.
		if (typeof window === 'undefined') return 'https://bitcoinweighin.com/';
		const params = new URLSearchParams();
		params.set('btc', String($btcAmount));
		if ($selectedDate) params.set('date', $selectedDate);
		if (commodity?.id) params.set('commodity', commodity.id);
		return `${window.location.origin}/?${params.toString()}`;
	}

	function getOgImageUrl(): string {
		const params = new URLSearchParams();
		params.set('btc', String($btcAmount));
		if ($selectedDate) params.set('date', $selectedDate);
		if (commodity?.id) params.set('commodity', commodity.id);
		const origin =
			typeof window !== 'undefined'
				? window.location.origin
				: 'https://bitcoinweighin.com';
		return `${origin}/og-image?${params.toString()}`;
	}

	// ── Action handlers ────────────────────────────────────────
	async function handlePrimaryShare() {
		const url = getShareUrl();
		const text = buildShareText();

		if (useNativeShare) {
			try {
				await navigator.share({ title: 'Bitcoin Weigh-In', text, url });
				return;
			} catch (e: unknown) {
				if (e instanceof Error && e.name === 'AbortError') return;
				// Other failures: fall through to popover.
			}
		}
		popoverOpen = !popoverOpen;
	}

	function openTarget(href: string) {
		window.open(href, '_blank', 'noopener,noreferrer,width=600,height=520');
		popoverOpen = false;
	}

	async function copyLink() {
		const url = getShareUrl();
		try {
			await navigator.clipboard.writeText(url);
			copyConfirmed = true;
			setTimeout(() => {
				copyConfirmed = false;
			}, 1500);
		} catch {
			window.prompt('Copy this URL:', url);
		}
	}

	function shareX() {
		openTarget(
			`https://x.com/intent/tweet?text=${encodeURIComponent(buildShareText())}&url=${encodeURIComponent(getShareUrl())}`,
		);
	}
	function shareFacebook() {
		openTarget(
			`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareUrl())}`,
		);
	}
	function shareReddit() {
		openTarget(
			`https://reddit.com/submit?url=${encodeURIComponent(getShareUrl())}&title=${encodeURIComponent(buildShareText())}`,
		);
	}
	function shareLinkedIn() {
		openTarget(
			`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(getShareUrl())}`,
		);
	}
	function sharePinterest() {
		openTarget(
			`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(getShareUrl())}&media=${encodeURIComponent(getOgImageUrl())}&description=${encodeURIComponent(buildShareText())}`,
		);
	}
	function shareWhatsApp() {
		openTarget(
			`https://wa.me/?text=${encodeURIComponent(buildShareText() + ' ' + getShareUrl())}`,
		);
	}
	function shareEmail() {
		const subject = commodity
			? `Bitcoin Weigh-In — ${formatBtc($btcAmount)} in ${commodityName}`
			: 'Bitcoin Weigh-In';
		const body = `${buildShareText()}\n\n${getShareUrl()}`;
		// mailto: opens the default mail client without a popup.
		window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
		popoverOpen = false;
	}

	// ── Dismiss handlers ───────────────────────────────────────
	function handleDocumentClick(e: MouseEvent) {
		if (!popoverOpen) return;
		const target = e.target as Node;
		if (popoverEl?.contains(target) || buttonEl?.contains(target)) return;
		popoverOpen = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && popoverOpen) {
			popoverOpen = false;
			buttonEl?.focus();
		}
	}

	$effect(() => {
		if (typeof document === 'undefined') return;
		if (popoverOpen) {
			document.addEventListener('click', handleDocumentClick);
			document.addEventListener('keydown', handleKeydown);
			return () => {
				document.removeEventListener('click', handleDocumentClick);
				document.removeEventListener('keydown', handleKeydown);
			};
		}
	});
</script>

<div class="share-wrap" {style}>
	<button
		bind:this={buttonEl}
		type="button"
		class="share-button"
		aria-label={commodity
			? `Share this ${commodity.displayName} view`
			: 'Share this page'}
		aria-haspopup={useNativeShare ? undefined : 'dialog'}
		aria-expanded={popoverOpen}
		onclick={handlePrimaryShare}
	>
		<svg
			class="icon"
			viewBox="0 0 24 24"
			width="16"
			height="16"
			fill="none"
			stroke="currentColor"
			stroke-width="1.8"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
			<polyline points="16 6 12 2 8 6" />
			<line x1="12" y1="2" x2="12" y2="15" />
		</svg>
		<span class="label">Share</span>
	</button>

	{#if popoverOpen}
		<div
			bind:this={popoverEl}
			class="popover"
			role="dialog"
			aria-label="Share options"
		>
			<button type="button" class="opt" onclick={shareX} aria-label="Share on X">
				<svg class="opt-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
					<path d="M18.244 2H21l-6.51 7.434L22 22h-6.766l-5.27-6.892L3.9 22H1.145l6.96-7.952L1 2h6.91l4.77 6.295L18.244 2zm-2.366 18.408h1.84L7.282 3.493H5.31l10.568 16.915z"/>
				</svg>
				<span>X</span>
			</button>
			<button type="button" class="opt" onclick={shareReddit} aria-label="Share on Reddit">
				<svg class="opt-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
					<path d="M22 12.07c0-1.32-1.07-2.39-2.39-2.39-.65 0-1.24.26-1.67.68-1.65-1.18-3.92-1.95-6.43-2.04l1.1-5.16 3.59.76c.04.92.8 1.66 1.73 1.66.96 0 1.74-.78 1.74-1.74S18.89 2.1 17.93 2.1c-.68 0-1.27.39-1.55.97l-3.99-.85c-.12-.03-.24 0-.34.07-.1.06-.17.16-.2.28L10.6 8.31c-2.55.07-4.85.84-6.51 2.04-.43-.43-1.02-.69-1.68-.69C1.07 9.66 0 10.73 0 12.05c0 .94.55 1.76 1.36 2.15-.04.21-.06.43-.06.65 0 3.32 3.87 6.02 8.64 6.02s8.64-2.7 8.64-6.02c0-.22-.02-.43-.06-.64.82-.39 1.38-1.22 1.38-2.17zm-15.05 1.74c0-.96.78-1.74 1.74-1.74s1.74.78 1.74 1.74-.78 1.74-1.74 1.74-1.74-.78-1.74-1.74zm10.34 4.6c-1.26 1.26-3.65 1.36-4.35 1.36s-3.1-.1-4.35-1.36c-.19-.19-.19-.5 0-.69.19-.19.5-.19.69 0 .8.8 2.5 1.07 3.66 1.07s2.87-.27 3.66-1.07c.19-.19.5-.19.69 0 .19.2.19.5 0 .69zm-.2-2.86c-.96 0-1.74-.78-1.74-1.74s.78-1.74 1.74-1.74 1.74.78 1.74 1.74-.78 1.74-1.74 1.74z"/>
				</svg>
				<span>Reddit</span>
			</button>
			<button type="button" class="opt" onclick={shareLinkedIn} aria-label="Share on LinkedIn">
				<svg class="opt-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
					<path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zm1.78 13.02H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.46C23.21 24 24 23.23 24 22.28V1.72C24 .77 23.21 0 22.23 0z"/>
				</svg>
				<span>LinkedIn</span>
			</button>
			<button type="button" class="opt" onclick={shareFacebook} aria-label="Share on Facebook">
				<svg class="opt-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
					<path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.017 1.792-4.683 4.533-4.683 1.312 0 2.686.235 2.686.235v2.965h-1.514c-1.491 0-1.956.93-1.956 1.886v2.265h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
				</svg>
				<span>Facebook</span>
			</button>
			<button type="button" class="opt" onclick={shareWhatsApp} aria-label="Share on WhatsApp">
				<svg class="opt-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
					<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.296-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
				</svg>
				<span>WhatsApp</span>
			</button>
			<button type="button" class="opt" onclick={sharePinterest} aria-label="Share on Pinterest">
				<svg class="opt-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
					<path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.346-.09.375-.293 1.199-.334 1.366-.052.216-.173.262-.4.158-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
				</svg>
				<span>Pinterest</span>
			</button>
			<button type="button" class="opt" onclick={shareEmail} aria-label="Share via email">
				<svg class="opt-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<rect x="2" y="4" width="20" height="16" rx="2"/>
					<path d="M22 7 12 13 2 7"/>
				</svg>
				<span>Email</span>
			</button>
			<button
				type="button"
				class="opt copy"
				onclick={copyLink}
				aria-label="Copy link"
				aria-live="polite"
			>
				{#if copyConfirmed}
					<svg class="opt-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<polyline points="20 6 9 17 4 12"/>
					</svg>
					<span>Copied</span>
				{:else}
					<svg class="opt-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
						<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
					</svg>
					<span>Copy link</span>
				{/if}
			</button>
		</div>
	{/if}
</div>

<style>
	.share-wrap {
		position: relative;
		display: inline-flex;
	}
	.share-button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: transparent;
		border: 1px solid #3f3f46; /* zinc-700 */
		color: #d4d4d8; /* zinc-300 */
		border-radius: 6px;
		padding: 6px 12px;
		font-size: 13px;
		font-family: inherit;
		cursor: pointer;
		transition: color 120ms, border-color 120ms, background 120ms;
	}
	.share-button:hover,
	.share-button:focus-visible {
		color: #fafafa;
		border-color: #71717a;
		background: rgba(255, 255, 255, 0.03);
		outline: none;
	}
	.icon {
		display: block;
	}
	.label {
		line-height: 1;
	}

	.popover {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		min-width: 180px;
		background: #18181b; /* zinc-900 */
		border: 1px solid #27272a; /* zinc-800 */
		border-radius: 8px;
		padding: 4px;
		display: flex;
		flex-direction: column;
		gap: 1px;
		z-index: 50;
		box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.6);
		animation: fade-in 150ms ease-out;
	}
	@keyframes fade-in {
		from { opacity: 0; transform: translateY(-2px); }
		to { opacity: 1; transform: translateY(0); }
	}
	.opt {
		display: flex;
		align-items: center;
		gap: 10px;
		background: transparent;
		border: 0;
		color: #d4d4d8;
		padding: 8px 10px;
		border-radius: 5px;
		font-size: 13px;
		font-family: inherit;
		text-align: left;
		cursor: pointer;
		transition: background 100ms, color 100ms;
	}
	.opt:hover,
	.opt:focus-visible {
		background: #27272a;
		color: #fafafa;
		outline: none;
	}
	.opt-icon {
		flex-shrink: 0;
		color: #a1a1aa;
	}
	.opt:hover .opt-icon,
	.opt:focus-visible .opt-icon {
		color: #fafafa;
	}
	.opt.copy {
		margin-top: 2px;
		border-top: 1px solid #27272a;
		border-radius: 0 0 5px 5px;
	}
</style>
