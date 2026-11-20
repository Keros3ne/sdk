/**
 * The SDK's Storybook (`keros3ne-studio stories`), on the SDK's own test studio: that it
 * shows the SDK's stories and the studio's, that a piece in a story is the piece itself
 * and can be worked, and that a story can play rounds from the studio's real books,
 * choice and all.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import { expect, test, type Page } from "@playwright/test";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";

const STUDIO = "sdk/test/book-studio";

// Storybook builds a story the first time it is asked for, which takes a while when the
// rest of the suite is running beside it.
test.describe.configure({ mode: "serial", timeout: 120_000 });

let storybook: ChildProcess;
let origin: string;

test.beforeAll(async () => {
	test.setTimeout(180_000);

	// The studio's books, for the stories that play from them.
	const made = spawnSync("bun", [
		"sdk/cli.ts",
		"books",
		"--root",
		STUDIO,
		"--workers",
		"0"
	]);
	expect(made.status).toBe(0);

	const port = 6100 + test.info().parallelIndex;
	origin = `http://localhost:${port}`;
	storybook = spawn(
		"bun",
		["sdk/cli.ts", "stories", "--root", STUDIO, "--port", String(port)],
		{ stdio: "ignore" }
	);

	await expect
		.poll(async () => (await fetch(`${origin}/index.json`).catch(() => null))?.ok, {
			timeout: 120_000
		})
		.toBe(true);
});

test.afterAll(async () => {
	const exited = new Promise((done) => storybook.once("exit", done));

	storybook.kill("SIGTERM");
	await exited;
});

/** Opens one story by itself, as Storybook shows it in its frame. */
async function open(page: Page, id: string) {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));

	await page.goto(`${origin}/iframe.html?id=${id}&viewMode=story`);
	await expect(page.locator("#storybook-root > *").first()).toBeAttached({
		timeout: 60_000
	});

	return errors;
}

test("it shows the SDK's own stories and the studio's", async () => {
	const index = (await (await fetch(`${origin}/index.json`)).json()) as {
		entries: Record<string, { title: string }>;
	};
	const ids = Object.keys(index.entries);

	expect(ids).toEqual(
		expect.arrayContaining([
			"sdk-control-bar--left-alone",
			"sdk-control-bar--in-a-tall-view",
			"sdk-board-of-reels--five-by-three",
			"sdk-books--a-round-from-the-books",
			"gem-drop-gem-meter--part-full"
		])
	);
});

test("the control bar in a story is the bar, and can be played", async ({ page }) => {
	const errors = await open(page, "sdk-control-bar--left-alone");
	const bar = page.getByRole("group", { name: "Game controls" });

	await expect(bar).toBeVisible();
	await bar.getByRole("button", { name: "Raise the bet" }).click();
	await expect(page.getByText("Bet: 1.20")).toBeVisible();
	await bar.getByRole("button", { name: "Spin", exact: true }).click();
	await expect(page.getByText(/^Played/)).toBeVisible();

	// In a tall view it is left to its buttons, with the balance and the last win along the top.
	await open(page, "sdk-control-bar--in-a-tall-view");
	await expect(page.locator(".sdk-bar-frame .sdk-bar-strip")).toBeVisible();
	await expect(page.locator(".sdk-bar-betbutton")).toBeVisible();
	expect(errors).toEqual([]);
});

test("a board of reels and a studio's own piece are drawn in their stories", async ({
	page
}) => {
	let errors = await open(page, "sdk-board-of-reels--five-by-three");

	await expect(page.getByRole("img", { name: "A board of reels" })).toBeVisible();
	await page.getByRole("button", { name: "Spin" }).click();
	await page.getByRole("button", { name: "Light the top row" }).click();
	await page.getByRole("button", { name: "Let it fall" }).click();
	expect(errors).toEqual([]);

	errors = await open(page, "gem-drop-gem-meter--full");
	await expect(page.getByRole("img", { name: "10 of 10 gems" })).toBeVisible();
	expect(errors).toEqual([]);
});

test("a story plays rounds from the studio's real books, and goes on from a choice", async ({
	page
}) => {
	const errors = await open(page, "sdk-books--a-round-from-the-books");
	const draw = page.getByRole("button", { name: "Draw a round" });

	await expect(page.getByLabel("Game")).toContainText("Gem Drop");
	await expect(page.getByLabel("Mode")).toContainText("Bought bonus");
	await expect(draw).toBeEnabled();

	// A spin: one row of the spin table, with the events that play it.
	await draw.click();
	await expect(page.getByRole("listitem").first()).toContainText(/spin, row \d+, pays/);
	await expect(page.locator("#storybook-root code").first()).toContainText('"type"');

	// A bought bonus stops at its choice at once, and plays on from the option picked.
	await page.getByLabel("Mode").selectOption({ label: "Bought bonus" });
	await draw.click();
	await expect(page.getByText("the round is open")).toBeVisible();
	await page.getByRole("button", { name: "wild" }).click();
	await expect(page.getByText("in all.")).toBeVisible();
	await expect(page.getByRole("list").first()).toContainText("bought");
	await expect(page.getByRole("list").first()).toContainText("bonus-wild");
	await expect(page.getByText("(chose wild)")).toBeVisible();
	expect(errors).toEqual([]);
});
