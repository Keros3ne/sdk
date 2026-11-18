/**
 * The studio SDK's control bar, laid out in a real browser: what a studio may change about
 * it (the order of its segments, which are hidden, how each is arranged inside, how wide it
 * is) and what it may not (a segment broken apart, what a player needs hidden).
 *
 * Author: dwclake
 * Created: 2026-11-19
 */

import { flushSync, mount, unmount } from "svelte";
import { afterEach, describe, expect, it } from "vitest";
import type { BarLayout, ControlBar as Bar } from "../bar.ts";
import { ControlBar } from "./index.ts";

let game: HTMLElement;
let mounted: Record<string, unknown> | null = null;

/**
 * A bar in a game of this width, laid out as asked. What comes back is the bar as the
 * component hands it to a game, with each thing done to it shown on the page at once, as
 * a test reads the page on the next line.
 */
function makeBar(layout?: BarLayout, width = 1000, betLabels?: string[]): Bar {
	let made: Bar | undefined;

	game = document.createElement("div");
	game.style.cssText = `position: relative; width: ${width}px; height: 600px;`;
	document.body.append(game);

	mounted = mount(ControlBar, {
		target: game,
		props: {
			bets: [10, 20, 50, 100],
			startBet: 20,
			limits: { minStake: 10, maxStake: 100 },
			balance: 25_00,
			betLabels,
			play: { label: "Spin", symbol: "spin" },
			onplay: () => {},
			autoplay: {
				counts: [10],
				noun: ["spin", "spins"],
				onstart: () => {},
				onstop: () => {}
			},
			layout,
			within: "parent",
			get bar() {
				return made;
			},
			set bar(next: Bar | undefined) {
				made = next;
			}
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
		},
		set(bar, key, value) {
			Reflect.set(bar, key, value);
			flushSync();

			return true;
		}
	});
}

const box = (selector: string) => game.querySelector(selector)!.getBoundingClientRect();
const segmentsInOrder = () =>
	[...game.querySelectorAll<HTMLElement>(".sdk-bar-segment")]
		.filter((segment) => !segment.hidden)
		.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)
		.map((segment) => segment.dataset.segment);
/** Whether every part of a segment is drawn inside the segment's own box. */
const whole = (name: string) => {
	const segment = game
		.querySelector(`[data-segment="${name}"]`)!
		.getBoundingClientRect();
	return [
		...game.querySelectorAll(
			`[data-segment="${name}"] button:not([hidden]), [data-segment="${name}"] output`
		)
	].every((part) => {
		const r = part.getBoundingClientRect();
		return (
			r.width === 0 ||
			(r.left >= segment.left - 0.5 &&
				r.right <= segment.right + 0.5 &&
				r.top >= segment.top - 0.5 &&
				r.bottom <= segment.bottom + 0.5)
		);
	});
};
const settle = () =>
	new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));

afterEach(() => {
	if (mounted) void unmount(mounted);
	mounted = null;
	game?.remove();
});

