/**
 * Making a game's books from its maths: every table's rounds played, on as many cores as
 * the machine has, the rows they come to weighed so that each table is worth exactly what
 * it must be (./book-weights.ts), the books written (./book-files.ts), and the whole game
 * put through the site's own check (./book-check.ts).
 *
 * The same maths and seed make the same books, byte for byte, on any machine with any
 * number of cores: each round is played from a stream of its own (./book-play.ts), and
 * rows are written in the order of their rounds whoever played them.
 *
 * Runs on Bun, on the studio's machine. The site never runs this on a studio's maths.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join, resolve } from "node:path";
import { Worker } from "node:worker_threads";
import { BOOK_MAX_ROWS } from "./book.ts";
import type { BooksCheck } from "./book-check.ts";
import {
	checkGameFolder,
	createBookWriter,
	readGameManifest,
	writeBooksSummary
} from "./book-files.ts";
import { playingRng, type BooksMaths, type PlayedRow } from "./book-play.ts";
import { reportRows, type ReportedTable } from "./book-report.ts";
import { weighRows, worthOf } from "./book-weights.ts";
import { BOOK_RTP_BP, type BooksSummary, type GameManifest } from "./game-manifest.ts";

const BP = 10_000;
/** How many rounds one stretch of a table is: what a worker plays at a time. */
const STRETCH_ROUNDS = 20_000;

/** What a row is worth beyond its payout: what the maker needs to know to value one. */
export interface Worths {
	/** What one unit of each counter is counted at. */
	counters: Record<string, number>;
	/** What each table must be worth. */
	tables: Record<string, number>;
}

/** A stretch of one table's rounds, and where its rows are to be written. */
export interface Stretch {
	seed: number;
	table: string;
	from: number;
	to: number;
	file: string;
	worths: Worths;
}

/** What a stretch came to: each row's worth, and its group in the table's shape, or -1. */
export interface PlayedStretch {
	values: Float64Array;
	groups: Int8Array;
}

/** What was made of one table. */
export interface MadeTable extends ReportedTable {
	rows: number;
}

export interface MadeBooks {
	game: GameManifest;
	books: BooksSummary;
	tables: MadeTable[];
	check: BooksCheck;
}

export interface MakeOptions {
	/** Where the books go. A game's own `books` folder, left out. */
	books?: string;
	/** How many workers to play on. As many as the machine has cores, left out; 0 plays here. */
	workers?: number;
	/** Told what is being done, as it is. */
	log?: (line: string) => void;
}

const loaded = new Map<string, Promise<BooksMaths>>();

/** A game's maths, imported: what its `maths/index.ts` exports by default. Once for each file. */
export function loadMaths(file: string): Promise<BooksMaths> {
	const known = loaded.get(file);
	if (known) return known;

	const maths = import(file).then((module: { default?: BooksMaths }) => {
		const found = module.default;
		if (
			!found ||
			typeof found.tables !== "object" ||
			!Number.isSafeInteger(found.seed)
		)
			throw new Error(
				`${file} does not export a game's books by default (defineBooks).`
			);

		return found;
	});
	loaded.set(file, maths);

	return maths;
}

/**
 * Plays a stretch of a table's rounds and writes each row as a line of the stretch's
 * file. Returns what each row is worth to the table: what it pays, what the units it
 * adds are counted at, and what the best of the tables it offers must be worth.
 */
export function playStretch(maths: BooksMaths, stretch: Stretch): PlayedStretch {
	const { table, from, to, worths } = stretch;
	const tableMaths = maths.tables[table];
	const values = new Float64Array(to - from);
	const groups = new Int8Array(to - from).fill(-1);
	const lines: string[] = [];

	for (let round = from; round < to; round++) {
		const row = tableMaths.play(playingRng(stretch.seed, table, round), round);
		if (!row || !Number.isSafeInteger(row.payoutBp) || row.payoutBp < 0)
			throw new Error(
				`"${table}", round ${round}: a round pays a whole number of basis points, not ${row?.payoutBp}.`
			);

		let value = row.payoutBp;

		for (const [id, units] of Object.entries(row.adds ?? {})) {
			if (!(id in worths.counters))
				throw new Error(
					`"${table}", round ${round}: the game has no counter "${id}".`
				);

			value += units * worths.counters[id];
		}

		if (row.choice) {
			let best = 0;

			for (const option of row.choice) {
				if (!(option.table in worths.tables))
					throw new Error(
						`"${table}", round ${round}: a choice offers the table "${option.table}", which the maths does not make.`
					);

				best = Math.max(best, worths.tables[option.table]);
			}

			value += best;
		}

		values[round - from] = value;
		groups[round - from] = (tableMaths.shape ?? []).findIndex((group) =>
			group.when(row)
		);
		lines.push(JSON.stringify(row));
	}

	writeFileSync(stretch.file, lines.join("\n"));

	return { values, groups };
}

