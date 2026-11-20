/**
 * A game as the one file of a release (./release-pack.ts): that it is one archive of a
 * client folder and a maths folder, that what a studio packs is what the site unpacks,
 * held to the game's records, and that what is not the release on record is refused and
 * not left behind.
 *
 * Author: dwclake
 * Created: 2026-11-20
 */

import { execFileSync } from "node:child_process";
import {
	cpSync,
	createReadStream,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeBooks } from "./book-maker.ts";
import { hasItsClient, writeClientRecord } from "./client-record.ts";
import { bookFiles, packGame, packedGame, unpackGame } from "./release-pack.ts";
import { tarBytes, type TarFile } from "./tar.ts";

const game = fileURLToPath(new URL("./test/book-studio/gem-drop", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "keros3ne-pack-"));
const studio = join(scratch, "studio", "gem-drop");
const release = join(scratch, "release");
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const TABLES = ["spin", "bought", "bonus-steady", "bonus-wild", "gem-pour"];

const BUILT: Record<string, string> = {
	"index.html": "<!doctype html><p>the game</p>",
	"card.svg": "<svg />",
	"_app/immutable/chunks/abc.js": "export const game = 1;"
};

/** The game as the site has it from a repository: its manifest and its two records. */
function received(name: string): string {
	const folder = join(scratch, name, "gem-drop");

	for (const file of ["game.json", "books/books.json", "client/client.json"])
		cpSync(join(studio, file), join(folder, file));

	return folder;
}

/** A release's files, from a folder of them. */
const from = (folder: string) => (packed: string) =>
	createReadStream(join(folder, packed));

/** The places of the files in an archive, as the system's `tar` lists them. */
const listed = (archive: string) =>
	execFileSync("tar", ["-tzf", archive], { encoding: "utf8" }).trim().split("\n");

/** A release whose archive of the game is these files: as one from outside might be. */
function sending(files: Record<string, string | Buffer>) {
	return async () => {
		const parts: Buffer[] = [];
		const each: TarFile[] = Object.entries(files).map(([name, bytes]) => ({
			name,
			size: Buffer.byteLength(bytes),
			bytes: () => [Buffer.from(bytes)]
		}));
		for await (const part of tarBytes(each)) parts.push(part);

		return Readable.from([gzipSync(Buffer.concat(parts))]);
	};
}

/** The game's own archive with some of its files changed, added or (`null`) left out. */
function changed(changes: Record<string, string | null>) {
	const files: Record<string, string | Buffer> = {};

	for (const [file, text] of Object.entries(BUILT)) files[`client/${file}`] = text;
	for (const file of ["books.json", ...bookFiles(TABLES)])
		files[`maths/${file}`] = readFileSync(join(studio, "books", file));
	for (const [name, text] of Object.entries(changes))
		if (text === null) delete files[name];
		else files[name] = text;

	return sending(files);
}

beforeAll(async () => {
	// The maths plays where it is, in the SDK; its books are made into a folder of the test's.
	cpSync(join(game, "game.json"), join(studio, "game.json"));
	await makeBooks(game, { books: join(studio, "books"), workers: 0 });

	for (const [file, text] of Object.entries(BUILT)) {
		mkdirSync(dirname(join(studio, "client", "dist", file)), { recursive: true });
		writeFileSync(join(studio, "client", "dist", file), text);
	}
	writeClientRecord(studio, []);

	await packGame(studio, "gem-drop", release);
});

