/**
 * A stand-in for the site, for playing a game before it is sent: what `keros3ne-studio dev`
 * plays a client against. It keeps a pretend balance, a pair of seeds, the player's progress
 * at each stake and their history, in memory, and plays rounds as the site's bet pipeline
 * does, with the same rules (./bets.ts, ./limits.ts), the same random stream (./rng.ts) and
 * the same refusals. State is stored as JSON between steps, as the site stores it, so a
 * game that keeps something JSON cannot is caught here too.
 *
 * What it does not do: the site's rewards (levels, rakeback, packs), its rate limits, and
 * its database. A round still open when the stand-in is made again is gone.
 */
import * as v from "valibot";
import { BP, chargeFor, settlePayout, stakeLimits } from "./bets.ts";
import { ROUND_MAX_ACTIONS, fitsInStore } from "./limits.ts";
import type { StudioGame } from "./maths.ts";
import type { HistoryBet, InitMessage, RoundMessage } from "./protocol.ts";
import { createRng, hashServerSeed, payoutRoll } from "./rng.ts";
import { formatKero } from "./kero.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyStudioGame = StudioGame<any, any, any, any, any, any, any>;

export type Reply =
	| { ok: true; round: RoundMessage }
	| { ok: false; reason: "insufficient" | "rejected"; message: string };

export interface Fairness {
	serverSeedHash: string;
	clientSeed: string;
	/** Bets placed on this pair so far. */
	nonce: number;
}

interface OpenRound {
	params: unknown;
	state: unknown;
	stake: number;
	baseStake: number;
	nonce: number;
	actions: number;
}

const stored = <T>(value: T): T => JSON.parse(JSON.stringify(value ?? null));

