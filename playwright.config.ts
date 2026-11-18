/**
 * The SDK's tests in a browser: its stage, its board, Storybook and `dev`, each on a
 * server of its own that the test starts. `bun run test:browser`.
 *
 * Author: dwclake
 * Created: 2026-11-19
 */

import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "e2e",
	testMatch: "**/*.e2e.ts",
	workers: 4,
	fullyParallel: true,
	use: {
		// A game is drawn with WebGL. A browser with no window draws that in software,
		// which several of them at once cannot keep up with. On a Mac it is told to use the
		// graphics card, as a player's browser does. Elsewhere it is left as it is.
		launchOptions: {
			args: process.platform === "darwin" ? ["--use-angle=metal"] : []
		}
	}
});
