/**
 * What slots share, for a studio's maths to be written with: grids from strips or from
 * weights, the four ways a grid pays (lines, ways, anywhere, clusters), what falls when
 * wins are taken away, free spins, and a recorder that keeps a round's events and what
 * it pays as the round is worked out, and hands them over as a row (./book-play.ts).
 *
 * A grid is its reels, left to right, each reel its symbols from the top down:
 * `grid[reel][row]`. A cell is `[reel, row]`. Pays are multiples of the bet in basis
 * points. Everything that repeats (a fall that pays again, free spins that win more)
 * takes a limit and stops at it: strips wrap round, and a fall with no end hung the
 * site once.
 *
 * Pure. A game's maths may import this.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import type { BookRow } from "./book.ts";
import type { PlayedRow } from "./book-play.ts";
import type { Rng } from "./rng.ts";

export type Grid<Sym> = Sym[][];
export type Cell = [reel: number, row: number];

/**
 * What each symbol pays for how many: `{ lantern: { 3: 15_000, 4: 40_000, 5: 75_000 } }`.
 * A count between two that are listed pays as the lower, so a cluster's table need only
 * say where the pay steps up.
 */
export type Paytable<Sym extends string> = Partial<Record<Sym, Record<number, number>>>;

/** One win on a grid. */
export interface Win<Sym> {
	symbol: Sym;
	/** How many made it: symbols on a line, reels of a way, symbols of a cluster. */
	count: number;
	/** The cells that made it, for the client to light and the fall to take away. */
	cells: Cell[];
	payoutBp: number;
	/** Which line, for a line win. */
	line?: number;
	/** How many ways, for a ways win. */
	ways?: number;
}

/** What a symbol pays for a count: the pay listed for the greatest count not over it. */
export function payFor<Sym extends string>(
	pays: Paytable<Sym>,
	symbol: Sym,
	count: number
): number {
	let listed = 0;
	let pay = 0;

	for (const [key, value] of Object.entries(pays[symbol] ?? {})) {
		const needed = Number(key);
		if (needed > count || needed < listed) continue;

		listed = needed;
		pay = value;
	}

	return pay;
}

/** A grid written as its rows, top row first, turned into reels: for tests, mostly. */
export function gridFromRows<Sym>(rows: readonly (readonly Sym[])[]): Grid<Sym> {
	return rows[0].map((_, reel) => rows.map((row) => row[reel]));
}

/** What a strip shows from a stop: `rows` symbols down from there, wrapping round. */
export function stripWindow<Sym>(
	strip: readonly Sym[],
	stop: number,
	rows: number
): Sym[] {
	return Array.from({ length: rows }, (_, row) => strip[(stop + row) % strip.length]);
}

/** Stops every strip somewhere and shows `rows` symbols of each. */
export function spinStrips<Sym>(
	strips: readonly (readonly Sym[])[],
	rows: number,
	rng: Rng
): { stops: number[]; grid: Grid<Sym> } {
	const stops = strips.map((strip) => rng.int(strip.length));

	return {
		stops,
		grid: strips.map((strip, reel) => stripWindow(strip, stops[reel], rows))
	};
}

/**
 * A draw from things that are not equally likely: `weighted([["cherry", 30], ["seven", 1]])`
 * gives a function that draws one, each as often as its whole-number weight.
 */
export function weighted<Item>(
	table: readonly (readonly [item: Item, weight: number])[]
): (rng: Rng) => Item {
	let total = 0;

	for (const [, weight] of table) {
		if (!Number.isSafeInteger(weight) || weight < 0)
			throw new Error(`A weight is a whole number, not ${weight}.`);

		total += weight;
	}

	if (total < 1) throw new Error("Nothing can be drawn: the weights come to nothing.");

	return (rng) => {
		let drawn = rng.int(total);

		for (const [item, weight] of table) {
			if (drawn < weight) return item;

			drawn -= weight;
		}

		// Never reached: the draw is under the total.
		return table[table.length - 1][0];
	};
}

