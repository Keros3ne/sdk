/**
 * A game's books as the files of a release. Books are not committed (they are tens of
 * megabytes a game): a studio packs them, one compressed file for each file of each
 * table, and sends them with the tag. The site unpacks them beside the game's
 * `books/books.json`, which it has from the repository, and holds them to that record:
 * the books it plays from are the ones the studio's maths made, and it never runs the
 * maths to find out.
 *
 * Author: dwclake
 * Created: 2026-11-19
 */

import {
	createReadStream,
	createWriteStream,
	mkdirSync,
	renameSync,
	rmSync
} from "node:fs";
import { join } from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip, createGzip } from "node:zlib";
import { checkGameFolder, readBooksSummary, type CheckedGame } from "./book-files.ts";

/** The two files a table is kept in. */
const PARTS = ["index", "rows"] as const;

/** One file of a game's books, as it is kept and as a release names it. */
export interface PackedFile {
	/** Its name in the game's `books` folder: `spin.index`. */
	file: string;
	/** Its name among a release's files: `gem-drop.spin.index.gz`. */
	packed: string;
}

/** The files a release holds for a game with these tables. */
export function packedFiles(slug: string, tables: readonly string[]): PackedFile[] {
	return tables.flatMap((table) =>
		PARTS.map((part) => ({
			file: `${table}.${part}`,
			packed: `${slug}.${table}.${part}.gz`
		}))
	);
}

/**
 * Packs a game's books, checked first, into `into`: the files to send with a release.
 * Returns their names. Throws if the books are not there or do not pass the check.
 */
export async function packBooks(gameFolder: string, into: string): Promise<string[]> {
	const { game, books, check } = checkGameFolder(gameFolder);
	if (check.problems.length > 0)
		throw new Error(
			`${game.slug}'s books do not pass the check: ${check.problems.join("; ")}`
		);

	mkdirSync(into, { recursive: true });

	const files = packedFiles(game.slug, Object.keys(books.tables));
	for (const { file, packed } of files)
		await pipeline(
			createReadStream(join(gameFolder, "books", file)),
			createGzip(),
			createWriteStream(join(into, packed))
		);

	return files.map((each) => each.packed);
}

/**
 * Unpacks a game's books from a release beside the record the game's folder holds
 * (`books/books.json`), and runs the whole check on them: every row read, each table's
 * rows, weight and digest held to the record, each mode's return summed. `open` gives a
 * packed file's bytes by its name.
 *
 * The books are written under other names and put in place only once all of them have
 * come; if the check fails they are taken away again, and it throws.
 */
export async function unpackBooks(
	gameFolder: string,
	slug: string,
	open: (packed: string) => Promise<Readable> | Readable
): Promise<CheckedGame> {
	const books = join(gameFolder, "books");
	const files = packedFiles(slug, Object.keys(readBooksSummary(books).tables));
	const coming = (file: string) => join(books, `${file}.coming`);

	try {
		for (const { file, packed } of files)
			await pipeline(
				await open(packed),
				createGunzip(),
				createWriteStream(coming(file))
			);
	} catch (error) {
		for (const { file } of files) rmSync(coming(file), { force: true });
		throw error;
	}

	for (const { file } of files) renameSync(coming(file), join(books, file));

	const remove = () => {
		for (const { file } of files) rmSync(join(books, file), { force: true });
		rmSync(join(books, "checked.json"), { force: true });
	};

	let checked: CheckedGame;
	try {
		checked = checkGameFolder(gameFolder);
	} catch (error) {
		remove();
		throw error;
	}

	if (checked.check.problems.length > 0) {
		remove();
		throw new Error(
			`${slug}'s books are not the ones its record names, or do not pass the check: ${checked.check.problems.join("; ")}`
		);
	}

	return checked;
}
