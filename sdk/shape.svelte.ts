/**
 * Which of the two shapes a game has now (./shapes.ts): `wide`, 16 by 10, or `tall`, 9 by
 * 16. The site decides which a game's frame has. A game draws each as a view of its own
 * (./Views.svelte), and asks here where it needs to know more, in place of measuring the
 * screen with media queries of its own:
 *
 *     const shape = createShape();
 *
 *     {#if shape.tall}...{:else}...{/if}
 *
 * The shape is also written on the page (`data-shape` on its root element), for a style
 * sheet: `[data-shape="tall"] .title { ... }`.
 *
 * It follows the page, which in a game's frame is the game. Where a game is one thing
 * among others on a page (a story, the site's own games), attach `shape.follow` to the
 * element that holds it, and the shape is that element's, written on it.
 *
 * Author: dwclake
 * Created: 2026-11-19
 */

import { shapeOf, type Shape } from "./shapes.ts";

export * from "./shapes.ts";
export { default as Views } from "./Views.svelte";

/** A game's shape, as it is now. Read it where it is drawn, and it is kept up to date. */
export interface GameShape {
	/** `wide` (16 by 10) or `tall` (9 by 16, on a phone). */
	readonly current: Shape;
	readonly wide: boolean;
	readonly tall: boolean;
	/** The game's size on the screen, in pixels. */
	readonly width: number;
	readonly height: number;
	/** An attachment: the shape follows this element, in place of the page, while it is there. */
	follow(element: HTMLElement): () => void;
}

/**
 * The shape of the game, kept up to date as its frame changes size. Where there is no
 * browser (a page rendered when the client is built) it is wide, 1600 by 1000.
 */
export function createShape(): GameShape {
	let width = $state(1600);
	let height = $state(1000);
	const current = $derived(shapeOf(width, height));

	// What the shape is measured from and written on: the page, until an element is followed.
	let marked: HTMLElement | undefined;

	/** Takes a size, and writes the shape it makes where a style sheet can read it. */
	function measure(element: HTMLElement, nextWidth: number, nextHeight: number) {
		if (!nextWidth || !nextHeight) return;

		width = nextWidth;
		height = nextHeight;
		marked = element;
		element.dataset.shape = shapeOf(nextWidth, nextHeight);
	}

	/** The page's own size. */
	function measurePage() {
		measure(document.documentElement, window.innerWidth, window.innerHeight);
	}

	let followsPage = typeof window !== "undefined";
	if (followsPage) {
		measurePage();
		window.addEventListener("resize", () => {
			if (followsPage) measurePage();
		});
	}

	return {
		get current() {
			return current;
		},
		get wide() {
			return current === "wide";
		},
		get tall() {
			return current === "tall";
		},
		get width() {
			return width;
		},
		get height() {
			return height;
		},
		follow(element) {
			followsPage = false;
			// The page no longer says a shape that is not the game's.
			if (marked && marked !== element) delete marked.dataset.shape;

			const watcher = new ResizeObserver(() =>
				measure(element, element.clientWidth, element.clientHeight)
			);
			watcher.observe(element);

			return () => {
				watcher.disconnect();
				delete element.dataset.shape;
				followsPage = true;
				measurePage();
			};
		}
	};
}
