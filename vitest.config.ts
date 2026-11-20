/**
 * The tests of the SDK and of the studio's own games: `bun run test`. They run on Bun, in
 * Node's place: the SDK's command line and its book files use what Bun brings. The
 * control bar and the controls are tested in a real browser, since what they are held
 * to is where things are drawn.
 *
 * Author: dwclake
 * Created: 2026-11-19
 */

import { svelte } from "@sveltejs/vite-plugin-svelte";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import { localResolve } from "./src/local-packages.ts";

export default defineConfig({
	...localResolve(),
	plugins: [svelte({ configFile: false, compilerOptions: { runes: true } })],
	test: {
		// Books are made in several of these: a few at a time leaves the machine usable.
		maxWorkers: 4,
		projects: [
			{
				extends: true,
				test: {
					name: "browser",
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: "chromium", headless: true }]
					},
					include: ["src/**/*.svelte.spec.ts"]
				}
			},
			{
				extends: true,
				test: {
					name: "node",
					environment: "node",
					testTimeout: 60_000,
					include: ["src/**/*.spec.ts"],
					exclude: [
						"src/**/*.svelte.spec.ts",
						"**/node_modules/**",
						"**/dist/**"
					]
				}
			}
		]
	}
});
