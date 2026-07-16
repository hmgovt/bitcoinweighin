/**
 * Konami code sequence tracker (delight brief §2.4) — pure, no DOM. Feed it
 * each keydown's `KeyboardEvent.key`; it tracks progress through
 * ↑↑↓↓←→←→BA and reports whether that key matched, extended a partial
 * match, or broke the sequence, without owning any DOM listener itself. The
 * caller (the page's global keydown handler, which already guards focused
 * inputs and modifier chords) decides what a `'matched'` result does.
 */

export const KONAMI_SEQUENCE: readonly string[] = [
	'ArrowUp',
	'ArrowUp',
	'ArrowDown',
	'ArrowDown',
	'ArrowLeft',
	'ArrowRight',
	'ArrowLeft',
	'ArrowRight',
	'b',
	'a',
];

export type KonamiStatus = 'progress' | 'matched' | 'reset';

export interface KonamiTracker {
	/** Feed one `KeyboardEvent.key`. Returns `'matched'` the instant the full
	 *  sequence completes (and rearms for the next attempt), `'progress'`
	 *  when the key extends a valid partial match, and `'reset'` when the
	 *  key breaks the sequence entirely. */
	feed(key: string): KonamiStatus;
	/** Keys matched so far, 0..KONAMI_SEQUENCE.length. */
	readonly progress: number;
	/** Manually rearm to the start of the sequence. */
	reset(): void;
}

/** Letters are compared case-insensitively (`KeyboardEvent.key` reflects
 *  shift state — 'B' vs 'b'); the arrow key names are already exact and
 *  untouched by this. */
function normalise(key: string): string {
	return key.length === 1 ? key.toLowerCase() : key;
}

export function createKonamiTracker(): KonamiTracker {
	let index = 0;
	return {
		feed(key: string): KonamiStatus {
			const norm = normalise(key);
			if (norm === normalise(KONAMI_SEQUENCE[index])) {
				index += 1;
				if (index === KONAMI_SEQUENCE.length) {
					index = 0;
					return 'matched';
				}
				return 'progress';
			}
			// A mismatching key might itself be a valid restart — e.g. the user
			// fumbles mid-sequence but the wrong key happens to be the
			// sequence's own first key, so count it rather than losing the beat.
			index = norm === normalise(KONAMI_SEQUENCE[0]) ? 1 : 0;
			return index === 0 ? 'reset' : 'progress';
		},
		get progress() {
			return index;
		},
		reset(): void {
			index = 0;
		},
	};
}
