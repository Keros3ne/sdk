/**
 * A loading screen's look (./loading-look.ts): what a studio may say of it, and how it is
 * carried to the screen.
 *
 * Author: dwclake
 * Created: 2026-11-18
 */

import { describe, expect, it } from "vitest";
import { lookProperties, lookStyle, type LoadingLook } from "./loading-look.ts";

describe("a loading screen's look", () => {
	it("is carried as the properties its style sheet reads, measures in pixels", () => {
		expect(
			lookProperties({
				surface: "var(--page)",
				ink: "#fff",
				titleSize: 14,
				titleCase: "uppercase",
				barWidth: 200,
				gap: 16
			})
		).toEqual([
			["--loading-surface", "var(--page)"],
			["--loading-ink", "#fff"],
			["--loading-title-size", "14px"],
			["--loading-title-case", "uppercase"],
			["--loading-bar-width", "200px"],
			["--loading-gap", "16px"]
		]);
		expect(lookStyle({ fill: "#fc0", barHeight: 6 })).toBe(
			"--loading-fill: #fc0; --loading-bar-height: 6px"
		);
		expect(lookStyle({})).toBe("");
	});

	it("leaves the name out only when asked", () => {
		expect(lookProperties({ showTitle: false })).toEqual([
			["--loading-title", "none"]
		]);
		expect(lookProperties({ showTitle: true })).toEqual([]);
	});

	it("refuses a part the screen does not have, and a value that says more than its own", () => {
		expect(() => lookProperties({ position: "static" } as LoadingLook)).toThrow(
			/has no "position"/
		);
		expect(() => lookProperties({ surface: "#123; inset: 50%" })).toThrow(
			/cannot be/
		);
		expect(() => lookProperties({ barWidth: "wide" as unknown as number })).toThrow(
			/cannot be/
		);
	});
});
