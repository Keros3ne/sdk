/**
 * Building a client that shares a package: that a package its repository names is read
 * from the folder the site fetched it into, as source, Svelte among it.
 *
 * Author: dwclake
 * Created: 2026-11-19
 */

import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { buildClient } from "./client-build.ts";

// Inside the repository, so that Svelte is found from it as it is from a studio's folder.
const scratch = fileURLToPath(new URL("../test-results", import.meta.url));
mkdirSync(scratch, { recursive: true });
const studio = mkdtempSync(join(scratch, "client-build-"));
afterAll(() => rmSync(studio, { recursive: true, force: true }));

/** Writes the studio's files. */
function write(files: Record<string, string>) {
	for (const [name, text] of Object.entries(files)) {
		mkdirSync(dirname(join(studio, name)), { recursive: true });
		writeFileSync(join(studio, name), text);
	}
}

describe("a client that shares a package", () => {
	it("is built with the package's source, from where the site fetched it", async () => {
		write({
			"studio.json": JSON.stringify({
				sdk: "^0.14.0",
				games: ["game"],
				packages: { "@tidewater/kit": "https://example.com/kit.git#v1.0.0" }
			}),
			"packages/@tidewater/kit/greeting.ts": `export const GREETING: string = "from the shared kit";`,
			"packages/@tidewater/kit/Badge.svelte": `<script lang="ts">\n\tlet { text }: { text: string } = $props();\n</script>\n\n<p class="badge">{text}</p>`,
			"game/client/index.html": `<!doctype html><html><body><div id="game"></div><script type="module" src="./src/main.ts"></script></body></html>`,
			"game/client/src/main.ts": `import { mount } from "svelte";\nimport Badge from "@tidewater/kit/Badge.svelte";\nimport { GREETING } from "@tidewater/kit/greeting.ts";\n\nmount(Badge, { target: document.getElementById("game")!, props: { text: GREETING } });`
		});

		// Named from the folder this is run in, as the site names it.
		await buildClient(relative(process.cwd(), join(studio, "game", "client")));

		const assets = join(studio, "game", "client", "dist", "assets");
		const built = readdirSync(assets)
			.filter((name) => name.endsWith(".js"))
			.map((name) => readFileSync(join(assets, name), "utf8"))
			.join("\n");

		expect(built).toContain("from the shared kit");
		expect(built).toContain("badge");
	});
});
