<!--
A game's views: what it draws in each of the two shapes, as separate things. Every game has
a `wide` view (16 by 10); one that is also drawn for a phone has a `tall` one (9 by 16) and
says so in its `game.json` (`"shapes": ["wide", "tall"]`). The site decides which shape the
game's frame has, and this shows the view for it:

    <Views>
      {#snippet wide()}<WideView {round} />{/snippet}
      {#snippet tall()}<TallView {round} />{/snippet}
    </Views>

What the game knows (its round, its balance, its bar) is kept above the views, not in
them: a view is only how that is drawn, and is made again when the shape changes (a
phone turned in full screen). A story shows one view whatever shape the page has, with
`show`.

Author: dwclake
Created: 2026-11-19
-->
<script lang="ts">
	import type { Snippet } from "svelte";
	import { createShape, type Shape } from "./shape.svelte.ts";

	interface Props {
		/** The game at 16 by 10. */
		wide: Snippet;
		/** The game at 9 by 16, for a game that has such a view. Without it, wide is shown always. */
		tall?: Snippet;
		/** The view to show whatever the page's shape: for a story of one view. */
		show?: Shape;
	}

	let { wide, tall, show }: Props = $props();

	const shape = createShape();
	const shown = $derived((show ?? shape.current) === "tall" && tall ? "tall" : "wide");
</script>

{#if shown === "tall" && tall}{@render tall()}{:else}{@render wide()}{/if}
