<!--
A picture on the stage. `texture` is a picture's name as the stage loaded it (`pictures`
on `Stage`), or a Pixi texture made some other way.

Author: dwclake
Created: 2026-11-17
-->
<script lang="ts">
	import { Sprite, Texture } from "pixi.js";
	import { place, type DisplayProps } from "./stage.svelte.ts";

	interface Props extends DisplayProps {
		texture: string | Texture;
		/** Which point of the picture is at `x`, `y`: 0 its left or top, 1 its right or foot. */
		anchor?: number | { x: number; y: number };
		/** Its size on the stage. Left out, the picture's own. */
		width?: number;
		height?: number;
		/** A colour laid over it, as Pixi takes one. */
		tint?: number;
	}

	let { texture, anchor, width, height, tint, ...display }: Props = $props();

	const sprite = new Sprite();

	place(sprite, () => display);

	$effect(() => {
		sprite.texture = typeof texture === "string" ? Texture.from(texture) : texture;

		if (typeof anchor === "number") sprite.anchor.set(anchor);
		else sprite.anchor.set(anchor?.x ?? 0, anchor?.y ?? 0);

		// After the picture: a size is kept by scaling whatever picture is shown.
		if (width !== undefined) sprite.width = width;
		if (height !== undefined) sprite.height = height;

		sprite.tint = tint ?? 0xffffff;
	});
</script>
