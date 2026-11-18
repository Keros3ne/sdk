/**
 * A round played from books and checked again: that the check agrees with the play for
 * every bet, with and without choices, and that it catches a site that shows another
 * row, another table, another page or another choice than the seeds give.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PAGE_ROWS } from "./book.ts";
import {
	createBookWriter,
	openBooks,
	writeBooksSummary,
	type Book
} from "./book-files.ts";
import {
	CHOICE_MAX_DEPTH,
	playRound,
	startingCounters,
	verifyRound,
	type Counters,
	type DrawableBook,
	type HeldCounters,
	type PlayedRound,
	type RowProof
} from "./book-round.ts";
import type { BookRow } from "./book.ts";
import type { CounterRules } from "./game-manifest.ts";
import { createRng, type Rng } from "./rng.ts";

const folder = mkdtempSync(join(tmpdir(), "keros3ne-round-"));
let books: Record<string, Book> = {};
let digests: Record<string, string> = {};

const WEATHERS = ["squall", "gale", "tempest"];

// A slot of three pages of rows. One row in five lands a bonus and offers the weather;
// each weather is a table of its own, and a gale may offer a gamble on top.
beforeAll(() => {
	const tables: Record<
		string,
		ReturnType<ReturnType<typeof createBookWriter>["close"]>
	> = {};

	const spin = createBookWriter(folder, "spin");
	for (let number = 0; number < PAGE_ROWS * 2 + 300; number++)
		spin.add({
			weight: 1 + (number % 9),
			payoutBp: (number % 11) * 3_000,
			events: [{ type: "reveal", stop: number }],
			...(number % 5 === 0
				? { choice: WEATHERS.map((id) => ({ id, table: `storm-${id}` })) }
				: {})
		});
	tables.spin = spin.close();

	for (const weather of WEATHERS) {
		const storm = createBookWriter(folder, `storm-${weather}`);

		for (let number = 0; number < 40; number++)
			storm.add({
				weight: 1 + (number % 3),
				payoutBp: number * 10_000,
				events: [{ type: "freeSpins", weather, number }],
				...(weather === "gale" && number % 2 === 0
					? {
							choice: [
								{ id: "keep", table: "gamble-keep" },
								{ id: "gamble", table: "gamble-risk" }
							]
						}
					: {})
			});
		tables[`storm-${weather}`] = storm.close();
	}

	for (const [name, pays] of [
		["gamble-keep", [50_000]],
		["gamble-risk", [0, 0, 150_000]]
	] as const) {
		const gamble = createBookWriter(folder, name);
		for (const payoutBp of pays) gamble.add({ weight: 1, payoutBp, events: [] });
		tables[name] = gamble.close();
	}

	writeBooksSummary(folder, tables);
	books = openBooks(folder);
	digests = Object.fromEntries(
		Object.entries(books).map(([name, book]) => [name, book.digest])
	);
});

afterAll(() => {
	for (const book of Object.values(books)) book.close();
	rmSync(folder, { recursive: true, force: true });
});

const rngOf = (nonce: number) => createRng("server seed", "client seed", nonce);

/** What the site would hand a browser for a round it played. */
const proofsOf = (round: PlayedRound): RowProof[] =>
	round.steps.map((step) => books[step.table].prove(step.row));

/** Plays a round to its end, picking by `pick` wherever it is asked to. */
function playOut(nonce: number, pick: (options: string[]) => string) {
	const choices: string[] = [];

	for (;;) {
		const round = playRound(books, "spin", rngOf(nonce), choices);
		if ("problem" in round) throw new Error(round.problem);

		if (!round.open) return { round, choices };

		choices.push(pick(round.steps[round.steps.length - 1].options!));
	}
}

/** The first bet whose round has at least this many choices in it, picking the gale. */
function betWith(choicesWanted: number) {
	for (let nonce = 0; nonce < 5_000; nonce++) {
		const played = playOut(nonce, (options) =>
			options.includes("gale") ? "gale" : "gamble"
		);
		if (played.choices.length >= choicesWanted) return { nonce, ...played };
	}

	throw new Error("No such bet in five thousand.");
}

