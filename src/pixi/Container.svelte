<!--
A group of pieces that move, turn and fade as one. What is inside it is placed from its
own corner, not the stage's.

Author: dwclake
Created: 2026-11-17
-->
<script lang="ts">
	import { Container } from "pixi.js";
	import type { Snippet } from "svelte";
	import { getStage, place, setStage, type DisplayProps } from "./stage.svelte.ts";

	let { children, ...display }: DisplayProps & { children?: Snippet } = $props();

	const container = new Container();
	const { app } = getStage();

	place(container, () => display);
	setStage({ app, parent: () => container });
</script>

{@render children?.()}
