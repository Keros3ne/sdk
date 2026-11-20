/**
 * A tar archive, written and read: the one file a game's release is (./release-pack.ts).
 * Only what a release needs of the format: plain files, by their places, in the order
 * given (ustar, which any `tar` opens). No links, owners, times or modes are kept, so the
 * same files make the same archive wherever it is written.
 *
 * It is read as it arrives, never held whole: a game's books are hundreds of megabytes.
 * What is read comes from outside, so a place that is absolute or climbs out of its
 * folder, and anything that is not a plain file, is refused.
 *
 * Author: dwclake
 * Created: 2026-11-20
 */

/** The size of a block: a header is one, and a file's bytes are padded to a whole number. */
const BLOCK = 512;

/** The longest name and prefix a header holds, in bytes. */
const NAME_BYTES = 100;
const PREFIX_BYTES = 155;

/** The largest file a header's eleven octal figures can state. */
const MOST_BYTES = 8 ** 11 - 1;

/** A place in an archive: letters, figures and plain marks, folders apart by `/`, never up or out. */
const PLACE = /^(?!\/)(?!.*(^|\/)\.{1,2}(\/|$))[\w.+@-]+(\/[\w.+@-]+)*$/;

/** Whether a name is a place a file of an archive may have. */
export function isPlace(name: string): boolean {
	return PLACE.test(name);
}

/** A file to put in an archive. */
export interface TarFile {
	/** Its place in the archive: `client/index.html`. */
	name: string;
	/** How many bytes it is. */
	size: number;
	/** Its bytes, asked for when it is its turn to be written. */
	bytes: () => AsyncIterable<Uint8Array> | Iterable<Uint8Array>;
}

/**
 * A place as a header holds it: a name of a hundred bytes at most, and what comes before
 * a `/` of it in a prefix where the whole is longer.
 */
function splitName(name: string): { name: string; prefix: string } {
	if (Buffer.byteLength(name) <= NAME_BYTES) return { name, prefix: "" };

	for (let at = name.indexOf("/"); at !== -1; at = name.indexOf("/", at + 1)) {
		const prefix = name.slice(0, at);
		const rest = name.slice(at + 1);

		if (
			Buffer.byteLength(prefix) <= PREFIX_BYTES &&
			Buffer.byteLength(rest) <= NAME_BYTES
		)
			return { name: rest, prefix };
	}

	throw new Error(`${name} is too long a place for an archive to hold.`);
}

/** The header of a plain file. */
function header(file: Pick<TarFile, "name" | "size">): Buffer {
	if (!isPlace(file.name))
		throw new Error(`"${file.name}" is not a place in an archive.`);
	if (!Number.isInteger(file.size) || file.size < 0 || file.size > MOST_BYTES)
		throw new Error(`${file.name} is not of a size an archive can hold.`);

	const block = Buffer.alloc(BLOCK);
	const { name, prefix } = splitName(file.name);

	block.write(name, 0, NAME_BYTES, "utf8");
	block.write("0000644\0", 100, "ascii");
	block.write("0000000\0", 108, "ascii");
	block.write("0000000\0", 116, "ascii");
	block.write(`${file.size.toString(8).padStart(11, "0")}\0`, 124, "ascii");
	block.write("00000000000\0", 136, "ascii");
	// The checksum is summed with its own place read as spaces.
	block.write("        ", 148, "ascii");
	block.write("0", 156, "ascii");
	block.write("ustar\0" + "00", 257, "ascii");
	block.write(prefix, 345, PREFIX_BYTES, "utf8");

	let sum = 0;
	for (const byte of block) sum += byte;
	block.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, "ascii");

	return block;
}

/**
 * An archive of these files, in this order, as it is written: a stream of its bytes.
 * Throws if a file turns out not to be of the size it was said to be.
 */
export async function* tarBytes(
	files: Iterable<TarFile> | AsyncIterable<TarFile>
): AsyncGenerator<Buffer> {
	for await (const file of files) {
		yield header(file);

		let written = 0;
		for await (const part of file.bytes()) {
			written += part.byteLength;
			yield Buffer.from(part.buffer, part.byteOffset, part.byteLength);
		}
		if (written !== file.size)
			throw new Error(
				`${file.name} came to ${written} bytes, not the ${file.size} it was said to be.`
			);

		const over = file.size % BLOCK;
		if (over > 0) yield Buffer.alloc(BLOCK - over);
	}

	// Two empty blocks end an archive.
	yield Buffer.alloc(BLOCK * 2);
}

