<!--
Pixi in the frame: the page of ../main.ts, which draws with Pixi as it comes or made ready
for the frame, as its address asks.

Author: dwclake
Created: 2026-11-18
-->
<script lang="ts">
	import { onMount } from "svelte";

	onMount(() => void import("../main.ts"));
</script>

<svelte:head>
	<title>Pixi in the frame</title>
</svelte:head>
