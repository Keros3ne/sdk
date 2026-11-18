/**
 * A loading screen, for a game that takes a while to be ready: over the whole game, with
 * a bar that fills as what it waits for arrives, and gone once it is ready.
 *
 *     const loading = createLoadingScreen({ title: "Seraph's Grace" });
 *     const host = await loading.track(connect());
 *     await Promise.all([loading.track(loadImages(), 3), loading.track(loadSounds())]);
 *     await loading.done();
 *
 * Make it first, before anything slow starts. It covers the game from the first moment,
 * however short the wait, and `done()` takes it away only once the game under it has been
 * drawn: a game is put together a piece at a time, and none of that is to be seen. How it
 * looks is the studio's, through the properties in ./loading.css.
 *
 * Most of a game's loading is its own code arriving, which is over before any of that code
 * can run. So a built client's page already has this screen written into it
 * (./client-build.ts), filled by a script of its own as the code arrives
 * (./loading-first.js). `createLoadingScreen()` takes that screen over where it finds one,
 * and what the game tracks fills the rest of the bar from where the code left it. Where
 * there is none (a story), it makes the screen itself, and the bar is all the game's.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */
import "./loading.css";

export interface LoadingScreen {
	/**
	 * Waits for `work` as part of loading, and returns it. The bar fills by `weight` when
	 * it settles, whether it succeeded or failed: handle a failure where `work` is awaited.
	 */
	track<T>(work: Promise<T>, weight?: number): Promise<T>;
	/** How much is loaded, from 0 to 1, for work the screen cannot see. The bar never goes back. */
	set(share: number): void;
	/**
	 * Fills the bar and takes the screen away, once what is under it has been drawn. Call it
	 * when the game is ready to be seen and played.
	 */
	done(): Promise<void>;
}

/**
 * Waits until the page has been drawn twice more: once for what was just set up, and once
 * for what that drawing itself set off. A page that is not being drawn at all (a tab in the
 * background) is not waited for.
 */
function drawn(): Promise<void> {
	return new Promise((resolve) => {
		const giveUp = window.setTimeout(resolve, 500);

		requestAnimationFrame(() =>
			requestAnimationFrame(() => {
				window.clearTimeout(giveUp);
				resolve();
			})
		);
	});
}

export function createLoadingScreen(config: { title?: string } = {}): LoadingScreen {
	const { title } = config;

	// The screen the page came with, part filled already by the code's arrival, or a new one.
	const written = document.querySelector<HTMLElement>(".sdk-loading[data-waiting]");
	const screen = written ?? document.createElement("div");
	let bar: HTMLElement;
	let fill: HTMLElement;
	/** How full the bar was when the game took it over: what it tracks fills the rest. */
	let from = 0;

	if (written) {
		// The page's own script stops filling it at this.
		written.removeAttribute("data-waiting");
		from = Math.min(1, Math.max(0, Number(written.dataset.shown) || 0));
		bar = written.querySelector<HTMLElement>(".sdk-loading-bar")!;
		fill = written.querySelector<HTMLElement>(".sdk-loading-fill")!;
	} else {
		screen.className = "sdk-loading";
		if (title) {
			const name = document.createElement("p");
			name.className = "sdk-loading-title";
			name.textContent = title;
			screen.append(name);
		}
		bar = document.createElement("div");
		bar.className = "sdk-loading-bar";
		bar.setAttribute("role", "progressbar");
		bar.setAttribute("aria-label", title ? `Loading ${title}` : "Loading");
		bar.setAttribute("aria-valuemin", "0");
		bar.setAttribute("aria-valuemax", "100");
		fill = document.createElement("div");
		fill.className = "sdk-loading-fill";
		bar.append(fill);
		screen.append(bar);
		document.body.append(screen);
	}

	// What is tracked, by weight, and what has settled of it; and a share set directly.
	let total = 0;
	let settled = 0;
	let direct = 0;
	let shown = from;
	let waiting: number | undefined;

	/** Draws the bar as full as what has settled makes it. */
	function render() {
		window.clearTimeout(waiting);
		waiting = undefined;

		// Never back: tracking more work after some has settled must not empty the bar.
		const tracked = Math.max(direct, total ? settled / total : 0);
		shown = Math.max(shown, from + (1 - from) * tracked);
		fill.style.transform = `scaleX(${shown})`;
		bar.setAttribute("aria-valuenow", String(Math.round(shown * 100)));
	}

	/**
	 * Draws the bar a moment from now, not at once. A game tracks its next work as soon as
	 * what that waits for has settled (the stage, once the site has answered), and for that
	 * instant everything tracked has settled: drawn then, the bar would be full with work
	 * still to come, and could not go back.
	 */
	function renderSoon() {
		waiting ??= window.setTimeout(render, 0);
	}
	render();

	return {
		track(work, weight = 1) {
			total += weight;
			const done = () => {
				settled += weight;
				renderSoon();
			};
			work.then(done, done);
			return work;
		},
		set(share) {
			direct = Math.min(1, Math.max(0, share));
			renderSoon();
		},
		async done() {
			direct = 1;
			render();

			// What the game set up as it became ready (the stage's first picture, words in a
			// typeface just arrived) is drawn over the next frames: the screen stays for them.
			await drawn();

			screen.classList.add("leaving");
			const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
			// Long enough for the bar to be seen full, and to fade.
			await new Promise((resolve) => setTimeout(resolve, still ? 0 : 400));
			screen.remove();
		}
	};
}
