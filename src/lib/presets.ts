/**
 * Preset resolver logic.
 *
 * Static presets have a numeric btc field.
 * Dynamic presets have btc: "dynamic" and a dynamicFn string
 * that maps to a resolver function here.
 */

import presetsData from './presets.json';
import type { DayPrices } from './prices.js';

export interface Preset {
	id: string;
	label: string;
	description: string;
	category: 'denomination' | 'absurdity';
	btc: number | 'dynamic';
	dynamicFn?: string;
	date?: string;
	dateRule?: 'freeze' | 'suggest';
	pinned?: boolean;
	factOverride?: string;
}

export const PRESETS: Preset[] = presetsData as Preset[];

/**
 * Resolve a dynamic preset's BTC value.
 */
export function resolveDynamicBtc(
	dynamicFn: string,
	dayPrices: DayPrices | undefined
): number | null {
	if (dynamicFn === 'market_cap') {
		if (!dayPrices?.btc_supply) return null;
		return dayPrices.btc_supply;
	}

	return null;
}

/**
 * Get the effective BTC value for a preset.
 */
export function resolvePresetBtc(
	preset: Preset,
	dayPrices: DayPrices | undefined
): number | null {
	if (typeof preset.btc === 'number') {
		return preset.btc;
	}
	if (preset.dynamicFn) {
		return resolveDynamicBtc(preset.dynamicFn, dayPrices);
	}
	return null;
}

/**
 * Find a preset by id.
 */
export function getPreset(id: string): Preset | undefined {
	return PRESETS.find((p) => p.id === id);
}

/**
 * Get pinned presets (visible in main bar).
 */
export function getPinnedPresets(): Preset[] {
	return PRESETS.filter((p) => p.pinned);
}

/**
 * Get non-pinned presets (for drawer).
 */
export function getDrawerPresets(): Preset[] {
	return PRESETS.filter((p) => !p.pinned);
}
