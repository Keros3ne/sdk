/**
 * The scan of a client's source: that a client written in Svelte is read as one written
 * without it is, that it may import what the SDK brings it and nothing else, and that
 * its stories, which only Storybook loads, are not held to a client's rules.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { scanClientSource } from "./testing.ts";

const root = mkdtempSync(join(tmpdir(), "keros3ne-client-scan-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

/** Writes a studio's files, and scans the client of its game. */
function scan(files: Record<string, string>, packages: string[] = []): string[] {
	const studio = mkdtempSync(join(root, "studio-"));

	for (const [name, text] of Object.entries(files)) {
		mkdirSync(dirname(join(studio, name)), { recursive: true });
		writeFileSync(join(studio, name), text);
	}

	return scanClientSource(
		join(studio, "game", "client"),
		studio,
		[join(studio, "game")],
		packages
	);
}

describe("a client's source", () => {
	it("may import the SDK, Svelte and Pixi, and its own game's files", () => {
		expect(
			scan({
				"game/client/src/Game.svelte": `<script lang="ts">
	import { onMount } from "svelte";
	import { Stage } from "@keros3ne/studio-sdk/pixi";
	import { Texture } from "pixi.js";
	import { LINES } from "../../maths/rules";
</script>`,
				"game/client/src/main.ts": `import { mount } from "svelte";\nimport Game from "./Game.svelte";`
			})
		).toEqual([]);
	});

	it("is refused another package or a file outside its game, in a Svelte file as in any other", () => {
		const problems = scan({
			"game/client/src/Game.svelte": `<script lang="ts">
	import confetti from "canvas-confetti";
	import { secret } from "../../../other-game/maths";
</script>`
		});

		expect(problems).toHaveLength(2);
		expect(problems[0]).toMatch(
			/Game\.svelte imports "canvas-confetti": a client may import the SDK/
		);
		expect(problems[1]).toMatch(
			/Game\.svelte imports "\.\.\/\.\.\/\.\.\/other-game\/maths"/
		);
	});

	it("is not held to these rules in its stories, which are never built into it", () => {
		expect(
			scan({
				"game/client/src/Reels.stories.ts": `import type { Meta } from "@storybook/svelte-vite";\nimport ReelsStory from "./ReelsStory.svelte";`,
				"game/client/src/ReelsStory.svelte": `<script lang="ts">\n\timport { Board } from "@keros3ne/studio-sdk/slot";\n</script>`
			})
		).toEqual([]);
	});

	it("may import a package its repository names, by the package's name, and no other", () => {
		const files = {
			"game/client/src/Game.svelte": `<script lang="ts">
	import Sheet from "@tidewater/kit/Sheet.svelte";
	import "@tidewater/kit/kit.css";
	import { play } from "@tidewater/kit-extras/sound";
</script>`
		};

		expect(scan(files, ["@tidewater/kit", "@tidewater/kit-extras"])).toEqual([]);

		const problems = scan(files, ["@tidewater/kit"]);
		expect(problems).toHaveLength(1);
		expect(problems[0]).toMatch(/imports "@tidewater\/kit-extras\/sound"/);
	});
});
