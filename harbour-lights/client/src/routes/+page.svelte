<!--
Harbour Lights: the client's page. It decides nothing. A spin is a row the site drew from
the game's book, and comes back through the SDK already settled; the game only plays it
out (../Game.svelte), then tells the site it has been shown.

This page is rendered when the client is built, so it holds only what can be drawn with no
browser and no site: the loading screen. The game itself is asked for once the page is in
a browser, where the site can answer.

Author: dwclake
Created: 2026-11-18
-->
<script lang="ts">
	import { onMount, type Component } from "svelte";
	import { connect, type GameHost } from "@keros3ne/studio-sdk/client";
	import { LoadingScreen, createLoading } from "@keros3ne/studio-sdk/loading";
	import type { RoundView } from "../round.ts";
	import "../style.css";

	/** What the game is given: the site, and how to tell the loading screen of its progress. */
	interface GameProps {
		host: GameHost<RoundView, null>;
		track?: <Work>(work: Promise<Work>) => Promise<Work>;
		onready?: () => void;
	}

	const loading = createLoading();

	let game = $state.raw<{ Game: Component<GameProps>; host: GameProps["host"] } | null>(
		null
	);

	// Up first: the site's answer, the game's own code, and the bar's typeface.
	onMount(async () => {
		const typeface = loading.track(
			document.fonts.load('500 15px "Geist Variable"').catch(() => null)
		);
		const [host, code] = await Promise.all([
			loading.track(connect<RoundView, null>(), 2),
			loading.track(import("../Game.svelte"), 2)
		]);
		await typeface;

		game = { Game: code.default, host };
	});
</script>

<svelte:head>
	<title>Harbour Lights</title>
</svelte:head>

<!-- The game's own: on the evening the game opens on (style.css's ground), so that when it
     leaves only what is in front changes, with the studio's logo over the name. -->
<LoadingScreen
	{loading}
	title="Harbour Lights"
	logo="./loading-logo.svg"
	look={{
		surface: "radial-gradient(circle at 50% 20%, #24546a, #173341 55%, #0f2530)",
		ink: "#f4efe6",
		track: "#1d4152",
		fill: "#ffd56b",
		titleCase: "uppercase",
		titleSpacing: "0.14em",
		logoWidth: 96
	}}
/>

{#if game}
	<game.Game
		host={game.host}
		track={(work) => loading.track(work, 2)}
		onready={() => {
			document.body.dataset.ready = "true";
			void loading.done();
		}}
	/>
{/if}
