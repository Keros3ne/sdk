/**
 * Pixi under the policy a studio game's client is served with. The web SDK draws games
 * with Pixi, and the frame's policy (src/frame.ts) is not to be loosened for it:
 * no `unsafe-eval`, no requests, no workers. This holds the settings that make that so,
 * and shows that Pixi as it comes does not get by without them.
 *
 * The page is the SDK's own (src/test/pixi-frame), built as every client is and
 * served here exactly as the site serves a client.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import { expect, test, type Page } from "@playwright/test";
import { serveClient } from "./client-server";

test.describe.configure({ mode: "serial" });

let served: Awaited<ReturnType<typeof serveClient>>;

test.beforeAll(async () => {
	served = await serveClient(
		"src/test/pixi-frame/client",
		"pixi-frame",
		4230 + test.info().parallelIndex
	);
});

test.afterAll(async () => {
	await served.stop();
});

/** Opens the page one way and hands back what it said of itself. */
async function open(page: Page, mode: "careful" | "default" | "eval-only") {
	await page.goto(`${served.url}?mode=${mode}`);
	await expect(page.locator('body[data-ready="true"]')).toBeAttached({
		timeout: 20_000
	});

	return page.evaluate(() => ({
		...document.body.dataset,
		stopped: JSON.parse(document.body.dataset.stopped ?? "[]") as string[]
	}));
}

test("Pixi draws a shape, a picture and a word under the frame's policy, with nothing loosened", async ({
	page
}) => {
	const said = await open(page, "careful");

	expect(said.failed).toBeUndefined();
	expect(said.stopped).toEqual([]);
	expect(said.shape).toBe("255,0,0");
	expect(said.picture).toBe("0,200,80");
	expect(said.ground).toBe("0,0,0");
});

test("Pixi as it comes does not start: the policy allows no eval", async ({ page }) => {
	const said = await open(page, "default");

	expect(said.failed).toMatch(/unsafe-eval/);
	expect(said.shape).toBeUndefined();
});

test("Pixi kept from eval alone still cannot load a picture: the policy allows no requests", async ({
	page
}) => {
	const said = await open(page, "eval-only");

	// The picture is asked for with a request, from a worker or from the page.
	expect(
		said.stopped.some((each) => /^(connect-src|worker-src|script-src)/.test(each))
	).toBe(true);
	expect(said.failed).toBe("The picture never loaded.");
});
