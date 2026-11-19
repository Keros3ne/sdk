<!--
A game's page: everything between the site and the game that is the same in every game.
It shows the loading screen from its first moment, answers the site, asks for the game's
own code, and once both have come hands the game the site (`host`), a way to tell the
loading screen of its own progress (`track`), and a call for when it is ready to be played
(`onready`), at which the loading screen is taken away. A client's page is this and
nothing else:

    <GamePage
      title="Game Title"
      logo="./loading-logo.svg"
      look={{ surface: "#173341", fill: "#ffd56b" }}
      game={() => import("../Game.svelte")}
    />

The page is rendered when the client is built, with no browser and no site, so the game is
asked for only once the page is in a browser: write `game` as a function that imports it,
which also lets the build split the game's code from the page's.

Author: dwclake
Created: 2026-11-19
-->
<script lang="ts">
	import { onMount, type Component } from "svelte";
	import { connect, type GameHost } from "./client.ts";
	import type { LoadingLook } from "./loading-look.ts";
	import { LoadingScreen, createLoading } from "./loading.ts";

	/** What a game's root component is given by its page. */
	export interface GameProps<View = unknown, Progress = unknown> {
		/** The site, or in a story something that plays rounds from the books in its place. */
		host: GameHost<View, Progress>;
		/** Follows a piece of work as it loads: hand it the stage's, and the loading screen's bar fills with it. */
		track?: <Work>(work: Promise<Work>) => Promise<Work>;
		/** Called once the game is ready to be played. */
		onready?: () => void;
	}

	interface Props {
		/** The game's name: the page's title, and what the loading screen says. */
		title: string;
		/** The studio's logo over the name on the loading screen, as an address in the client. */
		logo?: string;
		/** How the loading screen looks (./loading-look.ts). */
		look?: LoadingLook;
		/** The game's root component, imported when the page is in a browser. */
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		game: () => Promise<{ default: Component<any> }>;
		/**
		 * Typefaces to have before the game is shown, each as `document.fonts.load` takes one.
		 * The control bar's own, left out.
		 */
		fonts?: string[];
	}

	let {
		title,
		logo,
		look,
		game,
		fonts = ['500 15px "Geist Variable"']
	}: Props = $props();

	const loading = createLoading();

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let loaded = $state.raw<{
		Game: Component<any>;
		host: GameHost<unknown, unknown>;
	} | null>(null);

	// Up first: the site's answer, the game's own code, and its typefaces.
	onMount(async () => {
		const typefaces = fonts.map((face) =>
			loading.track(document.fonts.load(face).catch(() => null))
		);
		const [host, code] = await Promise.all([
			loading.track(connect(), 2),
			loading.track(game(), 2)
		]);
		await Promise.all(typefaces);

		loaded = { Game: code.default, host };
	});
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<LoadingScreen {loading} {title} {logo} {look} />

{#if loaded}
	<loaded.Game
		host={loaded.host}
		track={(work: Promise<unknown>) => loading.track(work, 2)}
		onready={() => {
			document.body.dataset.ready = "true";
			void loading.done();
		}}
	/>
{/if}
