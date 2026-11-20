/**
 * The weights of a book: that a table weighed is worth its target exactly at or under,
 * by next to nothing, that a table near its target is barely changed, that a shape asked
 * for is the shape given, and that what cannot be done is said plainly.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import { describe, expect, it } from "vitest";
import { checkBooks, type ScannableBook } from "./book-check.ts";
import { weighRows, worthOf } from "./book-weights.ts";
import { checkGameManifest } from "./game-manifest.ts";

/** By how much a weighed table is over its target, exactly: its weights times values, less the target's. */
function over(values: number[], weights: Float64Array, targetBp: number) {
	let total = 0n;
	let excess = 0n;

	for (let row = 0; row < values.length; row++) {
		total += BigInt(weights[row]);
		excess += BigInt(weights[row]) * BigInt(values[row] - targetBp);
	}

	return { total, excess };
}

/** Holds a weighed table to its target: never over, and under by less than a hundred thousandth. */
function expectExact(values: number[], weights: Float64Array, targetBp: number) {
	const { total, excess } = over(values, weights, targetBp);

	expect(excess <= 0n).toBe(true);
	expect(-excess * 100_000n < BigInt(targetBp) * total).toBe(true);
	expect(total <= 2n ** 52n).toBe(true);
	for (const weight of weights)
		expect(Number.isSafeInteger(weight) && weight >= 1).toBe(true);
}

/** A stream of numbers from 0 up to 1, the same every time. */
function seeded(seed: number) {
	let state = seed >>> 0;

	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let mixed = state;
		mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
		mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);

		return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
	};
}

/** The rows of a made-up slot as it plays out: most lose, some win a little, a few a lot. */
function slotValues(rows: number, seed: number): number[] {
	const next = seeded(seed);

	return Array.from({ length: rows }, () => {
		const roll = next();
		if (roll < 0.72) return 0;

		if (roll < 0.95) return Math.round(next() * 40) * 500;

		if (roll < 0.998) return 20_000 + Math.round(next() * 100) * 2_500;

		return 1_000_000 + Math.round(next() * 40) * 250_000;
	});
}

describe("a table weighed", () => {
	it("is worth its target, exactly at or under, and by next to nothing", () => {
		// 240 rows in 1,000 pay 4.05 bets: 97.2% as played.
		const values = [...Array(760).fill(0), ...Array(240).fill(40_500)];
		const weights = weighRows(values, 9_600);

		expectExact(values, weights, 9_600);
		expect(worthOf(values, weights)).toBeCloseTo(9_600, 1);

		// One weight for the rows that lose and one for the rows that pay.
		expect(new Set(weights.slice(0, 760)).size).toBe(1);
		expect(new Set(weights.slice(760)).size).toBe(1);
	});

	it("passes the site's own check", () => {
		const values = slotValues(20_000, 7);
		const weights = weighRows(values, 9_600);
		const book: ScannableBook = {
			totalWeight: weights.reduce((total, weight) => total + weight, 0),
			scan(visit) {
				values.forEach((payoutBp, row) =>
					visit({ weight: weights[row], payoutBp }, { events: [] }, row)
				);
			}
		};
		const game = checkGameManifest("game.json", {
			slug: "weighed",
			name: "Weighed",
			blurb: "A table weighed.",
			category: "slots",
			modes: [{ id: "spin", name: "Spin", costBp: 10_000, table: "spin" }]
		});
		const check = checkBooks(game, { spin: book });

		expect(check.problems).toEqual([]);
		expect(check.modes[0].rtpBp).toBeGreaterThan(9_599.9);
	});

	it("leaves what a win looks like alone, and changes how often one comes", () => {
		const values = slotValues(50_000, 11);
		const weights = weighRows(values, 9_600);
		const natural = values.reduce((total, value) => total + value, 0) / values.length;

		expectExact(values, weights, 9_600);

		// Every row under the target's worth weighs one thing, and every row over another.
		const low = new Set<number>();
		const high = new Set<number>();
		values.forEach((value, row) => (value < 9_600 ? low : high).add(weights[row]));

		expect(low.size).toBe(1);
		expect(high.size).toBe(1);

		// Played out it came to more or less than the target, and the weights lean the other way.
		const [lowWeight] = low;
		const [highWeight] = high;
		expect(lowWeight > highWeight).toBe(natural > 9_600);
	});

	it("weighs a million rows in the time it takes to notice", () => {
		const values = slotValues(1_000_000, 3);
		const started = performance.now();
		const weights = weighRows(values, 9_600);

		expect(performance.now() - started).toBeLessThan(5_000);
		expectExact(values, weights, 9_600);
	});

	it("is worth whatever a table must be, not only a spin's 96%", () => {
		// A bonus that must be worth 96 bets, from rows that pay 20 to 300.
		const next = seeded(5);
		const values = Array.from(
			{ length: 5_000 },
			() => 200_000 + Math.round(next() * 280) * 10_000
		);
		const weights = weighRows(values, 960_000);

		expectExact(values, weights, 960_000);
	});
});

