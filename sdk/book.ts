/**
 * A book: one table of a studio game's outcomes, worked out on the studio's machine and
 * shipped as data. The site draws a row from a bet's seeds and plays it; it never runs the
 * maths that made the book. This file is the format, and it is pure: the site reads a book
 * with it on the server and checks a bet against one in the player's browser.
 *
 * A table is two files, `<table>.index` and `<table>.rows`:
 *
 * - the rows file holds each row as a line of JSON (`BookRow`: the events that play the
 *   row out, and a choice if it ends in one), in blocks of `BLOCK_ROWS` lines, each block
 *   compressed on its own (raw deflate), so one row is read without the rest;
 * - the index is a header and one fixed record for each row: its weight, what it pays,
 *   where its line is, and the SHA-256 of that line.
 *
 * A book's digest is what the site publishes before any bet is placed. It covers every
 * row's weight, payout and line, in pages of `PAGE_ROWS` rows, so a browser can check one
 * row against it with that row's page and the list of pages, not the whole index.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import * as valibot from "valibot";
import type { Rng } from "./rng.ts";

/** The first four bytes of every index. */
export const BOOK_MAGIC = "K3BK";
/** The format's version: it goes up when a book written before would be misread. */
export const BOOK_VERSION = 1;

export const HEADER_BYTES = 32;
export const RECORD_BYTES = 72;
/** What of a record the digest covers: weight, payout and the line's hash. */
export const LEAF_BYTES = 48;
export const HASH_BYTES = 32;

/** How many rows are compressed together. */
export const BLOCK_ROWS = 64;
/**
 * How many rows one page of the digest covers. A browser is sent one page for each row it
 * checks and the list of pages once for each table: at 256 rows a page is 12 KB, and the
 * list for a million rows is 160 KB.
 */
export const PAGE_ROWS = 256;

/** The most rows a table may hold. */
export const BOOK_MAX_ROWS = 2 ** 21;
/** The longest a row's line may be, in bytes. */
export const ROW_MAX_BYTES = 131_072;
/** The most events one row may hold. */
export const ROW_MAX_EVENTS = 4_096;
/** The most options a choice may offer. */
export const CHOICE_MAX_OPTIONS = 8;
/** The most units it may take to fill a counter, and so the most a row may add to one. */
export const COUNTER_MAX_FULL = 1_000_000;
/** The most a table's weights may come to: whole numbers stay exact up to here. */
export const BOOK_MAX_WEIGHT = 2 ** 52;

/** What a table, a mode or an option is named: lowercase words joined by hyphens. */
export const BOOK_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const name = (what: string) =>
	valibot.pipe(
		valibot.string(),
		valibot.regex(BOOK_NAME, `${what} is lowercase words joined by hyphens`),
		valibot.maxLength(40)
	);

/**
 * A row's line: what the site reads of a row beyond its weight and payout. `events` are
 * the game's own, in the order the client plays them, each with a `type`. A row that ends
 * in a `choice` leaves the round open until the player picks an option, and the site then
 * draws a row from that option's table. `adds` is what the row puts into the game's
 * counters, the meters a game keeps between bets (./game-manifest.ts), by counter.
 */
export const bookRow = valibot.strictObject({
	events: valibot.pipe(
		valibot.array(valibot.looseObject({ type: valibot.string() })),
		valibot.maxLength(ROW_MAX_EVENTS)
	),
	adds: valibot.optional(
		valibot.record(
			name("A counter's id"),
			valibot.pipe(
				valibot.number(),
				valibot.integer("A row adds whole units to a counter"),
				valibot.minValue(1),
				valibot.maxValue(COUNTER_MAX_FULL)
			)
		)
	),
	choice: valibot.optional(
		valibot.pipe(
			valibot.array(
				valibot.strictObject({
					id: name("An option's id"),
					table: name("An option's table")
				})
			),
			valibot.minLength(2, "A choice offers at least two options"),
			valibot.maxLength(CHOICE_MAX_OPTIONS),
			valibot.check(
				(options) =>
					new Set(options.map((option) => option.id)).size === options.length,
				"A choice offers an option twice"
			)
		)
	)
});

