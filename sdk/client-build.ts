/**
 * How every studio game's client is built: one way, owned by the SDK, so that the site, `check`
 * and `dev` all build a client the same way, and no studio's own build configuration ever runs.
 * (A Vite config is code, and the site builds clients it took in from outside.)
 *
 * The client is built from `client/index.html`, with `client/public` copied as it is, into
 * `client/dist`: plain files with relative addresses, so the site can serve them from whatever
 * path it likes, and nothing inlined, since the policy a client is served under
 * (./frame.ts) allows no inline script.
 *
 * A game that shows the SDK's loading screen has it written into its page (`loadingFirst`
 * below), so that it is on screen, and filling, while the game's code is still arriving:
 * that code is most of what a game waits for, and none of it can draw a screen before it
 * has all come.
 *
 * A package the game's repository names (`packages` in its studio.json) is read as source
 * from where it is: the folder the site fetched it into, or where the studio installed it.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import {
	build,
	type HtmlTagDescriptor,
	type InlineConfig,
	type Plugin,
	type Rollup
} from "vite";
import { sharedPackages } from "./manifest.ts";
import { PACKAGES_FOLDER, readManifest } from "./studio-folder.ts";

/**
 * The packages a client's repository names that the site fetched as source, each by its
 * name: a client's imports of them are read from there. One the studio installed instead
 * is found as any installed package is, and is not named here.
 */
