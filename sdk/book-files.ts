/**
 * Books on disk: writing a table's two files as its rows are worked out, and opening them
 * again to draw and read a row. The format is in ./book.ts. A studio writes books with
 * this, and the site reads them with it, so what is read here comes from outside: nothing
 * in a file is believed until it has been checked against the limits and the line's hash.
 *
 * Runs on Bun or Node. Reading is synchronous, like the draw it serves.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import { createHash } from "node:crypto";
import {
	closeSync,
	existsSync,
	fstatSync,
	mkdirSync,
	openSync,
	readFileSync,
	readSync,
	statSync,
	writeFileSync,
	writeSync
} from "node:fs";
import { join } from "node:path";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import * as valibot from "valibot";
import {
	BLOCK_ROWS,
	BOOK_MAX_ROWS,
	BOOK_MAX_WEIGHT,
	BOOK_NAME,
	BOOK_VERSION,
	HASH_BYTES,
	HEADER_BYTES,
	LEAF_BYTES,
	PAGE_ROWS,
	RECORD_BYTES,
	ROW_MAX_BYTES,
	bookDigest,
	bookRow,
	decodeHeader,
	decodeRecord,
	drawBelow,
	encodeHeader,
	encodeRecord,
	leafOf,
	recordProblem,
	rowAt,
	type BookPage,
	type BookRecord,
	type BookRow,
	type BookSummary
} from "./book.ts";
import type { RowProof } from "./book-round.ts";
import { checkBooks, type BooksCheck } from "./book-check.ts";
import { bookGame, type BookGame } from "./book-game.ts";
import {
	checkBooksSummary,
	checkGameManifest,
	type BooksSummary,
	type GameManifest
} from "./game-manifest.ts";
import type { Rng } from "./rng.ts";

/** A row as a studio hands it to the writer. */
export interface NewRow extends BookRow {
	weight: number;
	payoutBp: number;
}

/** A row as it is read back: its record, its line as written, and the line read. */
export interface ReadRow {
	record: BookRecord;
	line: string;
	row: BookRow;
}

export interface BookWriter {
	/** Adds a row. Throws if it is not one a book can hold. */
	add(row: NewRow): void;
	/** Finishes both files and says what the book comes to. */
	close(): BookSummary;
}

export interface Book extends BookSummary {
	/** The pages the digest was made from. */
	pages: readonly BookPage[];
	/** The row a bet's stream of random numbers lands on, by its number. */
	draw(rng: Rng): number;
	/** One row's record. */
	record(row: number): BookRecord;
	/** One row, read and checked against its hash. */
	row(row: number): ReadRow;
	/** The leaves of one page of the digest, for a browser to check a row against. */
	leaves(page: number): Uint8Array;
	/** Everything a browser needs to check that a draw landed on this row (./book-round.ts). */
	prove(row: number): RowProof;
	/**
	 * Goes through every row in order, each read and checked against its hash as `row()`
	 * does, a block opened once for all its rows. For the check that reads a whole book.
	 */
	scan(visit: (record: BookRecord, row: BookRow, number: number) => void): void;
	close(): void;
}

/** A table's two files in a folder. Throws if the name is not one a table can have. */
function pathsOf(folder: string, table: string): { index: string; rows: string } {
	if (!BOOK_NAME.test(table) || table.length > 40)
		throw new Error(
			`"${table}" is not a table's name: lowercase words joined by hyphens.`
		);

	return {
		index: join(folder, `${table}.index`),
		rows: join(folder, `${table}.rows`)
	};
}

/** The SHA-256 of some bytes, by the runtime's own hash: a book has a million lines. */
const hashOf = (bytes: Uint8Array): Uint8Array =>
	new Uint8Array(createHash("sha256").update(bytes).digest());

/** Collects rows' leaves into the digest's pages as they pass, in order. */
function createPager() {
	const pages: BookPage[] = [];
	let leaves: Uint8Array[] = [];
	let start = 0;
	let weight = 0;

	/** Closes the page under way, if it has any rows. */
	function turn() {
		if (leaves.length === 0) return;

		pages.push({ start, hash: hashOf(Buffer.concat(leaves)) });
		leaves = [];
		start = weight;
	}

	return {
		pages,
		/** Takes the next row. */
		add(record: Pick<BookRecord, "weight" | "payoutBp" | "hash">) {
			leaves.push(leafOf(record));
			weight += record.weight;
			if (leaves.length === PAGE_ROWS) turn();
		},
		turn
	};
}

