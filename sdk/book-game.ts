/**
 * A game played from books, as the round game the site's bet pipeline plays
 * (./maths.ts): a round is opened in a mode, takes a choice wherever a row ends in one,
 * and settles when a row ends in none. Nothing here is a studio's code. The game is its
 * listing, which is data, and its books, which are data: this is the site's own reading
 * of them, the same on the site and in the stand-in `keros3ne-studio dev` plays against.
 *
 * What is stored of a round is what the player did and what they held: the mode, the
 * choices, and the counters going in. Everything else is drawn again from the bet's
 * seeds on every call, and can be checked from them in the player's browser
 * (`verifyBookBet`), with nothing believed but the digests the listing published.
 *
 * Pure: the books are handed in, already opened.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import * as valibot from "valibot";
import { settlePayout } from "./bets.ts";
import {
	playRound,
	startingCounters,
	verifyRound,
	type Counters,
	type DrawableBook,
	type HeldCounters,
	type PlayedRound,
	type RoundStep,
	type RowProof
} from "./book-round.ts";
import { BOOK_RTP_BP, booksSummary, gameManifest } from "./game-manifest.ts";
import type { RoundGame } from "./maths.ts";
import { createRng, payoutRoll, type Rng } from "./rng.ts";

/** What a mode came to in the check: what the site says of it, and holds a round to. */
const listedMode = valibot.strictObject({
	id: valibot.string(),
	rtpBp: valibot.pipe(
		valibot.number(),
		valibot.minValue(0),
		valibot.maxValue(BOOK_RTP_BP)
	),
	volatility: valibot.pipe(valibot.number(), valibot.minValue(0)),
	maxMultiplierBp: valibot.pipe(
		valibot.number(),
		valibot.integer(),
		valibot.minValue(0)
	)
});

/**
 * Everything the site knows of a game played from books: its manifest, what each of its
 * tables comes to (the digests are what it publishes), and what the check found of each
 * mode. It is made when the game is listed, and only if the check passed.
 */
export const bookListing = valibot.pipe(
	valibot.strictObject({
		game: gameManifest,
		tables: booksSummary.entries.tables,
		modes: valibot.array(listedMode)
	}),
	valibot.check(
		(listing) =>
			listing.modes.length === listing.game.modes.length &&
			listing.game.modes.every(
				(mode, index) => listing.modes[index].id === mode.id
			),
		"The modes checked are not the game's modes"
	)
);

export type BookListing = valibot.InferOutput<typeof bookListing>;

/** How a round is opened: in one of the game's modes, the ordinary one if none is named. */
export interface BookParams {
	mode: string;
}

/** What is stored of a round: what the player did, and what they held going in. */
export interface BookState {
	mode: string;
	choices: string[];
	held?: Counters;
}

/** The one thing a player does in a round: picks an option of the choice it is open at. */
export interface BookAction {
	choose: string;
}

/** What a player sees of a round: every row drawn so far, with the events that play it. */
export interface BookView {
	mode: string;
	steps: RoundStep[];
	payoutBp: number;
	open: boolean;
	/** What may be picked now, while the round is open. */
	options: string[] | null;
	/** What is held after the rows so far, for a game with counters. */
	counters?: Counters;
}

/** What is kept of a settled round: which rows were drawn, without their events. */
export interface BookResult {
	mode: string;
	steps: Pick<RoundStep, "table" | "row" | "payoutBp" | "chosen" | "filled">[];
	payoutBp: number;
	/** What is held after it, for a game with counters. */
	counters?: Counters;
}

/** What a player may see of their counters: what is held, and what fills each. */
export interface BookProgressView {
	held: Counters;
	full: Counters;
}

export type BookGame = RoundGame<BookParams, BookState, BookAction, BookView, BookResult>;

/** The counters a round is played with, or nothing for a game that has none. */
const countersOf = (
	listing: BookListing,
	held: Counters | undefined
): HeldCounters | undefined =>
	listing.game.counters ? { rules: listing.game, held: held ?? {} } : undefined;

/** What is kept of a round once it has settled. */
function resultOf(mode: string, round: PlayedRound): BookResult {
	return {
		mode,
		steps: round.steps.map(({ table, row, payoutBp, chosen, filled }) => ({
			table,
			row,
			payoutBp,
			...(chosen !== undefined ? { chosen } : {}),
			...(filled ? { filled } : {})
		})),
		payoutBp: round.payoutBp,
		...(round.counters ? { counters: round.counters } : {})
	};
}

