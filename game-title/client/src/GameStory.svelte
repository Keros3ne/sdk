<!--
The whole of Game Title in a story, in one of its two views, played from its real book
with nothing of the site behind it (./story-host.ts).

Author: dwclake
Created: 2026-11-18
-->
<script lang="ts">
	import type { Shape } from "@keros3ne/studio-sdk/shape";
	import Game from "./Game.svelte";
	import { storyHost } from "./story-host.ts";
	import "./style.css";

	interface Props {
		/** A spin that pays, in place of whatever the book gives. */
		winning?: boolean;
		/** The view to show, in a frame of its shape. */
		shape?: Shape;
	}

	let { winning = false, shape = "wide" }: Props = $props();
</script>

<!-- The game fills its frame on the site: here, a box of a frame's shape. -->
<div class={["frame", shape]}>
	{#key `${winning} ${shape}`}
		<Game host={storyHost(winning)} show={shape} />
	{/key}
</div>

<style>
	.frame {
		position: relative;
		width: min(100vw, 160vh);
		height: min(62.5vw, 100vh);
		overflow: hidden;
	}

	.frame.tall {
		width: min(100vw, 56.25vh);
		height: min(177.78vw, 100vh);
	}
</style>