const randomSeed = () => {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

/** Refused, with a reason the player is shown: as the site's bet pipeline refuses. */
class Refused extends Error {
	constructor(
		message: string,
		readonly reason: "insufficient" | "rejected" = "rejected"
	) {
		super(message);
	}
}

export function createStandIn(game: AnyStudioGame, options: { balance?: number } = {}) {
	let balance = options.balance ?? 25_00;
	let serverSeed = randomSeed();
	let clientSeed = randomSeed().slice(0, 16);
	let nonce = 0;
	let open: OpenRound | null = null;
	const progress = new Map<number, unknown>();
	const history: HistoryBet[] = [];
	const limits = stakeLimits(game);

	const rng = (round: OpenRound) => createRng(serverSeed, clientSeed, round.nonce);
	const progressAt = (stake: number) =>
		game.progress
			? (progress.get(stake) ?? stored(game.progress.initial()))
			: undefined;

	/** Settles the round if the game says it is over, and returns what the game is told. */
	function conclude(round: OpenRound): RoundMessage {
		if (!fitsInStore(round.state))
			throw new Error(`${game.slug} asked to store too large a round`);
		const outcome = game.outcome(round.state, rng(round));
		let payout = 0;
		if (outcome) {
			if (!Number.isSafeInteger(outcome.payoutBp) || outcome.payoutBp < 0)
				throw new Error(
					`${game.slug} paid ${outcome.payoutBp}, which is not a payout`
				);
			payout = settlePayout(
				round.baseStake,
				outcome.payoutBp,
				payoutRoll(serverSeed, clientSeed, round.nonce)
			);
			balance += payout;
			if (game.progress) {
				const next = stored(
					game.progress.advance(
						progressAt(round.baseStake),
						stored(outcome.result)
					)
				);
				if (!fitsInStore(next))
					throw new Error(`${game.slug} asked to store too much progress`);
				progress.set(round.baseStake, next);
			}
			history.unshift({
				stake: round.stake,
				payout,
				multiplierBp: Math.floor((payout * 10_000) / round.stake),
				at: Date.now()
			});
			history.length = Math.min(history.length, 20);
			open = null;
		} else {
			open = round;
		}
		return {
			open: !outcome,
			stake: round.stake,
			baseStake: round.baseStake,
			payout,
			view: stored(game.view(round.state, rng(round))),
			progress: game.progress
				? game.progress.view(progressAt(round.baseStake))
				: null,
			balance
		};
	}

	/** Runs one step; a refusal or a broken game becomes a refusal, and changes nothing. */
	function step(work: () => RoundMessage): Reply {
		const before = {
			balance,
			nonce,
			open,
			progress: new Map(progress),
			history: [...history]
		};
		try {
			return { ok: true, round: work() };
		} catch (error) {
			balance = before.balance;
			nonce = before.nonce;
			open = before.open;
			progress.clear();
			for (const [stake, value] of before.progress) progress.set(stake, value);
			history.splice(0, history.length, ...before.history);
			if (error instanceof Refused)
				return { ok: false, reason: error.reason, message: error.message };
			// On the site this is a failed request, not a refusal: the game is broken.
			return {
				ok: false,
				reason: "rejected",
				message: `The game broke a rule of the site: ${error instanceof Error ? error.message : String(error)}`
			};
		}
	}

	return {
		limits,
		get balance() {
			return balance;
		},
		/** The round left open, as the game would be told it when it loads. */
		get round(): RoundMessage | null {
			if (!open) return null;
			const round = open;
			return {
				open: true,
				stake: round.stake,
				baseStake: round.baseStake,
				payout: 0,
				view: stored(game.view(round.state, rng(round))),
				progress: game.progress
					? game.progress.view(progressAt(round.baseStake))
					: null,
				balance
			};
		},
		get fairness(): Fairness {
			return { serverSeedHash: hashServerSeed(serverSeed), clientSeed, nonce };
		},

		init(reducedMotion: boolean): InitMessage {
			return {
				game: { slug: game.slug, name: game.name },
				balance,
				limits,
				reducedMotion,
				round: this.round
			};
		},

		/** Opens a round at a bet. A way of playing that costs more is charged the bet times its `costBp`. */
		open(stake: number, params: unknown): Reply {
			return step(() => {
				const parsed = v.safeParse(game.params, params);
				if (!parsed.success)
					throw new Refused("Those bet options are not valid.");
				const costBp = game.costBp?.(parsed.output) ?? BP;
				if (!Number.isSafeInteger(stake) || stake < limits.minStake)
					throw new Refused(
						`The smallest bet on this game is ${formatKero(limits.minStake)}.`
					);
				if (stake > limits.maxStake)
					throw new Refused(
						`The largest bet on this game is ${formatKero(limits.maxStake)}.`
					);
				const charge = chargeFor(stake, costBp);
				if (charge === null) {
					if (!Number.isSafeInteger(costBp) || costBp < BP)
						throw new Error(`${game.slug} asked for a cost of ${costBp}`);
					throw new Refused(
						"That way of playing cannot be bet at this amount."
					);
				}
				if (open) throw new Refused("Finish the round you already have open.");
				if (balance < charge)
					throw new Refused("Not enough KC for that bet.", "insufficient");

				balance -= charge;
				nonce += 1;
				const round: OpenRound = {
					params: parsed.output,
					state: null,
					stake: charge,
					baseStake: stake,
					nonce,
					actions: 0
				};
				round.state = stored(
					game.start(parsed.output, rng(round), stored(progressAt(stake)))
				);
				return conclude(round);
			});
		},

		act(action: unknown): Reply {
			return step(() => {
				if (!open) throw new Refused("There is no round in progress.");
				const round = open;
				if (round.actions >= ROUND_MAX_ACTIONS)
					throw new Refused("This round has taken too many moves.");
				const parsed = v.safeParse(game.action, action);
				if (!parsed.success) throw new Refused("That move is not valid.");
				const result = game.act(round.state, parsed.output, rng(round));
				if ("problem" in result) throw new Refused(result.problem);
				const extra = (result.extraStakes ?? 0) * round.baseStake;
				if (extra > balance) throw new Refused("Not enough KC for that move.");
				balance -= extra;
				return conclude({
					...round,
					state: stored(result.state),
					stake: round.stake + extra,
					actions: round.actions + 1
				});
			});
		},

		progress(stake: number): unknown {
			return game.progress ? game.progress.view(progressAt(stake)) : null;
		},

		history(): HistoryBet[] {
			return [...history];
		},

		/** Sets the pretend balance, as a claim or a refuel would change it on the site. */
		setBalance(cents: number) {
			if (!Number.isSafeInteger(cents) || cents < 0)
				throw new RangeError("A balance is whole cents, from 0.");
			balance = cents;
		},

		/**
		 * A new pair of seeds, as a player can ask for on the site. Returns the old server seed,
		 * now revealed, or `null` while a round is open, whose seeds are still in use.
		 */
		rotateSeeds(): string | null {
			if (open) return null;
			const revealed = serverSeed;
			serverSeed = randomSeed();
			clientSeed = randomSeed().slice(0, 16);
			nonce = 0;
			return revealed;
		}
	};
}

export type StandIn = ReturnType<typeof createStandIn>;
