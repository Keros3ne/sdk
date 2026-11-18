/**
 * A game's rules and paytable: what the window's Rules and Paytable sections show, beside the
 * game. A studio writes its game's in `studios/<studio>/<slug>/guide.ts`, from the game's own
 * constants, so that it says what the game does. It is plain content, not markup: the site
 * checks it (`checkGuide`, below) and draws it in its own type, since a studio's code is not
 * trusted on the site's page. The site's built-in games write theirs in the same shape.
 *
 * A guide imports this file and its own game's maths, and nothing else.
 */
import * as v from "valibot";

export type GuideBlock =
	| { type: "heading"; text: string }
	/** A paragraph. `lead`, if given, is set in bold before it: "The halo." */
	| { type: "text"; text: string; lead?: string }
	| { type: "list"; items: string[] }
	/** A table of words and figures. The first column is read as each row's name. */
	| { type: "table"; head?: string[]; rows: string[][] };

export interface GameGuide {
	/** How the game is played and what each choice in it means. */
	rules: GuideBlock[];
	/** What it pays, for a game with more to say about that than its rules do. */
	paytable?: GuideBlock[];
}

/** A multiple in basis points, as a guide writes it: 15,000 is "1.50x". */
export const multiple = (bp: number): string => `${(bp / 10_000).toFixed(2)}x`;

const line = v.pipe(v.string(), v.maxLength(2_000));
const cell = v.pipe(v.string(), v.maxLength(200));
const block = v.variant("type", [
	v.object({ type: v.literal("heading"), text: v.pipe(v.string(), v.maxLength(120)) }),
	v.object({ type: v.literal("text"), text: line, lead: v.optional(cell) }),
	v.object({ type: v.literal("list"), items: v.pipe(v.array(line), v.maxLength(40)) }),
	v.object({
		type: v.literal("table"),
		head: v.optional(v.pipe(v.array(cell), v.maxLength(20))),
		rows: v.pipe(v.array(v.pipe(v.array(cell), v.maxLength(20))), v.maxLength(80))
	})
]);
const blocks = v.pipe(v.array(block), v.maxLength(80));

/** What a game's guide must be: checked when a studio's is loaded. */
export const guideSchema = v.object({ rules: blocks, paytable: v.optional(blocks) });

/** A studio's guide, checked. Throws, naming the game, if it is not one. */
export function checkGuide(slug: string, guide: unknown): GameGuide {
	const parsed = v.safeParse(guideSchema, guide);
	if (!parsed.success)
		throw new Error(
			`${slug}'s guide is not one the site can show: ${parsed.issues[0].message}`
		);
	return parsed.output;
}
