/**
 * Unit-system store (imperial / metric). Drives the click-to-swap
 * affordance on every commodity's mass and secondary-metrics line.
 *
 * Global so the cube panels (gold/silver/Pu-238) and the still panel
 * (cocaine) all flip together — one click anywhere swaps every readout
 * on the page.
 *
 * Persists to localStorage under `bw:system`. Defaults to 'imperial'.
 */

import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type UnitSystem = 'imperial' | 'metric';

const STORAGE_KEY = 'bw:system';

function readInitial(): UnitSystem {
	if (!browser) return 'imperial';
	try {
		const v = window.localStorage.getItem(STORAGE_KEY);
		if (v === 'metric' || v === 'imperial') return v;
	} catch {
		// Private-mode Safari throws on getItem; fall through to default.
	}
	return 'imperial';
}

export const system = writable<UnitSystem>(readInitial());

if (browser) {
	system.subscribe((v) => {
		try {
			window.localStorage.setItem(STORAGE_KEY, v);
		} catch {
			// localStorage may be unavailable; ignore.
		}
	});
}

export function toggleSystem() {
	system.update((s) => (s === 'imperial' ? 'metric' : 'imperial'));
}
