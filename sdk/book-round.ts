/**
 * A round played from books, and the check of one. A round opens by drawing a row from
 * its mode's table. A row that ends in a choice leaves the round open; when the player
 * picks an option, a row is drawn from that option's table, and so on until a row ends
 * in none. Every draw of a round comes from the one stream its bet's seeds give, in
 * order, so the whole round is a function of the seeds and the choices made.
 *
 * A game with counters (./game-manifest.ts) adds one thing. What a row adds goes into
 * the counters the player held when the bet was placed, and for any that fill, a row is
 * drawn there and then from the table the game names, before anything else is drawn.
 * The round is then a function of the seeds, the choices and what was held.
 *
 * `playRound` is the site's: it reads the books. `verifyRound` is the player's: it runs
 * in their browser on the seeds once revealed, and believes nothing but the digest each
 * table had before the bet was placed. For each draw it is handed the row's line, the
 * page of the digest the row is on and the list of pages, and it makes the draw again
 * for itself, finds the row the draw lands on, and checks that the line is that row's.
 *
 * Pure: no files and no clock.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import * as valibot from "valibot";
import {
	LEAF_BYTES,
	PAGE_ROWS,
	bookDigest,
	bookRow,
	drawBelow,
	hashLine,
	hashPage,
	type BookPage,
	type BookRow
} from "./book.ts";
import { fillsFor, type CounterRules, type OwedFill } from "./game-manifest.ts";
import type { Rng } from "./rng.ts";

/** The most choices one round may take. A row past that may not end in another. */
export const CHOICE_MAX_DEPTH = 8;

/** What playing a round needs of a table: a draw, and a row by its number. */
export interface DrawableBook {
	draw(rng: Rng): number;
	row(row: number): { record: { payoutBp: number }; row: BookRow };
}

/** How many units of each counter are held, by counter. */
export type Counters = Record<string, number>;

/** A game's counters for one round: how they work, and what the player held going in. */
export interface HeldCounters {
	rules: CounterRules;
	held: Readonly<Counters>;
}

/** One draw of a round: the row it landed on, and what was picked if it ended in a choice. */
export interface RoundStep {
	table: string;
	row: number;
	payoutBp: number;
	events: BookRow["events"];
	/** What the row put into the counters. */
	adds?: Counters;
	/** The counters whose filling this row was drawn for. */
	filled?: string[];
	/** The ids on offer, if the row ends in a choice. */
	options?: string[];
	/** The one picked, once it has been. */
	chosen?: string;
}

export interface PlayedRound {
	steps: RoundStep[];
	/** What every row so far pays together, as a multiple of the bet in basis points. */
	payoutBp: number;
	/** True while the last row's choice has not been made. */
	open: boolean;
	/** What is held after the rows so far, for a game with counters. */
	counters?: Counters;
}

/** A refusal, in words for the player. Nothing was drawn that counts. */
export interface RoundProblem {
	problem: string;
}

/**
 * What a player holds going into a round, for each counter the game has: what was kept
 * for them, held under what fills the counter, since a game's counters may have changed
 * since it was kept.
 */
export function startingCounters(counters: HeldCounters): Counters {
	return Object.fromEntries(
		(counters.rules.counters ?? []).map((each) => {
			const kept = counters.held[each.id];
			const units = Number.isSafeInteger(kept) && kept > 0 ? kept : 0;

			return [each.id, Math.min(units, each.full - 1)];
		})
	);
}

/**
 * Puts what a row adds into the counters, and says what draws are owed for any that
 * filled, each giving back what fills it. Throws for a row no checked game has: one that
 * adds to a counter the game lacks, or more than fills one.
 */
function addTo(rules: CounterRules, held: Counters, adds: Counters): OwedFill[] {
	const filled: string[] = [];

	for (const [id, units] of Object.entries(adds)) {
		const counter = (rules.counters ?? []).find((each) => each.id === id);
		if (!counter) throw new Error(`The game has no counter "${id}".`);

		if (units > counter.full)
			throw new Error(`A row adds ${units} to "${id}", more than fills it.`);

		held[id] += units;
		if (held[id] < counter.full) continue;

		held[id] -= counter.full;
		filled.push(id);
	}

	return fillsFor(rules, filled);
}

/** What one draw gave: the row's number, what it pays, and its line read. */
interface Drawn {
	row: number;
	payoutBp: number;
	read: BookRow;
}

