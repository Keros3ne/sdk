<!--
A game in a story: a box of the shape a game's frame has on the site, wide (16 by 10) or
tall (9 by 16), as large as the page allows, and under it what the game would have told a
screen reader, which on the site is the site's to say. A game's story wraps the game in
one, so that each of its views has stories of its own:

    <StoryFrame shape="tall" {said}>
      <Game host={createStoryHost({ slug: "game-title", onannounce: (text) => (said = text) })} show="tall" />
    </StoryFrame>

Author: dwclake
Created: 2026-11-19
-->
<script lang="ts">
	import type { Snippet } from "svelte";
	import type { Shape } from "./shapes.ts";

	interface Props {
		/** The shape of the frame: the view of the game the story is of. Wide, left out. */
		shape?: Shape;
		/** The last thing the game announced. */
		said?: string;
		children: Snippet;
	}

	let { shape = "wide", said = "", children }: Props = $props();
</script>

<div class={["sdk-story-frame", shape]}>{@render children()}</div>
<p class="sdk-story-said" role="status">{said}</p>

<style>
	.sdk-story-frame {
		position: relative;
		width: min(100vw, 152vh);
		height: min(62.5vw, 95vh);
		overflow: hidden;
	}

	.sdk-story-frame.tall {
		width: min(100vw, 53.4vh);
		height: min(177.78vw, 95vh);
	}

	.sdk-story-said {
		margin: 0;
		padding: 4px 8px;
		min-height: 1.4em;
		color: #c0aeb2;
		font:
			13px/1.4 ui-monospace,
			monospace;
	}
</style>
