/**
 * A game's built client as a file of a release. A studio builds its own client, where its
 * code is, with the SDK it was written for; the site never builds one, and never runs a
 * studio's code to make one. What was built is not committed. Its record is:
 * `client/client.json`, the digest of every file of it, written when it is built
 * (`keros3ne-studio client`) and committed, so that a tag says exactly which client it
 * sends. The studio packs the built files into one file of its release, and the site
 * unpacks that beside the record and holds every file to it.
 *
 * Author: dwclake
 * Created: 2026-11-19
 */

import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	renameSync,
	rmSync,
	writeFileSync
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import type { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import * as v from "valibot";
import { BOOK_VERSION } from "./book.ts";
import { PROTOCOL } from "./protocol.ts";

/** A place in a built client: letters, figures and plain marks, folders apart by `/`, never up or out. */
const PLACE = /^(?!\/)(?!.*(^|\/)\.{1,2}(\/|$))[\w.+@-]+(\/[\w.+@-]+)*$/;

/**
 * What a client built before its record said its protocol spoke: the SDK at 0.15, which
 * wrote no `protocol`, spoke this one.
 */
const PROTOCOL_BEFORE_RECORDED = "keros3ne-game/2";

const recordSchema = v.strictObject({
	/** The SDK the client was built with: said for people, and held to nothing. */
	sdk: v.string(),
	/**
	 * The protocol the client speaks to the site in (./protocol.ts), as the SDK it was built
	 * with has it. A site takes a client that speaks its own, whatever SDK either is on.
	 */
	protocol: v.optional(v.string(), PROTOCOL_BEFORE_RECORDED),
	/** Every file of the built client, by its place in it, and its SHA-256 digest. */
	files: v.record(
		v.pipe(v.string(), v.regex(PLACE)),
		v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/))
	)
});

/** The record of a built client: what a tag says it sends. */
export type ClientRecord = v.InferOutput<typeof recordSchema>;

/** What a packed client holds: each file by its place, as base64. */
const packedSchema = v.strictObject({
	files: v.record(v.pipe(v.string(), v.regex(PLACE)), v.string())
});

/** The name of a game's packed client among a release's files. */
export function packedClient(slug: string): string {
	return `${slug}.client.gz`;
}

/** Where a game's record of its built client is kept. */
export function clientRecordFile(gameFolder: string): string {
	return join(gameFolder, "client", "client.json");
}

/** This SDK's version: what a client built now is built with. */
const { version } = JSON.parse(
	readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8")
) as { version: string };

const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/** Every file under a folder, by its place in it, written with `/`. */
function filesIn(folder: string): string[] {
	const walk = (within: string): string[] =>
		readdirSync(within, { withFileTypes: true }).flatMap((entry) =>
			entry.isDirectory()
				? walk(join(within, entry.name))
				: [join(within, entry.name)]
		);

	return walk(folder)
		.map((file) => relative(folder, file).split(sep).join("/"))
		.sort();
}

/** The record of the client built into a game's `client/dist`, as it is now. */
export function recordClient(gameFolder: string): ClientRecord {
	const dist = join(gameFolder, "client", "dist");
	if (!existsSync(join(dist, "index.html"))) {
		throw new Error(`${dist} has no index.html: is the client built?`);
	}

	return {
		sdk: version,
		protocol: PROTOCOL,
		files: Object.fromEntries(
			filesIn(dist).map((file) => [file, digest(readFileSync(join(dist, file)))])
		)
	};
}

/** Writes the record of a game's built client beside its source, to be committed. */
export function writeClientRecord(gameFolder: string): ClientRecord {
	const record = recordClient(gameFolder);
	writeFileSync(
		clientRecordFile(gameFolder),
		`${JSON.stringify(record, null, "\t")}\n`
	);

	return record;
}

/** A game's record of its built client. Throws if there is none, or it is not one. */
export function readClientRecord(gameFolder: string): ClientRecord {
	const file = clientRecordFile(gameFolder);
	if (!existsSync(file)) {
		throw new Error(
			`there is no client/client.json, the record of its built client: build it with keros3ne-studio client`
		);
	}

	return v.parse(recordSchema, JSON.parse(readFileSync(file, "utf8")));
}

/**
 * The problems with a game's built client against its record, in words: no record, a file
 * that is not the one recorded, one missing, or one not on record. Empty when the client
 * built is exactly the one its record names.
 */
