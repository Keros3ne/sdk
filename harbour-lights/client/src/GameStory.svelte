<!--
The whole of Harbour Lights in a story, played from its real book with nothing of the
site behind it (./story-host.ts).

Author: dwclake
Created: 2026-11-18
-->
<script lang="ts">
	import Game from "./Game.svelte";
	import { storyHost } from "./story-host.ts";
	import "./style.css";

	let { winning = false }: { winning?: boolean } = $props();
</script>

<!-- The game fills its frame on the site: here, a box of a frame's shape. -->
<div class="frame">
	{#key winning}
		<Game host={storyHost(winning)} />
	{/key}
</div>

<style>
	.frame {
		position: relative;
		width: min(100vw, 160vh);
		height: min(62.5vw, 100vh);
		overflow: hidden;
	}
</style>
