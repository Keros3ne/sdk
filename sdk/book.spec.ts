/**
 * Books: that a table written is the table read, that its digest is of its contents and
 * nothing else, that a draw lands on each row exactly as often as its weight says, and
 * that a file changed after it was written is refused.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
	BLOCK_ROWS,
	HEADER_BYTES,
	LEAF_BYTES,
	PAGE_ROWS,
	RECORD_BYTES,
	bookDigest,
	decodeRecord,
	drawBelow,
	encodeRecord,
	hashLine,
	hashPage,
	leafOf,
	rowAt
} from "./book.ts";
import { createBookWriter, openBook, type NewRow } from "./book-files.ts";
import { createRng, type Rng } from "./rng.ts";

const folder = mkdtempSync(join(tmpdir(), "keros3ne-book-"));
afterAll(() => rmSync(folder, { recursive: true, force: true }));

/** A row of a made-up slot: what it pays depends on its number, so rows differ. */
const rowOf = (number: number): NewRow => ({
	weight: 1 + (number % 7),
	payoutBp: (number % 13) * 2_500,
	events: [
		{ type: "reveal", board: [number % 5, number % 3, number % 11] },
		{ type: "win", amountBp: (number % 13) * 2_500 }
	]
});

/** Writes `count` rows as a table and says what it came to. */
function write(
	table: string,
	count: number,
	change?: (row: NewRow, number: number) => NewRow
) {
	const writer = createBookWriter(folder, table);

	for (let number = 0; number < count; number++)
		writer.add(change ? change(rowOf(number), number) : rowOf(number));

	return writer.close();
}

/** A stream that hands back the numbers given, in order, whatever is asked for. */
function scripted(numbers: number[]): Rng {
	const left = [...numbers];
	const next = () => {
		const value = left.shift();
		if (value === undefined) throw new Error("The script ran out.");

		return value;
	};

	return { float: next, int: next, shuffle: (items) => [...items] };
}

// More than two pages of the digest, and a last block that is not full.
const ROWS = PAGE_ROWS * 2 + BLOCK_ROWS + 5;

describe("a book written and read", () => {
	const summary = write("spin", ROWS);

	it("comes to its rows and their weights", () => {
		let weight = 0;
		for (let number = 0; number < ROWS; number++) weight += rowOf(number).weight;

		expect(summary.rows).toBe(ROWS);
		expect(summary.totalWeight).toBe(weight);
	});

	it("reads back every row as it was written", () => {
		const book = openBook(folder, "spin");

		for (let number = 0; number < ROWS; number++) {
			const { weight, payoutBp, ...row } = rowOf(number);
			const read = book.row(number);

			expect(read.record.weight).toBe(weight);
			expect(read.record.payoutBp).toBe(payoutBp);
			expect(read.row).toEqual(row);
			expect(read.record.hash).toEqual(hashLine(read.line));
		}

		book.close();
	});

	it("has the digest the writer gave, made from its pages", () => {
		const book = openBook(folder, "spin");

		expect(book.digest).toBe(summary.digest);
		expect(book.pages).toHaveLength(3);
		expect(bookDigest(book, book.pages)).toBe(summary.digest);

		book.close();
	});

	it("lets one row be checked against the digest with its page alone", () => {
		const book = openBook(folder, "spin");
		const row = PAGE_ROWS + 17;
		const page = Math.floor(row / PAGE_ROWS);
		const leaves = book.leaves(page);
		const place = (row % PAGE_ROWS) * LEAF_BYTES;

		expect(hashPage(leaves)).toEqual(book.pages[page].hash);
		expect(leaves.slice(place, place + LEAF_BYTES)).toEqual(leafOf(book.record(row)));

		book.close();
	});

	it("has the same digest written again, and another if one weight changes", () => {
		expect(write("again", ROWS).digest).toBe(summary.digest);

		const changed = write("changed", ROWS, (row, number) =>
			number === PAGE_ROWS + 10 ? { ...row, weight: row.weight + 1 } : row
		);
		expect(changed.digest).not.toBe(summary.digest);
	});

	it("keeps a choice with its row", () => {
		const choice = [
			{ id: "squall", table: "storm-squall" },
			{ id: "gale", table: "storm-gale" }
		];
		const writer = createBookWriter(folder, "choice");
		writer.add({ weight: 1, payoutBp: 0, events: [{ type: "bonus" }], choice });
		writer.close();

		const book = openBook(folder, "choice");
		expect(book.row(0).row.choice).toEqual(choice);
		book.close();
	});
});

describe("a record", () => {
	it("is read as it was written", () => {
		const record = {
			weight: 2 ** 40 + 3,
			payoutBp: 50_000_000,
			blockOffset: 2 ** 33 + 7,
			blockLength: 9_000,
			lineOffset: 12_345,
			lineLength: 678,
			hash: hashLine("a line")
		};

		expect(decodeRecord(encodeRecord(record))).toEqual(record);
	});
});