/** A grid with every cell drawn afresh: `draw` is asked for each, reel by reel. */
export function drawGrid<Sym>(
	reels: number,
	rows: number,
	draw: (reel: number, row: number) => Sym
): Grid<Sym> {
	return Array.from({ length: reels }, (_, reel) =>
		Array.from({ length: rows }, (_, row) => draw(reel, row))
	);
}

/** The cells of a grid that hold something: `cellsOf(grid, (symbol) => symbol === "storm")`. */
export function cellsOf<Sym>(grid: Grid<Sym>, holds: (symbol: Sym) => boolean): Cell[] {
	const cells: Cell[] = [];

	grid.forEach((symbols, reel) =>
		symbols.forEach((symbol, row) => {
			if (holds(symbol)) cells.push([reel, row]);
		})
	);

	return cells;
}

/** How a grid pays: the paytable, and the symbol that stands for any other, if there is one. */
export interface PayRules<Sym extends string> {
	pays: Paytable<Sym>;
	wild?: Sym;
}

/**
 * Wins on lines that pay from the left. A line is the row it crosses on each reel. A
 * wild stands for the line's symbol; a line that opens with wilds pays as those wilds or
 * as the symbol after them, whichever is more.
 */
export function lineWins<Sym extends string>(
	grid: Grid<Sym>,
	lines: readonly (readonly number[])[],
	{ pays, wild }: PayRules<Sym>
): Win<Sym>[] {
	const wins: Win<Sym>[] = [];

	lines.forEach((rows, line) => {
		const symbols = rows.map((row, reel) => grid[reel][row]);
		const first = symbols.find((symbol) => symbol !== wild);

		/** How many from the left are this symbol, or the wild standing for it. */
		const run = (symbol: Sym) => {
			let count = 0;
			while (
				count < symbols.length &&
				(symbols[count] === symbol || symbols[count] === wild)
			)
				count++;

			return count;
		};

		let best: Win<Sym> | null = null;

		for (const symbol of [wild, first]) {
			if (symbol === undefined) continue;

			const count =
				symbol === wild
					? symbols.findIndex((each) => each !== wild)
					: run(symbol);
			const length = count < 0 ? symbols.length : count;
			const payoutBp = payFor(pays, symbol, length);

			if (payoutBp > (best?.payoutBp ?? 0))
				best = {
					symbol,
					count: length,
					cells: rows.slice(0, length).map((row, reel): Cell => [reel, row]),
					payoutBp,
					line
				};
		}

		if (best) wins.push(best);
	});

	return wins;
}

/**
 * Wins by ways: a symbol pays when it is on each reel from the left, anywhere on it, and
 * pays once for every way of picking one of it from each of those reels.
 */
export function waysWins<Sym extends string>(
	grid: Grid<Sym>,
	{ pays, wild }: PayRules<Sym>
): Win<Sym>[] {
	const wins: Win<Sym>[] = [];

	for (const symbol of Object.keys(pays) as Sym[]) {
		if (symbol === wild) continue;

		const cells: Cell[] = [];
		let ways = 1;
		let reels = 0;

		for (const [reel, symbols] of grid.entries()) {
			const found = symbols
				.map((each, row): Cell | null =>
					each === symbol || each === wild ? [reel, row] : null
				)
				.filter((cell): cell is Cell => cell !== null);
			if (found.length === 0) break;

			cells.push(...found);
			ways *= found.length;
			reels += 1;
		}

		const pay = payFor(pays, symbol, reels);
		if (pay > 0)
			wins.push({ symbol, count: reels, cells, payoutBp: pay * ways, ways });
	}

	return wins;
}

/** Wins that pay anywhere: a symbol pays for how many of it are in view, wherever they are. */
export function anywhereWins<Sym extends string>(
	grid: Grid<Sym>,
	{ pays, wild }: PayRules<Sym>
): Win<Sym>[] {
	const wins: Win<Sym>[] = [];

	for (const symbol of Object.keys(pays) as Sym[]) {
		if (symbol === wild) continue;

		const cells = cellsOf(grid, (each) => each === symbol || each === wild);
		const payoutBp = payFor(pays, symbol, cells.length);

		if (payoutBp > 0) wins.push({ symbol, count: cells.length, cells, payoutBp });
	}

	return wins;
}

