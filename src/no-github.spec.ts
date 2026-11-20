/**
 * Nothing a studio runs of the SDK reaches GitHub. A release is made by a workflow in the
 * studio's own repository, where the studio can read every step of it; a tool that asked
 * GitHub something, or changed something there, from a studio's machine would be doing so
 * out of its sight. This holds the SDK's own code to that: it names GitHub's API nowhere,
 * and starts GitHub's command line nowhere.
 *
 * Author: dwclake
 * Created: 2026-11-20
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const src = fileURLToPath(new URL(".", import.meta.url));

/** Every file of the SDK's own code: not its tests, and not what its test games build. */
function sources(folder: string): string[] {
	return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
		const path = join(folder, entry.name);
		if (entry.isDirectory())
			return ["test", "node_modules", "dist", ".svelte-kit"].includes(entry.name)
				? []
				: sources(path);

		return /\.(ts|js|svelte)$/.test(entry.name) && !/\.spec\.ts$/.test(entry.name)
			? [path]
			: [];
	});
}

it("asks GitHub nothing and changes nothing there, from any of its code", () => {
	const reaching = [
		/api\.github\.com/,
		/uploads\.github\.com/,
		/["'`]gh["'`]/,
		/\bgh (release|auth|api|repo|workflow|run)\b/
	];
	const found = sources(src).flatMap((file) => {
		const text = readFileSync(file, "utf8");

		return reaching
			.filter((pattern) => pattern.test(text))
			.map((pattern) => `${relative(src, file)}: ${pattern}`);
	});

	expect(found).toEqual([]);
});
