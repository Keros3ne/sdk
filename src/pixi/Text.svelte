<!--
Words on the stage, drawn in whatever typeface the client has loaded.

Author: dwclake
Created: 2026-11-17
-->
<script lang="ts">
	import { Text, type TextStyleOptions } from "pixi.js";
	import { place, type DisplayProps } from "./stage.svelte.ts";

	interface Props extends DisplayProps {
		text: string;
		/** How it is set, as Pixi takes it: `{ fill: 0xffffff, fontSize: 24 }`. */
		style?: TextStyleOptions;
		/** Which point of the words is at `x`, `y`: 0 their left or top, 1 their right or foot. */
		anchor?: number | { x: number; y: number };
	}

	let { text, style, anchor, ...display }: Props = $props();

	const words = new Text({ text: "" });

	place(words, () => display);

	$effect(() => {
		words.text = text;
		if (style) words.style = style;

		if (typeof anchor === "number") words.anchor.set(anchor);
		else words.anchor.set(anchor?.x ?? 0, anchor?.y ?? 0);
	});
</script>
