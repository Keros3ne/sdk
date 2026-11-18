/**
 * The check of a game's books: that a mode's return is summed exactly and held between
 * 96.00% and a basis point under it, that a choice is counted at its best option, that
 * what a mode swings by and the most it pays are read rightly, and that a game whose
 * tables do not join up is refused, with the reason.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { BookRow } from "./book.ts";
import { checkBooks, type ScannableBook } from "./book-check.ts";
import { checkGameFolder, createBookWriter, writeBooksSummary } from "./book-files.ts";
import { checkGameManifest } from "./game-manifest.ts";

type Choice = NonNullable<BookRow["choice"]>;

/** A row as these tests write one: its weight, what it pays, and the tables it offers. */
type Row = [weight: number, payoutBp: number, offers?: string[]];

/** A table in memory, from its rows. */
function table(rows: Row[]): ScannableBook {
	return {
		totalWeight: rows.reduce((total, [weight]) => total + weight, 0),
		scan(visit) {
			rows.forEach(([weight, payoutBp, offers], number) => {
				const choice: Choice | undefined = offers?.map((name) => ({
					id: name,
					table: name
				}));

				visit(
					{ weight, payoutBp },
					{ events: [], ...(choice ? { choice } : {}) },
					number
				);
			});
		}
	};
}

/** A game with these modes, each `[id, cost in bets, table]`. */
const game = (...modes: [string, number, string][]) =>
	checkGameManifest("game.json", {
		slug: "test-game",
		name: "Test game",
		blurb: "A game for the check.",
		category: "slots",
		modes: modes.map(([id, bets, opens]) => ({
			id,
			name: id,
			costBp: bets * 10_000,
			table: opens
		}))
	});

const spin = game(["spin", 1, "spin"]);

describe("a mode's return", () => {
	it("passes at exactly 96.00%", () => {
		// 24 in 100 pay four bets.
		const check = checkBooks(spin, {
			spin: table([
				[76, 0],
				[24, 40_000]
			])
		});

		expect(check.problems).toEqual([]);
		expect(check.passed).toBe(true);
		expect(check.modes).toEqual([
			{
				id: "spin",
				rtpBp: 9_600,
				volatility: expect.closeTo(4 * Math.sqrt(0.24 * 0.76), 6),
				maxMultiplierBp: 40_000
			}
		]);
	});

	it("passes under a basis point below, and fails at one or over the figure", () => {
		const paying = (weight: number) =>
			checkBooks(spin, {
				spin: table([
					[200_000 - weight, 0],
					[weight, 40_000]
				])
			});

		// 47,996 in 200,000 is 95.992%; 47,995 is 95.99%, exactly one basis point under.
		expect(paying(47_996).passed).toBe(true);
		expect(paying(47_995).problems).toEqual([
			'the mode "spin" returns 95.9900%, a basis point or more under 96.00%'
		]);
		expect(paying(48_001).problems).toEqual([
			'the mode "spin" returns 96.0020%, over 96.00%'
		]);
	});

	it("is exact where ordinary arithmetic is not", () => {
		// Weights near the most a book may weigh: 6 in 25 pay four bets, and one more does.
		const part = 2 ** 46;
		const over = checkBooks(spin, {
			spin: table([
				[19 * part - 1, 0],
				[6 * part + 1, 40_000]
			])
		});

		expect(over.passed).toBe(false);
		expect(over.problems[0]).toMatch(/over 96\.00%/);
	});

	it("is of what the mode costs", () => {
		// A bonus bought for a hundred bets returns ninety-six of them.
		const bought = game(["spin", 1, "spin"], ["bonus", 100, "bonus"]);
		const check = checkBooks(bought, {
			spin: table([
				[76, 0],
				[24, 40_000]
			]),
			bonus: table([
				[1, 0],
				[1, 1_920_000]
			])
		});

		expect(check.problems).toEqual([]);
		expect(check.modes[1]).toEqual({
			id: "bonus",
			rtpBp: 9_600,
			volatility: expect.closeTo(0.96, 6),
			maxMultiplierBp: 1_920_000
		});
	});
});

