/**
 * `studio.json`: what a studio says about itself and its games, at the root of its folder.
 * The site lists a studio and its games from it, and `keros3ne-studio check` checks it.
 *
 *   {
 *     "id": "tidewater",
 *     "name": "Tidewater Games",
 *     "blurb": "Slots from the coast.",
 *     "url": "https://tidewater.example",
 *     "sdk": "^0.3.0",
 *     "games": ["harbour-lights", "undertow"]
 *   }
 *
 * - `id` is how the site knows the studio, and what each of its games names as `studio`.
 * - `name` and `blurb` are shown where its games are listed; `url`, if given, is linked
 *   (https only).
 * - `sdk` is the version of this SDK the studio built on, as a range (`^0.3.0`).
 * - `games` lists its games by slug, in the order they are listed. Each is a folder beside
 *   studio.json, laid out as studio-folder.ts says, and its section (Games or Slots) is its
 *   maths' own `category`.
 * - `shared`, if given, names folders beside the games that their clients share (code, art,
 *   sound). A client may import from its own game's folder and these, and nothing else of
 *   the studio's; maths imports none of them.
 * - `hidden: true` keeps the studio and its games from players: they are listed and
 *   playable in development and in the site's tests, and not on the site itself.
 *
 * Pure: the site reads it in the browser as well as on the server.
 */
import * as v from "valibot";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const slug = (what: string) =>
	v.pipe(
		v.string(),
		v.regex(SLUG, `${what} is lowercase words joined by hyphens`),
		v.maxLength(40)
	);

export const studioManifest = v.pipe(
	v.strictObject({
		id: slug("The studio's id"),
		name: v.pipe(
			v.string(),
			v.trim(),
			v.minLength(1, "The studio has no name"),
			v.maxLength(60)
		),
		blurb: v.pipe(
			v.string(),
			v.trim(),
			v.minLength(1, "The studio has no blurb"),
			v.maxLength(120)
		),
		url: v.optional(
			v.pipe(
				v.string(),
				v.url(),
				v.startsWith("https://", "A studio's url is https")
			)
		),
		sdk: v.pipe(
			v.string(),
			v.regex(
				/^[\^~]?\d+\.\d+\.\d+$/,
				'sdk is the version it was built on, such as "^0.3.0"'
			)
		),
		hidden: v.optional(v.boolean()),
		games: v.pipe(
			v.array(slug("A game's slug")),
			v.minLength(1, "The studio lists no games"),
			v.maxLength(50),
			v.check(
				(games) => new Set(games).size === games.length,
				"A game is listed twice"
			)
		),
		shared: v.optional(
			v.pipe(v.array(slug("A shared folder's name")), v.maxLength(10))
		)
	}),
	v.check(
		(manifest) =>
			!(manifest.shared ?? []).some((name) => manifest.games.includes(name)),
		"A folder is both a game and shared"
	)
);

export type StudioManifest = v.InferOutput<typeof studioManifest>;

/** The folders of a studio its clients may import from besides their own: its `shared` ones. */
export const sharedFolders = (manifest: StudioManifest): string[] =>
	manifest.shared ?? [];

/** A studio's manifest, checked. Throws, naming where it came from, if it is not one. */
export function checkManifest(from: string, manifest: unknown): StudioManifest {
	const parsed = v.safeParse(studioManifest, manifest);
	if (!parsed.success) {
		const issue = parsed.issues[0];
		const at = issue.path?.map((step) => step.key).join(".");
		throw new Error(
			`${from} is not a studio manifest the site can read: ${at ? `${at}: ` : ""}${issue.message}`
		);
	}
	return parsed.output;
}
