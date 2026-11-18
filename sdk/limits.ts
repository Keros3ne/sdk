/**
 * The limits every studio game is held to, by the site when it plays a round and by
 * the proof check (./proof.ts) when it simulates one.
 */

/** The most actions one round may take. Any game that needs more is broken. */
export const ROUND_MAX_ACTIONS = 200;
/** The largest a round's stored state, or a player's progress, may be, as JSON. */
export const ROUND_MAX_STATE_BYTES = 16_384;

/** Whether a value a game wants stored is small enough to keep. */
export const fitsInStore = (value: unknown): boolean =>
	JSON.stringify(value ?? null).length <= ROUND_MAX_STATE_BYTES;
