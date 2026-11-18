/**
 * The client half of the SDK: how a studio game's client talks to the site.
 *
 *     const host = await connect<View, ProgressView>();
 *     const round = await host.open(100, {});       // the bet, in cents
 *     const next = await host.act({ type: 'pick', crate: 1 });
 *     ...play the animation...
 *     host.settled();                               // the site now shows the new balance
 *
 * `open` and `act` reject with a `Refusal` when the site says no: not enough
 * kero, a move out of turn, a bet outside the limits. The site decides every
 * outcome. Nothing the client computes is believed.
 */
import {
	PROTOCOL,
	type FromGame,
	type FromSite,
	type HistoryBet,
	type InitMessage,
	type RoundMessage
} from "./protocol.ts";

export type { HistoryBet, InitMessage, RoundMessage };

export class Refusal extends Error {
	constructor(
		public reason: "insufficient" | "rejected" | "timeout",
		message: string
	) {
		super(message);
		this.name = "Refusal";
	}
}

export interface GameHost<View, ProgressView> {
	/** What the site said when the game connected. `init.round` is a round to pick back up. */
	init: InitMessage<View, ProgressView>;
	/**
	 * Opens a round at a bet, in cents. A way of playing that costs more (`costBp` in the
	 * maths: a boosted spin, a bought bonus) is charged the bet times its cost; pass the
	 * bet, never the cost. Wins are paid on the bet.
	 */
	open(bet: number, params: unknown): Promise<RoundMessage<View, ProgressView>>;
	/** One action in the open round. */
	act(action: unknown): Promise<RoundMessage<View, ProgressView>>;
	/** Call when the result has been shown. Until then the site holds the balance back so as not to spoil it. */
	settled(): void;
	/** Says something to screen-reader users. A canvas says nothing by itself. */
	announce(text: string): void;
	/** The player's progress at a bet, for a game that keeps any. */
	progress(bet: number): Promise<ProgressView | null>;
	/** The player's latest bets on this game. */
	history(): Promise<HistoryBet[]>;
	/** Called when the balance changes for a reason outside the game. */
	onBalance(listener: (balance: number) => void): void;
}

const REPLY_TIMEOUT_MS = 20_000;

export function connect<View = unknown, ProgressView = unknown>(): Promise<
	GameHost<View, ProgressView>
> {
	const site = window.parent;
	const send = (message: FromGame) =>
		site.postMessage({ protocol: PROTOCOL, ...message }, "*");

	let nextId = 1;
	const waiting = new Map<
		number,
		{
			resolve: (value: never) => void;
			reject: (error: Refusal) => void;
			timer: number;
		}
	>();
	const balanceListeners: ((balance: number) => void)[] = [];

	function ask<T>(build: (id: number) => FromGame): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const id = nextId++;
			const timer = window.setTimeout(() => {
				waiting.delete(id);
				reject(new Refusal("timeout", "The site did not answer. Try again."));
			}, REPLY_TIMEOUT_MS);
			waiting.set(id, {
				resolve: resolve as (value: never) => void,
				reject,
				timer
			});
			send(build(id));
		});
	}

	return new Promise((ready) => {
		// The page around the game may not be listening yet when the game loads, so
		// it says it is ready until it is answered.
		let connected = false;
		const hello = window.setInterval(() => send({ type: "ready" }), 250);

		window.addEventListener("message", (event) => {
			// Only the page that framed the game is listened to.
			if (event.source !== site) return;
			const message = event.data as (FromSite & { protocol?: string }) | null;
			if (!message || message.protocol !== PROTOCOL) return;

			if (message.type === "init") {
				if (connected) return;
				connected = true;
				window.clearInterval(hello);
				ready({
					init: message as unknown as InitMessage<View, ProgressView>,
					open: (bet, params) =>
						ask((id) => ({ type: "open", id, bet, params })),
					act: (action) => ask((id) => ({ type: "act", id, action })),
					settled: () => send({ type: "settled" }),
					announce: (text) => send({ type: "announce", text }),
					progress: (bet) => ask((id) => ({ type: "progress", id, bet })),
					history: () => ask((id) => ({ type: "history", id })),
					onBalance: (listener) => void balanceListeners.push(listener)
				});
				return;
			}
			if (message.type === "balance") {
				for (const listener of balanceListeners) listener(message.balance);
				return;
			}

			const pending = waiting.get(message.id);
			if (!pending) return;
			waiting.delete(message.id);
			window.clearTimeout(pending.timer);
			if (message.type === "refused")
				pending.reject(new Refusal(message.reason, message.message));
			else if (message.type === "round") pending.resolve(message.round as never);
			else if (message.type === "progress")
				pending.resolve(message.progress as never);
			else if (message.type === "history") pending.resolve(message.bets as never);
		});

		send({ type: "ready" });
	});
}

/** Cents as silver: 150 is "1.50". */
export { formatKero, formatFuel } from "./kero.ts";
