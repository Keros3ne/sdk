/**
 * For a studio's stories: rounds from the game's real books, asked of the SDK's Storybook
 * while it runs (`keros3ne-studio stories`). A story plays what comes back through the
 * game's own handlers, so a piece is seen doing what it will do on the site.
 *
 *   const { view } = await roundFromBooks({ slug: "stormglass" });
 *   await playSteps(view.steps, handlers);
 *
 * Pure: it runs in the story's page.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import type { BookView } from "./book-game.ts";

/** A story's own types, handed on, so that a studio's stories need nothing but the SDK. */
export type { Meta, StoryObj } from "@storybook/svelte-vite";
import type { Counters } from "./book-round.ts";

/** Where stories ask, on Storybook's own server: `/round` for a round, `/games` for the games. */
export const STORY_BOOKS = "/__keros3ne/books";

/** What a story asks for: a game, a way of opening a round, and what to pick in it. */
export interface StoryRoundRequest {
	slug: string;
	/** The mode's id. The game's ordinary one, left out. */
	mode?: string;
	/** The options to pick, in order, wherever the round stops at a choice. */
	choices?: string[];
	/** Which round: the same seed gives the same round. A different one each time, left out. */
	seed?: string;
	/** What the player holds going in, for a game with counters. */
	held?: Counters;
}

/** A round as a story is handed it: what the client is shown, and the seed that gives it again. */
export interface StoryRound {
	view: BookView;
	seed: string;
}

/** A studio's games that are played from books, each with its modes. */
export interface StoryGames {
	games: { slug: string; name: string; modes: { id: string; name: string }[] }[];
}

/** Asks Storybook's server, and hands back its answer or throws what it said was wrong. */
async function ask<Answer>(path: string): Promise<Answer> {
	const response = await fetch(`${STORY_BOOKS}${path}`);
	const answer = (await response.json()) as Answer & { problem?: string };

	if (!response.ok)
		throw new Error(answer.problem ?? "Storybook could not read the game's books.");

	return answer;
}

/**
 * A round played from a game's books, as the site would play it. Where the round stops at
 * a choice, `view.options` says what may be picked: ask again with the same `seed` and
 * the choice added to `choices`, and the round goes on from there.
 */
export const roundFromBooks = (request: StoryRoundRequest): Promise<StoryRound> =>
	ask(`/round?request=${encodeURIComponent(JSON.stringify(request))}`);

/** The studio's games that are played from books. */
export const gamesWithBooks = (): Promise<StoryGames> => ask("/games");
