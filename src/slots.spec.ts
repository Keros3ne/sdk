/**
 * What slots share: that each way a grid pays finds the wins a player would, that what
 * falls falls rightly, that everything that repeats stops at its limit, and that a round
 * recorded is a row a book can hold.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import * as valibot from "valibot";
import { describe, expect, it } from "vitest";
import { bookRow } from "./book.ts";
import { playingRng } from "./book-play.ts";
import {
	anywhereWins,
	cellsOf,
	clusterWins,
	createRound,
	drawGrid,
	fall,
	freeSpins,
	gridFromRows,
	lineWins,
	payFor,
	refillFromStrips,
	spinStrips,
	stripWindow,
	tumble,
	waysWins,
	weighted,
	type Paytable
} from "./slots.ts";

type Sym = "A" | "B" | "C" | "W" | "S";

/** A grid from its rows as text: `"A B C"` is one row of three reels. */
const grid = (...rows: string[]) =>
	gridFromRows(rows.map((row) => row.split(" ") as Sym[]));

const pays: Paytable<Sym> = {
	A: { 3: 10_000, 4: 30_000, 5: 100_000 },
	B: { 3: 5_000, 4: 10_000, 5: 20_000 },
	W: { 3: 50_000 }
};
const rules = { pays, wild: "W" as Sym };
const rng = () => playingRng(1, "slots", 0);

describe("grids", () => {
	it("are their reels, from rows written top first", () => {
		expect(grid("A B", "C W")).toEqual([
			["A", "C"],
			["B", "W"]
		]);
	});

	it("show a strip from its stop, wrapping round", () => {
		expect(stripWindow(["A", "B", "C"], 2, 3)).toEqual(["C", "A", "B"]);

		const strips = [
			["A", "B", "C"],
			["C", "B", "A"]
		];
		const spun = spinStrips(strips, 2, rng());

		expect(spun.grid).toEqual(
			spun.stops.map((stop, reel) => stripWindow(strips[reel], stop, 2))
		);
	});

	it("are drawn by weight, each thing as often as it weighs", () => {
		const draw = weighted<Sym>([
			["A", 3],
			["B", 1],
			["C", 0]
		]);
		const stream = rng();
		const drawn = drawGrid(100, 100, () => draw(stream)).flat();
		const share = drawn.filter((symbol) => symbol === "A").length / drawn.length;

		expect(share).toBeGreaterThan(0.73);
		expect(share).toBeLessThan(0.77);
		expect(drawn).not.toContain("C");
		expect(() => weighted([["A", 0]])).toThrow(/come to nothing/);
		expect(() => weighted([["A", 1.5]])).toThrow(/whole number/);
	});

	it("say where a symbol is", () => {
		expect(cellsOf(grid("A S", "S A"), (symbol) => symbol === "S")).toEqual([
			[0, 1],
			[1, 0]
		]);
	});
});

describe("a paytable", () => {
	it("pays the greatest count listed that is not over what there is", () => {
		const clusters: Paytable<Sym> = { A: { 5: 1_000, 8: 5_000, 12: 20_000 } };

		expect(
			[4, 5, 7, 8, 11, 12, 30].map((count) => payFor(clusters, "A", count))
		).toEqual([0, 1_000, 1_000, 5_000, 5_000, 20_000, 20_000]);
		expect(payFor(clusters, "B", 9)).toBe(0);
	});
});

describe("lines", () => {
	const lines = [
		[0, 0, 0, 0, 0],
		[1, 1, 1, 1, 1],
		[0, 1, 0, 1, 0]
	];

	it("pay from the left, for as far as the symbol runs", () => {
		const wins = lineWins(grid("A A A B C", "B B C A A"), lines, rules);

		expect(wins).toEqual([
			{
				symbol: "A",
				count: 3,
				cells: [
					[0, 0],
					[1, 0],
					[2, 0]
				],
				payoutBp: 10_000,
				line: 0
			}
		]);
	});

	it("let a wild stand for the line's symbol", () => {
		const [win] = lineWins(grid("W A W A C", "C C C C C"), lines, rules);

		expect(win).toMatchObject({ symbol: "A", count: 4, payoutBp: 30_000, line: 0 });
	});

	it("pay a line that opens with wilds as whichever is more", () => {
		// Three wilds pay 5 bets; as four B they would pay 1.
		const [asWilds] = lineWins(grid("W W W B C", "C C C C C"), lines, rules);
		// Three wilds pay 5 bets; as five A they pay 10.
		const [asSymbol] = lineWins(grid("W W W A A", "C C C C C"), lines, rules);

		expect(asWilds).toMatchObject({ symbol: "W", count: 3, payoutBp: 50_000 });
		expect(asSymbol).toMatchObject({ symbol: "A", count: 5, payoutBp: 100_000 });
	});

	it("follow a line that is not straight", () => {
		const [win] = lineWins(grid("A C A C A", "C A C A C"), lines, rules);

		expect(win).toMatchObject({ symbol: "A", count: 5, line: 2 });
		expect(win.cells).toEqual([
			[0, 0],
			[1, 1],
			[2, 0],
			[3, 1],
			[4, 0]
		]);
	});
});

