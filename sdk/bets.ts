/**
 * The rules every bet on the site is held to, whatever the game: the smallest and largest
 * stake, what a way of playing may cost, and how a payout is settled to whole cents. There
 * is no limit on what a bet pays, beyond the most each game says a round can. The site's bet
 * pipeline uses these, and so does the stand-in for the site that `keros3ne-studio dev`
 * plays a game against, so that a game behaves there as it will on the site.
 */

/** One cent. A game that needs more says so (`minStake`): a slot whose wins are small shares of the bet, say. */
export const MIN_STAKE = 1;
export const MAX_STAKE = 100_00;
/**
 * The smallest and largest bet a game takes. A game may ask for a higher
 * minimum or a lower maximum than the site's, never the other way round.
 */
export function stakeLimits(game: { minStake?: number; maxStake?: number }): {
	minStake: number;
	maxStake: number;
} {
	return {
		minStake: Math.max(MIN_STAKE, game.minStake ?? 0),
		maxStake: Math.min(MAX_STAKE, game.maxStake ?? MAX_STAKE)
	};
}
export const BP = 10_000;

/** The most a round may cost, as a multiple of the bet in basis points: a thousand bets. */
export const MAX_COST_BP = 1_000 * BP;

/**
 * What a round costs at a bet, in cents: the bet times the way it is played (`costBp` on the
 * game, one bet if it has none). `null` where the cost is not one the site takes (under one
 * bet, over `MAX_COST_BP`, not a whole number of basis points) or does not come to whole
 * cents at this bet. Wins are paid on the bet, not on this.
 */
export function chargeFor(bet: number, costBp: number): number | null {
	if (!Number.isSafeInteger(costBp) || costBp < BP || costBp > MAX_COST_BP) return null;
	const total = bet * costBp;
	return Number.isSafeInteger(total) && total % BP === 0 ? total / BP : null;
}

/**
 * What a bet pays at a multiplier, to the cent below: for showing what a bet would pay,
 * and for limits. A settled bet's payout is `settlePayout`, which may be a cent more.
 */
export function payoutFor(stake: number, multiplierBp: number): number {
	return Math.floor((stake * multiplierBp) / BP);
}

/**
 * A settled bet's payout in whole cents: stake times multiplier, its fraction of a cent
 * rounded up or down by chance, in proportion to it. `roll` is the bet's own draw from 0
 * to BP - 1 (`payoutRoll` in ./rng.ts): the payout is a cent more when the roll is
 * below what is over the whole cents. Over every roll that comes to exactly
 * `stake * multiplierBp / BP`, so a game returns what it states at any bet. Rounding
 * always down took up to 7% of a game's return at a 0.10 bet.
 */
export function settlePayout(stake: number, multiplierBp: number, roll: number): number {
	const total = stake * multiplierBp;
	return Math.floor(total / BP) + (roll < total % BP ? 1 : 0);
}