describe("a round played from books", () => {
	it("is the same round every time it is asked for", () => {
		const first = playOut(7, (options) => options[0]);
		const second = playOut(7, (options) => options[0]);

		expect(second).toEqual(first);
	});

	it("stays open at a choice, and plays on from the option picked", () => {
		const { nonce } = betWith(1);
		const open = playRound(books, "spin", rngOf(nonce)) as PlayedRound;

		expect(open.open).toBe(true);
		expect(open.steps[0].options).toEqual(WEATHERS);

		const squall = playRound(books, "spin", rngOf(nonce), ["squall"]) as PlayedRound;
		expect(squall.open).toBe(false);
		expect(squall.steps[0]).toEqual({ ...open.steps[0], chosen: "squall" });
		expect(squall.steps[1].table).toBe("storm-squall");
		expect(squall.payoutBp).toBe(squall.steps[0].payoutBp + squall.steps[1].payoutBp);
	});

	it("refuses a choice not on offer, and one made after the round is over", () => {
		const { nonce } = betWith(1);

		expect(playRound(books, "spin", rngOf(nonce), ["hail"])).toEqual({
			problem: "That is not one of the choices."
		});
		expect(playRound(books, "spin", rngOf(nonce), ["squall", "gamble"])).toEqual({
			problem: "This round is over."
		});
	});

	it("throws for a game whose choices never end", () => {
		const loop = {
			draw: () => 0,
			row: () => ({
				record: { payoutBp: 0 },
				row: {
					events: [],
					choice: [
						{ id: "again", table: "loop" },
						{ id: "more", table: "loop" }
					]
				}
			})
		};
		const again = Array.from({ length: CHOICE_MAX_DEPTH + 1 }, () => "again");

		expect(() => playRound({ loop }, "loop", rngOf(0), again)).toThrow(/more than/);
	});
});

describe("a round checked from its seeds", () => {
	it("agrees with the play for every bet, whatever is picked", () => {
		for (let nonce = 0; nonce < 400; nonce++) {
			const { round, choices } = playOut(
				nonce,
				(options) => options[nonce % options.length]
			);
			const checked = verifyRound(
				digests,
				"spin",
				rngOf(nonce),
				choices,
				proofsOf(round)
			);

			expect(checked).toEqual({ ok: true, ...round });
		}
	});

	it("checks a round left open at its choice", () => {
		const { nonce } = betWith(1);
		const open = playRound(books, "spin", rngOf(nonce)) as PlayedRound;

		expect(verifyRound(digests, "spin", rngOf(nonce), [], proofsOf(open))).toEqual({
			ok: true,
			...open
		});
	});

	it("catches another row shown in place of the one drawn", () => {
		const { round } = playOut(3, (options) => options[0]);
		const [proof] = proofsOf(round);
		const row = round.steps[0].row;

		// A neighbour on the same page, and a row from another page.
		const neighbour = {
			...proof,
			line: books.spin.row(row === 0 ? 1 : row - 1).line
		};
		const elsewhere = books.spin.prove((row + PAGE_ROWS) % books.spin.rows);

		expect(verifyRound(digests, "spin", rngOf(3), [], [neighbour])).toEqual({
			ok: false,
			problem: "Draw 1: the row shown is not the row the draw lands on."
		});
		expect(verifyRound(digests, "spin", rngOf(3), [], [elsewhere])).toEqual({
			ok: false,
			problem: "Draw 1: the row shown is not on the page the draw lands on."
		});
	});

	it("catches a table, a page or a weight that is not what was published", () => {
		const { round } = playOut(3, (options) => options[0]);
		const [proof] = proofsOf(round);
		const check = (changed: RowProof, published = digests) =>
			verifyRound(published, "spin", rngOf(3), [], [changed]);

		const leaves = Uint8Array.from(proof.leaves);
		leaves[8] ^= 1;

		expect(check(proof, { ...digests, spin: digests["storm-gale"] })).toMatchObject({
			problem: "Draw 1: the table is not the one published before the bet."
		});
		expect(check({ ...proof, totalWeight: proof.totalWeight + 1 })).toMatchObject({
			problem: "Draw 1: the table is not the one published before the bet."
		});
		expect(check({ ...proof, leaves })).toMatchObject({
			problem: "Draw 1: the page shown is not the table's."
		});
		expect(check(proof)).toMatchObject({ ok: true });
	});

	it("catches a choice that was not the one recorded, or was never on offer", () => {
		const { nonce, round, choices } = betWith(2);
		const proofs = proofsOf(round);
		const check = (recorded: string[], shown = proofs) =>
			verifyRound(digests, "spin", rngOf(nonce), recorded, shown);

		expect(check(choices)).toMatchObject({ ok: true });
		expect(check(["squall", ...choices.slice(1)])).toMatchObject({ ok: false });
		expect(check(["hail"])).toEqual({
			ok: false,
			problem: "Draw 1: the choice recorded was not on offer."
		});
		expect(check(choices, proofs.slice(0, 1))).toEqual({
			ok: false,
			problem: "Draw 2: nothing was shown for it."
		});
		expect(check([], proofs)).toEqual({
			ok: false,
			problem: "More was recorded than the round had."
		});
	});
});

