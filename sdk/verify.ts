/**
 * Checking a round bet from its seeds: that the hidden things its round was played against
 * really came from the seeds committed to before it, and so paid what it did. The player's
 * actions were their own; what is checked is everything the game drew.
 *
 * The site checks its own round games' bets with this in the player's page, and a studio's in
 * a sandboxed frame (./verifier.ts), so the check is the same either way.
 */
import { settlePayout } from "./bets.ts";
import type { Rng } from "./rng.ts";
import { createRng, payoutRoll } from "./rng.ts";

/** What a settled round bet needs to be checked, its server seed revealed. */
export interface RoundToVerify {
	/** The player's actions, as stored when the round ended. */
	state: unknown;
	result: unknown;
	baseStake: number;
	payout: number;
	nonce: number;
	clientSeed: string;
	serverSeed: string;
}

/** Whether replaying the round from its seeds gives the result and payout recorded. */
export function verifyRound(
	game: {
		outcome(state: unknown, rng: Rng): { payoutBp: number; result: unknown } | null;
	},
	bet: RoundToVerify
): boolean {
	const outcome = game.outcome(
		bet.state,
		createRng(bet.serverSeed, bet.clientSeed, bet.nonce)
	);
	if (outcome === null || JSON.stringify(outcome.result) !== JSON.stringify(bet.result))
		return false;
	const paid = settlePayout(
		bet.baseStake,
		outcome.payoutBp,
		payoutRoll(bet.serverSeed, bet.clientSeed, bet.nonce)
	);
	return paid === bet.payout;
}
