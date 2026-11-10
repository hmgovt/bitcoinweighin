/** Colours for the /mining canvases — the same zinc/gold/steel tokens as the page's CSS. */
export const C = {
	ground: '#0e0e10',
	panel: '#16161a',
	panel2: '#1d1d22',
	rule: '#29292f',
	rule2: '#3f3f46',
	ink: '#e7e5e4',
	ink2: '#a1a1aa',
	ink3: '#71717a',
	gold: '#d4a14a',
	goldInk: '#eac37d',
	steel: '#8fb3c8',
} as const;

/** Warm "switching activity" glow, as an rgb triple for rgba(). */
export const WARM = '255,214,164';

export const MONO = '"JetBrains Mono", "SF Mono", ui-monospace, monospace';
export const SANS = '"Inter Tight", -apple-system, system-ui, sans-serif';
export const MF = (px: number, wt = 400): string => `${wt} ${px}px ${MONO}`;
export const SF = (px: number, wt = 400): string => `${wt} ${px}px ${SANS}`;

export const mulberry = (seed: number) => (): number => {
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smooth = (a: number, b: number, x: number): number => {
	const t = clamp01((x - a) / (b - a));
	return t * t * (3 - 2 * t);
};
export const ease = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