describe("a round of a game with counters", () => {
	const rules: CounterRules = {
		counters: [
			{ id: "bronze", full: 3, worthBp: 100, table: "pour-bronze" },
			{ id: "silver", full: 2, worthBp: 100, table: "pour-silver" }
		],
		fills: [{ counters: ["bronze", "silver"], table: "pour-both" }]
	};

	/** A table of one row, so that a draw is always that row. */
	const only = (payoutBp: number, rest: Partial<BookRow> = {}): DrawableBook => ({
		draw: () => 0,
		row: () => ({ record: { payoutBp }, row: { events: [], ...rest } })
	});

	const pours = {
		"pour-bronze": only(30_000),
		"pour-silver": only(20_000),
		"pour-both": only(90_000)
	};

	/** Plays one round of a spin that adds these units, holding these going in. */
	const spin = (adds: Counters, held: Counters, rest: Partial<BookRow> = {}) =>
		playRound(
			{ spin: only(5_000, { adds, ...rest }), ...pours },
			"spin",
			rngOf(0),
			[],
			{
				rules,
				held
			}
		) as PlayedRound;

	it("keeps what a row adds, for the next bet", () => {
		const round = spin({ bronze: 1 }, { bronze: 1 });

		expect(round.steps).toHaveLength(1);
		expect(round.steps[0].adds).toEqual({ bronze: 1 });
		expect(round.counters).toEqual({ bronze: 2, silver: 0 });
		expect(round.payoutBp).toBe(5_000);
	});

	it("draws from a counter's table when it fills, and keeps what was over", () => {
		const round = spin({ bronze: 2 }, { bronze: 2 });

		expect(round.steps.map((step) => step.table)).toEqual(["spin", "pour-bronze"]);
		expect(round.steps[1].filled).toEqual(["bronze"]);
		expect(round.counters).toEqual({ bronze: 1, silver: 0 });
		expect(round.payoutBp).toBe(35_000);
	});

	it("draws once from the table named for the counters that fill together", () => {
		const round = spin({ bronze: 1, silver: 1 }, { bronze: 2, silver: 1 });

		expect(round.steps.map((step) => step.table)).toEqual(["spin", "pour-both"]);
		expect(round.steps[1].filled).toEqual(["bronze", "silver"]);
		expect(round.counters).toEqual({ bronze: 0, silver: 0 });
		expect(round.payoutBp).toBe(95_000);
	});

	it("draws for a fill before it offers a choice", () => {
		const choice = [
			{ id: "keep", table: "pour-silver" },
			{ id: "gamble", table: "pour-both" }
		];
		const open = spin({ bronze: 3 }, {}, { choice });

		expect(open.open).toBe(true);
		expect(open.steps.map((step) => step.table)).toEqual(["spin", "pour-bronze"]);
		expect(open.steps[0].options).toEqual(["keep", "gamble"]);
	});

	it("holds what was kept under what fills a counter, whatever was kept", () => {
		const held = { bronze: 9, silver: -4, tin: 5, gold: Number.NaN };

		expect(startingCounters({ rules, held })).toEqual({ bronze: 2, silver: 0 });
	});

	it("throws for a row no checked game has", () => {
		expect(() => spin({ tin: 1 }, {})).toThrow(/no counter "tin"/);
		expect(() => spin({ silver: 3 }, {})).toThrow(/more than fills it/);
		expect(() =>
			playRound({ spin: only(0, { adds: { bronze: 1 } }) }, "spin", rngOf(0))
		).toThrow(/counters the game lacks/);
	});
});

