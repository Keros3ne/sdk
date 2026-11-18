/**
 * A look (./look.ts): what a studio may say of the bar and the controls, and how it is
 * carried to them.
 *
 * Author: dwclake
 * Created: 2026-11-19
 */

import { describe, expect, it } from "vitest";
import { barProperties, controlProperties, segmentProperties } from "./look.ts";

describe("a look", () => {
	it("is carried as the properties the style sheets read", () => {
		expect(
			controlProperties({ ink: "#fff", onAccent: "#000", radius: "999px" })
		).toEqual([
			["--sdk-ink", "#fff"],
			["--sdk-on-accent", "#000"],
			["--sdk-radius", "999px"]
		]);
		expect(
			barProperties({
				surface: "transparent",
				lineStrong: "#fff",
				labelFont: "monospace",
				segment: { surface: "#0008", blur: "blur(6px)" },
				segments: { play: { radius: "16px" } }
			})
		).toEqual([
			["--bar-surface", "transparent"],
			["--bar-line-strong", "#fff"],
			["--bar-label-font", "monospace"],
			["--bar-segment-surface", "#0008"],
			["--bar-segment-blur", "blur(6px)"]
		]);
		expect(segmentProperties({ radius: "16px" })).toEqual([
			["--bar-segment-radius", "16px"]
		]);
		expect(controlProperties(undefined)).toEqual([]);
	});

	it("refuses a value that says more than its own property", () => {
		expect(() => controlProperties({ accent: "#fc0; position: fixed" })).toThrow(
			/cannot be/
		);
		expect(() =>
			barProperties({ segment: { border: "1px solid red } body { x" } })
		).toThrow(/cannot be/);
	});
});
