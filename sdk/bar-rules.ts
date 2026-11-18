/**
 * The control bar's rules, apart from how it is drawn: what it hands a game, what a
 * studio may lay out and what it may not, and the bar's symbols. The bar itself is
 * ./controls/ControlBar.svelte.
 *
 * Pure: no page is needed to read it.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import type { StakeSteps } from "./stake-steps.ts";

export type { StakeSteps };

/**
 * The bar's symbols, as what is drawn inside each one's 16 by 16 picture. Drawn, so that
 * they need no font and no image to load, and in the manner of the site's own
 * (src/lib/components/Icon.svelte): lines, square ended, nothing filled.
 */
export const SYMBOL_PATHS = {
	spin: '<path d="M13.2 8a5.2 5.2 0 0 1-9.3 3.2"/><path d="M2.8 8a5.2 5.2 0 0 1 9.3-3.2"/><path d="M12.3 2.2V5H9.5"/><path d="M3.7 13.8V11h2.800"/>',
	play: '<path d="M5.5 3.5v9l7-4.500z"/>',
	ready: '<path d="M2.5 1v14L15 8z"/>',
	stop: '<path d="M2.5 2.5h11v11h-11z"/>',
	minus: '<path d="M3 8h10"/>',
	plus: '<path d="M8 3v10M3 8h10"/>',
	auto: '<path d="M13.4 8a5.4 5.4 0 1 1-1.900-4.100"/><path d="M11.800 1.700v2.400H9.400"/><path d="M6.800 6v4L10 8z"/>',
	fast: '<path d="M3.5 4l4 4-4 4"/><path d="M8.500 4l4 4-4 4"/>',
	turbo: '<path d="M2 4l4 4-4 4"/><path d="M6.500 4l4 4-4 4"/><path d="M11 4l4 4-4 4"/>',
	menu: '<path d="M3 4h10M3 8h10M3 12h10"/>'
} as const;

export type BarSymbol = keyof typeof SYMBOL_PATHS;

export interface ControlBar {
	/** Put this in the page. It places itself along the bottom. */
	element: HTMLElement;
	/** The bet chosen, in cents. */
	readonly bet: number;
	/** How quick the player has asked play to be: 0 is the ordinary pace, 1 fast, 2 turbo. */
	readonly speed: Speed;
	/**
	 * Whether to play quickly now. Ask at every step, so that a change takes hold
	 * at once. Pass `true` while a bonus is being shown (free spins, a feature):
	 * fast, the first level, quickens ordinary play only, so that what the player
	 * was playing for is still seen at its own pace. Turbo quickens everything.
	 */
	quick(inBonus?: boolean): boolean;
	/** The volume chosen in the menu, from 0 (off) to 1. */
	readonly volume: number;
	/**
	 * Set while a round is being played or shown. The bet cannot be changed and
	 * the play button cannot be pressed. Autoplay can still be stopped.
	 */
	busy: boolean;
	/**
	 * How many plays of autoplay are left. The game sets it as they run. Autoplay is
	 * readied in its popup and started and stopped by the play button, which shows the
	 * plays waiting or left; the bar calls `autoplay.onStart` and `onStop` for it.
	 */
	autoLeft: number;
	setBalance(cents: number): void;
	/** What the last play won, in cents. */
	setWin(cents: number): void;
	/**
	 * What the next play will cost, in cents, when that is not the bet itself: a
	 * boosted spin, say. The bar shows it where the bet is shown, so that what the
	 * player reads is what will leave the balance. Pass `null` to show the bet again.
	 */
	setCost(cents: number | null): void;
	/**
	 * What the bet is called over its amount, when the next play is a kind of its own: a
	 * boosted spin, say. One of the `betLabels` the bar was made with; `null` for "Bet"
	 * again. The segment is as wide as the longest of them from the start, so it never
	 * changes size. Throws on a name not declared.
	 */
	setBetLabel(label: string | null): void;
	/**
	 * Free spins left, shown on the play button over the spin symbol as autoplay's plays
	 * are. While they show, the button cannot be pressed: free spins are not the player's
	 * to stop. `null` gives the button back.
	 */
	setFreeSpins(left: number | null): void;
	/** Called when the player changes the bet. */
	onBet(listener: (bet: number) => void): void;
	/** Says more about the play button to a screen reader, such as what a boosted spin costs. */
	describePlay(label: string): void;
	focusPlay(): void;
	/** Where the top of the bar is, in pixels from the top of the game. For a bar along the bottom; `inset()` answers for any. */
	top(): number;
	/**
	 * The room the bar takes at the top and at the bottom of the game, in pixels:
	 * a game draws between the two. A floating bar counts with whichever edge it
	 * is nearer, from that edge to its far side. The same two figures are kept on
	 * the page as `--sdk-bar-top` and `--sdk-bar-bottom`, for a style sheet.
	 */
	inset(): { top: number; bottom: number };
	/**
	 * Where the bar is in the game, in pixels from its top left, for placing a game's own
	 * button beside it: on the same row as a bar made narrower (`layout.width`), say.
	 */
	rect(): { left: number; top: number; width: number; height: number };
	/** Moves, resizes or rearranges the bar. What is left out stays as it was. */
	setLayout(layout: BarLayout): void;
}

export type Speed = 0 | 1 | 2;
export const SPEEDS = ["normal", "fast", "turbo"] as const;

