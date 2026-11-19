/**
 * The messages a studio game's client and the site exchange. See this package's README.
 *
 * The client runs in a sandboxed frame with no access to the site: no cookies,
 * no network, no reach into the page around it. Everything it needs it asks for
 * with `postMessage`, and everything it asks for the site checks before acting.
 * Use `connect()` from ./client rather than these directly.
 */

/** What every version of the protocol starts with. */
export const PROTOCOL_FAMILY = "keros3ne-game/";
/**
 * Every message carries this, so that neither side mistakes anything else for one. The
 * number after the slash is the protocol's version: it goes up when a message changes
 * in a way the other side would misread, and the site refuses a client on another one.
 */
export const PROTOCOL = `${PROTOCOL_FAMILY}2` as const;

/** A round as the site reports it. `view` and `progress` are the game's own shapes. */
export interface RoundMessage<View = unknown, ProgressView = unknown> {
	/** False once the round has settled. */
	open: boolean;
	/** Everything the round has cost so far, in cents: the bet times the way it was played, and any more stakes since. */
	stake: number;
	/** The bet, in cents. Payouts are multiples of this, whatever the round cost. */
	baseStake: number;
	/** Paid out, in cents. Zero while the round is open. */
	payout: number;
	view: View;
	/** Where the player's progress stands at this bet, for a game that keeps any. */
	progress: ProgressView | null;
	/** The player's balance after this step, in cents. */
	balance: number;
}

export interface InitMessage<View = unknown, ProgressView = unknown> {
	game: { slug: string; name: string };
	/** Cents. */
	balance: number;
	/** The smallest and largest bet, in cents. */
	limits: { minStake: number; maxStake: number };
	/** The player has asked their device for less motion. Skip or shorten animation. */
	reducedMotion: boolean;
	/** A round left open, here or on another device, to pick back up. */
	round: RoundMessage<View, ProgressView> | null;
}

export interface HistoryBet {
	/** What the bet cost, in cents. */
	stake: number;
	payout: number;
	multiplierBp: number;
	/** Milliseconds since 1970. */
	at: number;
}

/** What the game sends. `id` ties a request to its reply. */
export type FromGame =
	/**
	 * The page has something to show: its loading screen. Sent by the page itself, before
	 * any of the game's code has arrived, and until that code runs. A browser gives a frame
	 * a white ground of its own until its page has drawn, so the site keeps the frame out
	 * of sight until it hears this (or `ready`, from a page with no loading screen).
	 */
	| { type: "drawn" }
	| { type: "ready" }
	/** Opens a round at a bet: the site charges the bet times what the way of playing (`params`) costs. */
	| { type: "open"; id: number; bet: number; params: unknown }
	| { type: "act"; id: number; action: unknown }
	/** The animation is over: the site may now show the new balance and any card that dropped. */
	| { type: "settled" }
	/** Words for a screen reader, for whatever just happened on the canvas. */
	| { type: "announce"; text: string }
	| { type: "progress"; id: number; bet: number }
	| { type: "history"; id: number };

/** What the site sends. */
export type FromSite =
	| ({ type: "init" } & InitMessage)
	| { type: "round"; id: number; round: RoundMessage }
	/** `reason` is `insufficient` when the player has not enough kero. `message` is for showing to them. */
	| {
			type: "refused";
			id: number;
			reason: "insufficient" | "rejected";
			message: string;
	  }
	| { type: "progress"; id: number; bet: number; progress: unknown }
	| { type: "history"; id: number; bets: HistoryBet[] }
	/** The balance changed for a reason outside the game. */
	| { type: "balance"; balance: number };

export type Envelope<Message> = Message & { protocol: typeof PROTOCOL };