/** A file of an archive being read. */
export interface TarEntry {
	/** Its place in the archive. */
	name: string;
	/** How many bytes it is. */
	size: number;
	/**
	 * Its bytes, as they arrive. They are there only until the next file is asked for:
	 * what was not read by then is passed over.
	 */
	bytes: () => AsyncGenerator<Buffer>;
}

/** A stream of bytes, taken a measured amount at a time. */
class Taker {
	private readonly source: AsyncIterator<Uint8Array>;
	private held: Buffer = Buffer.alloc(0);

	constructor(stream: AsyncIterable<Uint8Array>) {
		this.source = stream[Symbol.asyncIterator]();
	}

	/** The next bytes to arrive, `most` of them at most; `null` when there are no more. */
	async some(most: number): Promise<Buffer | null> {
		while (this.held.length === 0) {
			const next = await this.source.next();
			if (next.done) return null;

			this.held = Buffer.from(
				next.value.buffer,
				next.value.byteOffset,
				next.value.byteLength
			);
		}

		const taken = this.held.subarray(0, most);
		this.held = this.held.subarray(taken.length);

		return taken;
	}

	/** Exactly this many bytes; `null` if the stream ends before the first of them. */
	async exactly(count: number): Promise<Buffer | null> {
		const parts: Buffer[] = [];
		let had = 0;

		while (had < count) {
			const part = await this.some(count - had);
			if (part === null) {
				if (had === 0) return null;

				throw new Error("The archive is cut short.");
			}

			parts.push(part);
			had += part.length;
		}

		return parts.length === 1 ? parts[0] : Buffer.concat(parts);
	}

	/** Stops reading, and lets the stream go. */
	async stop(): Promise<void> {
		await this.source.return?.();
	}
}

/** A field of a header that is words: up to its first empty byte. */
function words(block: Buffer, from: number, length: number): string {
	const field = block.subarray(from, from + length);
	const end = field.indexOf(0);

	return field.subarray(0, end === -1 ? length : end).toString("utf8");
}

/** A field of a header that is a number, written in octal. */
function number(block: Buffer, from: number, length: number): number {
	const text = words(block, from, length).trim();
	if (!/^[0-7]*$/.test(text)) throw new Error("This is not a tar archive.");

	return text === "" ? 0 : Number.parseInt(text, 8);
}

/**
 * The files of an archive, one after another as it is read. A folder's own entry is
 * passed over. Throws at anything else that is not a plain file, at a place that is not
 * one, and at bytes that are no archive at all.
 */
export async function* tarEntries(
	stream: AsyncIterable<Uint8Array>
): AsyncGenerator<TarEntry> {
	const taker = new Taker(stream);

	try {
		while (true) {
			const block = await taker.exactly(BLOCK);
			// An empty block, or no more bytes, is the end.
			if (block === null || block.every((byte) => byte === 0)) return;

			let sum = 0;
			for (let at = 0; at < BLOCK; at++)
				sum += at >= 148 && at < 156 ? 32 : block[at];
			if (sum !== number(block, 148, 8))
				throw new Error("This is not a tar archive.");

			const kind = String.fromCharCode(block[156]);
			const prefix = words(block, 345, PREFIX_BYTES);
			const name = `${prefix ? `${prefix}/` : ""}${words(block, 0, NAME_BYTES)}`;
			const size = number(block, 124, 12);
			let left = size;

			/** The bytes of this file not read yet, as they arrive. */
			async function* bytes(): AsyncGenerator<Buffer> {
				while (left > 0) {
					const part = await taker.some(left);
					if (part === null) throw new Error("The archive is cut short.");

					left -= part.length;
					yield part;
				}
			}

			if (kind === "5") {
				// A folder's own entry holds nothing.
			} else if (kind !== "0" && kind !== "\0")
				throw new Error(
					`${name || "The archive"} holds something that is not a plain file.`
				);
			else if (!isPlace(name))
				throw new Error(
					`"${name}" is not a place a file of an archive may have.`
				);
			else yield { name, size, bytes };

			// What was not read of it, and the padding after it.
			for await (const _ of bytes());
			const over = size % BLOCK;
			if (over > 0 && (await taker.exactly(BLOCK - over)) === null)
				throw new Error("The archive is cut short.");
		}
	} finally {
		await taker.stop();
	}
}