export type BookRow = valibot.InferOutput<typeof bookRow>;

/** What an index starts with. */
export interface BookHeader {
	rows: number;
	totalWeight: number;
}

/** One row, as the index holds it. */
export interface BookRecord {
	/** A whole number, at least 1: the row is drawn this often in `totalWeight`. */
	weight: number;
	/** What the row pays, as a multiple of the bet in basis points. */
	payoutBp: number;
	/** Where the row's block starts in the rows file, and how long it is compressed. */
	blockOffset: number;
	blockLength: number;
	/** Where the row's line starts in its block once opened, and how long it is. */
	lineOffset: number;
	lineLength: number;
	/** The SHA-256 of the line. */
	hash: Uint8Array;
}

/** One page of the digest: the weight of every row before it, and the hash of its rows. */
export interface BookPage {
	start: number;
	hash: Uint8Array;
}

/** What a book comes to: what the site publishes of it. */
export interface BookSummary {
	rows: number;
	totalWeight: number;
	/** In hex. */
	digest: string;
}

/** Whether a figure is a whole number from `least` up that arithmetic keeps exact. */
const isWhole = (value: number, least: number) =>
	Number.isSafeInteger(value) && value >= least;

/** Why a row's weight or payout cannot go in a book, or `null` if they can. */
export function recordProblem(weight: number, payoutBp: number): string | null {
	if (!isWhole(weight, 1) || weight > BOOK_MAX_WEIGHT)
		return `a row's weight is a whole number from 1 to ${BOOK_MAX_WEIGHT}, not ${weight}`;

	if (!isWhole(payoutBp, 0))
		return `a row pays a whole number of basis points, not ${payoutBp}`;

	return null;
}

/** An index's header, as bytes. */
export function encodeHeader(header: BookHeader): Uint8Array {
	const bytes = new Uint8Array(HEADER_BYTES);
	const view = new DataView(bytes.buffer);

	bytes.set(utf8ToBytes(BOOK_MAGIC), 0);
	view.setUint32(4, BOOK_VERSION, true);
	view.setUint32(8, header.rows, true);
	view.setUint32(12, BLOCK_ROWS, true);
	view.setFloat64(16, header.totalWeight, true);

	return bytes;
}

/** An index's header, read. Throws if the bytes are not the start of a book this reads. */
export function decodeHeader(bytes: Uint8Array): BookHeader {
	if (bytes.length < HEADER_BYTES)
		throw new Error("The index is too short to be a book.");

	const view = new DataView(bytes.buffer, bytes.byteOffset, HEADER_BYTES);
	const magic = String.fromCharCode(...bytes.subarray(0, 4));
	if (magic !== BOOK_MAGIC) throw new Error("The index is not a book's.");

	const version = view.getUint32(4, true);
	if (version !== BOOK_VERSION)
		throw new Error(
			`The book is version ${version}, and this reads ${BOOK_VERSION}.`
		);

	const rows = view.getUint32(8, true);
	const totalWeight = view.getFloat64(16, true);
	if (rows < 1 || rows > BOOK_MAX_ROWS)
		throw new Error(`A book holds from 1 to ${BOOK_MAX_ROWS} rows, not ${rows}.`);

	if (!isWhole(totalWeight, rows) || totalWeight > BOOK_MAX_WEIGHT)
		throw new Error(`The book's weights cannot come to ${totalWeight}.`);

	return { rows, totalWeight };
}

/** A row's record, as bytes. */
export function encodeRecord(record: BookRecord): Uint8Array {
	const bytes = new Uint8Array(RECORD_BYTES);
	const view = new DataView(bytes.buffer);

	view.setFloat64(0, record.weight, true);
	view.setFloat64(8, record.payoutBp, true);
	view.setFloat64(16, record.blockOffset, true);
	view.setUint32(24, record.blockLength, true);
	view.setUint32(28, record.lineOffset, true);
	view.setUint32(32, record.lineLength, true);
	bytes.set(record.hash, 40);

	return bytes;
}