/**
 * What every table of a game must be worth: what its maths says, or else 96% of what a
 * mode that opens it costs, or what the units that fill a counter from it were counted
 * at. Throws for a table with no worth, or with two that disagree.
 */
export function tableWorths(
	game: GameManifest,
	maths: BooksMaths
): Record<string, number> {
	const found = new Map<string, { worthBp: number; from: string }>();

	/** Records what a table must be worth, and refuses a second answer that differs. */
	const say = (table: string, worthBp: number, from: string) => {
		const known = found.get(table);
		if (known && known.worthBp !== worthBp)
			throw new Error(
				`The table "${table}" must be worth ${known.worthBp} (${known.from}) and ${worthBp} (${from}).`
			);

		if (!Number.isSafeInteger(worthBp) || worthBp < 0)
			throw new Error(
				`The table "${table}" must be worth ${worthBp} (${from}), which is not a whole number of basis points.`
			);

		found.set(table, { worthBp, from });
	};

	for (const mode of game.modes)
		say(mode.table, (mode.costBp * BOOK_RTP_BP) / BP, `the mode "${mode.id}"`);

	const counters = game.counters ?? [];
	for (const counter of counters)
		say(counter.table, counter.full * counter.worthBp, `the counter "${counter.id}"`);

	for (const fill of game.fills ?? []) {
		const counted = fill.counters.reduce((total, id) => {
			const counter = counters.find((each) => each.id === id)!;

			return total + counter.full * counter.worthBp;
		}, 0);

		say(fill.table, counted, `the counters ${fill.counters.join(" and ")} together`);
	}

	for (const [table, tableMaths] of Object.entries(maths.tables)) {
		if (tableMaths.worthBp !== undefined) say(table, tableMaths.worthBp, "its maths");

		if (!found.has(table))
			throw new Error(
				`The table "${table}" must say what it is worth (worthBp): no mode opens it and no counter fills from it.`
			);
	}

	for (const [table, { from }] of found)
		if (!(table in maths.tables))
			throw new Error(`The maths makes no table "${table}", which ${from} needs.`);

	return Object.fromEntries([...found].map(([table, { worthBp }]) => [table, worthBp]));
}

/** Workers that play stretches, each one at a time, for as long as there are any. */
function createCrew(count: number, mathsFile: string) {
	const workers = Array.from(
		{ length: count },
		() => new Worker(new URL("./book-maker-worker.ts", import.meta.url))
	);

	return {
		/** Plays every stretch, on whichever worker is free, and answers in their order. */
		async play(stretches: Stretch[]): Promise<PlayedStretch[]> {
			const results: PlayedStretch[] = new Array(stretches.length);
			let next = 0;

			/** Keeps one worker busy until the stretches run out. */
			const keepBusy = async (worker: Worker) => {
				while (next < stretches.length) {
					const index = next++;

					results[index] = await new Promise<PlayedStretch>((done, failed) => {
						/** The stretch came back, played or not. */
						const answered = (answer: {
							played?: PlayedStretch;
							problem?: string;
						}) => {
							worker.off("error", broke);

							if (answer.played) done(answer.played);
							else failed(new Error(answer.problem));
						};
						/** The worker itself failed. Neither listener is left for the next stretch. */
						const broke = (error: Error) => {
							worker.off("message", answered);
							failed(error);
						};

						worker.once("message", answered);
						worker.once("error", broke);
						worker.postMessage({ ...stretches[index], maths: mathsFile });
					});
				}
			};

			await Promise.all(workers.map(keepBusy));

			return results;
		},

		/** Stops every worker. */
		async close() {
			await Promise.all(workers.map((worker) => worker.terminate()));
		}
	};
}