describe("ways", () => {
	it("pay once for every way through the reels from the left", () => {
		// A on reels one to three: two of it, one, and two with the wild. Four ways.
		const wins = waysWins(grid("A A A C C", "A C W C C", "C C C C A"), rules);

		expect(wins).toHaveLength(1);
		expect(wins[0]).toMatchObject({
			symbol: "A",
			count: 3,
			ways: 4,
			payoutBp: 40_000
		});
		expect(wins[0].cells).toHaveLength(5);
	});

	it("pay nothing for a symbol missing from a reel on the way", () => {
		expect(waysWins(grid("A C A A A", "A C A A A"), rules)).toEqual([]);
	});
});

describe("anywhere", () => {
	it("pays for how many are in view, wherever they are", () => {
		const scatter: Paytable<Sym> = { S: { 3: 20_000, 4: 100_000 } };
		const wins = anywhereWins(grid("S A B", "A A S", "B S A"), { pays: scatter });

		expect(wins).toEqual([
			{
				symbol: "S",
				count: 3,
				cells: [
					[0, 0],
					[1, 2],
					[2, 1]
				],
				payoutBp: 20_000
			}
		]);
		expect(anywhereWins(grid("S A B", "A A S"), { pays: scatter })).toEqual([]);
	});
});

describe("clusters", () => {
	const clusters = {
		pays: { A: { 4: 8_000, 6: 25_000 }, B: { 4: 2_000 } } as Paytable<Sym>,
		wild: "W" as Sym
	};

	it("pay for symbols that touch side to side or one above another", () => {
		const wins = clusterWins(
			grid("A A C B", "A C C B", "A C B B", "C C C C"),
			clusters
		);

		expect(wins.map((win) => [win.symbol, win.count, win.payoutBp])).toEqual([
			["A", 4, 8_000],
			["B", 4, 2_000]
		]);
	});

	it("do not join across a corner", () => {
		expect(clusterWins(grid("A A C", "C C A", "C C A"), clusters)).toEqual([]);
	});

	it("let a wild join every cluster it touches", () => {
		// Three A and three B, each with the one wild between them: four of each.
		const wins = clusterWins(grid("A A A", "C W C", "B B B"), clusters);

		expect(wins.map((win) => [win.symbol, win.count])).toEqual([
			["A", 4],
			["B", 4]
		]);
		expect(wins[0].cells).toContainEqual([1, 1]);
		expect(wins[1].cells).toContainEqual([1, 1]);
	});

	it("count two groups a wild joins as one cluster, once", () => {
		const wins = clusterWins(grid("A A C", "C W C", "C A A", "C C A"), clusters);

		expect(wins.map((win) => [win.symbol, win.count, win.payoutBp])).toEqual([
			["A", 6, 25_000]
		]);
	});
});

describe("a tumble", () => {
	it("takes cells away, lets the rest fall and fills the top", () => {
		const fallen = tumble(
			grid("A B", "B B", "C A"),
			[
				[0, 1],
				[1, 0],
				[1, 1]
			],
			(reel, count) =>
				Array.from({ length: count }, (_, index) => `${reel}${index}` as Sym)
		);

		expect(fallen.grid).toEqual([
			["00", "A", "C"],
			["10", "11", "A"]
		]);
		expect(fallen.drops).toEqual([["00"], ["10", "11"]]);
	});

	it("is refilled from the strips, from above where each stopped", () => {
		const strip: Sym[] = ["A", "B", "C", "S", "W"];
		const refill = refillFromStrips([strip], [1]);

		// The reel shows B C S from stop 1. Two more come down: W and A were above.
		expect(refill(0, 2)).toEqual(["W", "A"]);
		// And one more above those.
		expect(refill(0, 1)).toEqual(["S"]);
	});
});

