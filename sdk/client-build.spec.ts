/**
 * Building a client that shares a package: that a package its repository names is read
 * from the folder the site fetched it into, as source, Svelte among it. And building one
 * that shows a loading screen: that its page comes with the screen in it, and names the
 * code to wait for.
 *
 * Author: dwclake
 * Created: 2026-11-19
 */

import {
	existsSync,
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

describe("a client that shows a loading screen", () => {
	/** Builds a client of one script, and returns its page and the names of its files. */
	async function built(game: string, script: string) {
		write({
			[`${game}/client/index.html`]: `<!doctype html><html><head><meta charset="utf-8" /><title>Tide &amp; Time</title><script type="module" src="./src/main.ts"></script></head><body></body></html>`,
			[`${game}/client/src/more.ts`]: `export const MORE: string = "asked for only later";`,
			[`${game}/client/src/main.ts`]: script
		});
		await buildClient(join(studio, game, "client"));

		const dist = join(studio, game, "client", "dist");

		return {
			page: readFileSync(join(dist, "index.html"), "utf8"),
			files: readdirSync(join(dist, "assets")).map((name) => `assets/${name}`),
			size: (file: string) => readFileSync(join(dist, file)).byteLength
		};
	}

	it("has the screen in its page, with the code to wait for and what fills it", async () => {
		const { page, files, size } = await built(
			"waits",
			`import { createLoadingScreen } from "${fileURLToPath(new URL("./loading.ts", import.meta.url))}";\n\nconst loading = createLoadingScreen({ title: document.title });\nvoid import("./more.ts").then(() => loading.done());`
		);

		// The screen, named by the page's title, waiting to be filled.
		expect(page).toMatch(/<div class="sdk-loading sdk-loading-first" data-waiting /);
		expect(page).toContain(`<p class="sdk-loading-title">Tide &amp; Time</p>`);
		expect(page).toContain(`aria-label="Loading Tide &amp; Time"`);
		expect(page).not.toContain('sdk-loading-logo"');
		// Its style is in the page, after the page's encoding.
		expect(page.indexOf("<style>")).toBeGreaterThan(page.indexOf("charset"));
		expect(page).toContain(".sdk-loading-fill {");

		// What fills it is a file of the client's, never inline, and asked for first.
		const filler = files.find((file) => /loading-first-[\w-]+\.js$/.test(file));
		expect(filler).toBeDefined();
		expect(page).toContain(`<script defer src="./${filler}"></script>`);
		expect(page.indexOf(filler!)).toBeLessThan(page.indexOf(`type="module"`));
		expect(page).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);

		// The code named is the page's own script, by about its size (a weight: the file may
		// be finished after the page is written); not what it asks for only later.
		const code = /data-code="([^"]*)"/.exec(page)![1].split(",");
		const main = files.find((file) => /index-[\w-]+\.js$/.test(file))!;
		expect(code).toHaveLength(1);
		expect(code[0].split(":")[0]).toBe(main);
		expect(Number(code[0].split(":")[1]) / size(main)).toBeCloseTo(1, 1);
	});

	it("has the studio's logo over the name, where the client's public folder has one", async () => {
		write({
			"branded/client/public/loading-logo.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 2"><rect width="4" height="2" /></svg>`
		});
		const { page } = await built(
			"branded",
			`import { createLoadingScreen } from "${fileURLToPath(new URL("./loading.ts", import.meta.url))}";\n\nvoid createLoadingScreen({ title: document.title }).done();`
		);

		const logo = `<img class="sdk-loading-logo" src="./loading-logo.svg" alt="">`;
		expect(page).toContain(logo);
		expect(page.indexOf(logo)).toBeLessThan(
			page.indexOf(`<p class="sdk-loading-title"`)
		);
		expect(
			existsSync(join(studio, "branded", "client", "dist", "loading-logo.svg"))
		).toBe(true);
	});

	it("is dressed as the call says, read from the game's source: its name, logo and look", async () => {
		write({
			"dressed/client/public/mark.svg": `<svg xmlns="http://www.w3.org/2000/svg" />`
		});
		const { page } = await built(
			"dressed",
			`import { createLoadingScreen } from "${fileURLToPath(new URL("./loading.ts", import.meta.url))}";\n\nconst loading = createLoadingScreen({\n\ttitle: "Tide <Time>",\n\tlogo: "./mark.svg",\n\tlook: { surface: "linear-gradient(#123, #456)", fill: \`#fc0\`, barWidth: 180, showTitle: true }\n});\nvoid loading.done();`
		);

		expect(page).toContain(
			`style="--loading-surface: linear-gradient(#123, #456); --loading-fill: #fc0; --loading-bar-width: 180px"`
		);
		expect(page).toContain(`<img class="sdk-loading-logo" src="./mark.svg" alt="">`);
		// The name it wrote out, not the page's title.
		expect(page).toContain(`<p class="sdk-loading-title">Tide &lt;Time></p>`);
		expect(page).toContain(`aria-label="Loading Tide &lt;Time&gt;"`);
	});

	it("is refused where what the call says is worked out as the game runs, or is not the screen's", async () => {
		const loading = fileURLToPath(new URL("./loading.ts", import.meta.url));

		await expect(
			built(
				"worked-out",
				`import { createLoadingScreen } from "${loading}";\n\nconst colour = Math.random() > 0.5 ? "#123" : "#456";\nvoid createLoadingScreen({ look: { surface: colour } }).done();`
			)
		).rejects.toThrow(/its look's "surface" is worked out as the game runs/);

		await expect(
			built(
				"not-its-own",
				`import { createLoadingScreen } from "${loading}";\n\nvoid createLoadingScreen({ look: { surface: "#123; position: static" } }).done();`
			)
		).rejects.toThrow(/"surface" cannot be/);
	});

	it("is left as it was written when it shows none: nothing would take the screen away", async () => {
		const { page, files } = await built(
			"plain",
			`document.body.textContent = "ready at once";`
		);

		expect(page).not.toContain("sdk-loading");
		expect(page).not.toContain("loading-first");
		expect(files.filter((file) => file.includes("loading-first"))).toEqual([]);
	});
});