/**
 * A game played from books, as a round game. `tables` hands over its books, opened: it
 * is asked when a round is first played, not before, so a game can be listed where its
 * books are not.
 */
export function bookGame(
	listing: BookListing,
	studio: string,
	tables: () => Readonly<Record<string, DrawableBook>>
): BookGame {
	const { game } = listing;
	const modeIds = game.modes.map((mode) => mode.id) as [string, ...string[]];

	/** The game's mode with this id. A stored round's mode is always one of them. */
	const modeOf = (id: string) => {
		const index = game.modes.findIndex((mode) => mode.id === id);
		if (index < 0) throw new Error(`${game.slug} has no mode "${id}".`);

		return { ...game.modes[index], checked: listing.modes[index] };
	};

	/** The round as its seeds and the player's choices make it. */
	const play = (state: BookState, rng: Rng, choices = state.choices) =>
		playRound(
			tables(),
			modeOf(state.mode).table,
			rng,
			choices,
			countersOf(listing, state.held)
		);

	/** The same for a stored round, whose choices were all taken when they were made. */
	const played = (state: BookState, rng: Rng): PlayedRound => {
		const round = play(state, rng);
		if ("problem" in round) throw new Error(`${game.slug}: ${round.problem}`);

		return round;
	};

	return {
		kind: "round",
		slug: game.slug,
		name: game.name,
		blurb: game.blurb,
		studio,
		category: game.category,
		rtpBp: BOOK_RTP_BP,
		// Rated on ordinary play: the first mode.
		volatility: listing.modes[0].volatility,
		volatilityOf: (params) => modeOf(params.mode).checked.volatility,
		...(game.minStake !== undefined ? { minStake: game.minStake } : {}),
		...(game.maxStake !== undefined ? { maxStake: game.maxStake } : {}),

		params: valibot.pipe(
			valibot.optional(
				valibot.strictObject({
					mode: valibot.optional(valibot.picklist(modeIds))
				}),
				{}
			),
			valibot.transform((params): BookParams => ({
				mode: params.mode ?? modeIds[0]
			}))
		),
		action: valibot.strictObject({
			choose: valibot.pipe(valibot.string(), valibot.maxLength(40))
		}),

		costBp: (params) => modeOf(params.mode).costBp,
		maxMultiplierBp: (params) => modeOf(params.mode).checked.maxMultiplierBp,

		...(game.counters
			? {
					progress: {
						initial: (): Counters => ({}),
						advance: (_progress: Counters, result: BookResult): Counters =>
							result.counters ?? {},
						view: (progress: Counters): BookProgressView => ({
							held: startingCounters({ rules: game, held: progress ?? {} }),
							full: Object.fromEntries(
								game.counters!.map((counter) => [
									counter.id,
									counter.full
								])
							)
						})
					}
				}
			: {}),

		start: (params, _rng, progress?: Counters): BookState => ({
			mode: params.mode,
			choices: [],
			...(game.counters
				? { held: startingCounters({ rules: game, held: progress ?? {} }) }
				: {})
		}),

		act(state, action, rng) {
			const round = play(state, rng, [...state.choices, action.choose]);
			if ("problem" in round) return round;

			return { state: { ...state, choices: [...state.choices, action.choose] } };
		},

		outcome(state, rng) {
			const round = played(state, rng);

			return round.open
				? null
				: { payoutBp: round.payoutBp, result: resultOf(state.mode, round) };
		},

		view(state, rng) {
			const round = played(state, rng);

			return {
				mode: state.mode,
				steps: round.steps,
				payoutBp: round.payoutBp,
				open: round.open,
				options: round.open
					? (round.steps[round.steps.length - 1].options ?? null)
					: null,
				...(round.counters ? { counters: round.counters } : {})
			};
		}
	};
}

/** A settled bet on a game played from books, its server seed revealed. */
export interface BookBetToVerify {
	state: unknown;
	result: unknown;
	baseStake: number;
	payout: number;
	nonce: number;
	clientSeed: string;
	serverSeed: string;
}

