/*
 * The first of a game's loading: fills the loading screen written into a client's page
 * (./client-build.ts) while the game's code is still arriving, by how many bytes of it
 * have. The page names each file of that code and its size (`data-code`); the browser says
 * when each has arrived. Once the game's own code runs it takes the screen over
 * (./loading.ts, which removes `data-waiting`) and fills what is left of the bar from what
 * the game tracks, and this has nothing left to fill.
 *
 * A file of its own, plain and unbundled: the policy a client is served under allows no
 * inline script, and this must run before any of the game's code has arrived.
 *
 * Author: dwclake
 * Created: 2026-11-18
 */
(() => {
	/** How much of the bar the code's arrival fills. The rest is the game's own to track. */
	const CODE_SHARE = 0.85;

	const screen = document.querySelector(".sdk-loading[data-waiting]");
	if (!screen) return;

	// Each file of the game's code by its whole address, as the browser reports it, and its size.
	const sizes = new Map();
	for (const entry of (screen.dataset.code ?? "").split(",")) {
		const [file, size] = entry.split(":");
		if (file && Number(size) > 0)
			sizes.set(new URL(file, location.href).href, Number(size));
	}

	let wanted = 0;
	for (const size of sizes.values()) wanted += size;
	if (wanted === 0) return;

	const arrived = new Set();

	/** Draws the bar as full as the code that has arrived makes it. */
	function fill() {
		// The game's code is running, and the screen is its own now.
		if (!screen.hasAttribute("data-waiting")) return;

		let bytes = 0;
		for (const file of arrived) bytes += sizes.get(file);

		const share = (bytes / wanted) * CODE_SHARE;
		screen.dataset.shown = String(share);
		screen
			.querySelector(".sdk-loading-bar")
			?.setAttribute("aria-valuenow", String(Math.round(share * 100)));
		screen
			.querySelector(".sdk-loading-fill")
			?.style.setProperty("transform", `scaleX(${share})`);
	}

	// Every file the page asks for, as each one finishes, including any already done.
	new PerformanceObserver((list) => {
		for (const entry of list.getEntries()) {
			if (sizes.has(entry.name)) arrived.add(entry.name);
		}

		fill();
	}).observe({ type: "resource", buffered: true });
})();