/**
 * Starts a table's files in `folder`, replacing any there. Rows are added in the order
 * they will be numbered, and nothing is a book until `close()` has written the header.
 */
export function createBookWriter(folder: string, table: string): BookWriter {
	const paths = pathsOf(folder, table);
	mkdirSync(folder, { recursive: true });

	const indexFile = openSync(paths.index, "w");
	const rowsFile = openSync(paths.rows, "w");
	const pager = createPager();

	// The block under way: its lines, and what is known of each of their records so far.
	let lines: Buffer[] = [];
	let waiting: Omit<BookRecord, "blockOffset" | "blockLength">[] = [];
	let blockBytes = 0;

	let rows = 0;
	let totalWeight = 0;
	let rowsOffset = 0;
	let closed = false;

	// The header's place is kept, and filled in at the end.
	writeSync(indexFile, new Uint8Array(HEADER_BYTES));

	/** Compresses the block under way and writes it, and its rows' records after it. */
	function flush() {
		if (lines.length === 0) return;

		const block = deflateRawSync(Buffer.concat(lines));
		writeSync(rowsFile, block);

		const records = waiting.map((record) =>
			encodeRecord({
				...record,
				blockOffset: rowsOffset,
				blockLength: block.length
			})
		);
		writeSync(indexFile, Buffer.concat(records));

		rowsOffset += block.length;
		lines = [];
		waiting = [];
		blockBytes = 0;
	}

	return {
		add({ weight, payoutBp, ...rest }) {
			if (closed) throw new Error("The book is closed.");

			const problem = recordProblem(weight, payoutBp);
			if (problem) throw new Error(`Row ${rows}: ${problem}.`);

			if (rows >= BOOK_MAX_ROWS)
				throw new Error(`A book holds at most ${BOOK_MAX_ROWS} rows.`);

			if (totalWeight + weight > BOOK_MAX_WEIGHT)
				throw new Error(`A book's weights come to at most ${BOOK_MAX_WEIGHT}.`);

			const parsed = valibot.safeParse(bookRow, rest);
			if (!parsed.success)
				throw new Error(`Row ${rows}: ${parsed.issues[0].message}.`);

			const line = Buffer.from(JSON.stringify(parsed.output), "utf8");
			if (line.length > ROW_MAX_BYTES)
				throw new Error(
					`Row ${rows} is ${line.length} bytes, over the ${ROW_MAX_BYTES} a row may be.`
				);

			const record = {
				weight,
				payoutBp,
				lineOffset: blockBytes,
				lineLength: line.length,
				hash: hashOf(line)
			};

			lines.push(line);
			waiting.push(record);
			pager.add(record);
			blockBytes += line.length;
			rows += 1;
			totalWeight += weight;

			if (lines.length === BLOCK_ROWS) flush();
		},

		close() {
			if (closed) throw new Error("The book is closed.");

			closed = true;
			flush();
			pager.turn();

			try {
				if (rows === 0) throw new Error("A book needs at least one row.");

				const header = { rows, totalWeight };
				writeSync(indexFile, encodeHeader(header), 0, HEADER_BYTES, 0);

				return { ...header, digest: bookDigest(header, pager.pages) };
			} finally {
				closeSync(indexFile);
				closeSync(rowsFile);
			}
		}
	};
}

/** Reads exactly `length` bytes of a file from `position`. Throws if it ends first. */
function readExactly(file: number, position: number, length: number): Buffer {
	const bytes = Buffer.alloc(length);
	let have = 0;

	while (have < length) {
		const read = readSync(file, bytes, have, length - have, position + have);
		if (read === 0) throw new Error("The book's file ends before it should.");

		have += read;
	}

	return bytes;
}

/** How many records are read at once when an index is gone through. */
const READ_RECORDS = 4_096;

