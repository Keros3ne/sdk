import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createRng, hashServerSeed, payoutRoll } from "./rng";

/** The same float, computed independently with Node's own crypto. */
function referenceFloats(
	serverSeed: string,
	clientSeed: string,
	nonce: number,
	count: number
) {
	const out: number[] = [];
	for (let block = 0; out.length < count; block++) {
		const bytes = createHmac("sha256", serverSeed)
			.update(`${clientSeed}:${nonce}:${block}`)
			.digest();
		for (let i = 0; i < 32 && out.length < count; i += 4) {
			out.push(
				bytes[i] / 256 +
					bytes[i + 1] / 256 ** 2 +
					bytes[i + 2] / 256 ** 3 +
					bytes[i + 3] / 256 ** 4
			);
		}
	}
	return out;
}

describe("createRng", () => {
	it("matches an independent HMAC-SHA256 implementation, across block boundaries", () => {
		const rng = createRng("server-seed", "client-seed", 7);
		const actual = Array.from({ length: 20 }, () => rng.float());
		expect(actual).toEqual(referenceFloats("server-seed", "client-seed", 7, 20));
	});

	it("produces a fixed, known first value", () => {
		// Pinned so that an accidental change to the algorithm cannot go unnoticed:
		// it would make every past bet unverifiable.
		expect(createRng("server-seed", "client-seed", 1).float()).toBe(PINNED);
	});

	it("gives the same stream for the same inputs and a different one otherwise", () => {
		const first = (s: string, c: string, n: number) => createRng(s, c, n).float();
		expect(first("s", "c", 1)).toBe(first("s", "c", 1));
		expect(first("s", "c", 1)).not.toBe(first("s", "c", 2));
		expect(first("s", "c", 1)).not.toBe(first("s", "d", 1));
		expect(first("s", "c", 1)).not.toBe(first("t", "c", 1));
	});

	it("keeps floats in [0, 1) and ints in range, roughly evenly", () => {
		const rng = createRng("distribution", "check", 1);
		const counts = [0, 0, 0, 0, 0, 0];
		for (let i = 0; i < 60_000; i++) {
			const f = rng.float();
			expect(f >= 0 && f < 1).toBe(true);
			counts[rng.int(6)]++;
		}
		for (const count of counts) expect(Math.abs(count - 10_000)).toBeLessThan(500);
	});

	it("shuffles without losing or duplicating items", () => {
		const deck = Array.from({ length: 52 }, (_, i) => i);
		const shuffled = createRng("s", "c", 1).shuffle(deck);
		expect(shuffled).not.toEqual(deck);
		expect([...shuffled].sort((a, b) => a - b)).toEqual(deck);
	});
});

describe("payoutRoll", () => {
	it("is a whole number under 10,000, the same for the same bet, and pinned like the stream", () => {
		const roll = payoutRoll("server-seed", "client-seed", 1);
		expect(Number.isInteger(roll)).toBe(true);
		expect(roll).toBeGreaterThanOrEqual(0);
		expect(roll).toBeLessThan(10_000);
		expect(payoutRoll("server-seed", "client-seed", 1)).toBe(roll);
		expect(payoutRoll("server-seed", "client-seed", 2)).not.toBe(roll);
		// Computed again with Node's own crypto: changing how it is drawn changes what past bets
		// paid, as changing the stream would.
		const bytes = createHmac("sha256", "server-seed")
			.update("client-seed:1:payout")
			.digest();
		expect(roll).toBe(Math.floor((bytes.readUInt32BE(0) * 10_000) / 2 ** 32));
	});

	it("spreads evenly over its range", () => {
		const below = Array.from({ length: 4_000 }, (_, n) =>
			payoutRoll("s", "c", n)
		).filter((roll) => roll < 5_000).length;
		expect(below / 4_000).toBeGreaterThan(0.46);
		expect(below / 4_000).toBeLessThan(0.54);
	});
});

describe("hashServerSeed", () => {
	it("is the SHA-256 of the seed text", () => {
		expect(hashServerSeed("abc")).toBe(
			createHash("sha256").update("abc").digest("hex")
		);
	});
});

const PINNED = 0.6646030934061855;
