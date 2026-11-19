/**
 * The control bar's rules, in a real browser, since they are about where things are
 * drawn: that the SDK's bar is its items in its order with play in its dead centre, wide
 * and narrow; that it says what room it takes; that what a studio may ask of it is
 * followed and what it may not is refused; and that a studio's own bar, made of the same
 * items, is a bar as long as it shows the balance, the bet and play.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import { flushSync, mount, unmount } from "svelte";
import { afterEach, describe, expect, it } from "vitest";
import type { BarHandle as Bar } from "../bar.ts";
import CustomBar from "./CustomBar.fixture.svelte";
import { ControlBar } from "./index.ts";

let game: HTMLElement;
let mounted: Record<string, unknown> | null = null;

/** A positioned box the size of a game, for a bar to be placed in. */
function room(width: number): HTMLElement {
	game = document.createElement("div");
	game.style.cssText = `position: relative; width: ${width}px; height: 600px;`;
	document.body.append(game);

	return game;
}

/**
 * The SDK's bar in a game of this width, set as asked. What comes back is the bar as the
 * component hands it to a game, with each thing done to it shown on the page at once, as
 * a test reads the page on the next line.
 */
function makeBar(more: Record<string, unknown> = {}, width = 1000): Bar {
	let made: Bar | undefined;

	mounted = mount(ControlBar, {
		target: room(width),
		props: {
			bets: [10, 20, 50, 100],
			startBet: 20,
			limits: { minStake: 10, maxStake: 100 },
			balance: 25_00,
			play: { label: "Spin", symbol: "spin" },
			onplay: () => {},
			autoplay: {
				noun: ["spin", "spins"],
				onstart: () => {},
				onstop: () => {}
			},
			within: "parent",
			onready: (bar: Bar) => (made = bar),
			...more
		}
	});
	flushSync();

	return new Proxy(made!, {
		get(bar, key) {
			const value = Reflect.get(bar, key);
			if (typeof value !== "function") return value;

			return (...args: unknown[]) => {
				const result = (value as (...args: unknown[]) => unknown).apply(
					bar,
					args
				);
				flushSync();

				return result;
			};
		}
	});
}

const box = (selector: string) => game.querySelector(selector)!.getBoundingClientRect();
const middle = (selector: string) => {
	const { left, right } = box(selector);

	return (left + right) / 2;
};
/** The items drawn inside this, left to right. */
const itemsIn = (selector: string) =>
	[...game.querySelectorAll<HTMLElement>(`${selector} .sdk-bar-segment`)]
		.filter((segment) => segment.getBoundingClientRect().width > 0)
		.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)
		.map((segment) => segment.dataset.segment);
const settle = () =>
	new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));

afterEach(() => {
	if (mounted) void unmount(mounted);
	mounted = null;
	game?.remove();
});