/** A row's record, read from `RECORD_BYTES` bytes starting at `offset`. */
export function decodeRecord(bytes: Uint8Array, offset = 0): BookRecord {
	const view = new DataView(bytes.buffer, bytes.byteOffset + offset, RECORD_BYTES);

	return {
		weight: view.getFloat64(0, true),
		payoutBp: view.getFloat64(8, true),
		blockOffset: view.getFloat64(16, true),
		blockLength: view.getUint32(24, true),
		lineOffset: view.getUint32(28, true),
		lineLength: view.getUint32(32, true),
		// Copied as plain bytes, whatever kind of array they were read into.
		hash: Uint8Array.from(bytes.subarray(offset + 40, offset + 40 + HASH_BYTES))
	};
}

/** What the digest covers of a row: its weight, its payout and its line's hash. */
export function leafOf(
	record: Pick<BookRecord, "weight" | "payoutBp" | "hash">
): Uint8Array {
	const bytes = new Uint8Array(LEAF_BYTES);
	const view = new DataView(bytes.buffer);

	view.setFloat64(0, record.weight, true);
	view.setFloat64(8, record.payoutBp, true);
	bytes.set(record.hash, 16);

	return bytes;
}

/** The SHA-256 of a row's line. */
export const hashLine = (line: string): Uint8Array => sha256(utf8ToBytes(line));

/** The hash of one page: of its rows' leaves, one after another. */
export const hashPage = (leaves: Uint8Array): Uint8Array => sha256(leaves);

/** A book's digest, in hex: over how many rows it has, what they weigh and every page. */
export function bookDigest(header: BookHeader, pages: readonly BookPage[]): string {
	const hasher = sha256.create();
	const figures = new Uint8Array(12);
	const view = new DataView(figures.buffer);

	view.setUint32(0, header.rows, true);
	view.setFloat64(4, header.totalWeight, true);
	hasher.update(utf8ToBytes(`keros3ne-book/${BOOK_VERSION}`));
	hasher.update(figures);

	for (const page of pages) {
		const start = new Uint8Array(8);

		new DataView(start.buffer).setFloat64(0, page.start, true);
		hasher.update(start);
		hasher.update(page.hash);
	}

	return bytesToHex(hasher.digest());
}

/** The most times a draw is made again for landing past the total. Never reached. */
const DRAW_ATTEMPTS = 128;
/** `rng.int` is exactly even up to this many bits: its 32 are cut down, never stretched. */
const DRAW_BITS = 26;

/**
 * A whole number from 0 up to, not including, `total`, each exactly as likely as the
 * next. `rng.int(total)` is not: it has 32 bits to share out, which does not divide
 * evenly, and a book's return is summed on the promise that a row is drawn exactly as
 * often as its weight says. So this draws just enough bits to cover `total`, in two
 * parts, and draws again whenever they land past it: less than once in two.
 */
export function drawBelow(rng: Rng, total: number): number {
	if (!isWhole(total, 1) || total > BOOK_MAX_WEIGHT)
		throw new RangeError(`A draw is from 1 to ${BOOK_MAX_WEIGHT}, not ${total}.`);

	let bits = 0;
	while (2 ** bits < total) bits++;

	if (bits === 0) return 0;

	const lowBits = Math.min(bits, DRAW_BITS);
	const highBits = bits - lowBits;
	let value = 0;

	for (let attempt = 0; attempt < DRAW_ATTEMPTS; attempt++) {
		const high = highBits > 0 ? rng.int(2 ** highBits) : 0;
		const low = rng.int(2 ** lowBits);

		value = high * 2 ** lowBits + low;
		if (value < total) return value;
	}

	// One chance in 2^128 at most. A draw must still end, and end the same way twice.
	return value % total;
}

/**
 * Which row a drawn number falls on. `ends[row]` is the weight of every row up to and
 * including that one, so a row owns the numbers from the end before it up to its own.
 */
export function rowAt(ends: ArrayLike<number>, drawn: number): number {
	let low = 0;
	let high = ends.length - 1;

	while (low < high) {
		const middle = Math.floor((low + high) / 2);

		if (ends[middle] > drawn) high = middle;
		else low = middle + 1;
	}

	return low;
}
