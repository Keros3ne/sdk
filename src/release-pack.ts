/**
 * A game as the one file of a release. Neither a game's books nor its built client is
 * committed (books are tens of megabytes a game, and a client is made, not written): a
 * studio packs both into one archive for each game, `<slug>.tar.gz`, and sends it with
 * the tag. In it are two folders and nothing else:
 *
 *   client/   the client as it was built: every file of `client/dist`, in its place
 *   maths/    what the maths made: `books.json`, and each table's `.index` and `.rows`
 *
 * So a release is one file to a game, which `tar -xzf` opens. The site unpacks it beside
 * the records it has from the repository (`books/books.json`, `client/client.json`) and
 * holds every file to them: the books it plays from are the ones the studio's maths made,
 * the client it serves is the one the studio built, and it never runs the maths or builds
 * the client to find out. The archive's own `books.json` is for whoever opens it by hand;
 * the site goes by the repository's.
 *
 * Author: dwclake
 * Created: 2026-11-20
 */

import {
	createReadStream,
	createWriteStream,
	mkdirSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync
} from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip, createGzip } from "node:zlib";
import { checkGameFolder, readBooksSummary, type CheckedGame } from "./book-files.ts";
import {
	builtOnClones,
	checkBuiltClient,
	digest,
	filesIn,
	readClientRecord,
	type ClientRecord
} from "./client-record.ts";
import { tarBytes, tarEntries, type TarFile } from "./tar.ts";

/** The folder of an archive its built client is in. */
const CLIENT = "client/";

/** The folder of an archive its books are in. */
const MATHS = "maths/";

/** The record of a game's books, which travels with them. */
const BOOKS_RECORD = "books.json";

/** The two files a table is kept in. */
const PARTS = ["index", "rows"] as const;

/**
 * The most one file of a built client may come to. A client's files are held in memory
 * until every one has been held to its record.
 */
const MOST_CLIENT_FILE_BYTES = 100_000_000;

/** The name of a game's archive among a release's files: `gem-drop.tar.gz`. */
export function packedGame(slug: string): string {
	return `${slug}.tar.gz`;
}

/** The files a game's books are kept in, given its tables: `spin.index`, `spin.rows`. */
export function bookFiles(tables: readonly string[]): string[] {
	return tables.flatMap((table) => PARTS.map((part) => `${table}.${part}`));
}

/** A file on disk as a file of an archive, at this place in it. */
function fromDisk(name: string, file: string): TarFile {
	return { name, size: statSync(file).size, bytes: () => createReadStream(file) };
}

/**
 * Packs a game into `into`: its books, checked first, and its built client, held to its
 * record first, as the one file to send with a release. Returns the file's name. Throws
 * if the books are not there or do not pass the check, or the client is not the one
 * recorded.
 */
export async function packGame(
	gameFolder: string,
	slug: string,
	into: string,
	options: {
		/** Pack a client built on clones too: for taking a game in on trial, never for a release. */
		trial?: boolean;
	} = {}
): Promise<string> {
	const { books, check } = checkGameFolder(gameFolder);
	if (check.problems.length > 0)
		throw new Error(
			`${slug}'s books do not pass the check: ${check.problems.join("; ")}`
		);

	const problems = checkBuiltClient(gameFolder);
	if (problems.length > 0) throw new Error(`${slug}: ${problems.join("; ")}`);

	const clones = builtOnClones(gameFolder);
	if (clones && !options.trial) throw new Error(`${slug}: ${clones}`);

	// The client first: it is small, and whoever wants it alone need read no further.
	const dist = join(gameFolder, "client", "dist");
	const made = join(gameFolder, "books");
	const files = [
		...filesIn(dist).map((file) => fromDisk(`${CLIENT}${file}`, join(dist, file))),
		...[BOOKS_RECORD, ...bookFiles(Object.keys(books.tables))].map((file) =>
			fromDisk(`${MATHS}${file}`, join(made, file))
		)
	];

	// Written beside its place, and put there only once all of it has been.
	mkdirSync(into, { recursive: true });
	const packed = join(into, packedGame(slug));
	const coming = `${packed}.coming`;

	try {
		await pipeline(
			Readable.from(tarBytes(files)),
			createGzip(),
			createWriteStream(coming)
		);
		renameSync(coming, packed);
	} finally {
		rmSync(coming, { force: true });
	}

	return packedGame(slug);
}

/** What to take out of a game's archive. */
export interface Wanted {
	/** Its books, into the game's `books` folder. */
	books?: boolean;
	/** Its built client, into the game's `client/dist`. */
	client?: boolean;
}

/** What was taken out of a game's archive and held to its record. */
export interface Unpacked {
	/** Its books as the check found them, where they were asked for. */
	books?: CheckedGame;
	/** The record its client was held to, where it was asked for. */
	client?: ClientRecord;
}

