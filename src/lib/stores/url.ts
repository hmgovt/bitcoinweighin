/**
 * URL ↔ state synchronisation.
 *
 * URL is the source of truth. Svelte stores mirror URL state.
 * Changes update URL via history.replaceState with 100ms debounce.
 */

import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { getEntity } from '../holdings.js';

export type UnitSystem = 'metric' | 'imperial';

// ── Raw stores ──────────────────────────────────────────────────
export const btcAmount = writable<number>(1);
export const selectedDate = writable<string>('');
export const unitSystem = writable<UnitSystem>('imperial');
export const activePreset = writable<string | null>(null);
export const scrollToCommodity = writable<string | null>(null);
/** Pu-238 Geiger crackle opt-in. Default off; persists via ?audio=on. */
export const audioEnabled = writable<boolean>(false);

// ── URL sync ────────────────────────────────────────────────────

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function pushToUrl() {
	if (!browser) return;
	if (debounceTimer) clearTimeout(debounceTimer);
	debounceTimer = setTimeout(() => {
		const params = new URLSearchParams();
		const btc = get(btcAmount);
		if (btc !== 1) params.set('btc', String(btc));

		const date = get(selectedDate);
		if (date) params.set('date', date);

		const unit = get(unitSystem);
		if (unit !== 'imperial') params.set('unit', unit);

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
	unitSystem.subscribe(() => pushToUrl());
	activePreset.subscribe(() => pushToUrl());
	audioEnabled.subscribe(() => pushToUrl());
}

/**
 * Parse URL params and hydrate stores. Call once on page load.
 */
export function hydrateFromUrl(latestDate: string) {
	if (!browser) return;

	const params = new URLSearchParams(window.location.search);

	// Preset slug takes precedence over explicit btc/date params.
	const presetSlug = params.get('preset');
	if (presetSlug) {
		const entity = getEntity(presetSlug);
		if (entity) {
			activePreset.set(presetSlug);
			selectedDate.set(entity.asOf ?? params.get('date') ?? latestDate);
			btcAmount.set(entity.btc);
		} else {
			// Unknown slug — fall back to explicit params.
			selectedDate.set(params.get('date') || latestDate);
		}
	} else {
		selectedDate.set(params.get('date') || latestDate);
	}

	// Explicit btc param only when no preset is active.
	if (!presetSlug && params.has('btc')) {
		const btc = parseFloat(params.get('btc')!);
		if (!isNaN(btc) && btc > 0) {
			btcAmount.set(btc);
		}
	}

	const unit = params.get('unit');
	if (unit === 'metric' || unit === 'imperial') {
		unitSystem.set(unit);
	}

	const commodity = params.get('commodity');
	if (commodity) {
		scrollToCommodity.set(commodity);
	}

	if (params.get('audio') === 'on') {
		audioEnabled.set(true);
	}
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
 * Activate a preset by entity slug. Flips selectedDate to the entity's
 * asOf (so the price calculation matches the dated valuation) and sets
 * btcAmount to the entity's holdings.
 */
export function activatePreset(presetSlug: string) {
	const entity = getEntity(presetSlug);
	if (!entity) return;

	activePreset.set(presetSlug);
	if (entity.asOf) {
		selectedDate.set(entity.asOf);
	}
	btcAmount.set(entity.btc);
}