/**
 * Makes a game's books from its folder: `game.json`, and `maths/index.ts` beside it. The
 * books replace any that were there. What comes back says what was made and what the
 * site's check found; a game whose books do not pass has `check.problems` to say why.
 */
export async function makeBooks(
	folder: string,
	options: MakeOptions = {}
): Promise<MadeBooks> {
	const game = readGameManifest(folder);
	const mathsFile = resolve(folder, "maths", "index.ts");
	const maths = await loadMaths(mathsFile);
	const booksFolder = options.books ?? join(folder, "books");
	const making = join(booksFolder, ".making");
	const log = options.log ?? (() => {});

	const worths: Worths = {
		counters: Object.fromEntries(
			(game.counters ?? []).map((counter) => [counter.id, counter.worthBp])
		),
		tables: tableWorths(game, maths)
	};

	for (const [table, tableMaths] of Object.entries(maths.tables))
		if (
			!Number.isSafeInteger(tableMaths.rounds) ||
			tableMaths.rounds < 1 ||
			tableMaths.rounds > BOOK_MAX_ROWS
		)
			throw new Error(
				`The table "${table}" plays ${tableMaths.rounds} rounds, and a table has from 1 to ${BOOK_MAX_ROWS} rows.`
			);

	rmSync(making, { recursive: true, force: true });
	mkdirSync(making, { recursive: true });

	const workers = options.workers ?? availableParallelism();
	const crew = workers > 0 ? createCrew(workers, mathsFile) : null;
	const summaries: Record<
		string,
		ReturnType<ReturnType<typeof createBookWriter>["close"]>
	> = {};
	const tables: MadeTable[] = [];

	try {
		for (const [table, tableMaths] of Object.entries(maths.tables)) {
			log(`${table}: playing ${tableMaths.rounds} rounds`);

			const stretches: Stretch[] = [];
			for (let from = 0; from < tableMaths.rounds; from += STRETCH_ROUNDS)
				stretches.push({
					seed: maths.seed,
					table,
					from,
					to: Math.min(tableMaths.rounds, from + STRETCH_ROUNDS),
					file: join(making, `${table}.${from}.rows`),
					worths
				});

			const played = crew
				? await crew.play(stretches)
				: stretches.map((stretch) => playStretch(maths, stretch));

			// Every stretch's rows, end to end, in the order of their rounds.
			const values = new Float64Array(tableMaths.rounds);
			const groups = new Int8Array(tableMaths.rounds);
			played.forEach((stretch, index) => {
				values.set(stretch.values, stretches[index].from);
				groups.set(stretch.groups, stretches[index].from);
			});

			const worthBp = worths.tables[table];
			let weights: Float64Array;
			try {
				weights = weighRows(
					values,
					worthBp,
					tableMaths.shape
						? { groups: tableMaths.shape, groupOf: groups }
						: undefined
				);
			} catch (error) {
				throw new Error(
					`The table "${table}" cannot be made worth ${worthBp}: ${error instanceof Error ? error.message : String(error)}`
				);
			}

			log(`${table}: writing`);

			const writer = createBookWriter(booksFolder, table);
			let round = 0;

			for (const stretch of stretches) {
				for (const line of readFileSync(stretch.file, "utf8").split("\n")) {
					const row = JSON.parse(line) as PlayedRow;

					writer.add({ ...row, weight: weights[round] });
					round += 1;
				}

				rmSync(stretch.file);
			}

			summaries[table] = writer.close();
			const shape = tableMaths.shape
				? { groups: tableMaths.shape, groupOf: groups }
				: undefined;

			tables.push({
				table,
				rows: tableMaths.rounds,
				worthBp,
				playedBp: worthOf(values, new Float64Array(tableMaths.rounds).fill(1)),
				report: reportRows(values, weights, shape)
			});
		}
	} finally {
		await crew?.close();
		rmSync(making, { recursive: true, force: true });
	}

	const books = writeBooksSummary(booksFolder, summaries);
	const { check } = checkGameFolder(folder, booksFolder);

	return { game, books, tables, check };
}
