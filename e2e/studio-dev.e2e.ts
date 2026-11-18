import { expect, test, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import {
	cpSync,
	mkdirSync,
	readFileSync,
	rmSync,
	utimesSync,
	writeFileSync
} from "node:fs";
import { join, resolve } from "node:path";

/**
 * `keros3ne-studio dev`, the SDK's stand-in for the site (sdk/dev.ts), on a copy of the
 * example game and its books: a copy, so that its rebuilds never touch the game itself.
 * Under test-results, so that it finds the SDK in this repository. Each test starts its
 * own, on a port of its parallel slot (4200 and up), so that tests running at once never
 * share one.
 */
async function startDev() {
	const port = 4200 + test.info().parallelIndex;
	const root = resolve(`test-results/studio-dev-${port}`);
	rmSync(root, { recursive: true, force: true });
	mkdirSync(root, { recursive: true });
	cpSync("harbour-lights", join(root, "harbour-lights"), {
		recursive: true,
		filter: (path) =>
			!path.includes(join("client", "dist")) && !path.includes(".svelte-kit")
	});
	cpSync("studio.json", join(root, "studio.json"));
	const dev: ChildProcess = spawn(
		"bun",
		[
			"sdk/cli.ts",
			"dev",
			"harbour-lights",
			"--root",
			root,
			"--port",
			String(port),
			"--balance",
			"10.00"
		],
		{ stdio: "ignore" }
	);
	const url = `http://localhost:${port}/`;
	await expect
		.poll(async () => (await fetch(`${url}api/state`).catch(() => null))?.ok, {
			timeout: 20_000
		})
		.toBe(true);
	return {
		url,
		root,
		/** Stops it, and waits until it has stopped, so the next test can have the port. */
		stop: async () => {
			const exited = new Promise((done) => dev.once("exit", done));
			dev.kill("SIGTERM");
			await exited;
			rmSync(root, { recursive: true, force: true });
		}
	};
}

async function openGame(page: Page, url: string) {
	await page.goto(url);
	const game = page.frameLocator("iframe.frame");
	await expect(game.locator('body[data-ready="true"]')).toBeAttached({
		timeout: 20_000
	});
	return game;
}

test("dev plays a game against the stand-in, logs what the site would ignore, and sets a pretend balance", async ({
	page
}) => {
	const dev = await startDev();
	try {
		const errors: string[] = [];
		page.on("pageerror", (error) => errors.push(error.message));
		const game = await openGame(page, dev.url);
		const log = page.locator(".log");
		await expect(page.locator(".figure")).toHaveText("10.00");
		await expect(log).toContainText('"type":"init"');

		// A message the site would ignore is logged as ignored, with why.
		await page
			.frames()
			.find((frame) => frame.url().includes("/studio-frame/"))!
			.evaluate(() =>
				window.parent.postMessage(
					{
						protocol: "keros3ne-game/2",
						type: "open",
						id: 9,
						bet: -5,
						params: {}
					},
					"*"
				)
			);
		await expect(log).toContainText("ignored, as the site would");

		// A spin: the stake leaves at once, and the round is played by the stand-in, from the
		// game's books. What it paid is in the balance once the game says it was shown. The
		// client may be built once more just after `dev` starts, which loads the game again
		// under a spin: it is spun again until one has been shown to its end.
		await expect(async () => {
			await game.getByRole("button", { name: "Spin", exact: true }).click();
			await expect(log).toContainText('"type":"round"');
			await expect(log).toContainText('"type":"settled"', { timeout: 10_000 });
		}).toPass({ timeout: 40_000 });
		await expect(page.locator(".seeds")).toContainText(/Bets on these seeds[1-9]/);

		// The pretend balance can be set, and the game is told.
		await page.getByRole("textbox", { name: "New balance" }).fill("50.00");
		await page.getByRole("button", { name: "Set", exact: true }).click();
		await expect(page.locator(".figure")).toHaveText("50.00");
		await expect(log).toContainText('"type":"balance","balance":5000');

		// The phone's shape.
		await page.getByRole("button", { name: "Phone, 9 by 16" }).click();
		const frame = await page.locator("iframe.frame").boundingBox();
		expect(frame!.height).toBeGreaterThan(frame!.width);
		expect(errors).toEqual([]);
	} finally {
		await dev.stop();
	}
});

test("dev starts the stand-in again when the maths changes, and reloads the game when the client is rebuilt", async ({
	page
}) => {
	const dev = await startDev();
	try {
		const game = await openGame(page, dev.url);
		const log = page.locator(".log");
		const now = new Date();
		utimesSync(join(dev.root, "harbour-lights", "maths", "index.ts"), now, now);
		await expect(log).toContainText("The maths changed", { timeout: 20_000 });
		await expect(game.locator('body[data-ready="true"]')).toBeAttached({
			timeout: 20_000
		});

		utimesSync(
			join(dev.root, "harbour-lights", "client", "src", "routes", "+page.svelte"),
			now,
			now
		);
		await expect(log).toContainText("The client was built again", {
			timeout: 20_000
		});
		await expect(game.locator('body[data-ready="true"]')).toBeAttached({
			timeout: 20_000
		});
	} finally {
		await dev.stop();
	}
});
