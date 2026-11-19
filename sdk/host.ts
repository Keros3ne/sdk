/**
 * The site's end of the protocol (./protocol.ts): what it accepts from a game's client,
 * and how long it waits. The site's bridge checks every message against this, and so does
 * the stand-in for the site that `keros3ne-studio dev` runs, so a game that is understood
 * there is understood on the site.
 */
import * as v from "valibot";

/**
 * If a game never says its result has been shown, the balance is shown anyway after this
 * long. Long enough for the longest bonus at the ordinary pace: shown any sooner, the site
 * would give a result away while the game was still playing it.
 */
export const SETTLE_FALLBACK_MS = 5 * 60_000;
/** The most of an announcement that is read out. */
export const ANNOUNCE_MAX = 300;

const id = v.pipe(v.number(), v.integer(), v.minValue(0));
/** Everything a game may send. Anything else is ignored. */
export const fromGame = v.variant("type", [
	// The page has something to show. Sent by the page itself before any of the game's code
	// has arrived (./loading-first.js): the site keeps the frame out of sight until then.
	v.object({ type: v.literal("drawn") }),
	v.object({ type: v.literal("ready") }),
	v.object({
		type: v.literal("open"),
		id,
		bet: v.pipe(v.number(), v.integer(), v.minValue(1)),
		params: v.unknown()
	}),
	v.object({ type: v.literal("act"), id, action: v.unknown() }),
	v.object({ type: v.literal("settled") }),
	v.object({ type: v.literal("announce"), text: v.string() }),
	v.object({
		type: v.literal("progress"),
		id,
		bet: v.pipe(v.number(), v.integer(), v.minValue(1))
	}),
	v.object({ type: v.literal("history"), id })
]);
