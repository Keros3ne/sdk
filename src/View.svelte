<!--
One of a game's two views: a picture of one size, scaled as a whole to the room it has.
`WideView` and `TallView` are this at their two sizes (../shapes.ts: 1600 by 1000, and 900
by 1600), and are what a studio uses; the size is not a studio's to choose.

Everything in a view is laid out in the view's own pixels. Nothing in it asks how big the
screen is: at any size it is the same picture, larger or smaller. What is in it may still
change with the game (a panel shown only during a bonus, a figure that grows with its
digits); what does not change is where things are from one screen to another.

Author: dwclake
Created: 2026-11-19
-->
<script lang="ts">
	import type { Snippet } from "svelte";
	import { VIEW_SIZE, type Shape } from "./shapes.ts";
	import { provideView } from "./view.svelte.ts";

	let { shape, children }: { shape: Shape; children: Snippet } = $props();

	// A view is made for one shape and made again for the other, so this is read once.
	// svelte-ignore state_referenced_locally
	const { width, height } = VIEW_SIZE[shape];

	/** How many of the screen's pixels one of the view's is drawn with. */
	let scale = $state(1);

	// svelte-ignore state_referenced_locally
	provideView({
		shape,
		get scale() {
			return scale;
		}
	});

	/** Follows the room the view is in: the game's own frame, or a story's. */
	function fit(room: HTMLElement) {
		const measure = () => {
			if (!room.clientWidth || !room.clientHeight) return;

			scale = Math.min(room.clientWidth / width, room.clientHeight / height);
		};

		const watcher = new ResizeObserver(measure);
		watcher.observe(room);
		measure();

		return () => watcher.disconnect();
	}
</script>

<div class="sdk-view-room" {@attach fit}>
	<div
		class="sdk-view"
		data-view={shape}
		style:width="{width}px"
		style:height="{height}px"
		style:transform="translate(-50%, -50%) scale({scale})"
	>
		{@render children()}
	</div>
</div>

<style>
	/* The room: all of the game's frame, or all of what a story gives it. */
	.sdk-view-room {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}

	/* The picture, at its own size, in the middle of the room and scaled to fit it. What is
	   placed in it is placed against it: it is what `position: absolute` and `fixed` are
	   measured from. */
	.sdk-view {
		position: absolute;
		top: 50%;
		left: 50%;
		transform-origin: center;
		overflow: hidden;
	}
</style>