describe("a choice", () => {
	// 23 in 100 pay two bets, and 5 in 100 land a bonus worth ten: 4,600 and 5,000.
	const rows = (...offers: string[]): Row[] => [
		[72, 0],
		[23, 20_000],
		[5, 0, offers]
	];
	const steady = table([[1, 100_000]]);
	const wild = table([
		[9, 0],
		[1, 1_000_000]
	]);

	it("is counted at its best option, and an option may be worth less", () => {
		const lesser = table([[1, 90_000]]);
		const check = checkBooks(spin, {
			spin: table(rows("steady", "lesser")),
			steady,
			lesser
		});

		expect(check.problems).toEqual([]);
		expect(check.modes[0].rtpBp).toBe(9_600);
		expect(check.modes[0].maxMultiplierBp).toBe(100_000);
	});

	it("fails the game if any option is worth more than was counted on", () => {
		const richer = table([[1, 110_000]]);
		const check = checkBooks(spin, {
			spin: table(rows("steady", "richer")),
			steady,
			richer
		});

		expect(check.problems).toEqual([
			'the mode "spin" returns 101.0000%, over 96.00%'
		]);
	});

	it("of two options worth the same, rates the one that swings more", () => {
		const calm = checkBooks(spin, { spin: table(rows("steady")), steady });
		const both = checkBooks(spin, {
			spin: table(rows("steady", "wild")),
			steady,
			wild
		});

		expect(both.problems).toEqual([]);
		expect(both.modes[0].rtpBp).toBe(9_600);
		expect(both.modes[0].volatility).toBeGreaterThan(calm.modes[0].volatility * 2);
		expect(both.modes[0].maxMultiplierBp).toBe(1_000_000);
	});

	it("rates the one that swings more of two a hair apart, as weighed options are", () => {
		// Worth 99,999.9 where the steady one is worth 100,000: as good, to a player.
		const nearly = table([
			[9_000_001, 0],
			[999_999, 1_000_000]
		]);
		const calm = checkBooks(spin, { spin: table(rows("steady")), steady });
		const both = checkBooks(spin, {
			spin: table(rows("steady", "nearly")),
			steady,
			nearly
		});

		expect(both.problems).toEqual([]);
		expect(both.modes[0].rtpBp).toBe(9_600);
		expect(both.modes[0].volatility).toBeGreaterThan(calm.modes[0].volatility * 2);
	});

	it("may lead to another, and what each pays adds up", () => {
		// The bonus pays two bets itself and offers a gamble worth eight: ten in all.
		const bonus = table([[1, 20_000, ["gamble"]]]);
		const gamble = table([
			[3, 0],
			[1, 320_000]
		]);
		const check = checkBooks(spin, { spin: table(rows("bonus")), bonus, gamble });

		expect(check.problems).toEqual([]);
		expect(check.modes[0].rtpBp).toBe(9_600);
		expect(check.modes[0].maxMultiplierBp).toBe(340_000);
	});
});

describe("a game whose tables do not join up", () => {
	const plain: Row[] = [
		[76, 0],
		[24, 40_000]
	];

	it("is refused for a mode or a choice with no book", () => {
		expect(checkBooks(spin, {}).problems).toEqual([
			'the mode "spin" opens the table "spin", which has no book'
		]);
		expect(
			checkBooks(spin, { spin: table([...plain, [1, 0, ["bonus", "missing"]]]) })
				.problems
		).toEqual([
			'the table "spin" offers a choice of the table "bonus", which has no book',
			'the table "spin" offers a choice of the table "missing", which has no book'
		]);
	});

	it("is refused for a table that leads back to itself", () => {
		const check = checkBooks(spin, {
			spin: table([...plain, [1, 0, ["bonus", "other"]]]),
			bonus: table([[1, 0, ["spin", "other"]]]),
			other: table([[1, 0]])
		});

		expect(check.passed).toBe(false);
		expect(check.problems).toContain(
			'the table "spin" leads back to itself through its choices (spin, bonus, spin)'
		);
	});

	it("is refused for a table nothing opens, and for choices too deep", () => {
		expect(
			checkBooks(spin, { spin: table(plain), spare: table(plain) }).problems
		).toEqual(['the table "spare" is opened by no mode and offered by no choice']);

		// Nine tables in a chain, each offering the next: nine choices to the end.
		const chain: Record<string, ScannableBook> = {
			spin: table([[1, 0, ["step-1", "step-1"]]])
		};
		for (let step = 1; step <= 8; step++)
			chain[`step-${step}`] = table([
				[1, 0, [`step-${step + 1}`, `step-${step + 1}`]]
			]);
		chain["step-9"] = table([[1, 9_600]]);

		expect(checkBooks(spin, chain).problems).toEqual([
			'a round of the mode "spin" can take 9 choices, and a round takes at most 8'
		]);
	});
});