describe("a round with counters, checked from its seeds", () => {
	const counterFolder = mkdtempSync(join(tmpdir(), "keros3ne-counters-"));
	const rules: CounterRules = {
		counters: [
			{ id: "bronze", full: 7, worthBp: 100, table: "pour-bronze" },
			{ id: "silver", full: 5, worthBp: 100, table: "pour-silver" }
		],
		fills: [{ counters: ["bronze", "silver"], table: "pour-both" }]
	};
	let counterBooks: Record<string, Book> = {};
	let counterDigests: Record<string, string> = {};

	beforeAll(() => {
		const tables: Record<
			string,
			ReturnType<ReturnType<typeof createBookWriter>["close"]>
		> = {};

		const spin = createBookWriter(counterFolder, "spin");
		for (let number = 0; number < 600; number++) {
			const adds = {
				...(number % 2 === 0 ? { bronze: 1 + (number % 3) } : {}),
				...(number % 3 === 0 ? { silver: 1 + (number % 2) } : {})
			};

			spin.add({
				weight: 1 + (number % 4),
				payoutBp: (number % 7) * 2_000,
				events: [{ type: "reveal", stop: number }],
				...(Object.keys(adds).length > 0 ? { adds } : {})
			});
		}
		tables.spin = spin.close();

		for (const name of ["pour-bronze", "pour-silver", "pour-both"]) {
			const pour = createBookWriter(counterFolder, name);
			for (let number = 0; number < 20; number++)
				pour.add({
					weight: 1,
					payoutBp: number * 5_000,
					events: [{ type: "pour" }]
				});
			tables[name] = pour.close();
		}

		writeBooksSummary(counterFolder, tables);
		counterBooks = openBooks(counterFolder);
		counterDigests = Object.fromEntries(
			Object.entries(counterBooks).map(([name, book]) => [name, book.digest])
		);
	});

	afterAll(() => {
		for (const book of Object.values(counterBooks)) book.close();
		rmSync(counterFolder, { recursive: true, force: true });
	});

	/** One bet: played from what was held, and what the site would show for it. */
	function bet(nonce: number, held: Counters) {
		const counters: HeldCounters = { rules, held };
		const round = playRound(
			counterBooks,
			"spin",
			rngOf(nonce),
			[],
			counters
		) as PlayedRound;
		const proofs = round.steps.map((step) =>
			counterBooks[step.table].prove(step.row)
		);

		return { round, proofs, counters };
	}

	/** Checks a bet's round against what was shown for it. */
	const check = (
		nonce: number,
		proofs: RowProof[],
		counters?: HeldCounters,
		rng?: Rng
	) => verifyRound(counterDigests, "spin", rng ?? rngOf(nonce), [], proofs, counters);

	it("agrees with the play over a run of bets, the counters carried from each to the next", () => {
		let held: Counters = {};
		let pours = 0;
		let together = 0;

		for (let nonce = 0; nonce < 400; nonce++) {
			const { round, proofs, counters } = bet(nonce, held);

			expect(check(nonce, proofs, counters)).toEqual({ ok: true, ...round });

			pours += round.steps.length - 1;
			together += round.steps.filter((step) => step.table === "pour-both").length;
			held = round.counters!;
		}

		// The run is only worth anything if counters filled in it, alone and together.
		expect(pours).toBeGreaterThan(50);
		expect(together).toBeGreaterThan(0);
	});

	it("catches a bet recorded with other counters than were held", () => {
		// A bet that fills nothing from empty, and would have filled bronze from nearly full.
		let nonce = 0;
		while (
			bet(nonce, {}).round.steps.length !== 1 ||
			bet(nonce, { bronze: 6 }).round.steps.length !== 2
		)
			nonce++;

		const empty = bet(nonce, {});
		const nearly = bet(nonce, { bronze: 6 });

		expect(check(nonce, empty.proofs, nearly.counters)).toEqual({
			ok: false,
			problem: "Draw 2: nothing was shown for it."
		});
		expect(check(nonce, nearly.proofs, empty.counters)).toEqual({
			ok: false,
			problem: "More was recorded than the round had."
		});
		expect(check(nonce, nearly.proofs, nearly.counters)).toMatchObject({ ok: true });
	});

	it("does not check out without the game's counters at all", () => {
		let nonce = 0;
		while (!bet(nonce, {}).round.steps[0].adds) nonce++;

		expect(check(nonce, bet(nonce, {}).proofs)).toEqual({
			ok: false,
			problem: "A row adds to counters the game lacks."
		});
	});
});
