/**
 * How a bet goes up and down by its buttons: by a small amount while it is
 * small, and by more as it grows, so that a few presses cover the whole range.
 * Pure, and shared: the site's own games use `SITE_STEPS`, and a studio game
 * can hand the SDK's control bar steps of its own (./bar.ts).
 *
 * Amounts are in cents. A band says: while the bet is under `under`, a press
 * moves it by `by`. The last band has no `under` and covers everything above.
 */
export interface StakeBand {
	/** The band covers bets below this many cents. Left out on the last band. */
	under?: number;
	/** What one press moves the bet by, in cents. */
	by: number;
}
export type StakeSteps = readonly StakeBand[];

/**
 * The site's own games, which take a bet from one cent: by 0.01 to 0.10, by 0.05 to 0.30,
 * by 0.10 to 2.00, by 0.25 to 5.00, by 0.50 to 10.00, by 2.50 to 25.00, by 5.00 to 50.00,
 * and by 10.00 from there. From 0.40 no press moves the bet by more than a quarter of it,
 * so the buttons move it smoothly at any size a player is likely to bet.
 */
export const SITE_STEPS: StakeSteps = [
	{ under: 10, by: 1 },
	{ under: 30, by: 5 },
	{ under: 2_00, by: 10 },
	{ under: 5_00, by: 25 },
	{ under: 10_00, by: 50 },
	{ under: 25_00, by: 2_50 },
	{ under: 50_00, by: 5_00 },
	{ by: 10_00 }
];

const bandFor = (steps: StakeSteps, cents: number) =>
	steps.find((band) => band.under === undefined || cents < band.under) ?? steps.at(-1)!;

/**
 * The bet one press up or down from `cents`, kept between `min` and `max`. A
 * bet that is not on a step, because it was typed or halved, goes to the next
 * step in that direction and not a whole step past it: from 0.25, up is 0.30
 * and down is 0.20. Going down from the foot of a band uses the band below, so
 * 1.00 goes down to 0.90, not to 0.00.
 */
export function stepStake(
	cents: number,
	direction: 1 | -1,
	limits: { min: number; max: number },
	steps: StakeSteps = SITE_STEPS
): number {
	let next: number;
	if (direction === 1) {
		const { by } = bandFor(steps, cents);
		next = (Math.floor(cents / by) + 1) * by;
	} else {
		const { by } = bandFor(steps, cents - 1);
		next = (Math.ceil(cents / by) - 1) * by;
	}
	return Math.min(limits.max, Math.max(limits.min, next));
}

/** Every bet the steps reach from `min` to `max`, smallest first: the list a row of bet buttons moves through. */
export function stakeLadder(
	limits: { min: number; max: number },
	steps: StakeSteps = SITE_STEPS
): number[] {
	const ladder = [limits.min];
	for (;;) {
		const next = stepStake(ladder.at(-1)!, 1, limits, steps);
		if (next <= ladder.at(-1)!) return ladder;
		ladder.push(next);
	}
}
