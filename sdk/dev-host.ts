/**
 * The page around a game in `keros3ne-studio dev`: what the site's game page is to a game.
 * It frames the client sandboxed as the site does, checks every message the game sends as the
 * site does (./host.ts), passes it to the stand-in for the site (./stand-in.ts, on the dev
 * server) and passes back the answer. Around the frame it shows what a studio needs to see:
 * the pretend balance, held back until the game says a result was shown, as the site holds
 * it; what the game announced for a screen reader; the seeds; and a log of every message,
 * including those the site would ignore, and why.
 */
import * as v from "valibot";
import { formatKero, parseKero } from "./kero.ts";
import { ANNOUNCE_MAX, SETTLE_FALLBACK_MS, fromGame } from "./host.ts";
import { PROTOCOL, PROTOCOL_FAMILY } from "./protocol.ts";

interface State {
	game: {
		slug: string;
		name: string;
		category: string;
		rtpBp: number;
		volatility: number;
	};
	boot: string;
	balance: number;
	limits: { minStake: number; maxStake: number };
	fairness: { serverSeedHash: string; clientSeed: string; nonce: number };
	guideProblem: string | null;
}

const remember = {
	get(key: string): string | null {
		try {
			return localStorage.getItem(`keros3ne-dev:${key}`);
		} catch {
			return null;
		}
	},
	set(key: string, value: string) {
		try {
			localStorage.setItem(`keros3ne-dev:${key}`, value);
		} catch {
			// Not kept: the page works the same without.
		}
	}
};

function h<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {},
	...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
	const element = document.createElement(tag);
	const { class: className, ...rest } = props;
	if (className) element.className = className;
	Object.assign(element, rest);
	element.append(...children);
	return element;
}

