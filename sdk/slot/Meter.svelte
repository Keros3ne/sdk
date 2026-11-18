<!--
A meter: a bar that fills. For a counter a game keeps between bets, or anything else that
is so much of a whole. It moves to a new figure over a moment, not at a jump.

Author: dwclake
Created: 2026-11-17
-->
<script lang="ts">
	import { Graphics } from "pixi.js";
	import { onDestroy } from "svelte";
	import { getStage, place, type DisplayProps } from "../pixi/stage.svelte.ts";
	import { createTweens } from "./tween.ts";

	interface Props extends DisplayProps {
		/** How much there is, and how much fills it. */
		value: number;
		full: number;
		/** The bar's size on the stage. */
		width: number;
		height: number;
		/** The colour of what is filled and of what is not, as Pixi takes one. */
		fill?: number;
		ground?: number;
		/** How long a change takes to show, in milliseconds. */
		fillTime?: number;
	}

	let {
		value,
		full,
		width,
		height,
		fill = 0xffffff,
		ground = 0x2a2f38,
		fillTime = 300,
		...display
	}: Props = $props();

	const bar = new Graphics();
	const tweens = createTweens(getStage().app().ticker);
	/** How much of the bar is drawn as filled, from 0 to 1. */
	let drawn = 0;

	place(bar, () => display);

	/** Draws the bar with a share of it filled. */
	function draw(share: number) {
		drawn = share;
		bar.clear().rect(0, 0, width, height).fill(ground);
		if (share > 0) bar.rect(0, 0, width * share, height).fill(fill);
	}

	// A new figure is moved to from wherever the bar has got to.
	$effect(() => {
		const to = full > 0 ? Math.min(1, Math.max(0, value / full)) : 0;
		const from = drawn;

		tweens.finish();
		void tweens.run({ duration: fillTime }, (share) =>
			draw(from + (to - from) * share)
		);
	});

	onDestroy(() => tweens.finish());
</script>
