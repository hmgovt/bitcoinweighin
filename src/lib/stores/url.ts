/**
 * URL ↔ state synchronisation.
 *
 * URL is the source of truth. Svelte stores mirror URL state.
 * Changes update URL via history.replaceState with 100ms debounce.
 */

import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { getEntity } from '../holdings.js';

// ── Raw stores ──────────────────────────────────────────────────
export const btcAmount = writable<number>(1);
export const selectedDate = writable<string>('');
export const activePreset = writable<string | null>(null);
export const scrollToCommodity = writable<string | null>(null);
/** Pu-238 Geiger crackle opt-in. Default off; persists via ?audio=on. */
export const audioEnabled = writable<boolean>(false);

// Most recent date present in the price dataset. hydrateFromUrl sets
// this; activatePreset reads it to clamp entity asOf values that run
// ahead of the dataset (e.g. holdings figures dated today, before
// today's closing price has been published).
let datasetLatestDate = '';

// ── URL sync ────────────────────────────────────────────────────

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// Stays false until hydrateFromUrl has read the incoming params. Without
// this guard, the store subscriptions below fire at module load with
// default values (btc=1, date='') and a debounced pushToUrl can rewrite
// the URL to bare '/' before hydration reads it — wiping deep-link params
// whenever the archive fetch (which gates hydration) takes >debounce ms.
let hydrated = false;

function pushToUrl() {
	if (!browser || !hydrated) return;
	if (debounceTimer) clearTimeout(debounceTimer);
	debounceTimer = setTimeout(() => {
		const params = new URLSearchParams();
		const btc = get(btcAmount);
		if (btc !== 1) params.set('btc', String(btc));

		const date = get(selectedDate);
		if (date) params.set('date', date);

		const preset = get(activePreset);
		if (preset) params.set('preset', preset);

		const commodity = get(scrollToCommodity);
		if (commodity) params.set('commodity', commodity);

		const audio = get(audioEnabled);
		if (audio) params.set('audio', 'on');

		const qs = params.toString();
		const url = qs ? `?${qs}` : window.location.pathname;
		history.replaceState(null, '', url);
	}, 100);
}

// Subscribe each store to push URL updates
if (browser) {
	btcAmount.subscribe(() => pushToUrl());
	selectedDate.subscribe(() => pushToUrl());
	activePreset.subscribe(() => pushToUrl());
	audioEnabled.subscribe(() => pushToUrl());
}

/**
 * Parse URL params and hydrate stores. Call once on page load.
 */
export function hydrateFromUrl(latestDate: string) {
	if (!browser) return;

	datasetLatestDate = latestDate;

	const params = new URLSearchParams(window.location.search);

	// Dates from URL params or entity asOf are clamped to latestDate —
	// the dataset uses previous day's close, so "today" never has data.
	const urlDate = params.get('date');
	const clamp = (d: string | null | undefined) =>
		d && d > latestDate ? latestDate : d;

	// Preset slug takes precedence over explicit btc/date params.
	const presetSlug = params.get('preset');
	if (presetSlug) {
		const entity = getEntity(presetSlug);
		if (entity) {
			activePreset.set(presetSlug);
			selectedDate.set(clamp(urlDate) || latestDate); // value at latest/shared date, not asOf — see activatePreset
			btcAmount.set(entity.btc);
		} else {
			// Unknown slug — fall back to explicit params.
			selectedDate.set(clamp(urlDate) || latestDate);
		}
	} else {
		selectedDate.set(clamp(urlDate) || latestDate);
	}

	// Explicit btc param only when no preset is active.
	if (!presetSlug && params.has('btc')) {
		const btc = parseFloat(params.get('btc')!);
		if (!isNaN(btc) && btc > 0) {
			btcAmount.set(btc);
		}
	}

	// ?unit=metric (legacy): silently ignored. The toggle was removed
	// in May 2026; readouts now ship both units side-by-side.

	const commodity = params.get('commodity');
	if (commodity) {
		scrollToCommodity.set(commodity);
	}

	if (params.get('audio') === 'on') {
		audioEnabled.set(true);
	}

	// Open the gate only after params are read, then emit the canonical URL
	// once. Store writes above happened while hydrated=false, so none of them
	// raced a premature write.
	hydrated = true;
	pushToUrl();
}

/**
 * Set BTC amount from slider (clears active preset).
 */
export function setBtcFromSlider(value: number) {
	activePreset.set(null);
	btcAmount.set(value);
}

/**
 * Set date from date picker (clears active preset).
 */
export function setDateFromPicker(date: string) {
	activePreset.set(null);
	selectedDate.set(date);
}

/**
 * Activate a preset by entity slug. Sets btcAmount to the entity's holdings
 * and values it at the LATEST available price so every preset is compared
 * like-for-like.
 *
 * The entity's `asOf` is reported-holdings provenance (surfaced on the pill
 * as "845,256 BTC · June 2026"), NOT a valuation date. Pinning each preset to
 * its own asOf priced two stacks on two different days, so a bigger BTC pile
 * could read as "less" of a commodity purely because BTC moved between the
 * dates — e.g. Strategy (845k @ 9 Jun, BTC $63.3k) showing under BlackRock
 * (811k @ 22 May, BTC $75.8k). Valuing both at latest restores honest ordering.
 */
export function activatePreset(presetSlug: string) {
	const entity = getEntity(presetSlug);
	if (!entity) return;

	activePreset.set(presetSlug);
	if (datasetLatestDate) {
		selectedDate.set(datasetLatestDate);
	}
	btcAmount.set(entity.btc);
}
