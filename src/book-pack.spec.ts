/**
 * Books as the files of a release: that what a studio packs is what the site unpacks,
 * held to the game's record, and that books that are not the ones recorded are refused
 * and not left behind.
 *
 * Author: dwclake
 * Created: 2026-11-19
 */

import {
	cpSync,
	createReadStream,
	existsSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeBooks } from "./book-maker.ts";
import { packBooks, packedFiles, unpackBooks } from "./book-pack.ts";

const game = fileURLToPath(new URL("./test/book-studio/gem-drop", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "keros3ne-pack-"));
const studio = join(scratch, "studio", "gem-drop");
const release = join(scratch, "release");
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** The game as the site has it from a repository: its manifest and its books' record. */
function received(name: string): string {
	const folder = join(scratch, name, "gem-drop");

	cpSync(join(studio, "game.json"), join(folder, "game.json"));
	cpSync(join(studio, "books", "books.json"), join(folder, "books", "books.json"));

	return folder;
}

beforeAll(async () => {
	// The maths plays where it is, in the SDK; its books are made into a folder of the test's.
	cpSync(join(game, "game.json"), join(studio, "game.json"));
	await makeBooks(game, { books: join(studio, "books"), workers: 0 });
	await packBooks(studio, release);
});

describe("a game's books, packed for a release", () => {
	it("are two files for each table, named for the game", () => {
		const tables = ["spin", "bought", "bonus-steady", "bonus-wild", "gem-pour"];

		expect(readdirSync(release).sort()).toEqual(
			packedFiles("gem-drop", tables)
				.map((each) => each.packed)
				.sort()
		);
		expect(packedFiles("gem-drop", ["spin"])).toEqual([
			{ file: "spin.index", packed: "gem-drop.spin.index.gz" },
			{ file: "spin.rows", packed: "gem-drop.spin.rows.gz" }
		]);
	});

	it("unpack into the books that were packed, and pass the check", async () => {
		const folder = received("site");
		const checked = await unpackBooks(folder, "gem-drop", (packed) =>
			createReadStream(join(release, packed))
		);

		expect(checked.check.problems).toEqual([]);
		for (const file of ["spin.index", "spin.rows", "gem-pour.rows"])
			expect(readFileSync(join(folder, "books", file))).toEqual(
				readFileSync(join(studio, "books", file))
			);
	});

	it("are refused, and not kept, when they are not the books recorded", async () => {
		const folder = received("swapped");
		// Another table's rows under this one's name: well formed, and not what was recorded.
		const open = (packed: string) =>
			createReadStream(join(release, packed.replace(".spin.", ".bought.")));

		await expect(unpackBooks(folder, "gem-drop", open)).rejects.toThrow();
		expect(readdirSync(join(folder, "books"))).toEqual(["books.json"]);
	});

	it("are refused when a file is missing or is not what it says, with nothing kept", async () => {
		const missing = received("missing");
		const open = (packed: string) => {
			if (packed.includes("gem-pour"))
				throw new Error(`The release has no ${packed}.`);

			return createReadStream(join(release, packed));
		};

		await expect(unpackBooks(missing, "gem-drop", open)).rejects.toThrow(
			/has no gem-drop.gem-pour/
		);
		expect(readdirSync(join(missing, "books"))).toEqual(["books.json"]);

		const wrong = received("wrong");
		const junk = join(scratch, "junk.gz");
		writeFileSync(junk, gzipSync("not a book"));

		await expect(
			unpackBooks(wrong, "gem-drop", () => createReadStream(junk))
		).rejects.toThrow();
		expect(readdirSync(join(wrong, "books"))).toEqual(["books.json"]);
		expect(existsSync(join(wrong, "books", "spin.index"))).toBe(false);
	});
});
