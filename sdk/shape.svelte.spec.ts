/**
 * A game's shape (./shape.svelte.ts), in a real browser: that it is tall only where the
 * game is higher than it is wide, that it follows an element as the element changes size,
 * and that it is written where a style sheet can read it.
 *
 * Author: dwclake
 * Created: 2026-11-19
 */

import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";
import { createShape, shapeOf } from "./shape.svelte.ts";

const settle = () =>
	new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));

describe("a game's shape", () => {
	it("is tall only where the game is higher than it is wide", () => {
		expect(shapeOf(1600, 1000)).toBe("wide");
		expect(shapeOf(360, 640)).toBe("tall");
		expect(shapeOf(500, 500)).toBe("wide");
	});

	it("follows the page, and says so on it", () => {
		const shape = createShape();

		expect(shape.current).toBe(shapeOf(window.innerWidth, window.innerHeight));
		expect(document.documentElement.dataset.shape).toBe(shape.current);
	});

	it("follows an element as it changes size, and lets go of it", async () => {
		const box = document.createElement("div");
		box.style.cssText = "width: 320px; height: 200px;";
		document.body.append(box);

		const shape = createShape();
		const stop = shape.follow(box);

		await settle();
		flushSync();
		expect(shape.wide).toBe(true);
		expect([shape.width, shape.height]).toEqual([320, 200]);
		expect(box.dataset.shape).toBe("wide");
		expect(document.documentElement.dataset.shape).toBeUndefined();

		box.style.cssText = "width: 180px; height: 320px;";
		await settle();
		flushSync();
		expect(shape.tall).toBe(true);
		expect(box.dataset.shape).toBe("tall");

		stop();
		expect(box.dataset.shape).toBeUndefined();
		expect(document.documentElement.dataset.shape).toBe(shape.current);
		box.remove();
	});
});
