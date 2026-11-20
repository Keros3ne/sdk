/**
 * Packing a game: a version of it as the one file a studio sends (the engine's
 * `game-package.ts` says what is in it and how a site installs it).
 *
 *   stormglass-1.7.0.tar.gz
 *     release.json   what the package holds, every file by its size and digest
 *     game.json      the game's manifest
 *     guide.json     its rules and paytable
 *     card.svg       the picture a site lists it under (client/public/card.svg)
 *     client/        the client as it was built: every file of client/dist
 *     assets/        what else the game is made of, where its folder has an `assets`
 *     maths/         what the maths made: books.json, and each table's .index and .rows
 *
 * Neither a game's books nor its built client is committed, so this file is all of the
 * game that leaves a studio: no site sees the repository it was made in. Before anything
 * is packed, the books are held to the whole check and the built client to its record
 * (./client-record.ts), so what is packed is what the studio's own records say it made.
 *
 * Author: dwclake
 * Created: 2026-11-20
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { checkGameFolder } from "./book-files.ts";
import {
	builtOnClones,
	checkBuiltClient,
	filesIn,
	readClientRecord
} from "./client-record.ts";
import { packedName, writePackage, type PackedFile } from "./game-package.ts";

export { packedName };

/** The two files a table is kept in. */
const PARTS = ["index", "rows"] as const;

/** The files a game's books are kept in, given its tables: `spin.index`, `spin.rows`. */
export function bookFiles(tables: readonly string[]): string[] {
	return tables.flatMap((table) => PARTS.map((part) => `${table}.${part}`));
}

/** What packing a game made: the file's name, and its own size and digest. */
export interface Packed {
	name: string;
	version: string;
	sha256: string;
	size: number;
}

/**
 * Packs a game into `into`: the one file to send. Throws if its books are not there or do
 * not pass the check, if its built client is not the one on record, or if it lacks its
 * guide or its card.
 */
export async function packGame(
	gameFolder: string,
	slug: string,
	into: string,
	options: {
		/** Pack a client built on clones too: for trying a game, never for one to publish. */
		trial?: boolean;
	} = {}
): Promise<Packed> {
	const { game, books, check } = checkGameFolder(gameFolder);
	if (game.slug !== slug)
		throw new Error(`${slug}'s game.json names it "${game.slug}".`);
	if (check.problems.length > 0)
		throw new Error(
			`${slug}'s books do not pass the check: ${check.problems.join("; ")}`
		);

	const problems = checkBuiltClient(gameFolder);
	if (problems.length > 0) throw new Error(`${slug}: ${problems.join("; ")}`);

	const clones = builtOnClones(gameFolder);
	if (clones && !options.trial) throw new Error(`${slug}: ${clones}`);

	const card = join(gameFolder, "client", "public", "card.svg");
	for (const [file, what] of [
		[join(gameFolder, "guide.json"), "guide.json beside its game.json"],
		[card, "client/public/card.svg, the picture a site lists it under"]
	])
		if (!existsSync(file)) throw new Error(`${slug} has no ${what}.`);

	const dist = join(gameFolder, "client", "dist");
	const assets = join(gameFolder, "assets");
	const made = join(gameFolder, "books");
	const record = readClientRecord(gameFolder);

	// What is small and read first at the front; the books, which are most of it, last.
	const files: PackedFile[] = [
		{ name: "game.json", file: join(gameFolder, "game.json") },
		{ name: "guide.json", file: join(gameFolder, "guide.json") },
		{ name: "card.svg", file: card },
		...filesIn(dist).map((file) => ({
			name: `client/${file}`,
			file: join(dist, file)
		})),
		...(existsSync(assets)
			? filesIn(assets).map((file) => ({
					name: `assets/${file}`,
					file: join(assets, file)
				}))
			: []),
		...["books.json", ...bookFiles(Object.keys(books.tables))].map((file) => ({
			name: `maths/${file}`,
			file: join(made, file)
		}))
	];

	const packed = await writePackage(
		into,
		{
			slug,
			version: game.version,
			sdk: record.sdk,
			protocol: record.protocol,
			...(record.conditions?.length ? { conditions: record.conditions } : {})
		},
		files
	);

	return { ...packed, version: game.version };
}