/**
 * Opens a table's files in `folder`. The whole index is gone through once: every weight
 * is checked and added up against the header, and the digest is worked out, so what the
 * book says of itself is known to be what its index holds. Each row's line is checked
 * against its hash when it is read.
 */
export function openBook(folder: string, table: string): Book {
	const paths = pathsOf(folder, table);
	const indexFile = openSync(paths.index, "r");
	const rowsFile = openSync(paths.rows, "r");

	/** Closes both files. */
	const close = () => {
		closeSync(indexFile);
		closeSync(rowsFile);
	};

	try {
		const header = decodeHeader(readExactly(indexFile, 0, HEADER_BYTES));
		const rowsBytes = fstatSync(rowsFile).size;

		if (fstatSync(indexFile).size !== HEADER_BYTES + header.rows * RECORD_BYTES)
			throw new Error("The index is not the length its header says.");

		const ends = new Float64Array(header.rows);
		const pager = createPager();
		let weight = 0;

		for (let first = 0; first < header.rows; first += READ_RECORDS) {
			const count = Math.min(READ_RECORDS, header.rows - first);
			const bytes = readExactly(
				indexFile,
				HEADER_BYTES + first * RECORD_BYTES,
				count * RECORD_BYTES
			);

			for (let offset = 0; offset < count; offset++) {
				const record = decodeRecord(bytes, offset * RECORD_BYTES);
				const row = first + offset;

				const problem =
					recordProblem(record.weight, record.payoutBp) ??
					placeProblem(record, rowsBytes);
				if (problem) throw new Error(`Row ${row}: ${problem}.`);

				weight += record.weight;
				ends[row] = weight;
				pager.add(record);
			}
		}

		pager.turn();
		if (weight !== header.totalWeight)
			throw new Error(
				`The rows weigh ${weight}, and the header says ${header.totalWeight}.`
			);

		/** One row's record, read from the index. */
		const record = (row: number): BookRecord => {
			if (!Number.isInteger(row) || row < 0 || row >= header.rows)
				throw new RangeError(`The book has no row ${row}.`);

			return decodeRecord(
				readExactly(indexFile, HEADER_BYTES + row * RECORD_BYTES, RECORD_BYTES)
			);
		};

		const book: Book = {
			...header,
			digest: bookDigest(header, pager.pages),
			pages: pager.pages,
			draw: (rng) => rowAt(ends, drawBelow(rng, header.totalWeight)),
			record,

			row(row) {
				const found = record(row);
				const block = inflateRawSync(
					readExactly(rowsFile, found.blockOffset, found.blockLength),
					{ maxOutputLength: BLOCK_ROWS * ROW_MAX_BYTES }
				);

				return lineIn(block, found, row);
			},

			leaves(page) {
				if (!Number.isInteger(page) || page < 0 || page >= pager.pages.length)
					throw new RangeError(`The book has no page ${page}.`);

				const first = page * PAGE_ROWS;
				const count = Math.min(PAGE_ROWS, header.rows - first);
				const bytes = readExactly(
					indexFile,
					HEADER_BYTES + first * RECORD_BYTES,
					count * RECORD_BYTES
				);
				const leaves = new Uint8Array(count * LEAF_BYTES);

				for (let offset = 0; offset < count; offset++)
					leaves.set(
						leafOf(decodeRecord(bytes, offset * RECORD_BYTES)),
						offset * LEAF_BYTES
					);

				return leaves;
			},

			scan(visit) {
				let blockOffset = -1;
				let block: Buffer = Buffer.alloc(0);

				for (let first = 0; first < header.rows; first += READ_RECORDS) {
					const count = Math.min(READ_RECORDS, header.rows - first);
					const bytes = readExactly(
						indexFile,
						HEADER_BYTES + first * RECORD_BYTES,
						count * RECORD_BYTES
					);

					for (let offset = 0; offset < count; offset++) {
						const found = decodeRecord(bytes, offset * RECORD_BYTES);
						const row = first + offset;

						if (found.blockOffset !== blockOffset) {
							blockOffset = found.blockOffset;
							block = inflateRawSync(
								readExactly(
									rowsFile,
									found.blockOffset,
									found.blockLength
								),
								{ maxOutputLength: BLOCK_ROWS * ROW_MAX_BYTES }
							);
						}

						visit(found, lineIn(block, found, row).row, row);
					}
				}
			},

			prove(row) {
				const page = Math.floor(row / PAGE_ROWS);

				return {
					rows: header.rows,
					totalWeight: header.totalWeight,
					pages: pager.pages,
					page,
					line: book.row(row).line,
					leaves: book.leaves(page)
				};
			},

			close
		};

		return book;
	} catch (error) {
		close();
		throw error;
	}
}

