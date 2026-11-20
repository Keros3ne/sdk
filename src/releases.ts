/**
 * Which of a studio's games are due a release. A game is released by itself, at the
 * version its `game.json` says, under a tag made of its slug and that version
 * (`stormglass-v1.4.0`), whatever else its repository holds. So a game is due a release
 * when the repository has no tag of that name: its version was raised, or it is new.
 *
 * This reads the repository on this machine, with git, and nothing else. It never asks
 * GitHub anything, and never makes a tag or a release: a studio's own workflow does that
 * (the documentation's "Sending a release"), where the studio can see it.
 *
 * Author: dwclake
 * Created: 2026-11-20
 */

import { execFileSync } from "node:child_process";
import { readGameManifest } from "./book-files.ts";
import { releaseTag } from "./game-manifest.ts";
import { findGames, isBookGame, type GameFolder } from "./studio-folder.ts";

/** A game, and the release its `game.json` says it is at. */
export interface GameRelease {
	slug: string;
	/** The version its `game.json` says. */
	version: string;
	/** The tag a release of it at that version has: `<slug>-v<version>`. */
	tag: string;
}

/** The release a game's `game.json` says it is at. */
export function releaseAt(folder: GameFolder): GameRelease {
	const { slug, version } = readGameManifest(folder.dir);

	return { slug, version, tag: releaseTag(slug, version) };
}

/** Every tag the repository on this machine has. Throws where `root` is in no repository. */
function tags(root: string): Set<string> {
	try {
		return new Set(
			execFileSync("git", ["tag", "--list"], {
				cwd: root,
				encoding: "utf8",
				stdio: ["ignore", "pipe", "pipe"]
			})
				.split("\n")
				.filter(Boolean)
		);
	} catch {
		throw new Error(
			`${root} is not in a git repository, so there are no tags to tell which games are released.`
		);
	}
}

/**
 * The games of a studio that are due a release: each whose version has no tag in the
 * repository on this machine, in the studio's own order. A workflow that has not fetched
 * the repository's tags would find every game due.
 */
export function unreleased(root: string): GameRelease[] {
	const have = tags(root);

	return findGames(root)
		.filter(isBookGame)
		.map(releaseAt)
		.filter((release) => !have.has(release.tag));
}
