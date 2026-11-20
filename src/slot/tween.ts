/**
 * Moving something over time, on the stage's ticker: what the shared slot pieces animate
 * with. A tween that is given no time is done at once, which is how a game played with
 * reduced motion, or at its quickest, skips the moving.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import type { Ticker } from "pixi.js";

/** Starts fast and settles: for things that fall or spin to a stop. */
export const easeOut = (share: number): number => 1 - (1 - share) ** 3;

/** The same pace throughout. */
export const steady = (share: number): number => share;

export interface TweenOptions {
	/** How long it takes, in milliseconds. Nothing, and it is done at once. */
	duration: number;
	/** How long to wait before it starts. */
	delay?: number;
	ease?: (share: number) => number;
}

/** Tweens under way that can be cut short together: a piece's, when the piece goes. */
export interface Tweens {
	run(options: TweenOptions, step: (share: number) => void): Promise<void>;
	/** Finishes every tween at once, each at its end. */
	finish(): void;
}

/**
 * Tweens on a ticker. `step` is called with how far along the tween is, from 0 to 1, eased,
 * every frame and once at the end; the promise settles when it has ended.
 */
export function createTweens(ticker: Ticker): Tweens {
	const finishers = new Set<() => void>();

	return {
		run({ duration, delay = 0, ease = easeOut }, step) {
			if (duration <= 0 && delay <= 0) {
				step(1);

				return Promise.resolve();
			}

			return new Promise<void>((done) => {
				let elapsed = -delay;

				/** Ends the tween where it would have ended. */
				const finish = () => {
					ticker.remove(advance);
					finishers.delete(finish);
					step(1);
					done();
				};

				/** One frame on. */
				function advance() {
					elapsed += ticker.deltaMS;
					if (elapsed < 0) return;

					if (elapsed >= duration) finish();
					else step(ease(elapsed / duration));
				}

				finishers.add(finish);
				ticker.add(advance);
			});
		},

		finish() {
			for (const finish of [...finishers]) finish();
		}
	};
}
