/**
 * Whether the SDK is being run on the engine as it stands in the clone beside this
 * repository, and not the release installed: `LOCAL_PACKAGES=1`, which `bun run local ...`
 * sets. The SDK imports the engine through `imports` in package.json (`#engine/...`), and
 * the `local` condition there names the file in the clone (`local/engine`, a link that is
 * not committed). Bun and Node are told the condition on their command lines; Vite resolves
 * imports itself, so every Vite the SDK starts is told here.
 *
 * It is for developing the SDK and the engine together before either is released. A studio
 * never sets it: installed, the SDK finds the engine as the package it depends on.
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
			// The clone has packages of its own: one copy of each is used.
			dedupe: ["valibot", "@noble/hashes", "svelte", "pixi.js"]
		},
		ssr: {
			resolve: { conditions: ["local", "module", "node", "development|production"] }
		}
	};
}