describe("a fall", () => {
	const anywhere = { pays: { A: { 3: 10_000 } } as Paytable<Sym> };

	it("pays, takes the wins away and pays again until nothing does", () => {
		const fresh: Sym[][] = [
			["A", "A", "A"],
			["B", "C", "B"]
		];
		const fell = fall<Sym>({
			grid: grid("A A A", "B C B"),
			wins: (each) => anywhereWins(each, anywhere),
			refill: (reel) => [fresh[0].length ? fresh[0].shift()! : fresh[1][reel]],
			limit: 10
		});

		// The first three A pay and are replaced by three more, which pay and are not.
		expect(fell.steps).toHaveLength(2);
		expect(fell.payoutBp).toBe(20_000);
		expect(fell.cut).toBe(false);
		expect(fell.grid).toEqual(grid("B C B", "B C B"));
	});

	it("stops at its limit, however long it would have gone on", () => {
		const fell = fall<Sym>({
			grid: grid("A A A"),
			wins: (each) => anywhereWins(each, anywhere),
			refill: () => ["A"],
			limit: 25
		});

		expect(fell.steps).toHaveLength(25);
		expect(fell.payoutBp).toBe(250_000);
		expect(fell.cut).toBe(true);
	});

	it("keeps back what a game says stays", () => {
		const withWild = {
			pays: { A: { 3: 10_000 } } as Paytable<Sym>,
			wild: "W" as Sym
		};
		const fell = fall<Sym>({
			grid: grid("A A W"),
			wins: (each) => anywhereWins(each, withWild),
			refill: (_, count) => Array.from({ length: count }, (): Sym => "C"),
			limit: 5,
			taken: (wins, each) =>
				wins
					.flatMap((win) => win.cells)
					.filter(([reel, row]) => each[reel][row] !== "W")
		});

		expect(fell.grid).toEqual(grid("C C W"));
	});

	it("is refused without a limit", () => {
		const options = { grid: grid("A"), wins: () => [], refill: () => [] };

		expect(() => fall({ ...options, limit: 0 })).toThrow(/needs a limit/);
		expect(() => fall({ ...options, limit: Infinity })).toThrow(/needs a limit/);
	});
});

describe("free spins", () => {
	it("are played out, with the ones they win on top", () => {
		const played = freeSpins({
			spins: 3,
			limit: 50,
			play: (index, left) => ({ payoutBp: 1_000, more: index === 1 ? 2 : 0, left })
		});

		expect(played.spins.map((spin) => spin.left)).toEqual([2, 1, 2, 1, 0]);
		expect(played.payoutBp).toBe(5_000);
		expect(played.cut).toBe(false);
	});

	it("stop at their limit, however many they keep winning", () => {
		const played = freeSpins({
			spins: 1,
			limit: 40,
			play: () => ({ payoutBp: 500, more: 1 })
		});

		expect(played.spins).toHaveLength(40);
		expect(played.cut).toBe(true);
		expect(() =>
			freeSpins({ spins: 1, limit: -1, play: () => ({ payoutBp: 0 }) })
		).toThrow(/needs a limit/);
	});
});

describe("a round recorded", () => {
	it("is its events in order, what it paid, and a total to close", () => {
		const round = createRound();

		round.event("reveal", { grid: grid("A A A") });
		round.pay(10_000);
		round.event("win", { amountBp: 10_000 });
		round.pay(2_500);

		expect(round.payoutBp).toBe(12_500);
		expect(round.row()).toEqual({
			payoutBp: 12_500,
			events: [
				{ type: "reveal", grid: [["A"], ["A"], ["A"]] },
				{ type: "win", amountBp: 10_000 },
				{ type: "total", payoutBp: 12_500 }
			]
		});
	});

	it("is a row a book can hold, with what it adds and the choice it ends in", () => {
		const round = createRound();
		round.event("bonus");

		const { payoutBp, ...row } = round.row({
			adds: { gem: 2 },
			choice: [
				{ id: "keep", table: "bonus-keep" },
				{ id: "gamble", table: "bonus-gamble" }
			]
		});

		expect(payoutBp).toBe(0);
		expect(valibot.safeParse(bookRow, row).success).toBe(true);
		expect(() => round.pay(0.5)).toThrow(/whole numbers/);
	});
});