function fetchedPackages(client: string): { find: RegExp; replacement: string }[] {
	const root = dirname(dirname(client));
	if (!existsSync(join(root, "studio.json"))) return [];

	return Object.keys(sharedPackages(readManifest(root)))
		.map((name) => ({ name, folder: join(root, PACKAGES_FOLDER, name) }))
		.filter((each) => existsSync(each.folder))
		.map(({ name, folder }) => ({
			find: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}(?=/|$)`),
			replacement: folder
		}));
}

/** A file of the SDK's own, beside this one, as text. */
function ownFile(name: string): string {
	return readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");
}

/** Text as a page's source has it, as the words it stands for: what an attribute is given. */
function plain(text: string): string {
	return text
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">")
		.replaceAll("&quot;", '"')
		.replaceAll("&#39;", "'")
		.replaceAll("&amp;", "&");
}

/** The module that makes the loading screen: a client that has it in its code shows one. */
const LOADING_MODULE = fileURLToPath(new URL("./loading.ts", import.meta.url));

/**
 * The code Pixi asks for only once a stage is being made (./pixi/Stage.svelte, which draws
 * with WebGL): what makes it safe for the frame, the browser's own parts, and the renderer.
 * Each is asked for after the one before has arrived and run, so a game would wait for
 * them one at a time, after all the rest of its code.
 */
const STAGE_MODULES =
	/\/pixi\.js\/lib\/(unsafe-eval\/init|environment-browser\/browserAll|rendering\/renderers\/gl\/WebGLRenderer)\.m?js$/;

/**
 * The code a game needs before it can be played, in the order it is found: the page's own
 * script and everything that imports, and what its stage will ask for (`STAGE_MODULES`).
 */
function codeToLoad(bundle: Rollup.OutputBundle): Rollup.OutputChunk[] {
	const chunks = Object.values(bundle).filter((file) => file.type === "chunk");
	const first = chunks.filter(
		(chunk) =>
			chunk.isEntry ||
			// The file Pixi asks for by name may only pass on to the one that holds the code.
			STAGE_MODULES.test(chunk.facadeModuleId ?? "") ||
			chunk.moduleIds.some((id) => STAGE_MODULES.test(id))
	);

	const found = new Map<string, Rollup.OutputChunk>();
	const follow = (chunk: Rollup.OutputChunk) => {
		if (found.has(chunk.fileName)) return;

		found.set(chunk.fileName, chunk);
		for (const name of chunk.imports) {
			const imported = bundle[name];
			if (imported?.type === "chunk") follow(imported);
		}
	};
	first.forEach(follow);

	return [...found.values()];
}

/**
 * Writes the loading screen into the page of a client that shows one (./loading.ts), with
 * what fills it while the game's code arrives:
 *
 * - the screen itself, as `createLoadingScreen()` would make it, named by the page's title,
 *   and its style in the page, so it is drawn before the game's style sheet has come;
 * - the code the game needs, each file asked for from the start and all at once, not as
 *   the file before it finds it needs it, and each file's size, on the screen;
 * - a small script of the page's own (./loading-first.js), which fills the bar as those
 *   files arrive. A file, since the policy allows no inline script.
 *
 * A client that makes no loading screen is left as it is: nothing would take this one away.
 */
function loadingFirst(): Plugin {
	return {
		name: "keros3ne-loading-first",
		apply: "build",
		// Before the page is written, so that the script it names is among the client's files.
		enforce: "pre",

		/**
		 * The script that fills the bar, as a file of the client's, named by what is in it:
		 * only for a client that shows a loading screen.
		 */
		generateBundle(_options, bundle) {
			const shown = Object.values(bundle).some(
				(file) => file.type === "chunk" && file.moduleIds.includes(LOADING_MODULE)
			);
			if (!shown) return;

			this.emitFile({
				type: "asset",
				name: "loading-first.js",
				source: ownFile("./loading-first.js")
			});
		},

		transformIndexHtml: {
			order: "post",

			/** Adds the screen, its style, its script and the code to ask for to the page. */
			handler(html, { bundle }) {
				if (!bundle) return html;

				const chunks = Object.values(bundle).filter(
					(file) => file.type === "chunk"
				);
				const script = Object.keys(bundle).find((name) =>
					/(^|\/)loading-first-[\w-]+\.js$/.test(name)
				);
				// No script, no screen: the client shows none (`generateBundle` above).
				if (!script) return html;

				const title = /<title>([^<]*)<\/title>/.exec(html)?.[1].trim() ?? "";
				const code = codeToLoad(bundle);
				const entries = new Set(
					chunks.filter((chunk) => chunk.isEntry).map((chunk) => chunk.fileName)
				);

				const tags: HtmlTagDescriptor[] = [
					// After what the page's head began with: its encoding must stay among its first words.
					{
						tag: "style",
						children: ownFile("./loading.css"),
						injectTo: "head"
					},
					// The page asks for its own script itself; the rest are asked for here.
					...code
						.filter((chunk) => !entries.has(chunk.fileName))
						.map((chunk): HtmlTagDescriptor => ({
							tag: "link",
							attrs: {
								rel: "modulepreload",
								crossorigin: true,
								href: `./${chunk.fileName}`
							},
							injectTo: "head"
						})),
					{
						tag: "div",
						attrs: {
							class: "sdk-loading sdk-loading-first",
							"data-waiting": true,
							"data-code": code
								.map(
									(chunk) =>
										`${chunk.fileName}:${Buffer.byteLength(chunk.code)}`
								)
								.join(",")
						},
						children: [
							...(title
								? [
										{
											tag: "p",
											attrs: { class: "sdk-loading-title" },
											children: title
										}
									]
								: []),
							{
								tag: "div",
								attrs: {
									class: "sdk-loading-bar",
									role: "progressbar",
									"aria-label": title
										? `Loading ${plain(title)}`
										: "Loading",
									"aria-valuemin": "0",
									"aria-valuemax": "100",
									"aria-valuenow": "0"
								},
								children: [
									{ tag: "div", attrs: { class: "sdk-loading-fill" } }
								]
							}
						],
						injectTo: "body-prepend"
					},
					// First in the page, so it is asked for before the code it watches arrive, and
					// run once the screen is there to fill.
					{
						tag: "script",
						attrs: { defer: true, src: `./${script}` },
						injectTo: "head-prepend"
					}
				];

				return { html, tags };
			}
		}
	};
}

export function clientConfig(folder: string, watch = false): InlineConfig {
	// From wherever it was named: what is built goes beside the client, not beside whoever asked.
	const client = resolve(folder);

	return {
		// Built as it will be served, whatever this was run from (a test, a development server).
		mode: "production",
		resolve: { alias: fetchedPackages(client) },
		configFile: false,
		envDir: false,
		root: client,
		base: "./",
		publicDir: join(client, "public"),
		logLevel: "warn",
		clearScreen: false,
		// A client may be written in Svelte, in runes: compiled here, with no config of its own.
		plugins: [
			svelte({ configFile: false, compilerOptions: { runes: true } }),
			loadingFirst()
		],
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
