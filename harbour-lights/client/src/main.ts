/**
 * Harbour Lights: the client. It decides nothing. A spin is a row the site drew from the
 * game's book, and comes back through the SDK already settled; the game only plays it out
 * (Game.svelte), then tells the site it has been shown.
 *
 * Author: dwclake
 * Created: 2026-11-18
 */

import { mount } from "svelte";
import { connect } from "@keros3ne/studio-sdk/client";
import { createLoadingScreen } from "@keros3ne/studio-sdk/loading";
import Game from "./Game.svelte";
import type { RoundView } from "./round.ts";
import "./style.css";

// Up first: the loading screen, while the site answers and the pictures and the bar's
// typeface arrive.
// It is the game's own: on the evening the game opens on (style.css's ground), so that when
// it leaves only what is in front changes, with the studio's logo over the name. Written
// out here, plainly: the build reads this call to draw the same screen before any of this
// code has arrived.
const loading = createLoadingScreen({
	title: document.title,
	logo: "./loading-logo.svg",
	look: {
		surface: "radial-gradient(circle at 50% 20%, #24546a, #173341 55%, #0f2530)",
		ink: "#f4efe6",
		track: "#1d4152",
		fill: "#ffd56b",
		titleCase: "uppercase",
		titleSpacing: "0.14em",
		logoWidth: 96
	}
});
const typeface = loading.track(
	document.fonts.load('500 15px "Geist Variable"').catch(() => null)
);
const host = await loading.track(connect<RoundView, null>(), 2);
await typeface;

mount(Game, {
	target: document.body,
	props: {
		host,
		track: (work) => loading.track(work, 2),
		onready: () => {
			document.body.dataset.ready = "true";
			void loading.done();
		}
	}
});
