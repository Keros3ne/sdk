/**
 * Whether a bar's full layout fits with play in its dead centre. A bar's two sides share
 * what room play leaves, and play is in the middle only while neither side needs more than
 * its half: a long balance, or a game not wide enough, pushes it over. A bar asks here, and
 * gives up a little at a time until it fits (first the units after its amounts and some of
 * the room between its items, then the bet's minus and plus for one button), which is how
 * the SDK's own bar keeps play centred at any width.
 *
 *     const fit = createBarFit();
 *
 *     <div class="side" {@attach fit.watch}><BarBalance unit={!fit.tight} />...</div>
 *     {#if fit.cramped}<BarBetButton />{:else}<BarBet />{/if}
 *
 * Author: dwclake
 * Created: 2026-11-19
 */

/** A bar's fit: how much it must give up to keep play in its middle, and what watches it. */
export interface BarFit {
	/**
	 * How much the bar gives up: 0, nothing; 1, the units after its amounts and some of the
	 * room between its items; 2, the bet's minus and plus as well, for one button.
	 */
	readonly level: 0 | 1 | 2;
	/** Level 1 or more: the amounts stand without their unit, and the items closer. */
	readonly tight: boolean;
	/** Level 2: the bet is one button. */
	readonly cramped: boolean;
	/** An attachment for something inside the bar's part: the part and its play button are measured. */
	watch(inside: HTMLElement): () => void;
}

/**
 * Watches whether a bar's layout keeps play in its middle, and has it give up a little at a
 * time until it does. The bar's part is marked with the level (`data-fit`), for its style
 * sheet to bring its items closer.
 */
export function createBarFit(): BarFit {
	let level = $state<0 | 1 | 2>(0);
	// How wide the bar had to be to go back up a level, as far as was measured when it did not fit.
	const needs = [0, 0];

	return {
		get level() {
			return level;
		},
		get tight() {
			return level >= 1;
		},
		get cramped() {
			return level === 2;
		},
		watch(inside) {
			const bar = inside.closest<HTMLElement>(".sdk-bar-part");
			if (!bar) return () => {};

			const measure = () => {
				const play = bar.querySelector<HTMLElement>(".sdk-bar-play");
				const box = bar.getBoundingClientRect();
				if (!play || !box.width) return;

				const at = play.getBoundingClientRect();
				const off = Math.abs(at.left + at.width / 2 - (box.left + box.width / 2));

				if (off > 0.5 && level < 2) {
					// Each side is short by as much as play is off: twice that, and a little to spare.
					needs[level] = box.width + off * 2 + 16;
					level = (level + 1) as 1 | 2;
				} else if (level > 0 && off <= 0.5 && box.width >= needs[level - 1]) {
					// Back up a level once there is the room it was short of.
					level = (level - 1) as 0 | 1;
				}

				bar.dataset.fit = String(level);
			};

			// Measured again whenever the bar or what is in this side changes size, which giving
			// something up does: so it goes on, a level at a time, until play is in the middle.
			// Measured in the next frame, never inside the observer's own call: a change of
			// layout made there is one the browser cannot deliver in the same pass, and it
			// says so in the console.
			let frame = 0;
			const watcher = new ResizeObserver(() => {
				cancelAnimationFrame(frame);
				frame = requestAnimationFrame(measure);
			});
			watcher.observe(bar);
			watcher.observe(inside);

			return () => {
				cancelAnimationFrame(frame);
				watcher.disconnect();
				delete bar.dataset.fit;
			};
		}
	};
}