describe("a game, packed for a release", () => {
	it("is one file, named for the game: a client folder and a maths folder", () => {
		expect(packedGame("gem-drop")).toBe("gem-drop.tar.gz");
		expect(readdirSync(release)).toEqual(["gem-drop.tar.gz"]);

		expect(listed(join(release, "gem-drop.tar.gz")).sort()).toEqual(
			[
				...Object.keys(BUILT).map((file) => `client/${file}`),
				"maths/books.json",
				...bookFiles(TABLES).map((file) => `maths/${file}`)
			].sort()
		);
		expect(bookFiles(["spin"])).toEqual(["spin.index", "spin.rows"]);
	});

	it("is the same file whenever the same game is packed", async () => {
		const again = join(scratch, "again");
		await packGame(studio, "gem-drop", again);

		expect(readFileSync(join(again, "gem-drop.tar.gz"))).toEqual(
			readFileSync(join(release, "gem-drop.tar.gz"))
		);
	});

	it("is opened by hand into the client that was built and the books that were made", () => {
		const into = join(scratch, "by-hand");
		mkdirSync(into);
		execFileSync("tar", ["-xzf", join(release, "gem-drop.tar.gz"), "-C", into]);

		expect(readdirSync(into).sort()).toEqual(["client", "maths"]);
		expect(readFileSync(join(into, "client", "index.html"), "utf8")).toBe(
			BUILT["index.html"]
		);
		for (const file of ["books.json", "spin.rows"])
			expect(readFileSync(join(into, "maths", file))).toEqual(
				readFileSync(join(studio, "books", file))
			);
	});

	it("unpacks into the books and the client that were packed, held to their records", async () => {
		const folder = received("site");
		const unpacked = await unpackGame(folder, "gem-drop", from(release));

		expect(unpacked.books?.check.problems).toEqual([]);
		for (const file of ["spin.index", "spin.rows", "gem-pour.rows"])
			expect(readFileSync(join(folder, "books", file))).toEqual(
				readFileSync(join(studio, "books", file))
			);

		expect(Object.keys(unpacked.client?.files ?? {})).toHaveLength(3);
		for (const [file, text] of Object.entries(BUILT))
			expect(readFileSync(join(folder, "client", "dist", file), "utf8")).toBe(text);
		expect(hasItsClient(folder)).toBe(true);
	});

	it("gives its books alone, or its client alone, where only one is wanted", async () => {
		const books = received("books-alone");
		const had = await unpackGame(books, "gem-drop", from(release), { books: true });

		expect(had.books?.check.problems).toEqual([]);
		expect(had.client).toBeUndefined();
		expect(existsSync(join(books, "client", "dist"))).toBe(false);

		const client = received("client-alone");
		const got = await unpackGame(client, "gem-drop", from(release), { client: true });

		expect(got.books).toBeUndefined();
		expect(hasItsClient(client)).toBe(true);
		expect(readdirSync(join(client, "books"))).toEqual(["books.json"]);

		// A client is at the front of its archive: the books behind it need not arrive at all.
		const whole = readFileSync(join(release, "gem-drop.tar.gz"));
		const front = join(scratch, "front");
		mkdirSync(front);
		writeFileSync(
			join(front, "gem-drop.tar.gz"),
			whole.subarray(0, whole.length / 2)
		);

		const early = received("client-early");
		await unpackGame(early, "gem-drop", from(front), { client: true });
		expect(hasItsClient(early)).toBe(true);
	});

	it("is not packed when its books or its client are not the ones on record", async () => {
		const folder = join(scratch, "unsound", "gem-drop");
		cpSync(studio, folder, { recursive: true });
		const out = join(scratch, "unsound-out");

		writeFileSync(join(folder, "client", "dist", "extra.js"), "more");
		await expect(packGame(folder, "gem-drop", out)).rejects.toThrow(
			/extra\.js, which is not on its record/
		);
		rmSync(join(folder, "client", "dist", "extra.js"));

		// Built on packages taken from their clones: for a trial, and only when asked.
		const record = JSON.parse(
			readFileSync(join(folder, "client", "client.json"), "utf8")
		);
		writeFileSync(
			join(folder, "client", "client.json"),
			JSON.stringify({ ...record, conditions: ["local"] })
		);
		await expect(packGame(folder, "gem-drop", out)).rejects.toThrow(
			/built on packages taken from their clones/
		);
		await expect(packGame(folder, "gem-drop", out, { trial: true })).resolves.toBe(
			"gem-drop.tar.gz"
		);
		rmSync(out, { recursive: true });
		writeFileSync(join(folder, "client", "client.json"), JSON.stringify(record));

		rmSync(join(folder, "books", "spin.rows"));
		await expect(packGame(folder, "gem-drop", out)).rejects.toThrow();
		expect(existsSync(out) ? readdirSync(out) : []).toEqual([]);
	});

	it("is refused, and nothing kept, when its books are not the books recorded", async () => {
		const folder = received("swapped");
		// Another table's rows under this one's name: well formed, and not what was recorded.
		const open = changed({
			"maths/spin.rows": readFileSync(
				join(studio, "books", "bought.rows"),
				"latin1"
			)
		});

		await expect(unpackGame(folder, "gem-drop", open)).rejects.toThrow();
		expect(readdirSync(join(folder, "books"))).toEqual(["books.json"]);
		expect(existsSync(join(folder, "client", "dist"))).toBe(false);
	});

	it("is refused when a file is missing, or the release has no such file, with nothing kept", async () => {
		const missing = received("missing");

		await expect(
			unpackGame(missing, "gem-drop", changed({ "maths/gem-pour.rows": null }))
		).rejects.toThrow(/has no maths\/gem-pour\.rows/);
		await expect(
			unpackGame(missing, "gem-drop", changed({ "client/card.svg": null }))
		).rejects.toThrow(/has no client\/card\.svg/);
		await expect(
			unpackGame(missing, "gem-drop", (packed) => {
				throw new Error(`The release has no ${packed}.`);
			})
		).rejects.toThrow(/has no gem-drop\.tar\.gz/);
		await expect(
			unpackGame(missing, "gem-drop", () => Readable.from([gzipSync("not a game")]))
		).rejects.toThrow();
		await expect(
			unpackGame(missing, "gem-drop", () =>
				Readable.from([Buffer.from("not gzip")])
			)
		).rejects.toThrow();

		expect(readdirSync(join(missing, "books"))).toEqual(["books.json"]);
		expect(existsSync(join(missing, "client", "dist"))).toBe(false);
	});

	it("is refused where its client is not the one on record, or it holds anything else", async () => {
		const folder = received("wary");

		// A file changed, a file more, a file twice, and files that are no part of a release.
		await expect(
			unpackGame(
				folder,
				"gem-drop",
				changed({ "client/index.html": "<script>alert(1)</script>" })
			)
		).rejects.toThrow(/index\.html is not the file recorded/);
		await expect(
			unpackGame(folder, "gem-drop", changed({ "client/more.js": "more" }))
		).rejects.toThrow(/not the ones recorded/);
		await expect(
			unpackGame(folder, "gem-drop", changed({ "maths/more.rows": "more" }))
		).rejects.toThrow(/no more\.rows on record/);
		await expect(
			unpackGame(folder, "gem-drop", changed({ "outside.js": "out" }))
		).rejects.toThrow(/a client folder and a maths folder/);
		await expect(
			unpackGame(folder, "gem-drop", changed({ "maths/index.ts": "export {}" }))
		).rejects.toThrow(/no index\.ts on record/);

		expect(readdirSync(join(folder, "books"))).toEqual(["books.json"]);
		expect(existsSync(join(folder, "client", "dist"))).toBe(false);
		expect(readdirSync(join(scratch, "wary")).sort()).toEqual(["gem-drop"]);
	});
});