/**
 * Wins by clusters: symbols that touch, side to side or one above another, pay for how
 * many there are. A wild joins any cluster it touches, and may be in more than one.
 */
export function clusterWins<Sym extends string>(
	grid: Grid<Sym>,
	{ pays, wild }: PayRules<Sym>
): Win<Sym>[] {
	const wins: Win<Sym>[] = [];
	const key = ([reel, row]: Cell) => `${reel}:${row}`;

	for (const symbol of Object.keys(pays) as Sym[]) {
		if (symbol === wild) continue;

		const counted = new Set<string>();

		for (const start of cellsOf(grid, (each) => each === symbol)) {
			if (counted.has(key(start))) continue;

			// Everything that can be walked to from here through the symbol and wilds.
			const cells: Cell[] = [];
			const seen = new Set([key(start)]);
			const waiting = [start];

			while (waiting.length > 0) {
				const cell = waiting.pop()!;
				const [reel, row] = cell;

				cells.push(cell);
				if (grid[reel][row] === symbol) counted.add(key(cell));

				for (const next of [
					[reel - 1, row],
					[reel + 1, row],
					[reel, row - 1],
					[reel, row + 1]
				] as Cell[]) {
					const there = grid[next[0]]?.[next[1]];
					if ((there !== symbol && there !== wild) || there === undefined)
						continue;

					if (seen.has(key(next))) continue;

					seen.add(key(next));
					waiting.push(next);
				}
			}

			const payoutBp = payFor(pays, symbol, cells.length);
			if (payoutBp > 0) wins.push({ symbol, count: cells.length, cells, payoutBp });
		}
	}

	return wins;
}

/** What comes down a reel to fill it: asked for so many, answers with them, top first. */
export type Refill<Sym> = (reel: number, count: number) => Sym[];

/** New symbols from the strips, from above where each stopped, as a real reel would bring. */
export function refillFromStrips<Sym>(
	strips: readonly (readonly Sym[])[],
	stops: readonly number[]
): Refill<Sym> {
	const tops = [...stops];

	return (reel, count) => {
		const strip = strips[reel];

		tops[reel] =
			(((tops[reel] - count) % strip.length) + strip.length) % strip.length;

		return stripWindow(strip, tops[reel], count);
	};
}

/**
 * Takes cells away and lets what is above them fall. What is left keeps its order at the
 * foot of its reel, and `refill` fills the room at the top. `drops` is what came down
 * each reel, top first, for the client to show falling.
 */
export function tumble<Sym>(
	grid: Grid<Sym>,
	taken: readonly Cell[],
	refill: Refill<Sym>
): { grid: Grid<Sym>; drops: Sym[][] } {
	const gone = new Set(taken.map(([reel, row]) => `${reel}:${row}`));
	const drops: Sym[][] = [];

	const fallen = grid.map((symbols, reel) => {
		const kept = symbols.filter((_, row) => !gone.has(`${reel}:${row}`));
		const fresh = refill(reel, symbols.length - kept.length);
		if (fresh.length !== symbols.length - kept.length)
			throw new Error(
				`Reel ${reel} was refilled with the wrong number of symbols.`
			);

		drops.push(fresh);

		return [...fresh, ...kept];
	});

	return { grid: fallen, drops };
}

/** A whole number from 1 up, or an error: every limit here is one. */
function checkLimit(limit: number, what: string): void {
	if (!Number.isSafeInteger(limit) || limit < 1)
		throw new Error(`${what} needs a limit: a whole number from 1.`);
}

/** One step of a fall: the grid as it stood, what it paid, and what then came down. */
export interface FallStep<Sym> {
	grid: Grid<Sym>;
	wins: Win<Sym>[];
	payoutBp: number;
	drops: Sym[][];
}

