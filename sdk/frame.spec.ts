/**
 * How a client's files are served (./frame.ts): which of them a browser may keep.
 *
 * Author: dwclake
 * Created: 2026-11-18
 */

import { describe, expect, it } from "vitest";
import { clientHeaders } from "./frame.ts";

/** What a browser is told about keeping a file of a client's. */
function kept(file?: string): string {
	return clientHeaders("https://site.example", "game", "text/javascript", file)[
		"Cache-Control"
	];
}

describe("a client's files", () => {
	it("are kept for good where the build named them by what is in them", () => {
		expect(kept("_app/immutable/chunks/BeiYQHnb.js")).toBe(
			"public, max-age=31536000, immutable, no-transform"
		);
		expect(
			kept("/_app/immutable/assets/geist-latin-wght-normal.BgDaEnEv.woff2")
		).toBe("public, max-age=31536000, immutable, no-transform");
	});

	it("are asked for each time otherwise: the page, what public brought, a file not named", () => {
		expect(kept("index.html")).toBe("no-cache, no-transform");
		expect(kept("card.svg")).toBe("no-cache, no-transform");
		expect(kept("_app/version.json")).toBe("no-cache, no-transform");
		expect(kept("assets/lantern.png")).toBe("no-cache, no-transform");
		expect(kept("art/_app/immutable/chunks/BeiYQHnb.js")).toBe(
			"no-cache, no-transform"
		);
		expect(kept()).toBe("no-cache, no-transform");
	});
});
