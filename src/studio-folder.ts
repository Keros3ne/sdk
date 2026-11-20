/**
 * A studio's games, in its folder: the folders its `studio.json` lists (./manifest.ts), each
 * named by the game's slug and laid out as this package's README says:
 *
 *   <slug>/game.json             its manifest: its modes, and counters if it keeps meters
 *   <slug>/guide.json            its rules and paytable, as data
 *   <slug>/maths/index.ts        how its books are made (exports `defineBooks(...)`)
 *   <slug>/maths/maths.spec.ts   the studio's own tests of its rules
 *   <slug>/books/                its books, and `books.json`, the record of them
 *   <slug>/client/               the client: src/routes/, public/card.svg
 *
 * Runs under Bun, which can import a game's TypeScript as it is.
 */
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { loadBookGame } from "./book-files.ts";
import { checkManifest, type StudioManifest } from "./manifest.ts";
import type { AnyStudioGame } from "./stand-in.ts";

export interface GameFolder {
	slug: string;
	/** The game's own folder. */
	dir: string;
	maths: string;
	guide: string;
	client: string;
}

/** The studio's manifest, checked: `studio.json` in its folder. Throws if it is missing or wrong. */
export function readManifest(root: string): StudioManifest {
	const file = join(resolve(root), "studio.json");
	if (!existsSync(file))
		throw new Error(
			`There is no studio.json in ${resolve(root)}: a studio's folder starts with one.`
		);
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(file, "utf8"));
	} catch (error) {
		throw new Error(
			`${file} is not JSON: ${error instanceof Error ? error.message : String(error)}`
		);
	}
	return checkManifest(file, parsed);
}

/** Where the site keeps a release's packages, in its folder: fetched as source, not installed. */
export const PACKAGES_FOLDER = "packages";

/**
 * Where a package the manifest names is, as source: in the folder's own `packages`, where
 * the site put it, or else where the studio's package manager installed it. `null` if it
 * is in neither.
 */
export function packageFolder(root: string, name: string): string | null {
	for (const folder of [
		join(resolve(root), PACKAGES_FOLDER, name),
		join(resolve(root), "node_modules", name)
	])
		if (existsSync(folder)) return realpathSync(folder);

	return null;
}

const folderOf = (root: string, slug: string): GameFolder => {
	const dir = resolve(root, slug);
	return {
		slug,
		dir,
		maths: join(dir, "maths"),
		guide: join(dir, "guide.json"),
		client: join(dir, "client")
	};
};

/** Folders in the studio's folder that hold a game's maths, whether or not the manifest lists them. */
export function gameFolders(root: string): string[] {
	return readdirSync(root, { withFileTypes: true })
		.filter(
			(entry) =>
				entry.isDirectory() &&
				!entry.name.startsWith(".") &&
				entry.name !== "node_modules" &&
				existsSync(join(root, entry.name, "maths", "index.ts"))
		)
		.map((entry) => entry.name)
		.sort();
}

/** Every game the studio's manifest lists, in its order. Throws naming one whose folder is not there. */
export function findGames(root: string): GameFolder[] {
	return readManifest(root).games.map((slug) => {
		const folder = folderOf(root, slug);
		if (!existsSync(join(folder.maths, "index.ts")))
			throw new Error(
				`studio.json lists "${slug}", but there is no ${slug}/maths/index.ts.`
			);
		return folder;
	});
}

/** The games asked for by slug, or all of them; throws naming any that are not there. */
export function pickGames(root: string, slugs: string[]): GameFolder[] {
	const all = findGames(root);
	if (slugs.length === 0) return all;
	return slugs.map((slug) => {
		const folder = all.find((game) => game.slug === slug);
		if (!folder)
			throw new Error(
				`studio.json lists no game "${slug}". It lists: ${all.map((game) => game.slug).join(", ")}.`
			);
		return folder;
	});
}

/**
 * A game as whatever plays a round is handed one: read from its books, which must be
 * there and pass the check. Throws, saying how to make them, if the game has none.
 */
export async function loadGame(folder: GameFolder): Promise<AnyStudioGame> {
	if (!isBookGame(folder))
		throw new Error(
			`${folder.slug} has no game.json: a studio's game is played from books (see the README).`
		);

	return loadBookGame(
		folder.dir,
		readManifest(dirname(folder.dir)).id ?? "studio"
	) as unknown as AnyStudioGame;
}

/** Whether a game is played from books: it has a `game.json` beside its maths. */
export const isBookGame = (folder: GameFolder): boolean =>
	existsSync(join(folder.dir, "game.json"));

/** A game's guide, unchecked: its `guide.json`, which is plain data. */
export async function loadGuide(folder: GameFolder): Promise<unknown> {
	return existsSync(folder.guide)
		? JSON.parse(readFileSync(folder.guide, "utf8"))
		: undefined;
}