describe("a game's folder", () => {
	const folder = mkdtempSync(join(tmpdir(), "keros3ne-check-"));
	afterAll(() => rmSync(folder, { recursive: true, force: true }));

	it("is checked from game.json and the books beside it", () => {
		const books = join(folder, "books");
		const writer = createBookWriter(books, "spin");
		writer.add({ weight: 76, payoutBp: 0, events: [] });
		writer.add({ weight: 24, payoutBp: 40_000, events: [{ type: "win" }] });

		writeBooksSummary(books, { spin: writer.close() });
		writeFileSync(join(folder, "game.json"), JSON.stringify(spin));

		const checked = checkGameFolder(folder);
		expect(checked.game.slug).toBe("test-game");
		expect(checked.check.passed).toBe(true);
		expect(checked.check.modes[0].rtpBp).toBe(9_600);
		expect(Object.keys(checked.books.tables)).toEqual(["spin"]);
	});
});

describe("a game with counters", () => {
	/** A row that adds to counters as well: its weight, what it pays, and what it adds. */
	type Adding = [
		weight: number,
		payoutBp: number,
		adds?: Record<string, number>,
		offers?: string[]
	];

	/** A table in memory whose rows may add to counters. */
	function adding(rows: Adding[]): ScannableBook {
		return {
			totalWeight: rows.reduce((total, [weight]) => total + weight, 0),
			scan(visit) {
				rows.forEach(([weight, payoutBp, adds, offers], number) => {
					const choice = offers?.map((name) => ({ id: name, table: name }));

					visit(
						{ weight, payoutBp },
						{
							events: [],
							...(adds ? { adds } : {}),
							...(choice ? { choice } : {})
						},
						number
					);
				});
			}
		};
	}

	const bronze = { id: "bronze", full: 10, worthBp: 100, table: "pour-bronze" };
	const silver = { id: "silver", full: 5, worthBp: 300, table: "pour-silver" };
	const withCounters = (extra: object = {}) =>
		checkGameManifest("game.json", { ...spin, counters: [bronze], ...extra });

	// 24 in 100 pay 3.8 bets, and 30 in 100 pay 0.14 and add two units worth 0.01 each:
	// 9,120 and 480. Without the units counted it would come to 95.40%.
	const rows: Adding[] = [
		[46, 0],
		[24, 38_000],
		[30, 1_400, { bronze: 2 }]
	];
	// Ten units were counted at 1,000, and the pour is worth 1,000.
	const pour = adding([
		[1, 0],
		[1, 2_000]
	]);

	it("counts a unit added at what it is worth", () => {
		const check = checkBooks(withCounters(), {
			spin: adding(rows),
			"pour-bronze": pour
		});

		expect(check.problems).toEqual([]);
		expect(check.modes[0].rtpBp).toBe(9_600);
		expect(check.modes[0].maxMultiplierBp).toBe(38_000);
	});

	it("counts the most a fill can pay towards the most a round can", () => {
		// The same worth, but one pour in a thousand pays a hundred bets.
		const rare = adding([
			[999, 0],
			[1, 1_000_000]
		]);
		const check = checkBooks(withCounters(), {
			spin: adding(rows),
			"pour-bronze": rare
		});

		expect(check.problems).toEqual([]);
		expect(check.modes[0].maxMultiplierBp).toBe(1_001_400);
	});

	it("holds a counter's table to what its units were counted at", () => {
		const worth = (payoutBp: number) =>
			checkBooks(withCounters(), {
				spin: adding(rows),
				"pour-bronze": adding([
					[1, 0],
					[1, payoutBp]
				])
			}).problems;

		expect(worth(2_200)).toEqual([
			'the table "pour-bronze" is worth 1100.00 basis points, more than the 1000 that filling the counter "bronze" was counted at'
		]);
	});

	it("holds a mode to the basis point with its counters counted at what their tables pay", () => {
		const pouring = (payoutBp: number) =>
			checkBooks(withCounters(), {
				spin: adding(rows),
				"pour-bronze": adding([
					[1, 0],
					[1, payoutBp]
				])
			});

		// A pour worth 999 of the 1,000 counted: the 60 a spin adds come to 59.94, and
		// the mode to 95.9994%. Worth 800, they come to 48, and the mode to 95.88%.
		expect(pouring(1_998).problems).toEqual([]);
		expect(pouring(1_998).modes[0].rtpBp).toBe(9_600);
		expect(pouring(1_600).problems).toEqual([
			'the mode "spin" returns as little as 95.8800% with its counters counted at what their tables pay, a basis point or more under 96.00%'
		]);
	});

	it("rates a mode on what its counters' tables really pay, and when", () => {
		// Every spin pays 0.959 and adds one of the ten units that fill the counter. One
		// spin in ten pours, and one pour in a hundred pays a bet: a variance of
		// 0.1 x 0.01 x 10,000^2 less the mean of 10 squared, in basis points.
		const every = adding([[1, 9_590, { bronze: 1 }]]);
		const game = withCounters({ counters: [{ ...bronze, worthBp: 10 }] });
		const rare = checkBooks(game, {
			spin: every,
			"pour-bronze": adding([
				[99, 0],
				[1, 10_000]
			])
		});
		const steady = checkBooks(game, {
			spin: every,
			"pour-bronze": adding([[1, 100]])
		});

		expect(rare.problems).toEqual([]);
		expect(rare.modes[0].volatility).toBeCloseTo(Math.sqrt(99_900) / 10_000, 9);

		// A pour that always pays the same still comes one spin in ten.
		expect(steady.modes[0].volatility).toBeCloseTo(
			Math.sqrt(0.1 * 0.9 * 100 ** 2) / 10_000,
			9
		);
	});

	it("holds a table for counters that fill together to what they all were counted at", () => {
		const game = withCounters({
			counters: [bronze, silver],
			fills: [{ counters: ["bronze", "silver"], table: "pour-both" }]
		});
		const books = (bothPays: number) => ({
			spin: adding(rows),
			"pour-bronze": pour,
			"pour-silver": adding([[1, 1_500]]),
			"pour-both": adding([[1, bothPays]])
		});

		expect(checkBooks(game, books(2_500)).problems).toEqual([]);
		expect(checkBooks(game, books(2_600)).problems).toEqual([
			'the table "pour-both" is worth 2600.00 basis points, more than the 2500 that filling the counters "bronze" and "silver" together was counted at'
		]);
	});

	it("lets a table that counters fill from only pay", () => {
		const check = checkBooks(withCounters(), {
			spin: adding(rows),
			"pour-bronze": adding([
				[1, 0, { bronze: 1 }],
				[1, 1_900]
			])
		});

		expect(check.problems).toEqual([
			'the table "pour-bronze" is drawn from when the counter "bronze" fills, so its rows may only pay: none may add to a counter or end in a choice'
		]);
	});

	it("refuses a row that adds to no counter of the game, or more than fills one", () => {
		const added = (adds: Record<string, number>) =>
			checkBooks(withCounters(), {
				spin: adding([...rows, [1, 0, adds]]),
				"pour-bronze": pour
			}).problems;

		expect(added({ tin: 1 })).toContain(
			'the table "spin" adds to a counter "tin" the game does not have'
		);
		expect(added({ bronze: 11 })).toContain(
			'the table "spin" adds 11 to the counter "bronze" at once, more than fills it'
		);
	});

	it("refuses a counter whose table has no book", () => {
		expect(checkBooks(withCounters(), { spin: adding(rows) }).problems).toEqual([
			'the counter "bronze" fills from the table "pour-bronze", which has no book'
		]);
	});
});
