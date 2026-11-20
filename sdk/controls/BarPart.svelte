<!--
A part of a control bar: one piece of it on the game, holding some of the bar's items. The
SDK's bar is one part along the bottom, and on a narrow game a second along the top; a
studio's own bar is as many as it likes, each placed by `inset` and dressed by `look`.
What is in a part is laid out by whoever writes it: the SDK's bar by its own elements
(./ControlBar.svelte), a studio's by its own.

A part says which edge of the game it is at: the room it takes there is what the bar
reports to the game (`bar.inset()`), and the popups of the items in it open away from it.
Left alone it lies along that edge, across the game.

Author: dwclake
Created: 2026-11-19
-->
<script lang="ts">
	import type { Snippet } from "svelte";
	import { dress, partProperties, type PartLook } from "../look.ts";
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
		/**
		 * Clear room between the part and the game's edges, in pixels at the bar's usual size:
		 * a part afloat. None, left out: it lies along its edge, across the game.
		 */
		inset?: number;
		/** How its box looks: what it is drawn on, its edge, corners, padding and shadow (../look.ts). */
		look?: PartLook;
		children: Snippet;
	}

	let {
		edge = "bottom",
		gap = 0,
		label = "Game controls",
		inset = 0,
		look,
		children
	}: Props = $props();

	providePart(() => edge);
</script>

<div
	class="sdk-bar-part"
	{@attach dress(() => partProperties(look))}
	style:--part-inset={inset ? `${inset}px` : undefined}
	data-edge={edge}
	data-gap={gap || undefined}
	role="group"
	aria-label={label}
>
	{@render children()}
</div>

<style>
	/*
	 * A part: one piece of the bar on the game. Along its edge, across the game, left alone;
	 * with `inset`, that far clear of the game's edges, afloat.
	 */
	.sdk-bar-part {
		position: absolute;
		left: calc(var(--part-inset, 0px) * var(--s));
		right: calc(var(--part-inset, 0px) * var(--s));
		padding: var(--part-padding, 0);
		border: var(--part-border, none);
		border-radius: var(--part-radius, 0);
		background: var(--part-surface, transparent);
		box-shadow: var(--part-shadow, none);
		backdrop-filter: var(--part-blur, none);
	}

	.sdk-bar-part[data-edge="bottom"] {
		bottom: calc(var(--part-inset, 0px) * var(--s));
	}

	.sdk-bar-part[data-edge="top"] {
		top: calc(var(--part-inset, 0px) * var(--s));
	}
</style>
