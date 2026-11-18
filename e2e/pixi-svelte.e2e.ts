/**
 * The SDK's Pixi bindings for Svelte (sdk/pixi), in a browser, under the policy a
 * studio game's client is served with: that what a component says is what Pixi draws,
 * that it follows state as it changes, that a piece comes and goes with its component,
 * and that presses and the ticker reach the pieces.
 *
 * The page is the SDK's own (sdk/test/pixi-svelte), built as every client is.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import { expect, test, type Page } from "@playwright/test";
import { serveClient } from "./client-server";

const RED = "255,0,0";
const BLUE = "0,0,255";
const PICTURE = "0,200,80";
const GROUND = "0,0,0";

test.describe.configure({ mode: "serial" });

let served: Awaited<ReturnType<typeof serveClient>>;

test.beforeAll(async () => {
	served = await serveClient(
		"sdk/test/pixi-svelte/client",
		"pixi-svelte",
		4240 + test.info().parallelIndex
	);
});

test.afterAll(async () => {
	await served.stop();
});

/** Has the page write what it has drawn, and hands it back. */
async function read(page: Page) {
	await page.getByRole("button", { name: "Read" }).click();

	return page.evaluate(() => ({ ...document.body.dataset }));
}

test("a drawing written as components is drawn, follows its state, and is pressed and ticked", async ({
	page
}) => {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));

	await page.goto(served.url);
	await expect(page.locator('body[data-ready="true"]')).toBeAttached({
		timeout: 20_000
	});
	await expect(page.getByRole("img", { name: "A test drawing" })).toBeVisible();
	// The loading screen followed the stage, and went when it was ready.
	await expect(page.getByRole("progressbar")).toHaveCount(0);

	// As written: a shape at the left, a picture, words, and a group with a shape in it.
	let drawn = await read(page);
	expect(drawn.left).toBe(RED);
	expect(drawn.right).toBe(GROUND);
	expect(drawn.picture).toBe(PICTURE);
	expect(drawn.group).toBe(BLUE);
	expect(drawn.words).toBe("true");
	expect(drawn.pieces).toBe("4");

	// State changes, and the shape is where its prop now says.
	await page.getByRole("button", { name: "Move" }).click();
	drawn = await read(page);
	expect(drawn.left).toBe(GROUND);
	expect(drawn.right).toBe(RED);

	// A piece goes with its component, and comes back with it.
	await page.getByRole("button", { name: "Picture" }).click();
	drawn = await read(page);
	expect(drawn.picture).toBe(GROUND);
	expect(drawn.pieces).toBe("3");

	await page.getByRole("button", { name: "Picture" }).click();
	drawn = await read(page);
	expect(drawn.picture).toBe(PICTURE);
	expect(drawn.pieces).toBe("4");

	// A press on a piece inside a group reaches it, and one beside it does not.
	const canvas = page.locator("canvas");
	await canvas.click({ position: { x: 120, y: 70 } });
	await canvas.click({ position: { x: 20, y: 70 } });
	drawn = await read(page);
	expect(drawn.pressed).toBe("1");

	// The ticker reaches a piece that follows it.
	expect(Number(drawn.frames)).toBeGreaterThan(0);

	// And the policy stopped nothing along the way.
	expect(JSON.parse(drawn.stopped ?? "[]")).toEqual([]);
	expect(errors).toEqual([]);
});

test("the stage is drawn in the game's own measure, whatever room it is given", async ({
	page
}) => {
	await page.goto(served.url);
	await expect(page.locator('body[data-ready="true"]')).toBeAttached({
		timeout: 20_000
	});

	// Twice the room: the canvas is twice the size, and keeps its shape.
	await page.addStyleTag({ content: ".room { width: 400px !important; }" });
	await expect
		.poll(async () => (await page.locator("canvas").boundingBox())?.width)
		.toBe(400);
	expect((await page.locator("canvas").boundingBox())?.height).toBe(200);

	// The press lands on the same piece, now at twice the distance.
	await page.locator("canvas").click({ position: { x: 240, y: 140 } });
	expect((await read(page)).pressed).toBe("1");
});
