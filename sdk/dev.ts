/// <reference types="bun" />
/**
 * `keros3ne-studio dev <slug>`: a game played in a browser against a stand-in for the site.
 *
 * Two processes. This one, the supervisor, keeps the client built (./client-build.ts) and runs
 * the server, starting it again whenever the maths or the guide changes, since a module once
 * imported cannot be imported afresh. The server serves:
 *
 *   /                          the page around the game (./dev-host.ts), in place of the site's
 *   /studio-frame/<slug>/...   the built client, with the site's own policy (./frame.ts)
 *   /api/...                   the stand-in for the site (./stand-in.ts), which plays the maths
 *   /events                    word to the page that the client was rebuilt, or the server started
 *
 * The client runs in a frame sandboxed as on the site, and talks to the page around it with
 * the same messages, checked the same way (./host.ts). A game that plays here plays there.
 */
import { existsSync, watch, type FSWatcher } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import * as v from "valibot";
import { checkGuide } from "./guide.ts";
import { clientHeaders, CLIENT_FILE_TYPES } from "./frame.ts";
import { fromGame } from "./host.ts";
import { watchClient } from "./client-build.ts";
import { LOCAL_CONDITIONS } from "./local-packages.ts";
import { createStandIn } from "./stand-in.ts";
import { loadGame, loadGuide, type GameFolder } from "./studio-folder.ts";

interface Options {
	root: string;
	folder: GameFolder;
	port: number;
	balance: number;
}

/** Calls `then` once a burst of changes has stopped. */
function settleThen(then: () => void, ms = 150) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	return () => {
		clearTimeout(timer);
		timer = setTimeout(then, ms);
	};
}

/** Keeps the client built and the server running, and starts the server again when the maths changes. */
export async function supervise(options: Options & { cli: string }): Promise<number> {
	const { root, folder, port, balance, cli } = options;
	if (!existsSync(join(folder.client, "src", "routes"))) {
		console.error(`${folder.slug} has no client/src/routes to build.`);
		return 1;
	}

	const client = await watchClient(folder.client, {
		error: (error) =>
			console.error(
				`The client did not build: ${error instanceof Error ? error.message : String(error)}`
			)
	});

	let server: ReturnType<typeof Bun.spawn> | null = null;
	let stopping = false;
	const start = () => {
		server = Bun.spawn(
			[
				process.execPath,
				cli,
				"dev-serve",
				folder.slug,
				"--root",
				root,
				"--port",
				String(port),
				"--balance",
				(balance / 100).toFixed(2)
			],
			{ stdio: ["ignore", "inherit", "inherit"] }
		);
	};
	const restart = settleThen(async () => {
		if (stopping) return;
		console.log(
			"The maths or the guide changed: starting again. The pretend balance starts afresh."
		);
		server?.kill();
		await server?.exited;
		start();
	});

	const watchers: FSWatcher[] = [watch(folder.maths, { recursive: true }, restart)];
	if (existsSync(folder.guide)) watchers.push(watch(folder.guide, restart));
	start();

	const stop = async () => {
		stopping = true;
		for (const watcher of watchers) watcher.close();
		server?.kill();
		// Gone before this is, so that whatever started `dev` can have the port again at once.
		await Promise.all([server?.exited, client.close()]);
		process.exit(0);
	};
	process.on("SIGINT", stop);
	process.on("SIGTERM", stop);
	return -1;
}

/** The host page, built from ./dev-host.ts (or the .js it was built into, in the published package). */
async function hostScript(): Promise<string> {
	const source = ["dev-host.ts", "dev-host.js"]
		.map((name) => join(import.meta.dir, name))
		.find((path) => existsSync(path));
	if (!source) throw new Error("The SDK's dev-host script is missing.");
	const built = await Bun.build({
		entrypoints: [source],
		target: "browser",
		conditions: LOCAL_CONDITIONS,
		minify: false
	});
	if (!built.success)
		throw new AggregateError(built.logs, "The page around the game did not build.");
	return built.outputs[0].text();
}

