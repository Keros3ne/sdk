/**
 * What each of Reel Test's two views is given: the game, and what its stage tells the
 * page as it loads.
 *
 * Author: dwclake
 * Created: 2026-11-19
 */
import type { ReelTest } from "./game.svelte.ts";

export interface ViewProps extends Record<string, unknown> {
	game: ReelTest;
	/** Follows the stage as it loads: a loading screen's `track`. */
	track?: <Work>(work: Promise<Work>) => Promise<Work>;
	/** Called once the stage is ready to be played on. */
	onready?: () => void;
}
