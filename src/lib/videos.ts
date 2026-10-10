/**
 * The /videos catalogue: every video we publish, newest first. Each plays
 * from YouTube (privacy-enhanced embed, loaded only when someone presses
 * play); the poster is our own thumbnail in static/video/posters/.
 *
 * Add a video here when it goes up on YouTube: its ID is the part after
 * "watch?v=" or "shorts/" in its link.
 */
export interface Video {
	/** URL-safe id, also the page anchor (/videos#oil-short). */
	slug: string;
	/** YouTube video ID. */
	youtubeId: string;
	title: string;
	/** One or two plain sentences: what it shows. */
	description: string;
	/** 'short' is vertical 9:16; 'video' is 16:9. */
	kind: 'short' | 'video';
	/** YYYY-MM-DD, the day it went up. */
	published: string;
	durationS: number;
	/** Poster under /video/posters/, matching the kind's shape. */
	poster: string;
	/** The tab it's about, for the "try it" link. */
	commodity: string;
}

export const VIDEOS: Video[] = [];

/** ISO 8601 duration for structured data, e.g. 47 → "PT47S", 125 → "PT2M5S". */
export function isoDuration(s: number): string {
	const m = Math.floor(s / 60);
	const r = Math.round(s % 60);
	return `PT${m ? `${m}M` : ''}${r || !m ? `${r}S` : ''}`;
}

/** "0:47", "2:05". */
export function clock(s: number): string {
	const r = Math.round(s);
	return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`;
}