describe("a shape asked for", () => {
	const values = slotValues(100_000, 21);
	// Rows that pay a hundred bets or more are the most a round can pay; rows that pay
	// from two bets up to that are the bonus.
	const groupOf = values.map((value) =>
		value >= 1_000_000 ? 0 : value >= 20_000 ? 1 : -1
	);

	it("draws a group once in so many rounds, and gives another its share of the worth", () => {
		const weights = weighRows(values, 9_600, {
			groups: [
				{ name: "max", oneIn: 5_000 },
				{ name: "bonus", share: 0.3 }
			],
			groupOf
		});

		expectExact(values, weights, 9_600);

		let total = 0;
		let maxWeight = 0;
		let bonusWorth = 0;
		values.forEach((value, row) => {
			total += weights[row];
			if (groupOf[row] === 0) maxWeight += weights[row];

			if (groupOf[row] === 1) bonusWorth += weights[row] * value;
		});

		expect(total / maxWeight).toBeCloseTo(5_000, 0);
		expect(bonusWorth / total / 9_600).toBeCloseTo(0.3, 4);
	});

	it("is refused when it asks for more than the table has to give", () => {
		const asking =
			(groups: { name: string; oneIn?: number; share?: number }[]) => () =>
				weighRows(values, 9_600, { groups, groupOf });

		// The largest wins average some sixty bets: once in ten rounds is far over 96%.
		expect(
			asking([
				{ name: "max", oneIn: 10 },
				{ name: "bonus", share: 0.3 }
			])
		).toThrow(/more than the table has to give/);
		expect(
			asking([
				{ name: "max", share: 0.7 },
				{ name: "bonus", share: 0.5 }
			])
		).toThrow(/more than the table has to give/);
		expect(asking([{ name: "max" }, { name: "bonus", share: 0.3 }])).toThrow(
			/one of oneIn and share/
		);
		expect(() =>
			weighRows(values, 9_600, {
				groups: [{ name: "empty", oneIn: 100 }],
				groupOf: values.map(() => -1)
			})
		).toThrow(/"empty" has no rows/);
	});
});

describe("what cannot be weighed", () => {
	it("is a target over everything the rows pay, or under it", () => {
		expect(() => weighRows([0, 5_000, 9_000], 9_600)).toThrow(/No row is worth/);
		expect(() => weighRows([10_000, 20_000], 9_600)).toThrow(/none is under it/);
		expect(() => weighRows([], 9_600)).toThrow(/no rows/);
		expect(() => weighRows([0, 100.5], 9_600)).toThrow(/whole number/);
	});

	it("is not a table whose every row is worth the target", () => {
		const weights = weighRows([9_600, 9_600, 9_600], 9_600);

		expect(new Set(weights).size).toBe(1);
		expect(over([9_600, 9_600, 9_600], weights, 9_600).excess).toBe(0n);
	});
});
