/**
 * Game Title: the rules of the game, as figures. Three reels, three rows, one line
 * along the middle: three of a kind on the line pays. Its maths plays every spin there is
 * with these to make its books (./index.ts), and its client reads them to draw a spin.
 *
 * Author: dwclake
 * Created: 2026-11-18
 */

export const SYMBOLS = ["lighthouse", "anchor", "buoy", "shell", "fish"] as const;
export type SymbolName = (typeof SYMBOLS)[number];

export const REELS = 3;
export const ROWS = 3;
/** The row the line runs along: the middle one. */
export const LINE_ROW = 1;

/** What three of a kind on the line pays, in basis points of the stake: 40,000 is 4x. */
export const PAYS: Record<SymbolName, number> = {
	lighthouse: 10_000_000,
	anchor: 2_500_000,
	buoy: 500_000,
	shell: 100_000,
	fish: 40_000
};

/**
 * The strip each reel turns through: 20 places, the same on every reel. One lighthouse, one
 * anchor, three buoys, six shells, nine fish.
 */
export const STRIP: readonly SymbolName[] = [
	"fish",
	"shell",
	"fish",
	"buoy",
	"fish",
	"shell",
	"anchor",
	"fish",
	"shell",
	"fish",
	"buoy",
	"fish",
	"shell",
	"lighthouse",
	"fish",
	"shell",
	"fish",
	"buoy",
	"shell",
	"fish"
];

/** How many ways the three reels can stop: every one of them is a row of the game's book. */
export const STOPS = STRIP.length ** REELS;

/** What the line won, if it won. */
export interface LineWin {
	symbol: SymbolName;
	bp: number;
}

/** A spin as it is shown: each reel's three symbols, top to bottom, and what the line won. */
export interface Spin {
	reels: SymbolName[][];
	win: LineWin | null;
}

/** The three symbols a reel shows when it stops at `stop`: the one before it, it, and the one after. */
export const showing = (stop: number): SymbolName[] =>
	[-1, 0, 1].map((step) => STRIP[(stop + step + STRIP.length) % STRIP.length]);

/** What the middle row pays, in basis points of the stake. */
export function linePays(line: readonly SymbolName[]): LineWin | null {
	return line[0] === line[1] && line[1] === line[2]
		? { symbol: line[0], bp: PAYS[line[0]] }
		: null;
}

/** The spin that one way of stopping the reels gives: `way` counts them, from 0 to `STOPS` less one. */
export function spinOf(way: number): Spin {
	const stops = [
		Math.floor(way / STRIP.length ** 2),
		Math.floor(way / STRIP.length) % STRIP.length,
		way % STRIP.length
	];
	const reels = stops.map(showing);

	return { reels, win: linePays(reels.map((reel) => reel[LINE_ROW])) };
}
