/**
 * Whether the SDK is being run on the engine as it stands in the clone beside this
 * repository, and not the release installed: `LOCAL_PACKAGES=1`, which `bun run local ...`
 * sets. The SDK imports the engine through `imports` in package.json (`#engine/...`), and
 * the `local` condition there names the file in the clone (`local/engine`, a link that is
 * not committed). Bun and Node are told the condition on their command lines; Vite resolves
 * imports itself, so every Vite the SDK starts is told here.
 *
 * It is for developing the SDK and the engine together before either is released, and a
 * studio may use the same for a package of its own that its games share: a kit named in
 * its games' `imports` with a `local` condition is taken from its clone when a client is
 * built with `LOCAL_PACKAGES=1` (the README's "A package your games share, as you change
 * it"). Installed, the SDK finds the engine as the package it depends on.
 *
 * Author: dwclake
 * Created: 2026-11-19
 */
import type { UserConfig } from "vite";

/** Whether the engine is the clone beside this repository. */
export const LOCAL = process.env.LOCAL_PACKAGES === "1";

/** The condition that names the clone's files, when it is in use. */
export const LOCAL_CONDITIONS: string[] = LOCAL ? ["local"] : [];

/**
 * What a Vite configuration needs to resolve the engine as this run does: nothing, unless
 * the clone is in use. Spread into the configuration.
 */
export function localResolve(): Pick<UserConfig, "resolve" | "ssr"> {
	if (!LOCAL) return {};

	return {
		resolve: {
			conditions: ["local", "module", "browser", "development|production"],
			// A clone has packages of its own installed: one copy of each is used, the SDK and
			// the engine among them, or a studio's kit would be on another SDK than its game.
			dedupe: [
				"valibot",
				"@noble/hashes",
				"svelte",
				"pixi.js",
				"@keros3ne/sdk",
				"@keros3ne/engine"
			]
		},
		ssr: {
			resolve: { conditions: ["local", "module", "node", "development|production"] }
		}
	};
}
