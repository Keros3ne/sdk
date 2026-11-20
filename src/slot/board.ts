/**
 * What a board of reels (./Board.svelte) is told beyond a grid: how to pace what moves,
 * and which wins to light.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import type { Cell } from "../slots.ts";

/**
 * How a spin or a fall is paced. With `instant`, nothing moves: it is simply so. The
 * times, in milliseconds, are the board's own unless given here: for a spin played fast.
 */
export interface Pace {
	instant?: boolean;
	spinTime?: number;
	reelDelay?: number;
	fallTime?: number;
	/**
	 * How much longer each reel of a spin takes than it otherwise would, in milliseconds,
	 * by reel: a reel held back comes down slowly, for the suspense of what it may bring.
	 */
	holds?: readonly number[];
}

/** A win to light: its cells, and what to write on one of them. */
export interface LitWin {
	cells: readonly Cell[];
	text?: string;
}
