/**
 * Game Title in a story: something to play the game against in the site's place. It
 * answers a spin with a round played from the game's real book by Storybook
 * (`roundFromBooks`), so a story shows what a player will see.
 *
 * Author: dwclake
 * Created: 2026-11-18
 */

import type { GameHost } from "@keros3ne/studio-sdk/client";
import { roundFromBooks } from "@keros3ne/studio-sdk/stories";
import type { RoundView } from "./round.ts";

/** The most rounds that are asked for in looking for one that wins. */
const TRIES = 200;

/** A stand-in for the site, for stories. With `winning`, every spin is one that pays. */
export function storyHost(winning = false): GameHost<RoundView, null> {
	let balance = 100_00;

	return {
		init: {
			game: { slug: "game-title", name: "Game Title" },
			balance,
			limits: { minStake: 10, maxStake: 100_00 },
			reducedMotion: false,
			round: null
		},

		async open(bet) {
			for (let tried = 0; tried < TRIES; tried++) {
				const { view } = await roundFromBooks({ slug: "game-title" });
				if (winning && view.payoutBp === 0) continue;

				const payout = Math.floor((bet * view.payoutBp) / 10_000);

				balance += payout - bet;

				return {
					open: false,
					stake: bet,
					baseStake: bet,
					payout,
					view,
					progress: null,
					balance
				};
			}

			throw new Error("No spin in two hundred paid.");
		},

		act: () => Promise.reject(new Error("A spin of Game Title takes no choice.")),
		settled() {},
		announce() {},
		progress: async () => null,
		history: async () => [],
		onBalance() {}
	};
}
