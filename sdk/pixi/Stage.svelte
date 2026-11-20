<!--
The stage a game is drawn on: a canvas and the Pixi application behind it. What is inside
it is drawn in the game's own measure, `width` by `height`, whatever size the canvas is on
the screen: the stage is scaled to the room it is given and drawn at the screen's own
sharpness. Pixi is made ready for the frame's policy first (prepare.ts), and nothing
inside is drawn until the pictures named in `pictures` have loaded.

Author: dwclake
Created: 2026-11-17
-->
<script lang="ts">
	import type { Application } from "pixi.js";
	import { untrack, type Snippet } from "svelte";
	import { loadPictures, makeApplication } from "./prepare.ts";
	import { setStage } from "./stage.svelte.ts";
	import { getView } from "../view.svelte.ts";

	interface Props {
		/** The game's own measure: what is inside is placed in these, not in screen pixels. */
		width: number;
		height: number;
		/** The colour behind everything, as Pixi takes one: `0x10151c`. */
		background?: number;
		/**
		 * With nothing behind what is drawn: the page shows through the stage. For a game
		 * with a backdrop of its own under it, drawn some other way.
		 */
		seeThrough?: boolean;
		/** The pictures to load before anything is drawn, by the name sprites call them. */
		pictures?: Readonly<Record<string, string>>;
		/** What the stage shows, in words, for someone who cannot see it. */
		label?: string;
		/** Follows the loading: hand it a loading screen's `track`. */
		track?: <Work>(work: Promise<Work>) => Promise<Work>;
		/** Called once the stage is ready, with its application. */
		onready?: (app: Application) => void;
		children?: Snippet;
	}

	let {
		width,
		height,
		background = 0x000000,
		seeThrough = false,
		pictures = {},
		label,
		track,
		onready,
		children
	}: Props = $props();

	let app = $state.raw<Application | null>(null);

	setStage({
		app: () => app!,
		parent: () => app!.stage
	});

	/** The view the stage is drawn in, if it is in one: for how much it is scaled. */
	const view = getView();
	/** Draws the stage again at its size on the screen, once it is made. */
	let refit: (() => void) | undefined;

	// The view scaled another way (the game's frame changed size): the canvas is the same
	// size in the view's own pixels, so nothing else says to draw it again.
	$effect(() => {
		void view?.scale;
		refit?.();
	});

	/** Makes the application on the canvas, and keeps it the size of the room it has. */
	function mount(canvas: HTMLCanvasElement) {
		let gone = false;
		let made: Application | null = null;
		let watcher: ResizeObserver | null = null;

		// Made once: the props are read as they are now, and kept up to date below.
		const work = untrack(async () => {
			await loadPictures(pictures);

			const application = await makeApplication({
				canvas,
				width,
				height,
				background,
				backgroundAlpha: seeThrough ? 0 : 1,
				antialias: true,
				resolution: window.devicePixelRatio || 1
			});

			if (gone) {
				application.destroy();

				return;
			}

			/**
			 * Draws at the canvas's size on the screen, the stage scaled to fill it. The canvas's
			 * own size is in the pixels of the game's view, which is scaled as a whole to the
			 * room it has: it is drawn with as many dots as that comes to on the screen.
			 */
			const fit = () => {
				const room = canvas.clientWidth;
				if (room === 0) return;

				application.renderer.resolution =
					(window.devicePixelRatio || 1) * (view?.scale ?? 1);
				application.renderer.resize(room, (room * height) / width);
				application.stage.scale.set(room / width);
			};

			refit = fit;

			watcher = new ResizeObserver(fit);
			watcher.observe(canvas);
			fit();

			made = application;
			app = application;
			onready?.(application);
		});

		void (track ? track(work) : work);

		return () => {
			gone = true;
			watcher?.disconnect();
			refit = undefined;
			app = null;
			made?.destroy(false, { children: true });
		};
	}
</script>

<canvas
	class="stage"
	style:aspect-ratio="{width} / {height}"
	role={label ? "img" : undefined}
	aria-label={label}
	{@attach mount}
></canvas>

{#if app}
	{@render children?.()}
{/if}

<style>
	.stage {
		display: block;
		width: 100%;
		height: auto;
	}
</style>
