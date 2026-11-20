/**
 * A tar archive written and read (./tar.ts): that what is written is what is read, that
 * the system's own `tar` opens it, and that what comes from outside and is not plain
 * files in their places is refused.
 *
 * Author: dwclake
 * Created: 2026-11-20
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterAll, describe, expect, it } from "vitest";
import { isPlace, tarBytes, tarEntries, type TarFile } from "./tar.ts";

const scratch = mkdtempSync(join(tmpdir(), "keros3ne-tar-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** For the system's tar on a Mac: an archive of the files alone, with none of the Mac's own beside them. */
const PLAIN = { ...process.env, COPYFILE_DISABLE: "1" };

/** A file of an archive holding these words. */
const file = (name: string, text: string): TarFile => ({
	name,
	size: Buffer.byteLength(text),
	bytes: () => [Buffer.from(text)]
});

/** A whole archive of these files, as bytes. */
async function archive(files: TarFile[]): Promise<Buffer> {
	const parts: Buffer[] = [];
	for await (const part of tarBytes(files)) parts.push(part);

	return Buffer.concat(parts);
}

/** What an archive holds: each file's words by its place. Read a few bytes at a time. */
async function read(bytes: Buffer, step = 7): Promise<Record<string, string>> {
	/** The archive as it might arrive: in pieces of no particular size. */
	async function* arriving() {
		for (let at = 0; at < bytes.length; at += step)
			yield bytes.subarray(at, at + step);
	}

	const found: Record<string, string> = {};
	for await (const entry of tarEntries(arriving())) {
		const parts: Buffer[] = [];
		for await (const part of entry.bytes()) parts.push(part);

		found[entry.name] = Buffer.concat(parts).toString("utf8");
		expect(found[entry.name].length).toBe(entry.size);
	}

	return found;
}

/** A long place: longer than a header's name alone holds. */
const DEEP = `client/_app/immutable/${"chunk-".repeat(14)}/a-file-with-a-long-name.js`;

const FILES = [
	file("client/index.html", "<!doctype html>"),
	file("client/empty.txt", ""),
	file(DEEP, "export {};"),
	file("maths/spin.rows", "r".repeat(1300))
];

describe("a tar archive", () => {
	it("is read back as the files that were written, however it arrives", async () => {
		const bytes = await archive(FILES);
		const expected = {
			"client/index.html": "<!doctype html>",
			"client/empty.txt": "",
			[DEEP]: "export {};",
			"maths/spin.rows": "r".repeat(1300)
		};

		expect(bytes.length % 512).toBe(0);
		expect(await read(bytes)).toEqual(expected);
		expect(await read(bytes, 100_000)).toEqual(expected);
		expect(Object.keys(await read(bytes))).toEqual(FILES.map((each) => each.name));
	});

	it("is the same archive whenever the same files are written", async () => {
		expect(await archive(FILES)).toEqual(await archive(FILES));
	});

	it("is opened by the system's own tar", async () => {
		const packed = join(scratch, "game.tar");
		const into = join(scratch, "opened");
		writeFileSync(packed, await archive(FILES));
		mkdirSync(into);

		execFileSync("tar", ["-xf", packed, "-C", into]);

		expect(readFileSync(join(into, "client", "index.html"), "utf8")).toBe(
			"<!doctype html>"
		);
		expect(readFileSync(join(into, DEEP), "utf8")).toBe("export {};");
		expect(readFileSync(join(into, "maths", "spin.rows"), "utf8")).toHaveLength(1300);
	});

	it("passes over a file that is not read, and a folder's own entry", async () => {
		const made = join(scratch, "by-tar");
		mkdirSync(join(made, "client"), { recursive: true });
		writeFileSync(join(made, "client", "index.html"), "a page");
		writeFileSync(join(made, "last.txt"), "the last");
		execFileSync(
			"tar",
			[
				"--format",
				"ustar",
				"-cf",
				join(scratch, "by-tar.tar"),
				"-C",
				made,
				"client",
				"last.txt"
			],
			{ env: PLAIN }
		);

		const found = await read(readFileSync(join(scratch, "by-tar.tar")));

		expect(Object.keys(found)).toEqual(["client/index.html", "last.txt"]);
		expect(found["last.txt"]).toBe("the last");

		// A file not read is passed over, and the one after it is still whole.
		let last = "";
		for await (const entry of tarEntries(Readable.from([await archive(FILES)])))
			if (entry.name === "maths/spin.rows")
				for await (const part of entry.bytes()) last += part.toString("utf8");

		expect(last).toBe("r".repeat(1300));
	});

	it("refuses a place that is absolute or climbs out, written or read", async () => {
		for (const name of [
			"/etc/passwd",
			"../outside.js",
			"client/../../out",
			"a//b",
			""
		])
			expect(isPlace(name)).toBe(false);
		await expect(archive([file("../outside.js", "out")])).rejects.toThrow(
			/not a place/
		);

		// An archive that names such a place, as one from outside might.
		const bytes = await archive([file("client/aa/outside.js", "out")]);
		bytes.write("../", 7, "ascii");
		let sum = 0;
		for (let at = 0; at < 512; at++) sum += at >= 148 && at < 156 ? 32 : bytes[at];
		bytes.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, "ascii");

		await expect(read(bytes)).rejects.toThrow(/not a place/);
	});

	it("refuses a link, bytes that are no archive, and an archive cut short", async () => {
		const made = join(scratch, "linked");
		mkdirSync(made);
		writeFileSync(join(made, "real.txt"), "real");
		execFileSync("ln", ["-s", "real.txt", join(made, "link.txt")]);
		execFileSync(
			"tar",
			[
				"--format",
				"ustar",
				"-cf",
				join(scratch, "linked.tar"),
				"-C",
				made,
				"link.txt"
			],
			{ env: PLAIN }
		);

		await expect(read(readFileSync(join(scratch, "linked.tar")))).rejects.toThrow(
			/not a plain file/
		);
		await expect(read(Buffer.alloc(1024, "not an archive"))).rejects.toThrow(
			/not a tar archive/
		);

		const bytes = await archive(FILES);
		await expect(read(bytes.subarray(0, bytes.length - 1500))).rejects.toThrow(
			/cut short/
		);
	});

	it("refuses to write a file that is not the size it was said to be", async () => {
		await expect(
			archive([{ name: "a.txt", size: 3, bytes: () => [Buffer.from("four")] }])
		).rejects.toThrow(/came to 4 bytes/);
	});
});