export interface Fall<Sym> {
	steps: FallStep<Sym>[];
	/** The grid left at the end, which pays nothing more (or was cut off). */
	grid: Grid<Sym>;
	payoutBp: number;
	/** True if the fall was stopped at its limit with wins still to pay. */
	cut: boolean;
}

/**
 * Pays a grid, takes the wins away, lets the rest fall, and pays again, until nothing
 * pays or `limit` falls have been made. `wins` says what a grid pays; `taken`, if given,
 * says which of a step's winning cells go (all of them, left out: a game whose wilds
 * stay would keep those back).
 */
export function fall<Sym>(options: {
	grid: Grid<Sym>;
	wins(grid: Grid<Sym>, step: number): Win<Sym>[];
	refill: Refill<Sym>;
	limit: number;
	taken?(wins: Win<Sym>[], grid: Grid<Sym>): Cell[];
}): Fall<Sym> {
	checkLimit(options.limit, "A fall");

	const steps: FallStep<Sym>[] = [];
	let grid = options.grid;
	let payoutBp = 0;

	for (let step = 0; step < options.limit; step++) {
		const wins = options.wins(grid, step);
		if (wins.length === 0) return { steps, grid, payoutBp, cut: false };

		const taken = options.taken?.(wins, grid) ?? wins.flatMap((win) => win.cells);
		const next = tumble(grid, taken, options.refill);
		const paid = wins.reduce((total, win) => total + win.payoutBp, 0);

		steps.push({ grid, wins, payoutBp: paid, drops: next.drops });
		payoutBp += paid;
		grid = next.grid;
	}

	return { steps, grid, payoutBp, cut: options.wins(grid, options.limit).length > 0 };
}

/** What one free spin came to. `more` is how many free spins it won on top. */
export interface FreeSpin {
	payoutBp: number;
	more?: number;
}

/**
 * Plays free spins: `spins` to start with, and as many more as they win, up to `limit`
 * in all. `play` is handed the spin's number from 0 and how many are left after it.
 */
export function freeSpins<Spin extends FreeSpin>(options: {
	spins: number;
	limit: number;
	play(index: number, left: number): Spin;
}): { spins: Spin[]; payoutBp: number; cut: boolean } {
	checkLimit(options.limit, "Free spins");

	const spins: Spin[] = [];
	let left = options.spins;
	let payoutBp = 0;

	while (left > 0 && spins.length < options.limit) {
		left -= 1;

		const spin = options.play(spins.length, left);

		spins.push(spin);
		payoutBp += spin.payoutBp;
		left += spin.more ?? 0;
	}

	return { spins, payoutBp, cut: left > 0 };
}

/** What a recorder keeps of a round as it is worked out. */
export interface RoundRecorder {
	/** Adds an event for the client to play, in order: its type, and whatever it needs. */
	event(type: string, detail?: Record<string, unknown>): void;
	/** Adds to what the round pays. */
	pay(payoutBp: number): void;
	/** What the round pays so far. */
	readonly payoutBp: number;
	/**
	 * The round as a row, closed with an event of what it paid in all (`total`). `rest`
	 * is what it adds to the game's counters and the choice it ends in, if any.
	 */
	row(rest?: Pick<BookRow, "adds" | "choice">): PlayedRow;
}

/**
 * Starts a round's record. A round's maths calls `event` and `pay` as it goes, so the
 * events are in the order things happened and the payout is the sum of what was paid,
 * and neither can drift from the other.
 */
export function createRound(): RoundRecorder {
	const events: BookRow["events"] = [];
	let payoutBp = 0;

	return {
		event(type, detail = {}) {
			events.push({ ...detail, type });
		},

		pay(amount) {
			if (!Number.isSafeInteger(amount) || amount < 0)
				throw new Error(
					`A round pays whole numbers of basis points, not ${amount}.`
				);

			payoutBp += amount;
		},

		get payoutBp() {
			return payoutBp;
		},

		row(rest = {}) {
			return {
				payoutBp,
				events: [...events, { type: "total", payoutBp }],
				...(rest.adds ? { adds: rest.adds } : {}),
				...(rest.choice ? { choice: rest.choice } : {})
			};
		}
	};
}
