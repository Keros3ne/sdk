/**
 * How every studio game's client is built: one way, owned by the SDK, so that the site, `check`
 * and `dev` all build a client the same way, and no studio's own build configuration ever runs.
 * (A Vite config is code, and the site builds clients it took in from outside.)
 *
 * The client is built from `client/index.html`, with `client/public` copied as it is, into
 * `client/dist`: plain files with relative addresses, so the site can serve them from whatever
 * path it likes, and nothing inlined, since the policy a client is served under
 * (./frame.ts) allows no inline script.
 */
import { existsSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { build, type InlineConfig, type Rollup } from "vite";

export function clientConfig(client: string, watch = false): InlineConfig {
	return {
		configFile: false,
		envDir: false,
		root: client,
		base: "./",
		publicDir: join(client, "public"),
		logLevel: "warn",
		clearScreen: false,
		// A client may be written in Svelte, in runes: compiled here, with no config of its own.
		plugins: [svelte({ configFile: false, compilerOptions: { runes: true } })],
		build: {
			outDir: join(client, "dist"),
			emptyOutDir: true,
			modulePreload: false,
			assetsInlineLimit: 0,
			watch: watch ? {} : null
		}
	};
}

/** Builds a game's client into `client/dist`. */
export async function buildClient(client: string): Promise<void> {
	await build(clientConfig(client));
}

/**
 * Builds a game's client into `client/dist` and again whenever it changes, until `close()`.
 * `onBuilt` is called after each build, and `onError` with what went wrong in one.
 */
export async function watchClient(
	client: string,
	on: { built?: () => void; error?: (error: unknown) => void } = {}
): Promise<{ close: () => Promise<void> }> {
	const watcher = (await build(clientConfig(client, true))) as {
		on(
			event: "event",
			listener: (event: {
				code: string;
				error?: unknown;
				result?: { close(): Promise<void> };
			}) => void
		): void;
		close(): Promise<void>;
	};
	watcher.on("event", (event) => {
		if (event.code === "BUNDLE_END") void event.result?.close();
		if (event.code === "END") on.built?.();
		if (event.code === "ERROR") on.error?.(event.error);
	});
	return { close: () => watcher.close() };
}
