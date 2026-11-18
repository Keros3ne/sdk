/**
 * `game.json`: what a studio says about one game played from books, in the game's own
 * folder, and `books/books.json` beside its books: what those books come to, written
 * when they are. Together they are everything the site knows of the game before a bet:
 *
 *   {
 *     "slug": "stormglass",
 *     "name": "Stormglass",
 *     "blurb": "Five reels under a sky you choose.",
 *     "category": "slots",
 *     "modes": [
 *       { "id": "spin", "name": "Spin", "costBp": 10000, "table": "spin" },
 *       { "id": "bonus", "name": "Bought bonus", "costBp": 1000000, "table": "bonus" }
 *     ]
 *   }
 *
 * - `modes` are the ways of opening a round, the ordinary one first: what each costs, as
 *   a multiple of the bet in basis points, and the table its row is drawn from. A game
 *   may have more tables than modes: a row's choice names the others (./book.ts).
 * - `minStake` and `maxStake`, in cents, narrow the bets the site takes, never widen them.
 * - `counters`, if given, are meters the game keeps between bets, for each player at each
 *   size of bet: `{ "id": "bronze", "full": 55, "worthBp": 2379, "table": "pour-bronze" }`.
 *   A row says what it adds to them (`adds`, ./book.ts). A counter that reaches `full`
 *   gives `full` back and a row is drawn from its `table`, in the same bet. `worthBp` is
 *   what one unit is worth, in basis points of the bet: the check counts a row that adds
 *   a unit as paying that much, and holds the counter's table to what `full` units were
 *   counted at, so the game returns what it says with the meters in it.
 * - `fills`, if given, name one table for several counters that fill on the same row, in
 *   place of each one's own: `{ "counters": ["bronze", "silver"], "table": "pour-both" }`.
 *   It is used when exactly those fill. Otherwise each draws from its own, in the order
 *   the counters are listed.
 *
 * A game declares no return and no volatility. Every mode returns `BOOK_RTP_BP`, and the
 * site reads how much a game swings from its books.
 *
 * Pure: the site reads both in the browser as well as on the server.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import * as valibot from "valibot";
import { BP, MAX_COST_BP, MAX_STAKE, MIN_STAKE } from "./bets.ts";
import {
	BOOK_MAX_ROWS,
	BOOK_MAX_WEIGHT,
	BOOK_NAME,
	BOOK_VERSION,
	COUNTER_MAX_FULL
} from "./book.ts";

/** What every mode of every game played from books returns, in basis points. */
export const BOOK_RTP_BP = 9_600;

/** The most ways a game may be opened, and the most tables it may ship. */
export const GAME_MAX_MODES = 16;
export const GAME_MAX_TABLES = 64;
/** The most counters a game may keep. */
export const GAME_MAX_COUNTERS = 8;
/**
 * The most one unit of a counter may be counted at, in basis points of the bet: a hundred
 * thousand bets. A counter that fills at one stands for a whole bonus, drawn from a table
 * of its own, and a rare bonus may be worth thousands of bets.
 */
export const COUNTER_MAX_WORTH_BP = 100_000 * BP;

const name = (what: string) =>
	valibot.pipe(
		valibot.string(),
		valibot.regex(BOOK_NAME, `${what} is lowercase words joined by hyphens`),
		valibot.maxLength(40)
	);

const words = (what: string, most: number) =>
	valibot.pipe(
		valibot.string(),
		valibot.trim(),
		valibot.minLength(1, `${what} is missing`),
		valibot.maxLength(most)
	);

const stake = valibot.pipe(
	valibot.number(),
	valibot.integer("A stake is a whole number of cents"),
	valibot.minValue(MIN_STAKE),
	valibot.maxValue(MAX_STAKE)
);

const mode = valibot.strictObject({
	id: name("A mode's id"),
	/** What a player is shown for it. */
	name: words("A mode's name", 40),
	costBp: valibot.pipe(
		valibot.number(),
		valibot.integer("A mode's cost is a whole number of basis points"),
		valibot.minValue(BP, "A mode costs at least one bet"),
		valibot.maxValue(MAX_COST_BP, "A mode costs at most a thousand bets")
	),
	table: name("A mode's table")
});

const counter = valibot.strictObject({
	id: name("A counter's id"),
	/** How many units fill it. */
	full: valibot.pipe(
		valibot.number(),
		valibot.integer("A counter fills at a whole number of units"),
		valibot.minValue(1),
		valibot.maxValue(COUNTER_MAX_FULL)
	),
	/** What one unit is worth, in basis points of the bet. */
	worthBp: valibot.pipe(
		valibot.number(),
		valibot.integer("A unit is worth a whole number of basis points"),
		valibot.minValue(1),
		valibot.maxValue(COUNTER_MAX_WORTH_BP)
	),
	/** The table a row is drawn from when it fills. */
	table: name("A counter's table")
});

const fill = valibot.strictObject({
	counters: valibot.pipe(
		valibot.array(name("A counter's id")),
		valibot.minLength(2, "A fill is of two counters or more"),
		valibot.maxLength(GAME_MAX_COUNTERS),
		valibot.check(
			(ids) => new Set(ids).size === ids.length,
			"A fill names a counter twice"
		)
	),
	table: name("A fill's table")
});

/** A set of counters as one string, whatever order they were named in. */
const setKey = (ids: readonly string[]) => [...ids].sort().join(" ");