export function checkBuiltClient(gameFolder: string): string[] {
	let record: ClientRecord;
	let built: ClientRecord;
	try {
		record = readClientRecord(gameFolder);
		built = recordClient(gameFolder);
	} catch (error) {
		return [error instanceof Error ? error.message : String(error)];
	}

	const problems: string[] = [];
	for (const [file, recorded] of Object.entries(record.files)) {
		if (!(file in built.files))
			problems.push(`its built client has no ${file}, which its record names`);
		else if (built.files[file] !== recorded)
			problems.push(`its built client's ${file} is not the one its record names`);
	}
	for (const file of Object.keys(built.files)) {
		if (!(file in record.files))
			problems.push(`its built client has ${file}, which is not on its record`);
	}

	return problems.length > 0
		? [
				...problems.slice(0, 5),
				"build it again and record it with: keros3ne-studio client"
			]
		: [];
}

/**
 * Why this SDK cannot take a game as it was built, in words: its client speaks another
 * version of the protocol than this one, or its books are written in another format than
 * this one reads. Empty when it can. These two are all that a site and a game must agree
 * on: a game is built by its studio with whatever version of the SDK it was written for,
 * and a site takes it so long as they understand each other.
 */
export function unsupported(gameFolder: string): string[] {
	const problems: string[] = [];

	try {
		const { protocol } = readClientRecord(gameFolder);
		if (protocol !== PROTOCOL) {
			problems.push(
				`its client speaks ${protocol}, and this site speaks ${PROTOCOL}: build it with an SDK that speaks ${PROTOCOL}`
			);
		}
	} catch {
		// No record, or not one: said by the check of the built client.
	}

	try {
		// Read as it is written: the record's own check would refuse another format outright.
		const { version: books } = JSON.parse(
			readFileSync(join(gameFolder, "books", "books.json"), "utf8")
		) as { version?: unknown };
		if (books !== BOOK_VERSION) {
			problems.push(
				`its books are in format ${books}, and this site reads format ${BOOK_VERSION}: make them with an SDK that writes format ${BOOK_VERSION}`
			);
		}
	} catch {
		// No record of its books: said by the check of the books.
	}

	return problems;
}

/**
 * Packs a game's built client, held to its record first, into `into`: one file to send
 * with a release. Returns its name. Throws if the client is not the one recorded.
 */
export function packClient(gameFolder: string, slug: string, into: string): string {
	const problems = checkBuiltClient(gameFolder);
	if (problems.length > 0) throw new Error(`${slug}: ${problems.join("; ")}`);

	const dist = join(gameFolder, "client", "dist");
	const files = Object.fromEntries(
		filesIn(dist).map((file) => [
			file,
			readFileSync(join(dist, file)).toString("base64")
		])
	);

	mkdirSync(into, { recursive: true });
	writeFileSync(join(into, packedClient(slug)), gzipSync(JSON.stringify({ files })));

	return packedClient(slug);
}

/** All of a stream, as bytes. */
async function bytesOf(stream: Readable): Promise<Buffer> {
	const parts: Buffer[] = [];
	for await (const part of stream) parts.push(Buffer.from(part as Uint8Array));

	return Buffer.concat(parts);
}

/**
 * Unpacks a game's built client from a release into its `client/dist`, held to the record
 * the game's folder has of it (`client/client.json`): exactly the files recorded, each
 * with the digest recorded. `open` gives a packed file's bytes by its name. Nothing is
 * put in place unless all of it is as recorded; a client already there is replaced.
 */
export async function unpackClient(
	gameFolder: string,
	slug: string,
	open: (packed: string) => Promise<Readable> | Readable
): Promise<ClientRecord> {
	const record = readClientRecord(gameFolder);
	const packed = v.parse(
		packedSchema,
		JSON.parse(
			gunzipSync(await bytesOf(await open(packedClient(slug)))).toString("utf8")
		)
	);

	const sent = Object.keys(packed.files).sort();
	const recorded = Object.keys(record.files).sort();
	if (sent.join("\n") !== recorded.join("\n")) {
		throw new Error(
			`${slug}'s client is not the one its record names: its files are not the ones recorded.`
		);
	}

	const files = new Map<string, Buffer>();
	for (const file of sent) {
		const bytes = Buffer.from(packed.files[file], "base64");
		if (digest(bytes) !== record.files[file]) {
			throw new Error(
				`${slug}'s client is not the one its record names: ${file} is not the file recorded.`
			);
		}

		files.set(file, bytes);
	}

	// Written beside its place, and put there only once all of it has been.
	const dist = join(gameFolder, "client", "dist");
	const coming = `${dist}.coming`;
	rmSync(coming, { recursive: true, force: true });
	for (const [file, bytes] of files) {
		mkdirSync(dirname(join(coming, file)), { recursive: true });
		writeFileSync(join(coming, file), bytes);
	}
	rmSync(dist, { recursive: true, force: true });
	renameSync(coming, dist);

	return record;
}

/** Whether a game's built client is on disk and is the one its record names. */
export function hasItsClient(gameFolder: string): boolean {
	return (
		existsSync(clientRecordFile(gameFolder)) &&
		checkBuiltClient(gameFolder).length === 0
	);
}