/** A row's proof as it travels: its bytes as text. */
export interface SentProof {
	rows: number;
	totalWeight: number;
	/** Each page's start, and its hash in hex. */
	pages: { start: number; hash: string }[];
	page: number;
	/** The page's leaves, in base64. */
	leaves: string;
	line: string;
}

const hexOf = (bytes: Uint8Array): string =>
	Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const bytesOf = (hex: string): Uint8Array =>
	Uint8Array.from(hex.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));

/** A proof, made ready to send. */
export function sendProof(proof: RowProof): SentProof {
	let leaves = "";
	for (const byte of proof.leaves) leaves += String.fromCharCode(byte);

	return {
		rows: proof.rows,
		totalWeight: proof.totalWeight,
		pages: proof.pages.map((page) => ({ start: page.start, hash: hexOf(page.hash) })),
		page: proof.page,
		leaves: btoa(leaves),
		line: proof.line
	};
}

/** A proof as it was before it was sent. */
export function receiveProof(sent: SentProof): RowProof {
	return {
		rows: sent.rows,
		totalWeight: sent.totalWeight,
		pages: sent.pages.map((page) => ({
			start: page.start,
			hash: bytesOf(page.hash)
		})),
		page: sent.page,
		leaves: Uint8Array.from(atob(sent.leaves), (letter) => letter.charCodeAt(0)),
		line: sent.line
	};
}

/**
 * Whether a bet on a game played from books is what its seeds make it. The round is
 * worked out again from the seeds, the mode, the choices and the counters the bet
 * records, each draw checked against the digest the listing published for its table,
 * and what comes out is held to what the bet says: the rows, what each paid, what is
 * held after, and the payout to the cent.
 */
export function verifyBookBet(
	listing: BookListing,
	bet: BookBetToVerify,
	proofs: readonly SentProof[]
): boolean {
	const state = bet.state as BookState;
	const mode = listing.game.modes.find((each) => each.id === state?.mode);
	if (!mode || !Array.isArray(state.choices)) return false;

	let round;
	try {
		round = verifyRound(
			Object.fromEntries(
				Object.entries(listing.tables).map(([table, summary]) => [
					table,
					summary.digest
				])
			),
			mode.table,
			createRng(bet.serverSeed, bet.clientSeed, bet.nonce),
			state.choices,
			proofs.map(receiveProof),
			countersOf(listing, state.held)
		);
	} catch {
		return false;
	}

	if (!round.ok || round.open) return false;

	if (JSON.stringify(resultOf(state.mode, round)) !== JSON.stringify(bet.result))
		return false;

	const paid = settlePayout(
		bet.baseStake,
		round.payoutBp,
		payoutRoll(bet.serverSeed, bet.clientSeed, bet.nonce)
	);

	return paid === bet.payout;
}

/** A settled bet as a history lists it: enough to follow what was held from bet to bet. */
export interface BookBetInHistory {
	id: string;
	baseStake: number;
	state: unknown;
	result: unknown;
}

/**
 * The bets, by id, whose counters do not follow from the bet before. A bet records what
 * its player held going in, and one bet alone cannot show that this is what the last
 * one left: a site could say a meter was emptier than it was, and the round would still
 * check out from its seeds. So each bet is held to the bet before it at the same size of
 * bet, which is how counters are kept: what it says was held must be what that bet says
 * was held after it.
 *
 * `bets` are one player's on one game, newest first, as a history lists them. Nothing
 * here needs a seed, so a bet still sealed is checked too. The oldest bet listed at each
 * size has no bet before it in the list, and is taken at its word. A game with no
 * counters has nothing to follow.
 */
export function brokenHolds(
	listing: BookListing,
	bets: readonly BookBetInHistory[]
): string[] {
	const counters = listing.game.counters;
	if (!counters) return [];

	const broken: string[] = [];

	bets.forEach((bet, index) => {
		const before = bets
			.slice(index + 1)
			.find((each) => each.baseStake === bet.baseStake);
		if (!before) return;

		const held = (bet.state as BookState | null)?.held ?? {};
		const left = startingCounters({
			rules: listing.game,
			held: (before.result as BookResult | null)?.counters ?? {}
		});
		const follows =
			Object.keys(held).length === counters.length &&
			counters.every((counter) => held[counter.id] === left[counter.id]);

		if (!follows) broken.push(bet.id);
	});

	return broken;
}