/**
 * A round worked out one draw at a time. `draw` makes the next draw of the stream from a
 * table: the site's reads its books, the browser's checks what it was shown. Both then
 * follow the same rules from here, so a round checked is a round played.
 *
 * Returns the round, a refusal, or (from `draw`) whatever stopped it. Throws for a game
 * that is broken, which the check of a game finds before it is ever played.
 */
function workOut<Stopped>(
	table: string,
	choices: readonly string[],
	counters: HeldCounters | undefined,
	draw: (table: string) => Drawn | Stopped,
	isStopped: (drawn: Drawn | Stopped) => drawn is Stopped
): PlayedRound | RoundProblem | Stopped {
	const steps: RoundStep[] = [];
	const held = counters ? startingCounters(counters) : undefined;
	let payoutBp = 0;

	/** The round as it stands. */
	const round = (open: boolean): PlayedRound => ({
		steps,
		payoutBp,
		open,
		...(held ? { counters: held } : {})
	});

	for (let depth = 0; depth <= CHOICE_MAX_DEPTH; depth++) {
		const drawn = draw(table);
		if (isStopped(drawn)) return drawn;

		const step: RoundStep = {
			table,
			row: drawn.row,
			payoutBp: drawn.payoutBp,
			events: drawn.read.events
		};

		steps.push(step);
		payoutBp += drawn.payoutBp;

		// Counters next: anything that fills is drawn for before the choice is offered.
		if (drawn.read.adds) {
			if (!counters || !held)
				throw new Error("A row adds to counters the game lacks.");

			step.adds = drawn.read.adds;

			for (const owed of addTo(counters.rules, held, drawn.read.adds)) {
				const fill = draw(owed.table);
				if (isStopped(fill)) return fill;

				if (fill.read.adds || fill.read.choice)
					throw new Error(`A row of "${owed.table}" does more than pay.`);

				steps.push({
					table: owed.table,
					row: fill.row,
					payoutBp: fill.payoutBp,
					events: fill.read.events,
					filled: owed.counters
				});
				payoutBp += fill.payoutBp;
			}
		}

		const choice = drawn.read.choice;
		if (!choice) {
			if (choices.length > depth) return { problem: "This round is over." };

			return round(false);
		}

		step.options = choice.map((option) => option.id);

		const picked = choices[depth];
		if (picked === undefined) return round(true);

		const option = choice.find((each) => each.id === picked);
		if (!option) return { problem: "That is not one of the choices." };

		step.chosen = picked;
		table = option.table;
	}

	throw new Error(`A round took more than ${CHOICE_MAX_DEPTH} choices.`);
}

/**
 * Plays a round as far as the choices given take it. `rng` is the bet's stream from its
 * start, `choices` every option picked so far, in order, and `counters` what the player
 * held when the bet was placed, for a game that has any. Asking again with one more
 * choice draws every earlier row again, the same, and one more.
 *
 * Throws only for a game that is broken: a table that is not there, or choices that
 * never end. Those are found when a game is checked, before it is ever played.
 */
export function playRound(
	tables: Readonly<Record<string, DrawableBook>>,
	table: string,
	rng: Rng,
	choices: readonly string[] = [],
	counters?: HeldCounters
): PlayedRound | RoundProblem {
	/** The next draw of the stream, from a table's book. */
	const draw = (from: string): Drawn => {
		const book = tables[from];
		if (!book) throw new Error(`The game has no table "${from}".`);

		const row = book.draw(rng);
		const { record, row: read } = book.row(row);

		return { row, payoutBp: record.payoutBp, read };
	};

	return workOut<never>(
		table,
		choices,
		counters,
		draw,
		(drawn): drawn is never => false
	);
}

/**
 * What the site hands a browser for one draw: the row's line as written, the leaves of
 * the page of the digest it is on, and the table's rows, weight and list of pages, from
 * which the browser makes the table's digest for itself.
 */
export interface RowProof {
	rows: number;
	totalWeight: number;
	pages: readonly BookPage[];
	/** Which page the row is on. */
	page: number;
	/** That page's leaves: `LEAF_BYTES` for each of its rows, in order. */
	leaves: Uint8Array;
	line: string;
}

export interface VerifiedRound extends PlayedRound {
	ok: true;
}

/** Why a round did not check out, in words. */
export interface FailedRound {
	ok: false;
	problem: string;
}

/** Whether two runs of bytes are the same. */
function sameBytes(first: Uint8Array, second: Uint8Array): boolean {
	if (first.length !== second.length) return false;

	for (let index = 0; index < first.length; index++)
		if (first[index] !== second[index]) return false;

	return true;
}

