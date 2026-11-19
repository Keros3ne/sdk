<!--
A part of a control bar: one piece of it on the game, holding some of the bar's items. The
SDK's bar is one part along the bottom, and on a narrow game a second along the top; a
studio's own bar is as many as it likes, placed by its own style sheet (the `class`).

A part says which edge of the game it is at: the room it takes there is what the bar
reports to the game (`bar.inset()`), and the popups of the items in it open away from it.
Left alone it lies along that edge, across the game.

Author: dwclake
Created: 2026-11-19
-->
<script lang="ts">
	import type { Snippet } from "svelte";
	import { providePart } from "./bar-state.svelte.ts";

	interface Props {
		/** The edge of the game the part is at, or nearer. The bottom, left out. */
		edge?: "bottom" | "top";
		/**
		 * Clear room kept between the part and the game, in pixels at the bar's usual size: it
		 * counts in the room the bar reports (`bar.inset()`), so a game drawing clear of the bar
		 * leaves this much between them. None, left out: for a bar afloat, which needs some.
		 */
		gap?: number;
		/** What the part is, for a screen reader: "Game controls". */
		label?: string;
		/** Classes of the studio's own, to place and dress it. */
		class?: string;
		children: Snippet;
	}

	let {
		edge = "bottom",
		gap = 0,
		label = "Game controls",
		class: partClass,
		children
	}: Props = $props();

	providePart(() => edge);
</script>

<div
	class={["sdk-bar-part", partClass]}
	data-edge={edge}
	data-gap={gap || undefined}
	role="group"
	aria-label={label}
>
	{@render children()}
</div>
