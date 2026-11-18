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
const loading = createLoadingScreen({ title: document.title });
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