/**
 * A row's line in its block once opened, held to the hash its record gives and read.
 * Throws if the line is not there, is not the one the index was made from, or is not a row.
 */
function lineIn(block: Buffer, found: BookRecord, row: number): ReadRow {
	if (found.lineOffset + found.lineLength > block.length)
		throw new Error(`Row ${row} is not where the index says.`);

	const bytes = block.subarray(found.lineOffset, found.lineOffset + found.lineLength);
	if (!Buffer.from(hashOf(bytes)).equals(Buffer.from(found.hash)))
		throw new Error(`Row ${row} is not the row the index was made from.`);

	const line = bytes.toString("utf8");
	const parsed = valibot.safeParse(bookRow, JSON.parse(line));
	if (!parsed.success) throw new Error(`Row ${row}: ${parsed.issues[0].message}.`);

	return { record: found, line, row: parsed.output };
}

/** Why a record cannot point where it does in a rows file of `rowsBytes`, or `null`. */
function placeProblem(record: BookRecord, rowsBytes: number): string | null {
	const inFile =
		Number.isSafeInteger(record.blockOffset) &&
		record.blockOffset >= 0 &&
		record.blockLength > 0 &&
		record.blockOffset + record.blockLength <= rowsBytes;
	if (!inFile) return "its block is not in the rows file";

	if (record.lineLength < 1 || record.lineLength > ROW_MAX_BYTES)
		return `its line is ${record.lineLength} bytes, and a row is from 1 to ${ROW_MAX_BYTES}`;

	if (record.lineOffset + record.lineLength > BLOCK_ROWS * ROW_MAX_BYTES)
		return "its line is past the end of any block";

	if (record.hash.length !== HASH_BYTES) return "its hash is cut short";

	return null;
}

/** Where a game's summary of its books is kept: beside them. */
const summaryPath = (folder: string) => join(folder, "books.json");

/**
 * Writes `books.json` in a game's books folder: each table by name and what its writer
 * said it came to. It is small and is committed, where the books are not, so that books
 * made again from the same maths can be held to the digests they had.
 */
export function writeBooksSummary(
	folder: string,
	tables: Record<string, BookSummary>
): BooksSummary {
	const sorted = Object.fromEntries(
		Object.entries(tables).sort(([first], [second]) => first.localeCompare(second))
	);
	const summary = checkBooksSummary(summaryPath(folder), {
		version: BOOK_VERSION,
		tables: sorted
	});

	mkdirSync(folder, { recursive: true });
	writeFileSync(summaryPath(folder), `${JSON.stringify(summary, null, "\t")}\n`);

	return summary;
}

/** Reads and checks `books.json` in a game's books folder. Throws if it is missing. */
export function readBooksSummary(folder: string): BooksSummary {
	const file = summaryPath(folder);
	if (!existsSync(file)) throw new Error(`There is no books.json in ${folder}.`);

	return checkBooksSummary(file, JSON.parse(readFileSync(file, "utf8")));
}

/**
 * Opens every table a game's summary lists and holds each to it: the rows, the weight
 * and the digest the summary gives must be what the files hold. Throws, closing what it
 * had opened, at the first that is not. The site hands in the tables its listing
 * published, so that the books it plays from are the books it said it would.
 */
export function openBooks(
	folder: string,
	tables: BooksSummary["tables"] = readBooksSummary(folder).tables
): Record<string, Book> {
	const books: Record<string, Book> = {};

	try {
		for (const [table, expected] of Object.entries(tables)) {
			const book = openBook(folder, table);
			books[table] = book;

			const same =
				book.rows === expected.rows &&
				book.totalWeight === expected.totalWeight &&
				book.digest === expected.digest;
			if (!same)
				throw new Error(
					`The book "${table}" is not the one it was said to be: its rows, weight or digest differ.`
				);
		}

		return books;
	} catch (error) {
		for (const book of Object.values(books)) book.close();
		throw error;
	}
}