describe("the control bar", () => {
	it("is the site's five segments in the site's order, play in the middle, when left alone", async () => {
		makeBar();
		await settle();
		expect(segmentsInOrder()).toEqual(["menu", "balance", "bet", "play", "win"]);
		const play = box(".sdk-bar-play");
		expect(
			Math.abs(play.left + play.width / 2 - (box(".sdk-bar").left + 500))
		).toBeLessThan(1);
		// Autoplay at play's left and speed at its right.
		expect(box(".sdk-bar-auto").right).toBeLessThan(play.left);
		expect(box(".sdk-bar-speed").left).toBeGreaterThan(play.right);
		for (const name of ["menu", "balance", "bet", "play", "win"])
			expect(whole(name), name).toBe(true);
	});

	it("names the bet as the game asks, from names declared up front, without the segment changing size", async () => {
		const bar = makeBar(undefined, 1000, ["Bonus spin"]);
		await settle();
		const label = () =>
			[...game.querySelectorAll<HTMLElement>(".sdk-bar-betlabel > span")]
				.filter((name) => getComputedStyle(name).visibility === "visible")
				.map((name) => name.textContent)
				.join();
		const button = () => game.querySelector(".sdk-bar-betvalue")!;
		const before = box('[data-segment="bet"]');
		expect(label()).toBe("Bet");

		bar.setBetLabel("Bonus spin");
		await settle();
		expect(label()).toBe("Bonus spin");
		expect(button().getAttribute("aria-label")).toMatch(/^Bonus spin 0\.20\b/);
		const after = box('[data-segment="bet"]');
		expect(after.width).toBe(before.width);
		expect(after.left).toBe(before.left);
		expect(whole("bet")).toBe(true);

		bar.setBetLabel(null);
		expect(label()).toBe("Bet");
		expect(() => bar.setBetLabel("Mega spin")).toThrow(/betLabels/);
	});

	it("shows the free spins left on the play button, which cannot stop them", async () => {
		const bar = makeBar();
		const play = () => game.querySelector<HTMLButtonElement>(".sdk-bar-play")!;
		bar.setFreeSpins(6);
		expect(play().getAttribute("aria-label")).toBe("Free spins, 6 left");
		expect(play().querySelector(".sdk-bar-play-count")!.textContent).toBe("6");
		expect(play().disabled).toBe(true);
		bar.setFreeSpins(5);
		expect(play().querySelector(".sdk-bar-play-count")!.textContent).toBe("5");
		bar.setFreeSpins(null);
		expect(play().getAttribute("aria-label")).toBe("Spin");
		expect(play().disabled).toBe(false);
		expect(play().querySelector(".sdk-bar-play-count")).toBeNull();
	});

	it("refuses a name for the bet too long for the segment", () => {
		expect(() => makeBar(undefined, 1000, ["A very very long name"])).toThrow(
			/1 to 10/
		);
	});

	it("puts the segments in the order a studio asks, keeping play in the middle and each segment whole", async () => {
		makeBar({ order: ["win", "bet", "play", "balance", "menu"] });
		await settle();
		expect(segmentsInOrder()).toEqual(["win", "bet", "play", "balance", "menu"]);
		const play = box(".sdk-bar-play");
		expect(
			Math.abs(play.left + play.width / 2 - (box(".sdk-bar").left + 500))
		).toBeLessThan(1);
		// The segment beside play is close to it; the rest are out at the edge.
		expect(play.left - box('[data-segment="bet"]').right).toBeLessThan(80);
		expect(box(".sdk-bar").right - box('[data-segment="menu"]').right).toBeLessThan(
			20
		);
		for (const name of ["menu", "balance", "bet", "play", "win"])
			expect(whole(name), name).toBe(true);
	});

	it("hides the menu and the win if asked, and refuses to hide anything a player needs", async () => {
		makeBar({ hide: ["menu", "win"] });
		await settle();
		expect(segmentsInOrder()).toEqual(["balance", "bet", "play"]);
		game.remove();
		for (const segment of ["balance", "bet", "play"] as const)
			expect(() => makeBar({ hide: [segment] })).toThrow(/cannot be hidden/);
	});

	it("refuses an order that leaves out a segment or names one twice", () => {
		expect(() =>
			makeBar({ order: ["menu", "balance", "bet", "play"] as never })
		).toThrow(/each of/);
		expect(() => makeBar({ order: ["menu", "menu", "bet", "play", "win"] })).toThrow(
			/each of/
		);
	});

	it("arranges the bet's plus and minus in a column at either side of the bet", async () => {
		for (const [arrange, side] of [
			["column-end", "right"],
			["column-start", "left"]
		] as const) {
			makeBar({ arrange: { bet: arrange } });
			await settle();
			const [plus, minus, bet] = [
				box(".sdk-bar-plus"),
				box(".sdk-bar-minus"),
				box(".sdk-bar-betvalue")
			];
			expect(plus.bottom, arrange).toBeLessThanOrEqual(minus.top);
			expect(Math.abs(plus.left - minus.left), arrange).toBeLessThan(1);
			if (side === "right")
				expect(plus.left, arrange).toBeGreaterThanOrEqual(bet.right);
			else expect(plus.right, arrange).toBeLessThanOrEqual(bet.left);
			// Still inside the bar's height, and still one segment.
			expect(plus.top, arrange).toBeGreaterThanOrEqual(box(".sdk-bar").top);
			expect(minus.bottom, arrange).toBeLessThanOrEqual(box(".sdk-bar").bottom);
			expect(whole("bet"), arrange).toBe(true);
			game.remove();
		}
	});

	it("arranges autoplay and speed together at one side of play, in a row or a column", async () => {
		for (const arrange of [
			"row-start",
			"row-end",
			"column-start",
			"column-end"
		] as const) {
			makeBar({ arrange: { play: arrange } });
			await settle();
			const [auto, speed, play] = [
				box(".sdk-bar-auto"),
				box(".sdk-bar-speed"),
				box(".sdk-bar-play")
			];
			const before = arrange.endsWith("start");
			for (const part of [auto, speed])
				if (before) expect(part.right, arrange).toBeLessThanOrEqual(play.left);
				else expect(part.left, arrange).toBeGreaterThanOrEqual(play.right);
			if (arrange.startsWith("column"))
				expect(auto.bottom, arrange).toBeLessThanOrEqual(speed.top);
			else expect(Math.abs(auto.top - speed.top), arrange).toBeLessThan(1);
			expect(whole("play"), arrange).toBe(true);
			game.remove();
		}
		expect(() => makeBar({ arrange: { play: "diagonal" as never } })).toThrow(
			/arranged/
		);
	});

	it("is as wide as asked, to the side asked, and says where it is for a button beside it", async () => {
		const bar = makeBar({ width: 0.8, align: "start" });
		await settle();
		const rect = bar.rect();
		expect(rect.left).toBe(0);
		expect(rect.width).toBe(800);
		expect(rect.top + rect.height).toBe(600);
		bar.setLayout({ align: "end" });
		expect(bar.rect().left).toBe(200);
		// Never narrower than what is in it.
		bar.setLayout({ width: 0.5 });
		// (scrollWidth is a whole pixel; the box may be a fraction under it.)
		expect(bar.rect().width).toBeGreaterThan(500);
		expect(bar.rect().width).toBeGreaterThanOrEqual(
			game.querySelector(".sdk-bar")!.scrollWidth - 1
		);
	});

	it("is the site's two rows on a narrow game whatever was asked, each segment still whole", async () => {
		makeBar(
			{
				order: ["win", "bet", "play", "balance", "menu"],
				width: 0.6,
				arrange: { bet: "column-start" }
			},
			380
		);
		await settle();
		const bar = box(".sdk-bar");
		expect(bar.width).toBe(380);
		// Above: the balance, the bet and the win; below: the menu and play, play in the middle.
		const top = (name: string) => box(`[data-segment="${name}"]`).top;
		expect(top("balance")).toBe(top("win"));
		expect(top("play")).toBeGreaterThan(top("bet"));
		const play = box(".sdk-bar-play");
		expect(Math.abs(play.left + play.width / 2 - (bar.left + 190))).toBeLessThan(2);
		// The arrangement inside a segment is still the studio's.
		expect(box(".sdk-bar-plus").bottom).toBeLessThanOrEqual(
			box(".sdk-bar-minus").top
		);
		for (const name of ["menu", "balance", "bet", "play", "win"])
			expect(whole(name), name).toBe(true);
	});
});
