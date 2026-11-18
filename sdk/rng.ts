/**
 * The provably fair random stream.
 *
 * Every random value in every game comes from here, and is a pure function of
 * three inputs: the server seed (secret until revealed), the client seed (chosen
 * by the player), and the nonce (the bet's number under that seed pair).
 *
 * Bytes are HMAC-SHA256(key = serverSeed, message = "clientSeed:nonce:block"),
 * with `block` counting up from 0 whenever a game needs more than 32 bytes.
 *
 * This file runs on the server to settle bets and in the browser to verify them,
 * and must be synchronous because bets settle inside a synchronous transaction.
 * That is why it uses a JS hash library and not Web Crypto, which is async.
 */
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

export interface Rng {
	/** Uniform in [0, 1), built from 4 bytes (32 bits of resolution). */
	float(): number;
	/** Uniform integer in [0, n). */
	int(n: number): number;
	/** A new array with the items in random order (Fisher-Yates). */
	shuffle<T>(items: readonly T[]): T[];
}

export function createRng(serverSeed: string, clientSeed: string, nonce: number): Rng {
	const key = utf8ToBytes(serverSeed);
	let block = 0;
	let bytes = new Uint8Array(0);
	let offset = 0;

	function nextByte(): number {
		if (offset === bytes.length) {
			bytes = hmac(sha256, key, utf8ToBytes(`${clientSeed}:${nonce}:${block++}`));
			offset = 0;
		}
		return bytes[offset++];
	}

	function float(): number {
		let value = 0;
		for (let i = 1; i <= 4; i++) value += nextByte() / 256 ** i;
		return value;
	}

	function int(n: number): number {
		if (!Number.isInteger(n) || n < 1)
			throw new RangeError("int(n) needs a positive integer.");
		return Math.floor(float() * n);
	}

	function shuffle<T>(items: readonly T[]): T[] {
		const out = [...items];
		for (let i = out.length - 1; i > 0; i--) {
			const j = int(i + 1);
			[out[i], out[j]] = [out[j], out[i]];
		}
		return out;
	}

	return { float, int, shuffle };
}

/** What players are shown while a server seed is still secret. */
export function hashServerSeed(serverSeed: string): string {
	return bytesToHex(sha256(utf8ToBytes(serverSeed)));
}

/**
 * The draw that settles a bet's payout to whole cents (`settlePayout` in economy.ts): a
 * whole number from 0 to 9,999. From a message of its own, "clientSeed:nonce:payout", so
 * that no game's own draws are changed by it.
 */
export function payoutRoll(
	serverSeed: string,
	clientSeed: string,
	nonce: number
): number {
	const bytes = hmac(
		sha256,
		utf8ToBytes(serverSeed),
		utf8ToBytes(`${clientSeed}:${nonce}:payout`)
	);
	const value =
		((bytes[0] << 24) >>> 0) + (bytes[1] << 16) + (bytes[2] << 8) + bytes[3];
	// Exact: a power of two divides without rounding, and the product stays under 2^53.
	return Math.floor((value * 10_000) / 2 ** 32);
}
