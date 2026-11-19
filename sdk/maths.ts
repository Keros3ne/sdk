/**
 * The round game: a game played over zero or more actions after it opens, as the site's
 * bet pipeline plays one. The site's own round games (mines, blackjack) are written
 * against it, and a studio's game, which is played from books, is presented as one
 * (./book-game.ts), so that one pipeline plays them all.
 *
 * A round game is pure: no clock, no network, no randomness of its own. Every random
 * choice comes from the `Rng` it is handed, which the site builds from the player's
 * seeds, so a bet settled on the server can be checked again in the player's browser.
 */
import type * as v from "valibot";
import type { GameGuide } from "./guide.ts";
import type { Rng } from "./rng.ts";
import type { Shape } from "./shapes.ts";

export type { Rng };

/**
 * State a game keeps for a player between bets: a meter that fills, things
 * collected. Only studio games use it.
 *
 * It is kept separately for each stake size. Otherwise a player could fill a
 * meter at the smallest stake and collect what it unlocks at the largest.
 */
export interface GameProgress<
	Progress = unknown,
	Result = unknown,
	ProgressView = unknown
> {
	/** What a player starts with. */
	initial(): Progress;
	/** The progress after a round that ended with `result`. Called once, when it settles. */
	advance(progress: Progress, result: Result): Progress;
	/** What the player may see of it. */
	view(progress: Progress): ProgressView;
}

/**
 * A game played over zero or more actions after it opens. The stake is taken when
 * the round opens and the bet stays open until the game says it is over.
 *
 * Nothing hidden is ever stored. Every call is handed a fresh RNG stream for the
 * bet's seeds and nonce, and the game re-derives what is hidden (where the
 * crates are, what the free spins hold) by drawing from it in the same order each time. `State` therefore
 * holds only what the player has done, and is safe to keep and to verify.
 */
export interface RoundGame<
	Params = unknown,
	State = unknown,
	Action = unknown,
	View = unknown,
	Result = unknown
> {
	kind: "round";
	slug: string;
	name: string;
	/** One line for the game's card. */
	blurb: string;
	/** The id of the studio that made it, as the site's credits list it. */
	studio?: string;
	/** Which section of the site it lives in. Its page is `/{category}/{slug}`. */
	category: "slots" | "games";
	/** Its rules, and its paytable if it has one (./guide.ts). The site fills this in. */
	guide?: GameGuide;
	/** The shapes it has a view for (./shapes.ts). Left out, wide only. */
	shapes?: readonly Shape[];
	/** The long-run return to player, in basis points. */
	rtpBp: number;
	/**
	 * How much results swing: the standard deviation of a round's result, in opening
	 * stakes, counting everything staked and paid in it, under the way of playing the
	 * game declares its return for. A bought bonus is not rated: the figure is for
	 * ordinary play.
	 */
	volatility: number;
	/** The same for one way of opening a round, in a game where that changes it. */
	volatilityOf?(params: Params): number;
	/** The smallest opening stake in cents, if higher than the site's. */
	minStake?: number;
	/** The largest opening stake in cents, if lower than the site's. */
	maxStake?: number;
	params: v.GenericSchema<unknown, Params>;
	action: v.GenericSchema<unknown, Action>;
	/**
	 * What a round opened this way costs, as a multiple of the bet in basis points:
	 * 30,000 for a spin at three bets, 1,000,000 for a bonus bought at a hundred. Left out,
	 * one bet. The site charges the bet times this, and pays on the bet: what a round
	 * pays (`payoutBp`, `maxMultiplierBp`) is a multiple of the bet, never of what it cost,
	 * so a game never divides its wins by its costs. From one bet to `MAX_COST_BP`, and the
	 * bet times it must come to whole cents, or the bet is refused.
	 */
	costBp?(params: Params): number;
	/** The most a round can pay, as a multiplier of the bet. */
	maxMultiplierBp(params: Params): number;
	/**
	 * Set by a game that keeps state between bets. `start` is then handed the
	 * player's progress at this stake, and must copy what the round depends on into
	 * `State`: that is what lets the bet be verified later from `State` alone.
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	progress?: GameProgress<any, Result, any>;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	start(params: Params, rng: Rng, progress?: any): State;
	/**
	 * Applies an action. `extraStakes` is how many more bets the action costs (1 for a
	 * double or a split). A refused action changes nothing.
	 */
	act(
		state: State,
		action: Action,
		rng: Rng
	): { state: State; extraStakes?: number } | { problem: string };
	/** `null` while the round is still being played. `payoutBp` is of the bet. */
	outcome(state: State, rng: Rng): { payoutBp: number; result: Result } | null;
	/** What the player may see right now. Must not reveal anything still hidden. */
	view(state: State, rng: Rng): View;
}

/** One hundred percent, in basis points. A multiplier of 2x is 20,000. */
export const BP = 10_000;

/**
 * A game as the site lists one: a round game, with the studio that made it and what its
 * books come to. A studio does not write one of these: a studio's game is played from
 * books (./book.ts), and this is how its books are presented to whatever plays a round by
 * the site's rules (./book-game.ts).
 */
export interface StudioGame<
	Params,
	State,
	Action,
	View,
	Result,
	Progress = never,
	ProgressView = never
> extends RoundGame<Params, State, Action, View, Result> {
	/** The studio's id, as listed in the site's credits. */
	studio: string;
	/** The return to player, in basis points. Rewards are worked out from it. */
	rtpBp: number;
	/**
	 * How much results swing: the standard deviation of a round's result, in bets, on
	 * the ordinary way to open a round. A bought bonus is not rated. Players are shown
	 * a word for it (low, medium, high).
	 */
	volatility: number;
	progress?: GameProgress<Progress, Result, ProgressView>;
}