describe("the SDK's control bar", () => {
	it("is its items in its order along the bottom, with play in its dead centre", async () => {
		const bar = makeBar();
		await document.fonts.ready;
		await settle();

		expect(itemsIn(".sdk-bar")).toEqual([
			"menu",
			"balance",
			"bet",
			"play",
			"autoplay",
			"speed",
			"win"
		]);
		expect(Math.abs(middle(".sdk-bar-play") - middle(".sdk-bar"))).toBeLessThan(1);
		expect(game.querySelector(".sdk-bar-strip")).toBeNull();

		// It lies along the bottom, and says what room it takes there.
		const dock = box(".sdk-bar");
		const around = game.getBoundingClientRect();
		expect(Math.round(dock.bottom)).toBe(Math.round(around.bottom));
		expect(bar.inset()).toEqual({ top: 0, bottom: Math.ceil(dock.height - 0.01) });
		expect(game.style.getPropertyValue("--sdk-bar-bottom")).toBe(
			`${bar.inset().bottom}px`
		);
		expect(bar.rect().width).toBe(1000);
	});

	it("keeps play in its dead centre at any width and any balance, the bet one button where the whole would not fit", async () => {
		for (const [width, balance] of [
			[640, 25_00],
			[760, 25_00],
			[900, 25_00],
			[900, 9_999_999_99],
			[1200, 9_999_999_99],
			[1600, 9_999_999_99]
		]) {
			makeBar({ balance }, width);
			await document.fonts.ready;
			await settle();
			await settle();
			flushSync();
			await settle();

			const where = `at ${width} with ${balance}`;
			expect(
				Math.abs(middle(".sdk-bar-play") - middle(".sdk-bar")),
				where
			).toBeLessThan(1);
			// Nothing runs out of the bar.
			const dock = box(".sdk-bar");
			for (const item of game.querySelectorAll(".sdk-bar .sdk-bar-segment")) {
				const at = item.getBoundingClientRect();
				if (at.width === 0) continue;

				expect(at.left, where).toBeGreaterThanOrEqual(dock.left);
				expect(at.right, where).toBeLessThanOrEqual(dock.right);
			}

			void unmount(mounted!);
			mounted = null;
			game.remove();
		}

		// With room for all of it the bet has its minus and plus; without, it is one button.
		makeBar({ balance: 25_00 }, 1200);
		await settle();
		expect(game.querySelector(".sdk-bar-betbutton")).toBeNull();
		expect(game.querySelector(".sdk-bar-minus")).not.toBeNull();
		void unmount(mounted!);
		mounted = null;
		game.remove();

		makeBar({ balance: 25_00 }, 660);
		await settle();
		await settle();
		flushSync();
		expect(game.querySelector(".sdk-bar-betbutton")).not.toBeNull();
	});

	it("is one row on a narrow game, with the balance and the last win along the top", async () => {
		const bar = makeBar({}, 390);
		await document.fonts.ready;
		await settle();

		expect(itemsIn(".sdk-bar")).toEqual(["menu", "bet", "play", "autoplay", "speed"]);
		expect(itemsIn(".sdk-bar-strip")).toEqual(["balance", "win"]);
		expect(Math.abs(middle(".sdk-bar-play") - middle(".sdk-bar"))).toBeLessThan(1);

		// No button touches the next, and none is outside the game.
		const buttons = [...game.querySelectorAll<HTMLElement>(".sdk-bar > * button")]
			.filter(
				(button) => button.offsetParent && !button.closest(".sdk-popup-panel")
			)
			.map((button) => button.getBoundingClientRect())
			.sort((a, b) => a.left - b.left);
		const around = game.getBoundingClientRect();
		expect(buttons.length).toBe(5);
		expect(buttons[0].left).toBeGreaterThanOrEqual(around.left);
		expect(buttons.at(-1)!.right).toBeLessThanOrEqual(around.right);
		for (let index = 1; index < buttons.length; index++)
			expect(buttons[index].left - buttons[index - 1].right).toBeGreaterThanOrEqual(
				4
			);

		// Both parts count in the room the bar takes.
		const inset = bar.inset();
		expect(inset.top).toBe(Math.ceil(box(".sdk-bar-strip").height - 0.01));
		expect(inset.bottom).toBe(Math.ceil(box(".sdk-bar").height - 0.01));
	});

	it("chooses a bet from its button on a narrow game, which closes when one is chosen", async () => {
		const bar = makeBar({}, 390);
		await settle();

		const opener = game.querySelector<HTMLButtonElement>(".sdk-bar-betbutton")!;
		opener.click();
		flushSync();

		const offers = [
			...game.querySelectorAll<HTMLButtonElement>(".sdk-bar-bets .sdk-choice")
		];
		expect(offers.map((offer) => offer.textContent?.trim())).toEqual([
			"0.10",
			"0.20",
			"0.50",
			"1.00"
		]);

		offers[2].click();
		flushSync();
		expect(bar.bet).toBe(50);
		expect(opener.getAttribute("aria-expanded")).toBe("false");
		expect(opener.textContent).toContain("0.50");
	});

	it("names the bet as the game asks, from names declared up front, without the bet changing size", async () => {
		const bar = makeBar({ betLabels: ["Bonus spin"] });
		await settle();
		const label = () =>
			[...game.querySelectorAll<HTMLElement>(".sdk-bar-betlabel > span")]
				.filter((name) => getComputedStyle(name).visibility === "visible")
				.map((name) => name.textContent?.trim())
				.join();
		const before = box('[data-segment="bet"]');
		expect(label()).toBe("Bet");

		bar.setBetLabel("Bonus spin");
		await settle();
		expect(label()).toBe("Bonus spin");
		expect(game.querySelector(".sdk-bar-betvalue")!.textContent).toContain("0.20");
		const after = box('[data-segment="bet"]');
		expect(after.width).toBe(before.width);
		expect(after.left).toBe(before.left);

		expect(() => bar.setBetLabel("Not declared")).toThrow(/betLabels/);
	});

	it("refuses a name for the bet too long for its label", () => {
		expect(() => makeBar({ betLabels: ["A very long name"] })).toThrow(
			/1 to 10 characters/
		);
	});

	it("shows the free spins left on the play button, which cannot stop them", async () => {
		const bar = makeBar();
		await settle();
		const play = game.querySelector<HTMLButtonElement>(".sdk-bar-play")!;

		bar.setFreeSpins(8);
		expect(play.disabled).toBe(true);
		expect(play.getAttribute("aria-label")).toBe("Free spins, 8 left");
		expect(play.querySelector(".sdk-bar-play-count")!.textContent?.trim()).toBe("8");

		bar.setFreeSpins(null);
		expect(play.disabled).toBe(false);
		expect(play.getAttribute("aria-label")).toBe("Spin");
	});

	it("keeps autoplay's count on the play button inside the button", async () => {
		const bar = makeBar();
		await document.fonts.ready;
		await settle();

		bar.autoLeft = 100;
		flushSync();
		await settle();

		const play = box(".sdk-bar-play");
		const count = box(".sdk-bar-play-count");
		expect(count.left).toBeGreaterThan(play.left);
		expect(count.right).toBeLessThan(play.right);
		expect(game.querySelector(".sdk-bar-play")!.getAttribute("aria-label")).toBe(
			"Stop autoplay, 100 spins left"
		);
	});

	it("leaves out the menu and the win if asked, and refuses to leave out what a player needs", async () => {
		makeBar({ hide: ["menu", "win"] });
		await settle();

		expect(itemsIn(".sdk-bar")).toEqual([
			"balance",
			"bet",
			"play",
			"autoplay",
			"speed"
		]);
		expect(Math.abs(middle(".sdk-bar-play") - middle(".sdk-bar"))).toBeLessThan(1);

		void unmount(mounted!);
		mounted = null;
		game.remove();
		expect(() => makeBar({ hide: ["balance"] })).toThrow(/cannot be hidden/);
	});

	it("lies along the top if asked, its popups opening downward", async () => {
		const bar = makeBar({ place: "top" });
		await settle();

		const dock = box(".sdk-bar");
		expect(Math.round(dock.top)).toBe(Math.round(game.getBoundingClientRect().top));
		expect(bar.inset()).toEqual({ top: Math.ceil(dock.height - 0.01), bottom: 0 });

		game.querySelector<HTMLButtonElement>('button[aria-label="Auto"]')!.click();
		flushSync();
		expect(box(".sdk-bar-auto .sdk-popup-panel").top).toBeGreaterThanOrEqual(
			box('button[aria-label="Auto"]').bottom
		);
	});

	it("is bigger or smaller as asked, but never too big to fit across the game", async () => {
		makeBar({ scale: 1.25 });
		await settle();
		const frame = () => game.querySelector<HTMLElement>(".sdk-bar-frame")!;
		expect(frame().style.getPropertyValue("--bar-s")).toBe("1.25");

		void unmount(mounted!);
		mounted = null;
		game.remove();
		makeBar({ scale: 1.5 }, 800);
		await settle();
		expect(Number(frame().style.getPropertyValue("--bar-s"))).toBeLessThan(1.5);
		expect(box(".sdk-bar").width).toBe(800);
	});
});

