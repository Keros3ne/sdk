import { describe, expect, it } from "vitest";
import { placeLabels, type Cell } from "./labels";

const line = (rows: number[], count: number): Cell[] =>
	rows.slice(0, count).map((row, reel) => [reel, row] as const);

describe("placeLabels", () => {
	it("puts a single win on the cell in the middle of it", () => {
		expect(placeLabels([line([1, 1, 1, 1, 1], 3)])).toEqual([[1, 1]]);
		expect(placeLabels([line([0, 0, 0, 0, 0], 5)])).toEqual([[2, 0]]);
	});

	it("puts every label on one of its own win's cells", () => {
		const wins = [
			line([1, 1, 1, 1, 1], 4),
			line([0, 1, 2, 1, 0], 3),
			line([2, 1, 0, 1, 2], 5),
			[
				[4, 0],
				[0, 2],
				[3, 2]
			] as Cell[]
		];
		placeLabels(wins).forEach((cell, index) =>
			expect(wins[index]).toContainEqual(cell)
		);
	});

	it("never gives two wins the same cell while they have another to use", () => {
		// Three lines that all pass through the middle of the second reel.
		const crossing = [
			line([1, 1, 1, 1, 1], 3),
			line([0, 1, 2, 1, 0], 3),
			line([2, 1, 0, 1, 2], 3)
		];
		const cells = placeLabels(crossing).map(([reel, row]) => `${reel},${row}`);
		expect(new Set(cells).size).toBe(3);

		// Two lines that won on exactly the same cells.
		const same = [line([1, 1, 1, 1, 1], 3), line([1, 1, 1, 0, 0], 3)];
		const [a, b] = placeLabels(same);
		expect(a).not.toEqual(b);
	});

	it("spreads the labels of symbols scattered over the whole grid", () => {
		// Six symbols, each on six cells of a six by six grid, interleaved as a tumbling slot leaves them.
		const wins: Cell[][] = Array.from({ length: 6 }, () => []);
		for (let reel = 0; reel < 6; reel++)
			for (let row = 0; row < 6; row++)
				wins[(reel * 5 + row * 7) % 6].push([reel, row]);
		const placed = placeLabels(wins);
		for (const [i, a] of placed.entries()) {
			for (const b of placed.slice(i + 1)) {
				// No two share a cell, or sit side by side on a row.
				expect(a[1] === b[1] && Math.abs(a[0] - b[0]) < 2, `${a} and ${b}`).toBe(
					false
				);
			}
		}
	});

	it("keeps the order of the wins, and copes with a win that has no cells", () => {
		const wins = [[[0, 0]] as Cell[], [] as Cell[], [[4, 2]] as Cell[]];
		expect(placeLabels(wins)).toEqual([
			[0, 0],
			[0, 0],
			[4, 2]
		]);
	});
});
