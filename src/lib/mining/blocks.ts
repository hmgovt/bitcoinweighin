import type { HeaderSource } from './sha256.js';
import latest from './blocks-latest.json';

/**
 * The two newest blocks at the last daily update (scripts/fetch-latest-blocks.ts,
 * run by the 02:00 UTC workflow). The /mining page mines the older one's
 * template, replays its real find, then moves on to the newer one — whose
 * previous-block field is the older one's hash.
 *
 * The fetcher verifies every header against its block hash before writing,
 * and the page re-checks each one in the browser before using it.
 */
export const BLOCKS: HeaderSource[] = latest.blocks;
/** When the blocks were fetched (ISO 8601). */
export const BLOCKS_FETCHED_AT: string = latest.fetchedAt;