describe("a studio's own bar", () => {
	it("is the SDK's items where the studio put them, each dressed and sized as it asked", async () => {
		let made: Bar | undefined;
		mounted = mount(CustomBar, {
			target: room(1000),
			props: { onready: (bar: Bar) => (made = bar) }
		});
		flushSync();
		await settle();

		expect(itemsIn(".custom-top")).toEqual(["win", "balance"]);
		expect(itemsIn(".custom-bottom")).toEqual([
			"play",
			"speed",
			"autoplay",
			"bet",
			"menu"
		]);

		// An item takes more through its own props than the SDK's bar offers.
		expect(game.querySelector(".custom-top .sdk-bar-label")!.textContent).toBe(
			"Last win"
		);
		expect(game.querySelector(".custom-top .sdk-bar-win .sdk-bar-unit")).toBeNull();
		expect(
			game
				.querySelector<HTMLElement>('[data-segment="balance"]')!
				.style.getPropertyValue("--bar-segment-surface")
		).toBe("rgb(1, 2, 3)");
		// Its colours too: the switched-on colour is the item's own to say.
		expect(
			game
				.querySelector<HTMLElement>('[data-segment="speed"]')!
				.style.getPropertyValue("--bar-on")
		).toBe("rgb(4, 5, 6)");
		expect(box(".sdk-bar-play").width).toBe(108);
		expect(box(".sdk-bar-plus").bottom).toBeLessThanOrEqual(
			box(".sdk-bar-minus").top
		);

		// It is still a bar: it plays, and says what room its parts take.
		expect(made!.inset().top).toBe(Math.ceil(box(".custom-top").height - 0.01));
		// A part may ask for clear room beyond itself, which counts too.
		expect(made!.inset().bottom).toBe(
			Math.ceil(box(".custom-bottom").height + 10 - 0.01)
		);

		game.querySelector<HTMLButtonElement>(
			'button[aria-label="Raise the bet"]'
		)!.click();
		flushSync();
		expect(made!.bet).toBe(50);
	});

	it("is refused without the balance, the bet or play", () => {
		for (const without of ["balance", "bet", "play"] as const) {
			expect(() => {
				mount(CustomBar, { target: room(1000), props: { without } });
				flushSync();
			}).toThrow(new RegExp(`no ${without}`));
			game.remove();
		}
	});
});
