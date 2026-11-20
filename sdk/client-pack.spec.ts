/**
 * A built client as a file of a release (./client-pack.ts): that what is packed is the
 * client on record, and that what is unpacked is held to the record, file for file.
 *
 * Author: dwclake
 * Created: 2026-11-19
 */

import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import { afterAll, describe, expect, it } from "vitest";
import { BOOK_VERSION } from "./book.ts";
import { PROTOCOL } from "./protocol.ts";
import {
	builtOnClones,
	checkBuiltClient,
	hasItsClient,
	packClient,
	packedClient,
	readClientRecord,
	unpackClient,
	unsupported,
	writeClientRecord
} from "./client-pack.ts";

const scratch = mkdtempSync(join(tmpdir(), "client-pack-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const BUILT = {
	"index.html": "<!doctype html><p>the game</p>",
	"card.svg": "<svg />",
	"_app/immutable/chunks/abc.js": "export const game = 1;"
};

/** A game's folder with these files built into its client's `dist`. */
function game(name: string, files: Record<string, string> = BUILT): string {
	const folder = join(scratch, name);
	for (const [file, text] of Object.entries(files)) {
		mkdirSync(dirname(join(folder, "client", "dist", file)), { recursive: true });
		writeFileSync(join(folder, "client", "dist", file), text);
	}

	return folder;
}

/** A release's files, from a folder of them. */
const from = (folder: string) => (name: string) =>
	Readable.from([readFileSync(join(folder, name))]);

describe("a built client", () => {
	it("is put on record file by file, and held to the record", () => {
		const folder = game("recorded");
		expect(checkBuiltClient(folder)[0]).toMatch(/no client\/client\.json/);

		const record = writeClientRecord(folder, []);
		expect(Object.keys(record.files)).toEqual([
			"_app/immutable/chunks/abc.js",
			"card.svg",
			"index.html"
		]);
		expect(readClientRecord(folder)).toEqual(record);
		expect(checkBuiltClient(folder)).toEqual([]);
		expect(hasItsClient(folder)).toBe(true);

		// Built again differently, it is no longer the client on record.
		writeFileSync(
			join(folder, "client", "dist", "index.html"),
			"<!doctype html><p>another</p>"
		);
		writeFileSync(join(folder, "client", "dist", "extra.js"), "more");
		const problems = checkBuiltClient(folder);
		expect(problems.join("\n")).toMatch(
			/index\.html is not the one its record names/
		);
		expect(problems.join("\n")).toMatch(/has extra\.js, which is not on its record/);
		expect(hasItsClient(folder)).toBe(false);
		expect(() => packClient(folder, "recorded", join(scratch, "nowhere"))).toThrow(
			/not the one its record names/
		);
	});

	it("travels as one file of a release, and is unpacked as it was built", async () => {
		const studio = game("sent");
		writeClientRecord(studio, []);
		const release = join(scratch, "release");
		expect(packClient(studio, "sent", release)).toBe("sent.client.gz");

		// The site has the game's record, from its repository, and nothing built.
		const site = join(scratch, "held");
		mkdirSync(join(site, "client"), { recursive: true });
		writeFileSync(
			join(site, "client", "client.json"),
			readFileSync(join(studio, "client", "client.json"))
		);

		await unpackClient(site, "sent", from(release));
		for (const [file, text] of Object.entries(BUILT))
			expect(readFileSync(join(site, "client", "dist", file), "utf8")).toBe(text);
		expect(hasItsClient(site)).toBe(true);
	});

	it("is refused, and nothing put in place, where what a release sends is not what is on record", async () => {
		const studio = game("true");
		writeClientRecord(studio, []);
		const site = join(scratch, "wary");
		mkdirSync(join(site, "client"), { recursive: true });
		writeFileSync(
			join(site, "client", "client.json"),
			readFileSync(join(studio, "client", "client.json"))
		);

		/** A release whose packed client holds these files. */
		const sending = (files: Record<string, string>) => () =>
			Readable.from([
				gzipSync(
					JSON.stringify({
						files: Object.fromEntries(
							Object.entries(files).map(([file, text]) => [
								file,
								Buffer.from(text).toString("base64")
							])
						)
					})
				)
			]);

		// A file changed, a file more, and a file that would be written outside the client.
		await expect(
			unpackClient(
				site,
				"true",
				sending({ ...BUILT, "index.html": "<script>alert(1)</script>" })
			)
		).rejects.toThrow(/index\.html is not the file recorded/);
		await expect(
			unpackClient(site, "true", sending({ ...BUILT, "more.js": "more" }))
		).rejects.toThrow(/not the ones recorded/);
		await expect(
			unpackClient(site, "true", sending({ ...BUILT, "../../outside.js": "out" }))
		).rejects.toThrow();

		expect(existsSync(join(site, "client", "dist"))).toBe(false);
		expect(existsSync(join(scratch, "outside.js"))).toBe(false);
		expect(packedClient("true")).toBe("true.client.gz");
	});

	it("is taken by a site that speaks its protocol and reads its books, whatever SDK built it", () => {
		const folder = game("understood");
		const record = writeClientRecord(folder, []);
		expect(record.protocol).toBe(PROTOCOL);
		mkdirSync(join(folder, "books"), { recursive: true });
		const books = (version: number) =>
			writeFileSync(
				join(folder, "books", "books.json"),
				JSON.stringify({ version, tables: {} })
			);
		books(BOOK_VERSION);
		expect(unsupported(folder)).toEqual([]);

		// Built with another SDK altogether, and it makes no difference.
		const rewrite = (change: Record<string, unknown>) =>
			writeFileSync(
				join(folder, "client", "client.json"),
				JSON.stringify({ ...record, ...change })
			);
		rewrite({ sdk: "9.9.9" });
		expect(unsupported(folder)).toEqual([]);

		// A record written before records said so (the SDK at 0.15) is of a client that spoke
		// that SDK's protocol.
		const { protocol: _said, ...before } = record;
		writeFileSync(join(folder, "client", "client.json"), JSON.stringify(before));
		expect(readClientRecord(folder).protocol).toBe("keros3ne-game/2");

		// A client that speaks another protocol, or books in another format, is refused, and why.
		rewrite({ protocol: "keros3ne-game/999" });
		expect(unsupported(folder)).toEqual([
			expect.stringMatching(
				new RegExp(`speaks keros3ne-game/999, and this site speaks ${PROTOCOL}`)
			)
		]);
		rewrite({});
		books(BOOK_VERSION + 1);
		expect(unsupported(folder)).toEqual([
			expect.stringMatching(
				new RegExp(
					`format ${BOOK_VERSION + 1}, and this site reads format ${BOOK_VERSION}`
				)
			)
		]);
	});

	it("is never packed for a release when it was built on packages taken from their clones", () => {
		const folder = game("on-clones");
		const record = writeClientRecord(folder, []);
		const out = join(scratch, "on-clones-out");

		// Built on every package at its tag, the record says nothing of it, and it packs.
		expect(record.conditions).toBeUndefined();
		expect(builtOnClones(folder)).toBeNull();
		expect(() => packClient(folder, "on-clones", out)).not.toThrow();

		// As `bun run local client` records it: its files are of no tag's making.
		writeFileSync(
			join(folder, "client", "client.json"),
			JSON.stringify({ ...record, conditions: ["local"] })
		);
		expect(builtOnClones(folder)).toMatch(/taken from their clones \(local\)/);
		expect(() => packClient(folder, "on-clones", out)).toThrow(
			/built on packages taken from their clones/
		);
		// For a trial, and only when asked.
		expect(() => packClient(folder, "on-clones", out, { trial: true })).not.toThrow();
	});
});
