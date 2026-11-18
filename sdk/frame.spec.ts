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
		expect(kept("assets/index-C2QBgKch.js")).toBe(
			"public, max-age=31536000, immutable"
		);
		expect(kept("/assets/geist-latin-wght-normal-BgDaEnEv.woff2")).toBe(
			"public, max-age=31536000, immutable"
		);
	});

	it("are asked for each time otherwise: the page, what public brought, a file not named", () => {
		expect(kept("index.html")).toBe("no-cache");
		expect(kept("card.svg")).toBe("no-cache");
		expect(kept("assets/lantern.png")).toBe("no-cache");
		expect(kept("art/assets/index-C2QBgKch.js")).toBe("no-cache");
		expect(kept()).toBe("no-cache");
	});
});