export const gameManifest = valibot.pipe(
	valibot.strictObject({
		slug: name("The game's slug"),
		name: words("The game's name", 60),
		blurb: words("The game's blurb", 120),
		category: valibot.picklist(["slots", "games"]),
		minStake: valibot.optional(stake),
		maxStake: valibot.optional(stake),
		modes: valibot.pipe(
			valibot.array(mode),
			valibot.minLength(1, "The game has no way of being played"),
			valibot.maxLength(GAME_MAX_MODES),
			valibot.check(
				(modes) => new Set(modes.map((each) => each.id)).size === modes.length,
				"Two modes have the same id"
			)
		),
		counters: valibot.optional(
			valibot.pipe(
				valibot.array(counter),
				valibot.minLength(1),
				valibot.maxLength(GAME_MAX_COUNTERS),
				valibot.check(
					(counters) =>
						new Set(counters.map((each) => each.id)).size === counters.length,
					"Two counters have the same id"
				)
			)
		),
		fills: valibot.optional(
			valibot.pipe(
				valibot.array(fill),
				valibot.maxLength(2 ** GAME_MAX_COUNTERS),
				valibot.check(
					(fills) =>
						new Set(fills.map((each) => setKey(each.counters))).size ===
						fills.length,
					"Two fills are of the same counters"
				)
			)
		)
	}),
	valibot.check((game) => {
		const known = new Set((game.counters ?? []).map((each) => each.id));

		return (game.fills ?? []).every((each) =>
			each.counters.every((id) => known.has(id))
		);
	}, "A fill names a counter the game does not have"),
	valibot.check(
		(game) => (game.minStake ?? MIN_STAKE) <= (game.maxStake ?? MAX_STAKE),
		"The smallest stake is over the largest"
	)
);

export type GameManifest = valibot.InferOutput<typeof gameManifest>;
export type GameMode = GameManifest["modes"][number];
export type GameCounter = NonNullable<GameManifest["counters"]>[number];

/** What of a game says how its counters work. */
export type CounterRules = Pick<GameManifest, "counters" | "fills">;

/** One draw owed for counters that filled: the table, and the counters it is for. */
export interface OwedFill {
	table: string;
	counters: string[];
}

/**
 * The draws owed when these counters fill on the same row: one from the table the game
 * names for exactly this set, if it names one, and otherwise one from each counter's own
 * table, in the order the game lists its counters.
 */
export function fillsFor(rules: CounterRules, filled: readonly string[]): OwedFill[] {
	const together = (rules.fills ?? []).find(
		(each) => setKey(each.counters) === setKey(filled)
	);
	if (together && filled.length > 1)
		return [{ table: together.table, counters: [...together.counters].sort() }];

	return (rules.counters ?? [])
		.filter((each) => filled.includes(each.id))
		.map((each) => ({ table: each.table, counters: [each.id] }));
}

const whole = (least: number, most: number) =>
	valibot.pipe(
		valibot.number(),
		valibot.integer(),
		valibot.minValue(least),
		valibot.maxValue(most)
	);

/** `books/books.json`: each of a game's tables by name, and what it comes to. */
export const booksSummary = valibot.strictObject({
	version: valibot.literal(BOOK_VERSION),
	tables: valibot.pipe(
		valibot.record(
			name("A table's name"),
			valibot.strictObject({
				rows: whole(1, BOOK_MAX_ROWS),
				totalWeight: whole(1, BOOK_MAX_WEIGHT),
				digest: valibot.pipe(
					valibot.string(),
					valibot.regex(/^[0-9a-f]{64}$/, "A digest is 64 hex digits")
				)
			})
		),
		valibot.check(
			(tables) => Object.keys(tables).length >= 1,
			"The game has no books"
		),
		valibot.check(
			(tables) => Object.keys(tables).length <= GAME_MAX_TABLES,
			`A game ships at most ${GAME_MAX_TABLES} tables`
		)
	)
});

export type BooksSummary = valibot.InferOutput<typeof booksSummary>;

/** A file's contents, checked against what it should be. Throws, naming the file. */
function checked<Schema extends valibot.GenericSchema>(
	schema: Schema,
	from: string,
	what: string,
	value: unknown
): valibot.InferOutput<Schema> {
	const parsed = valibot.safeParse(schema, value);
	if (parsed.success) return parsed.output;

	const issue = parsed.issues[0];
	const at = issue.path?.map((step) => step.key).join(".");

	throw new Error(
		`${from} is not ${what} the site can read: ${at ? `${at}: ` : ""}${issue.message}`
	);
}

/** A game's manifest, checked. Throws, naming where it came from, if it is not one. */
export const checkGameManifest = (from: string, manifest: unknown): GameManifest =>
	checked(gameManifest, from, "a game's manifest", manifest);

/** A game's summary of its books, checked. Throws, naming where it came from. */
export const checkBooksSummary = (from: string, summary: unknown): BooksSummary =>
	checked(booksSummary, from, "a summary of books", summary);

/** The mode of a game with this id, or `undefined`. The ordinary one is `modes[0]`. */
export const modeOf = (game: GameManifest, id: string): GameMode | undefined =>
	game.modes.find((each) => each.id === id);

/**
 * What stands between a game and its books, in words: a mode whose table was not
 * shipped. Empty when every mode can be opened. Whether a choice's tables are there is
 * found by the check that reads the rows.
 */
export function missingTables(game: GameManifest, books: BooksSummary): string[] {
	return game.modes
		.filter((each) => !(each.table in books.tables))
		.map(
			(each) =>
				`the mode "${each.id}" opens the table "${each.table}", which has no book`
		);
}