/** The last page that starts at or before a drawn number. */
function pageOf(pages: readonly BookPage[], drawn: number): number {
	let low = 0;
	let high = pages.length - 1;

	while (low < high) {
		const middle = Math.ceil((low + high) / 2);

		if (pages[middle].start <= drawn) low = middle;
		else high = middle - 1;
	}

	return low;
}

/**
 * Checks one draw. Makes the table's digest from the proof and holds it to the one
 * published, makes the draw, finds the row it lands on in the page given, and holds the
 * line to that row's hash. Returns the row, or the reason it does not check out.
 */
function verifyStep(proof: RowProof, digest: string, rng: Rng): Drawn | string {
	const { rows, totalWeight, pages, leaves } = proof;

	// The digest first: nothing else in the proof is worth reading unless it is the table's.
	if (bookDigest({ rows, totalWeight }, pages) !== digest)
		return "the table is not the one published before the bet";

	if (pages.length !== Math.ceil(rows / PAGE_ROWS) || pages[0]?.start !== 0)
		return "the table's pages are not those of its rows";

	const drawn = drawBelow(rng, totalWeight);
	const page = pageOf(pages, drawn);
	if (proof.page !== page) return "the row shown is not on the page the draw lands on";

	const count = Math.min(PAGE_ROWS, rows - page * PAGE_ROWS);
	if (
		leaves.length !== count * LEAF_BYTES ||
		!sameBytes(hashPage(leaves), pages[page].hash)
	)
		return "the page shown is not the table's";

	// Through the page's rows, each owning the numbers from the end before it to its own.
	const view = new DataView(leaves.buffer, leaves.byteOffset, leaves.byteLength);
	let end = pages[page].start;

	for (let offset = 0; offset < count; offset++) {
		const place = offset * LEAF_BYTES;

		end += view.getFloat64(place, true);
		if (drawn >= end) continue;

		const hash = leaves.subarray(place + 16, place + LEAF_BYTES);
		if (!sameBytes(hashLine(proof.line), hash))
			return "the row shown is not the row the draw lands on";

		let parsed: unknown;
		try {
			parsed = JSON.parse(proof.line);
		} catch {
			return "the row is not one a round can be played from";
		}

		const read = valibot.safeParse(bookRow, parsed);
		if (!read.success) return "the row is not one a round can be played from";

		return {
			row: page * PAGE_ROWS + offset,
			payoutBp: view.getFloat64(place + 8, true),
			read: read.output
		};
	}

	return "the draw lands past the end of the page";
}

/**
 * Checks a whole round from its seeds: `rng` is the bet's stream from its start, `table`
 * the one its mode opens, `digests` what each table's digest was before the bet, `choices`
 * what the bet records the player picked, `proofs` one for each draw, in order, and
 * `counters` what the bet records the player held, for a game that has any.
 *
 * What comes back when it checks out is the round as this worked it out: its rows, its
 * events, what it pays and what is held after it. The caller holds that to what the site
 * says the bet was.
 */
export function verifyRound(
	digests: Readonly<Record<string, string>>,
	table: string,
	rng: Rng,
	choices: readonly string[],
	proofs: readonly RowProof[],
	counters?: HeldCounters
): VerifiedRound | FailedRound {
	let made = 0;

	/** A failure at the draw now being made, counted from the first. */
	const failed = (problem: string): FailedRound => ({
		ok: false,
		problem: `Draw ${made + 1}: ${problem}.`
	});

	/** The next draw of the stream, checked against the next proof. */
	const draw = (from: string): Drawn | FailedRound => {
		const digest = digests[from];
		const proof = proofs[made];
		if (digest === undefined) return failed(`the game published no table "${from}"`);

		if (!proof) return failed("nothing was shown for it");

		const found = verifyStep(proof, digest, rng);
		if (typeof found === "string") return failed(found);

		made += 1;

		return found;
	};

	let round: PlayedRound | RoundProblem | FailedRound;
	try {
		round = workOut(
			table,
			choices,
			counters,
			draw,
			(drawn): drawn is FailedRound => "ok" in drawn
		);
	} catch (error) {
		// What the site's own play would throw for: here it is one more way not to check out.
		return {
			ok: false,
			problem: error instanceof Error ? error.message : String(error)
		};
	}

	if ("ok" in round) return round;

	if ("problem" in round)
		return {
			ok: false,
			problem:
				round.problem === "This round is over."
					? "More was recorded than the round had."
					: `Draw ${made}: the choice recorded was not on offer.`
		};

	if (proofs.length > made)
		return { ok: false, problem: "More was recorded than the round had." };

	return { ok: true, ...round };
}
