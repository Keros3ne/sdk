/**
 * Tossup: a small round game for the SDK's own tests of what plays a round by the site's
 * rules (../stand-in.ts). A coin with a choice of risk, a pick to make before it is tossed,
 * and a meter that counts rounds. Not a game anyone plays, and not a studio's: it has a
 * round, an action, a refusal and progress. Not published: only the SDK's top folder is
 * built.
 *
 * Author: dwclake
 * Created: 2026-11-19
 */
import * as v from "valibot";
import type { StudioGame } from "../maths.ts";

interface State {
	risk: "low" | "high";
	pick: "heads" | "tails" | null;
}

/** What a win pays: 1.94x on an even chance, 3.88x on one in four. */
export const PAYS = { low: 19_400, high: 38_800 } as const;

export const tossup: StudioGame<
	{ risk: "low" | "high" },
	State,
	{ pick: "heads" | "tails" },
	{ risk: string; pick: string | null },
	{ won: boolean },
	{ meter: number },
	{ meter: number }
> = {
	kind: "round",
	slug: "tossup",
	name: "Tossup",
	blurb: "A coin, tossed once.",
	studio: "fixture",
	category: "games",
	rtpBp: 9_700,
	volatility: 0.97,
	params: v.object({ risk: v.picklist(["low", "high"]) }),
	action: v.object({ pick: v.picklist(["heads", "tails"]) }),
	maxMultiplierBp: (params) => PAYS[params.risk],
	progress: {
		initial: () => ({ meter: 0 }),
		advance: (progress) => ({ meter: (progress.meter + 1) % 5 }),
		view: (progress) => ({ meter: progress.meter })
	},
	start: (params) => ({ risk: params.risk, pick: null }),
	act(state, action) {
		if (state.pick) return { problem: "The coin is already tossed." };
		return { state: { ...state, pick: action.pick } };
	},
	outcome(state, rng) {
		if (!state.pick) return null;
		const won = state.risk === "low" ? rng.int(2) === 0 : rng.int(4) === 0;
		return { payoutBp: won ? PAYS[state.risk] : 0, result: { won } };
	},
	view: (state) => ({ risk: state.risk, pick: state.pick })
};