describe("a draw", () => {
	it("draws again when it lands past the total", () => {
		// Five takes three bits, so 7 and 5 are past it.
		expect(drawBelow(scripted([7, 5, 2]), 5)).toBe(2);
		expect(drawBelow(scripted([4]), 5)).toBe(4);
	});

	it("covers a total that is one more than a power of two", () => {
		// 2^40 + 1 takes 41 bits: 15 high and 26 low. The last number is the highest.
		expect(drawBelow(scripted([2 ** 14, 0]), 2 ** 40 + 1)).toBe(2 ** 40);
	});

	it("needs no number at all when there is one thing to draw", () => {
		expect(drawBelow(scripted([]), 1)).toBe(0);
	});

	it("gives a row the numbers from the end before it up to its own", () => {
		const ends = [1, 4, 5, 12];

		expect([0, 1, 3, 4, 5, 11].map((drawn) => rowAt(ends, drawn))).toEqual([
			0, 1, 1, 2, 3, 3
		]);
	});

	it("lands on a row as often as it weighs", () => {
		const writer = createBookWriter(folder, "weights");
		for (const weight of [1, 3, 12]) writer.add({ weight, payoutBp: 0, events: [] });
		writer.close();

		const book = openBook(folder, "weights");
		const landed = [0, 0, 0];
		const draws = 32_000;

		for (let nonce = 0; nonce < draws; nonce++)
			landed[book.draw(createRng("server seed", "client seed", nonce))] += 1;
		book.close();

		// Within five standard deviations of 1, 3 and 12 in 16.
		expect(Math.abs(landed[0] - draws / 16)).toBeLessThan(220);
		expect(Math.abs(landed[1] - (draws * 3) / 16)).toBeLessThan(350);
		expect(Math.abs(landed[2] - (draws * 12) / 16)).toBeLessThan(390);
	});
});

describe("what a book refuses", () => {
	const writer = () => createBookWriter(folder, "refused");

	it("a weight that is not a whole number from 1", () => {
		expect(() => writer().add({ weight: 0, payoutBp: 0, events: [] })).toThrow(
			/weight/
		);
		expect(() => writer().add({ weight: 1.5, payoutBp: 0, events: [] })).toThrow(
			/weight/
		);
	});

	it("a payout that is not a whole number of basis points", () => {
		expect(() => writer().add({ weight: 1, payoutBp: 0.5, events: [] })).toThrow(
			/pays/
		);
		expect(() => writer().add({ weight: 1, payoutBp: -1, events: [] })).toThrow(
			/pays/
		);
	});

	it("a row that is too long, or has no events, or a choice of one", () => {
		const long = { type: "reveal", text: "x".repeat(140_000) };

		expect(() => writer().add({ weight: 1, payoutBp: 0, events: [long] })).toThrow(
			/bytes/
		);
		expect(() =>
			writer().add({ weight: 1, payoutBp: 0 } as unknown as NewRow)
		).toThrow();
		expect(() =>
			writer().add({
				weight: 1,
				payoutBp: 0,
				events: [],
				choice: [{ id: "only", table: "only" }]
			})
		).toThrow(/two options/);
	});

	it("a book with no rows, and a table with no name of its own", () => {
		expect(() => writer().close()).toThrow(/at least one row/);
		expect(() => createBookWriter(folder, "../elsewhere")).toThrow(
			/not a table's name/
		);
	});

	it("a row whose line was changed after it was written", () => {
		write("tampered", 10, (row) => ({
			...row,
			events: [{ type: "reveal", text: "aaaa" }]
		}));

		// Stored so small that the block is its own text: one letter of it is changed.
		const file = join(folder, "tampered.rows");
		const bytes = readFileSync(file);
		const other = createBookWriter(folder, "tampered-other");
		for (let number = 0; number < 10; number++)
			other.add({ ...rowOf(number), events: [{ type: "reveal", text: "aaab" }] });
		other.close();
		writeFileSync(file, readFileSync(join(folder, "tampered-other.rows")));

		const book = openBook(folder, "tampered");
		expect(bytes.equals(readFileSync(file))).toBe(false);
		expect(() => book.row(0)).toThrow(
			/not the row the index was made from|not where/
		);
		book.close();
	});

	it("an index cut short, or one whose weights do not come to its header's", () => {
		write("short", 100);
		const file = join(folder, "short.index");
		const bytes = readFileSync(file);

		writeFileSync(file, bytes.subarray(0, bytes.length - 10));
		expect(() => openBook(folder, "short")).toThrow(/length/);

		// The first row's weight, raised by one behind the header's back.
		const heavier = Buffer.from(bytes);
		heavier.writeDoubleLE(heavier.readDoubleLE(HEADER_BYTES) + 1, HEADER_BYTES);
		writeFileSync(file, heavier);
		expect(() => openBook(folder, "short")).toThrow(/header says/);

		// And a record that points past the end of the rows file.
		const astray = Buffer.from(bytes);
		astray.writeDoubleLE(1e9, HEADER_BYTES + RECORD_BYTES + 16);
		writeFileSync(file, astray);
		expect(() => openBook(folder, "short")).toThrow(/Row 1: its block/);
	});
});