/**
 * Unpacks a game from a release beside the records the game's folder holds of it
 * (`books/books.json`, `client/client.json`), both its books and its client unless `want`
 * says which. `open` gives a file of the release, as bytes, by its name.
 *
 * Its books are held to their record by the whole check: every row read, each table's
 * rows, weight and digest held to the record, each mode's return summed. Its client is
 * held to its record file for file: exactly the files recorded, each with the digest
 * recorded. Nothing is put in place unless all of what was asked for is as recorded, and
 * nothing is written outside the game's folder whatever the archive names. A client
 * already there is replaced. Throws, with nothing kept, at an archive that holds anything
 * else, lacks a file, or is not what the records name.
 */
export async function unpackGame(
	gameFolder: string,
	slug: string,
	open: (packed: string) => Promise<Readable> | Readable,
	want: Wanted = { books: true, client: true }
): Promise<Unpacked> {
	const books = join(gameFolder, "books");
	const dist = join(gameFolder, "client", "dist");
	const record = want.client ? readClientRecord(gameFolder) : null;

	/** The files of its books still to come, and of its client. */
	const tables = want.books
		? bookFiles(Object.keys(readBooksSummary(books).tables))
		: [];
	const booksToCome = new Set(tables);
	const clientToCome = new Set(Object.keys(record?.files ?? {}));

	const coming = (file: string) => join(books, `${file}.coming`);
	const client = new Map<string, Buffer>();
	const seen = new Set<string>();

	/** Why the archive is not this game's release. */
	const refused = (why: string) =>
		new Error(
			`${packedGame(slug)} is not the release ${slug}'s records name: ${why}`
		);

	try {
		const source = await open(packedGame(slug));
		const unzipped = createGunzip();
		// Whatever stops either end stops the other; why is told by the reading below.
		void pipeline(source, unzipped).catch(() => {});

		try {
			for await (const entry of tarEntries(unzipped)) {
				if (seen.has(entry.name)) throw refused(`it holds ${entry.name} twice.`);
				seen.add(entry.name);

				if (entry.name.startsWith(CLIENT)) {
					if (!record) continue;

					const file = entry.name.slice(CLIENT.length);
					if (!clientToCome.delete(file))
						throw refused(`its client's files are not the ones recorded.`);
					if (entry.size > MOST_CLIENT_FILE_BYTES)
						throw refused(`its client's ${file} is too large.`);

					const parts: Buffer[] = [];
					for await (const part of entry.bytes()) parts.push(part);

					const bytes = Buffer.concat(parts);
					if (digest(bytes) !== record.files[file])
						throw refused(`its client's ${file} is not the file recorded.`);

					client.set(file, bytes);
				} else if (entry.name === `${MATHS}${BOOKS_RECORD}`) {
					// For whoever opens the archive by hand: the site goes by the repository's.
				} else if (entry.name.startsWith(MATHS)) {
					if (!want.books) continue;

					const file = entry.name.slice(MATHS.length);
					if (!booksToCome.delete(file))
						throw refused(`its books have no ${file} on record.`);

					await pipeline(
						Readable.from(entry.bytes()),
						createWriteStream(coming(file))
					);
				} else
					throw refused(
						`it holds ${entry.name}, and a game's release is a client folder and a maths folder.`
					);

				// A client asked for alone is at the front: the books behind it need not be fetched.
				if (!want.books && clientToCome.size === 0) break;
			}
		} finally {
			source.destroy();
			unzipped.destroy();
		}

		const missing = [
			...[...booksToCome].map((file) => `${MATHS}${file}`),
			...[...clientToCome].map((file) => `${CLIENT}${file}`)
		];
		if (missing.length > 0)
			throw refused(
				`it has no ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? `, and ${missing.length - 5} more` : ""}.`
			);
	} catch (error) {
		for (const file of tables) rmSync(coming(file), { force: true });

		throw error;
	}

	const unpacked: Unpacked = {};

	if (want.books) {
		for (const file of tables) renameSync(coming(file), join(books, file));

		const remove = () => {
			for (const file of tables) rmSync(join(books, file), { force: true });
			rmSync(join(books, "checked.json"), { force: true });
		};

		try {
			unpacked.books = checkGameFolder(gameFolder);
		} catch (error) {
			remove();
			throw error;
		}

		if (unpacked.books.check.problems.length > 0) {
			remove();
			throw new Error(
				`${slug}'s books are not the ones its record names, or do not pass the check: ${unpacked.books.check.problems.join("; ")}`
			);
		}
	}

	if (record) {
		// Written beside its place, and put there only once all of it has been.
		const built = `${dist}.coming`;
		rmSync(built, { recursive: true, force: true });
		for (const [file, bytes] of client) {
			mkdirSync(dirname(join(built, file)), { recursive: true });
			writeFileSync(join(built, file), bytes);
		}
		rmSync(dist, { recursive: true, force: true });
		renameSync(built, dist);

		unpacked.client = record;
	}

	return unpacked;
}
