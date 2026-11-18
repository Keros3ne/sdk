/**
 * A loading screen, for a game that takes a while to be ready: over the whole game, with
 * a bar that fills as what it waits for arrives, and gone once it is ready.
 *
 *     const loading = createLoadingScreen({ title: "Seraph's Grace" });
 *     const host = await loading.track(connect());
 *     await Promise.all([loading.track(loadImages(), 3), loading.track(loadSounds())]);
 *     await loading.done();
 *
 * Make it first, before anything slow starts. It is only seen once loading has taken a
 * moment (`delay`), so a game that is ready at once never shows it. How it looks is the
 * studio's, through the properties in ./loading.css.
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
	/** Fills the bar and takes the screen away. */
	done(): Promise<void>;
}

export function createLoadingScreen(
	config: { title?: string; delay?: number } = {}
): LoadingScreen {
	const { title, delay = 250 } = config;

	const screen = document.createElement("div");
	screen.className = "sdk-loading";
	if (title) {
		const name = document.createElement("p");
		name.className = "sdk-loading-title";
		name.textContent = title;
		screen.append(name);
	}
	const bar = document.createElement("div");
	bar.className = "sdk-loading-bar";
	bar.setAttribute("role", "progressbar");
	bar.setAttribute("aria-label", title ? `Loading ${title}` : "Loading");
	bar.setAttribute("aria-valuemin", "0");
	bar.setAttribute("aria-valuemax", "100");
	const fill = document.createElement("div");
	fill.className = "sdk-loading-fill";
	bar.append(fill);
	screen.append(bar);
	document.body.append(screen);
	const showing = window.setTimeout(() => screen.classList.add("shown"), delay);

	// What is tracked, by weight, and what has settled of it; and a share set directly.
	let total = 0;
	let settled = 0;
	let direct = 0;
	let shown = 0;
	function render() {
		// Never back: tracking more work after some has settled must not empty the bar.
		shown = Math.max(shown, direct, total ? settled / total : 0);
		fill.style.transform = `scaleX(${shown})`;
		bar.setAttribute("aria-valuenow", String(Math.round(shown * 100)));
	}
	render();

	return {
		track(work, weight = 1) {
			total += weight;
			render();
			const done = () => {
				settled += weight;
				render();
			};
			work.then(done, done);
			return work;
		},
		set(share) {
			direct = Math.min(1, Math.max(0, share));
			render();
		},
		async done() {
			window.clearTimeout(showing);
			direct = 1;
			render();
			if (screen.classList.contains("shown")) {
				screen.classList.add("leaving");
				const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
				// Long enough for the bar to be seen full, and to fade.
				await new Promise((resolve) => setTimeout(resolve, still ? 0 : 400));
			}
			screen.remove();
		}
	};
}
