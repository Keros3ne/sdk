/**
 * Whether a bar's full layout fits with play in its dead centre. A bar's two sides share
 * what room play leaves, and play is in the middle only while neither side needs more than
 * its half: a long balance, or a game not wide enough, pushes it over. A bar asks here, and
 * where it is cramped lays itself out with less (the bet as one button, amounts without
 * their unit), which is how the SDK's own bar keeps play centred at any width.
 *
 *     const fit = createBarFit();
 *
 *     <div class="side" {@attach fit.watch}>...</div>
 *     {#if fit.cramped}<BarBetButton />{:else}<BarBet />{/if}
 *
 * Author: dwclake
 * Created: 2026-11-19
 */

/** A bar's fit: whether it is cramped, and what watches it. */
export interface BarFit {
	/** The full layout does not fit with play in the middle: lay out with less. */
	readonly cramped: boolean;
	/** An attachment for something inside the bar's part: the part and its play button are measured. */
	watch(inside: HTMLElement): () => void;
	/** Forgets what was measured, where what is in the bar has changed much (a balance far longer or shorter). */
	again(): void;
}

/** Watches whether a bar's full layout keeps play in its middle. */
export function createBarFit(): BarFit {
	let cramped = $state(false);
	// How wide the bar had to be for the full layout, as far as was measured when it did not fit.
	let needs = 0;
	let measure: (() => void) | undefined;

	return {
		get cramped() {
			return cramped;
		},
		watch(inside) {
			const bar = inside.closest<HTMLElement>(".sdk-bar-part");
			if (!bar) return () => {};

			measure = () => {
				const play = bar.querySelector<HTMLElement>(".sdk-bar-play");
				const box = bar.getBoundingClientRect();
				if (!play || !box.width) return;

				if (cramped) {
					// Back to the full layout once there is the room it was short of.
					if (box.width >= needs) cramped = false;

					return;
				}

				const at = play.getBoundingClientRect();
				const off = Math.abs(at.left + at.width / 2 - (box.left + box.width / 2));
				if (off > 0.5) {
					// Each side is short by as much as play is off: twice that, and a little to spare.
					needs = box.width + off * 2 + 16;
					cramped = true;
				}
			};

			const watcher = new ResizeObserver(() => measure?.());
			watcher.observe(bar);
			watcher.observe(inside);

			return () => {
				watcher.disconnect();
				measure = undefined;
			};
		},
		again() {
			cramped = false;
			needs = 0;
			requestAnimationFrame(() => measure?.());
		}
	};
}