async function api<T>(path: string, body?: unknown): Promise<T> {
	const response = await fetch(path, {
		method: body === undefined ? "GET" : "POST",
		headers: { "Content-Type": "application/json" },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	const data = await response.json();
	if (!response.ok) throw new Error(data.error ?? `${response.status}`);
	return data as T;
}

const brief = (value: unknown) => {
	const text = JSON.stringify(value);
	return text.length > 400 ? `${text.slice(0, 400)}...` : text;
};

async function start() {
	let state = await api<State>("/api/state");
	const slug = state.game.slug;
	document.title = `${state.game.name}: keros3ne-studio dev`;

	// What the page shows, held as the site holds it.
	let shown = state.balance;
	let held = false;
	let fallback: ReturnType<typeof setTimeout> | undefined;
	let reducedMotion = remember.get("reduced-motion") === "true";
	let shape: "wide" | "phone" = remember.get("shape") === "phone" ? "phone" : "wide";

	// The frame, sandboxed as on the site: scripts, and nothing else.
	const frame = h("iframe", {
		title: `${state.game.name}, the game`,
		className: "frame"
	});
	frame.setAttribute("sandbox", "allow-scripts");
	frame.setAttribute("allow", "autoplay");
	const load = () => {
		held = false;
		clearTimeout(fallback);
		frame.src = `/studio-frame/${slug}/index.html?t=${Date.now()}`;
	};

	const stage = h("div", { class: "stage" }, frame);
	const size = h("span", { class: "size" });
	new ResizeObserver(() => {
		size.textContent = `${Math.round(frame.clientWidth)} by ${Math.round(frame.clientHeight)}`;
	}).observe(frame);

	const shapes = h("div", { class: "segmented", role: "group", ariaLabel: "Shape" });
	for (const [value, label] of [
		["wide", "16 by 10"],
		["phone", "Phone, 9 by 16"]
	] as const) {
		const button = h("button", { type: "button", textContent: label });
		button.addEventListener("click", () => {
			shape = value;
			remember.set("shape", value);
			draw();
		});
		shapes.append(button);
	}

	const motion = h("input", { type: "checkbox", checked: reducedMotion });
	motion.addEventListener("change", () => {
		reducedMotion = motion.checked;
		remember.set("reduced-motion", String(reducedMotion));
		load();
	});
	const reload = h("button", {
		type: "button",
		class: "quiet",
		textContent: "Reload the game"
	});
	reload.addEventListener("click", load);

	// The panel beside the game.
	const balance = h("strong", { class: "figure" });
	const heldNote = h("span", { class: "note" });
	const balanceField = h("input", {
		type: "text",
		inputMode: "decimal",
		ariaLabel: "New balance",
		placeholder: "25.00"
	});
	const balanceForm = h(
		"form",
		{ class: "row" },
		balanceField,
		h("button", { type: "submit", class: "quiet", textContent: "Set" })
	);
	balanceForm.addEventListener("submit", async (event) => {
		event.preventDefault();
		const cents = parseKero(balanceField.value);
		if (cents === null)
			return log("warn", "page", `"${balanceField.value}" is not an amount`);
		const result = await api<{ state: State }>("/api/balance", { balance: cents });
		state = result.state;
		balanceField.value = "";
		// As the site does when a claim changes the balance: told at once, unless a result is being shown.
		if (!held) {
			shown = state.balance;
			post({ type: "balance", balance: state.balance });
		}
		draw();
	});

	const seeds = h("dl", { class: "seeds" });
	const rotate = h("button", {
		type: "button",
		class: "quiet",
		textContent: "New seeds"
	});
	rotate.addEventListener("click", async () => {
		try {
			const result = await api<{ revealed: string; state: State }>(
				"/api/seeds",
				{}
			);
			state = result.state;
			log("info", "page", `New seeds. The last server seed was ${result.revealed}`);
			draw();
		} catch (error) {
			log("warn", "page", (error as Error).message);
		}
	});

	const said = h("p", { class: "said", ariaLive: "polite" });
	const problem = h("p", { class: "problem", role: "alert" });
	const entries = h("ol", { class: "log" });
	const clear = h("button", { type: "button", class: "quiet", textContent: "Clear" });
	clear.addEventListener("click", () => entries.replaceChildren());

	function log(kind: "in" | "out" | "info" | "warn", who: string, text: string) {
		const time = new Date().toLocaleTimeString("en", { hour12: false });
		entries.append(
			h(
				"li",
				{ class: kind },
				h("span", { class: "time", textContent: time }),
				h("span", { class: "who", textContent: who }),
				h("span", { class: "text", textContent: text })
			)
		);
		while (entries.childElementCount > 300) entries.firstElementChild?.remove();
		entries.scrollTop = entries.scrollHeight;
	}

	function draw() {
		stage.dataset.shape = shape;
		for (const button of shapes.querySelectorAll("button"))
			button.setAttribute(
				"aria-pressed",
				String(button.textContent?.startsWith(shape === "wide" ? "16" : "Phone"))
			);
		balance.textContent = formatKero(shown);
		heldNote.textContent = held
			? `${formatKero(state.balance)} once the game says the result was shown`
			: "";
		const f = state.fairness;
		seeds.replaceChildren(
			h("dt", { textContent: "Server seed (hashed)" }),
			h("dd", { textContent: f.serverSeedHash }),
			h("dt", { textContent: "Client seed" }),
			h("dd", { textContent: f.clientSeed }),
			h("dt", { textContent: "Bets on these seeds" }),
			h("dd", { textContent: String(f.nonce) }),
			h("dt", { textContent: "Bets taken" }),
			h("dd", {
				textContent: `${formatKero(state.limits.minStake)} to ${formatKero(state.limits.maxStake)}`
			})
		);
	}

	function post(message: Record<string, unknown>) {
		log("out", "site", brief(message));
		frame.contentWindow?.postMessage({ protocol: PROTOCOL, ...message }, "*");
	}

	/** The result has been shown, or the site has waited long enough: show the balance. */
	function settle(late: boolean) {
		if (!held) return;
		held = false;
		clearTimeout(fallback);
		shown = state.balance;
		if (late)
			log(
				"warn",
				"site",
				`The game did not call settled() within ${SETTLE_FALLBACK_MS / 1000} seconds of a result, so the site showed the balance anyway. Call it once the result has been shown.`
			);
		draw();
	}

	window.addEventListener("message", async (event) => {
		if (event.source !== frame.contentWindow) return;
		const protocol: unknown = event.data?.protocol;
		if (protocol !== PROTOCOL) {
			if (typeof protocol === "string" && protocol.startsWith(PROTOCOL_FAMILY)) {
				problem.textContent =
					"This game was built for another version of the site, and cannot be played here.";
				log(
					"warn",
					"game",
					`speaks ${protocol}; the site speaks ${PROTOCOL}. Build it on the SDK the site uses.`
				);
			} else {
				log(
					"warn",
					"game",
					`ignored, not the site's protocol: ${brief(event.data)}`
				);
			}
			return;
		}
		const parsed = v.safeParse(fromGame, event.data);
		if (!parsed.success) {
			log(
				"warn",
				"game",
				`ignored, as the site would (${parsed.issues[0].message}): ${brief(event.data)}`
			);
			return;
		}
		const message = parsed.output;
		if (
			message.type !== "ready" ||
			!entries.lastElementChild?.textContent?.includes('"ready"')
		)
			log("in", "game", brief(message));

		if (message.type === "settled") return settle(false);
		if (message.type === "announce") {
			said.textContent = message.text.slice(0, ANNOUNCE_MAX);
			return;
		}

		let result: { reply: Record<string, unknown> & { type: string }; state: State };
		try {
			result = await api("/api/message", { message, reducedMotion });
		} catch (error) {
			log(
				"warn",
				"site",
				`the stand-in could not answer: ${(error as Error).message}`
			);
			return;
		}
		state = result.state;
		const reply = result.reply;
		if (reply.type === "round") {
			problem.textContent = "";
			const round = reply.round as { open: boolean };
			if (round.open) {
				// A stake leaving the wallet gives nothing away, so the balance follows at once.
				if (!held) shown = state.balance;
			} else {
				// The result is known here before the game has shown it: hold the balance back.
				held = true;
				clearTimeout(fallback);
				fallback = setTimeout(() => settle(true), SETTLE_FALLBACK_MS);
			}
		} else if (reply.type === "refused") {
			// On the site only running out is shown on the page; the game shows the rest.
			problem.textContent =
				reply.reason === "insufficient" ? String(reply.message) : "";
		} else if (reply.type === "init") {
			shown = state.balance;
			held = false;
		}
		draw();
		post(reply);
	});

	// Word from the server: the client was rebuilt, or the server started again after a change to the maths.
	let boot = state.boot;
	const events = new EventSource("/events");
	events.addEventListener("boot", async (event) => {
		if ((event as MessageEvent).data === boot) return;
		boot = (event as MessageEvent).data;
		state = await api<State>("/api/state");
		shown = state.balance;
		log(
			"info",
			"page",
			"The maths changed: the game was loaded again, on a fresh pretend balance."
		);
		draw();
		load();
	});
	events.addEventListener("reload", () => {
		log("info", "page", "The client was built again.");
		load();
	});

	const guide = state.guideProblem
		? h("p", {
				class: "problem",
				textContent: `Its guide is not one the site can show: ${state.guideProblem}`
			})
		: "";

	document.getElementById("host")!.append(
		h(
			"header",
			{ class: "bar" },
			h("h1", { textContent: state.game.name }),
			h("span", {
				class: "eyebrow",
				textContent: `${state.game.category} · keros3ne-studio dev`
			}),
			shapes,
			h("label", { class: "switch" }, motion, " Reduced motion"),
			reload,
			size
		),
		h(
			"main",
			{ class: "layout" },
			stage,
			h(
				"aside",
				{ class: "panel" },
				guide,
				h(
					"section",
					{},
					h("h2", { class: "eyebrow", textContent: "Balance" }),
					balance,
					heldNote,
					balanceForm
				),
				problem,
				h(
					"section",
					{},
					h("h2", {
						class: "eyebrow",
						textContent: "Said to a screen reader"
					}),
					said
				),
				h(
					"section",
					{},
					h(
						"div",
						{ class: "row spread" },
						h("h2", { class: "eyebrow", textContent: "Seeds" }),
						rotate
					),
					seeds
				),
				h(
					"section",
					{ class: "grow" },
					h(
						"div",
						{ class: "row spread" },
						h("h2", { class: "eyebrow", textContent: "Messages" }),
						clear
					),
					entries
				)
			)
		)
	);
	draw();
	load();
}

void start();
