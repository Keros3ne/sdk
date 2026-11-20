/**
 * Which games are due a release (./releases.ts): each whose version has no tag yet, read
 * from a repository made here.
 *
 * Author: dwclake
 * Created: 2026-11-20
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, it } from "vitest";
import { unreleased } from "./releases.ts";

const root = mkdtempSync(join(tmpdir(), "keros3ne-releases-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

/** Runs git in the test's repository. */
const git = (...args: string[]) =>
	execFileSync("git", args, {
		cwd: root,
		stdio: "pipe",
		env: {
			...process.env,
			GIT_AUTHOR_NAME: "Test",
			GIT_AUTHOR_EMAIL: "test@example.com",
			GIT_COMMITTER_NAME: "Test",
			GIT_COMMITTER_EMAIL: "test@example.com"
		}
	});

/** Writes a game of the studio at a version. */
function game(slug: string, version: string) {
	mkdirSync(join(root, slug, "maths"), { recursive: true });
	writeFileSync(join(root, slug, "maths", "index.ts"), "export {};\n");
	writeFileSync(
		join(root, slug, "game.json"),
		JSON.stringify({
			slug,
			version,
			name: slug,
			blurb: "A game.",
			category: "slots",
			modes: [{ id: "spin", name: "Spin", costBp: 10_000, table: "spin" }]
		})
	);
}

it("names each game whose version has no tag, and no other", () => {
	writeFileSync(
		join(root, "studio.json"),
		JSON.stringify({ sdk: "^0.26.0", games: ["first", "the-vault", "third"] })
	);
	game("first", "1.0.0");
	game("the-vault", "2.3.1");
	game("third", "0.1.0");

	// With no repository there is nothing to tell by.
	expect(() => unreleased(root)).toThrow(/not in a git repository/);

	git("init", "--quiet");
	git("add", "-A");
	git("commit", "--quiet", "-m", "Three games");

	// New, every game is due.
	expect(unreleased(root).map((each) => each.tag)).toEqual([
		"first-v1.0.0",
		"the-vault-v2.3.1",
		"third-v0.1.0"
	]);

	// Released, a game is due again only once its version is raised.
	git("tag", "first-v1.0.0");
	git("tag", "the-vault-v2.3.1");
	git("tag", "third-v0.0.9");
	expect(unreleased(root)).toEqual([
		{ slug: "third", version: "0.1.0", tag: "third-v0.1.0" }
	]);

	game("first", "1.0.1");
	expect(unreleased(root).map((each) => each.tag)).toEqual([
		"first-v1.0.1",
		"third-v0.1.0"
	]);
});