/** Reads and checks `game.json` in a game's folder. Throws if it is missing or wrong. */
export function readGameManifest(folder: string): GameManifest {
	const file = join(folder, "game.json");
	if (!existsSync(file)) throw new Error(`There is no game.json in ${folder}.`);

	return checkGameManifest(file, JSON.parse(readFileSync(file, "utf8")));
}

/** A game's folder, checked: its manifest, what its books come to, and what the check found. */
export interface CheckedGame {
	game: GameManifest;
	books: BooksSummary;
	check: BooksCheck;
}

/**
 * Checks a game played from books, from its folder: `game.json`, and `books/` beside it.
 * Throws if either cannot be read or the books are not those `books.json` describes;
 * what the check itself finds wrong is in `check.problems`. The books may be somewhere
 * other than beside the game, for books made to be looked at and thrown away.
 */
export function checkGameFolder(
	folder: string,
	booksFolder = join(folder, "books")
): CheckedGame {
	const game = readGameManifest(folder);
	const summary = readBooksSummary(booksFolder);
	const books = openBooks(booksFolder);

	try {
		return { game, books: summary, check: checkBooks(game, books) };
	} finally {
		for (const book of Object.values(books)) book.close();
	}
}

/** Beside a game's books: what their last check found, so they are not read through again. Not committed. */
const CHECKED_FILE = "checked.json";

/**
 * What tells one making of a game's books from another without reading them: its
 * manifest, the record of its books, and each book's size and when it was written.
 */
function booksKey(folder: string, tables: readonly string[]): string {
	const hash = createHash("sha256");

	for (const file of ["game.json", join("books", "books.json")])
		hash.update(file)
			.update("\0")
			.update(readFileSync(join(folder, file)))
			.update("\0");

	for (const table of [...tables].sort())
		for (const kind of ["index", "rows"]) {
			const stat = statSync(join(folder, "books", `${table}.${kind}`));

			hash.update(`${table}.${kind} ${stat.size} ${stat.mtimeMs}\0`);
		}

	return hash.digest("hex");
}

/**
 * The check of a game's books, as `checkGameFolder` makes it, kept beside the books and
 * used again while they are the books it was made on. The check reads every row of every
 * table, which takes a while for a large game: what plays a game over and over on one
 * machine (`dev`, a story) need not do it each time it starts. What lists a game, or
 * checks it for the site, always reads the books through.
 */
function checkedOnce(folder: string): CheckedGame {
	const game = readGameManifest(folder);
	const summary = readBooksSummary(join(folder, "books"));
	const file = join(folder, "books", CHECKED_FILE);
	let key: string | undefined;

	try {
		key = booksKey(folder, Object.keys(summary.tables));

		const kept = JSON.parse(readFileSync(file, "utf8")) as {
			key: string;
			check: BooksCheck;
		};
		if (kept.key === key && kept.check.passed)
			return { game, books: summary, check: kept.check };
	} catch {
		// Nothing kept, or books not there to take a key from: the check says which.
	}

	const checked = checkGameFolder(folder);

	try {
		if (key && checked.check.passed)
			writeFileSync(file, JSON.stringify({ key, check: checked.check }));
	} catch {
		// Kept only to save time: a folder that cannot be written to is checked each time.
	}

	return checked;
}

/**
 * A game played from books, loaded from its folder as the round game the site plays: its
 * manifest, and its books, which must pass the check (made once for each making of them,
 * and kept). The books stay open for as long as the game is played. For
 * `keros3ne-studio dev`, which plays it against a stand-in, and for stories.
 */
export function loadBookGame(folder: string, studio: string): BookGame {
	const checked = checkedOnce(folder);
	if (!checked.check.passed)
		throw new Error(
			`${checked.game.slug}'s books do not pass the check: ${checked.check.problems.join("; ")}`
		);

	const books = openBooks(join(folder, "books"));

	return bookGame(
		{ game: checked.game, tables: checked.books.tables, modes: checked.check.modes },
		studio,
		() => books
	);
}