const page = (name: string) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name.replace(/[<&]/g, "")}: keros3ne-studio dev</title>
<link rel="stylesheet" href="/host.css">
</head>
<body>
<div id="host"></div>
<script type="module" src="/host.js"></script>
</body>
</html>
`;

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
	});

/** The server: the page, the client's files, and the stand-in for the site. */
export async function serve(options: Options): Promise<number> {
	const { folder, port } = options;
	const game = await loadGame(folder);
	let guideProblem: string | null = null;
	try {
		checkGuide(folder.slug, await loadGuide(folder));
	} catch (error) {
		guideProblem = error instanceof Error ? error.message : String(error);
	}
	const standIn = createStandIn(game, { balance: options.balance });
	const script = await hostScript();
	const style = await Bun.file(join(import.meta.dir, "dev-host.css")).text();
	const boot = crypto.randomUUID();
	const dist = resolve(folder.client, "dist");

	// The pages listening for news: the client was rebuilt.
	const listeners = new Set<ReadableStreamDefaultController<string>>();
	const tell = (event: string, data = "") => {
		for (const listener of listeners) {
			try {
				listener.enqueue(`event: ${event}\ndata: ${data}\n\n`);
			} catch {
				listeners.delete(listener);
			}
		}
	};
	// Vite empties dist and writes it again, so the client's folder is watched, not dist.
	const rebuilt = settleThen(() => tell("reload"), 300);
	const watcher = watch(folder.client, { recursive: true }, (_event, name) => {
		if (name && normalize(String(name)).split(sep)[0] === "dist") rebuilt();
	});
	process.on("SIGTERM", () => {
		watcher.close();
		process.exit(0);
	});

	const state = () => ({
		game: {
			slug: game.slug,
			name: game.name,
			category: game.category,
			shapes: game.shapes ?? ["wide"],
			rtpBp: game.rtpBp,
			volatility: game.volatility
		},
		boot,
		balance: standIn.balance,
		limits: standIn.limits,
		fairness: standIn.fairness,
		guideProblem
	});

	const server = Bun.serve({
		port,
		idleTimeout: 0,
		async fetch(request) {
			const url = new URL(request.url);
			const path = url.pathname;

			if (path === "/")
				return new Response(page(game.name), {
					headers: { "Content-Type": "text/html; charset=utf-8" }
				});
			if (path === "/host.js")
				return new Response(script, {
					headers: { "Content-Type": "text/javascript; charset=utf-8" }
				});
			if (path === "/host.css")
				return new Response(style, {
					headers: { "Content-Type": "text/css; charset=utf-8" }
				});

			if (path === "/events") {
				let mine: ReadableStreamDefaultController<string>;
				const stream = new ReadableStream<string>({
					start(controller) {
						mine = controller;
						listeners.add(controller);
						controller.enqueue(`event: boot\ndata: ${boot}\n\n`);
					},
					cancel() {
						listeners.delete(mine);
					}
				});
				return new Response(stream, {
					headers: {
						"Content-Type": "text/event-stream",
						"Cache-Control": "no-store"
					}
				});
			}

			const prefix = `/studio-frame/${folder.slug}/`;
			if (path.startsWith(prefix)) {
				const file = resolve(
					join(
						dist,
						normalize(
							decodeURIComponent(path.slice(prefix.length)) || "index.html"
						)
					)
				);
				const type = CLIENT_FILE_TYPES[extname(file).toLowerCase()];
				if (
					!file.startsWith(dist + sep) ||
					!type ||
					!(await Bun.file(file).exists())
				)
					return new Response("Not found", { status: 404 });
				return new Response(Bun.file(file), {
					headers: clientHeaders(
						url.origin,
						folder.slug,
						type,
						decodeURIComponent(path.slice(prefix.length))
					)
				});
			}

			if (path === "/api/state") return json(state());

			if (request.method === "POST" && path === "/api/message") {
				const body = (await request.json()) as {
					message: unknown;
					reducedMotion?: boolean;
				};
				const parsed = v.safeParse(fromGame, body.message);
				if (!parsed.success)
					return json({ error: "not a message the site understands" }, 400);
				const message = parsed.output;
				let reply: unknown = null;
				switch (message.type) {
					case "ready":
						reply = {
							type: "init",
							...(await standIn.init(body.reducedMotion === true))
						};
						break;
					case "open":
					case "act": {
						const result =
							message.type === "open"
								? await standIn.open(message.bet, message.params)
								: await standIn.act(message.action);
						reply = result.ok
							? { type: "round", id: message.id, round: result.round }
							: {
									type: "refused",
									id: message.id,
									reason: result.reason,
									message: result.message
								};
						break;
					}
					case "progress":
						reply = {
							type: "progress",
							id: message.id,
							bet: message.bet,
							progress: await standIn.progress(message.bet)
						};
						break;
					case "history":
						reply = {
							type: "history",
							id: message.id,
							bets: standIn.history()
						};
						break;
				}
				return json({ reply, state: state() });
			}

			if (request.method === "POST" && path === "/api/balance") {
				const { balance } = (await request.json()) as { balance: number };
				try {
					standIn.setBalance(balance);
				} catch (error) {
					return json(
						{ error: error instanceof Error ? error.message : String(error) },
						400
					);
				}
				return json({ state: state() });
			}

			if (request.method === "POST" && path === "/api/seeds") {
				const revealed = standIn.rotateSeeds();
				if (revealed === null)
					return json(
						{ error: "Finish the round first: its seeds are still in use." },
						409
					);
				return json({ revealed, state: state() });
			}

			return new Response("Not found", { status: 404 });
		}
	});

	console.log(`${game.name}: http://localhost:${server.port}/`);
	if (guideProblem)
		console.warn(`  Its guide is not one the site can show: ${guideProblem}`);
	return -1;
}
