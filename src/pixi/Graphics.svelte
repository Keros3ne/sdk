<!--
Shapes on the stage. `draw` is handed a Pixi graphics, cleared, and draws on it; it is
called again whenever anything it reads changes.

Author: dwclake
Created: 2026-11-17
-->
<script lang="ts">
	import { Graphics } from "pixi.js";
	import { place, type DisplayProps } from "./stage.svelte.ts";

	interface Props extends DisplayProps {
		draw: (graphics: Graphics) => void;
	}

	let { draw, ...display }: Props = $props();

	const graphics = new Graphics();

	place(graphics, () => display);

	$effect(() => {
		graphics.clear();
		draw(graphics);
	});
</script>