/** The bar's segments, each kept whole: a studio orders them, and may hide the menu and the win. */
export type BarSegment = "menu" | "balance" | "bet" | "play" | "win";
export const BAR_SEGMENTS: readonly BarSegment[] = [
	"menu",
	"balance",
	"bet",
	"play",
	"win"
];
/** The segments a studio may leave out. The balance, the bet and play are always there. */
export const HIDEABLE_SEGMENTS: readonly BarSegment[] = ["menu", "win"];
/** How much bigger or smaller one segment may be than the rest of the bar. */
export const SEGMENT_SCALE = { min: 0.8, max: 1.25 };
/**
 * How the bet's segment is laid out inside: the bet between minus and plus (`split`, the
 * default), or plus over minus in a column at the bet's left (`column-start`) or right
 * (`column-end`).
 */
export type BetArrangement = "split" | "column-start" | "column-end";
/**
 * How play's segment is laid out inside: autoplay at play's left and speed at its right
 * (`split`, the default), or the two together at one side of play, side by side (`row-start`,
 * `row-end`) or one over the other (`column-start`, `column-end`).
 */
export type PlayArrangement =
	"split" | "row-start" | "row-end" | "column-start" | "column-end";
export const BET_ARRANGEMENTS: readonly BetArrangement[] = [
	"split",
	"column-start",
	"column-end"
];
export const PLAY_ARRANGEMENTS: readonly PlayArrangement[] = [
	"split",
	"row-start",
	"row-end",
	"column-start",
	"column-end"
];
/** How narrow a docked bar may be made, as a share of the game's width (never narrower than what is in it). */
export const BAR_WIDTH = { min: 0.5, max: 1 };

/** Where the bar is, how big, and how its segments are laid out. The studio's choice: the player does not move it. */
export interface BarLayout {
	/** Along the bottom (the default), along the top, or floating over the game. */
	place?: "bottom" | "top" | "float";
	/**
	 * For a floating bar: where its middle is, as fractions of the game's width
	 * and height. It is kept wholly inside the game, so `{ x: 0.5, y: 1 }` is the
	 * middle of the bottom, clear of the edge. That is also where it is left alone.
	 */
	at?: { x: number; y: number };
	/** Its size against the usual: from 0.8 to 1.5. Never so big that it does not fit across the game. */
	scale?: number;
	/**
	 * For a bar along the bottom or the top: how wide it is, as a share of the game's width,
	 * from a half to all of it (the default), and never narrower than what is in it. What is
	 * left of the row is the game's, for a button of its own beside the bar.
	 */
	width?: number;
	/** Which side a docked bar narrower than the game keeps to. The middle unless asked. */
	align?: "start" | "center" | "end";
	/**
	 * The order of the segments, left to right: all five, each once. Play is kept in the
	 * middle of the bar where there is room: the segments before it share the room to its
	 * left, those after it the room to its right, the one beside play close to it and the
	 * rest out at the edge. Not followed on a narrow game.
	 */
	order?: BarSegment[];
	/** Segments not to show: the menu (and the volume in it) and the last win, only. */
	hide?: BarSegment[];
	/** Each segment's size against the rest of the bar, 0.8 to 1.25: `{ play: 1.2 }`. */
	sizes?: Partial<Record<BarSegment, number>>;
	/** Where the parts of the bet's and play's segments are, inside them. Followed on a narrow game too. */
	arrange?: { bet?: BetArrangement; play?: PlayArrangement };
}

/** A layout a studio asked for that breaks the bar's rules. Thrown, so it is found while the game is made. */
export function checkLayout(layout: BarLayout) {
	if (layout.order) {
		const order = layout.order;
		if (
			order.length !== BAR_SEGMENTS.length ||
			!BAR_SEGMENTS.every((segment) => order.includes(segment))
		)
			throw new Error(
				`The bar's order must name each of ${BAR_SEGMENTS.join(", ")} once.`
			);
	}
	if (layout.arrange?.bet && !BET_ARRANGEMENTS.includes(layout.arrange.bet))
		throw new Error(`The bet's segment is arranged ${BET_ARRANGEMENTS.join(", ")}.`);
	if (layout.arrange?.play && !PLAY_ARRANGEMENTS.includes(layout.arrange.play))
		throw new Error(`Play's segment is arranged ${PLAY_ARRANGEMENTS.join(", ")}.`);
	for (const segment of layout.hide ?? [])
		if (!HIDEABLE_SEGMENTS.includes(segment))
			throw new Error(
				`The bar's ${segment} cannot be hidden: only ${HIDEABLE_SEGMENTS.join(" and ")}.`
			);
}
export const BAR_SCALE = { min: 0.8, max: 1.5 };
/** At or under this width a game's bar is docked in two rows, whatever was asked for (bar.css). */
export const NARROW = 600;
/** How wide the bar's contents are at its usual size, one row and two: what a bigger bar must still fit in. */
export const CONTENT = { wide: 640, narrow: 320 };
/** How small a bar in two rows may be made, to fit a game too narrow for it at its usual size. */
export const SMALLEST = 0.75;
/** How far a floating bar is kept from the game's edges. */
export const MARGIN = 8;

/**
 * The most characters a name for the bet may have (`betLabels`). The label is monospace, so
 * that many are no wider than the amount under it, and a name never widens the segment.
 */
export const BET_LABEL_LENGTH = 10;
