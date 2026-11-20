<!--
One of the control bar's symbols (../bar-rules.ts): lines on a 16 by 16 grid, drawn in
the colour of the words around it.

Author: dwclake
Created: 2026-11-17
-->
<script lang="ts">
	import { SYMBOL_PATHS, type BarSymbol } from "../bar-rules.ts";

	let { name }: { name: BarSymbol } = $props();
</script>

<span class="sdk-bar-symbol" aria-hidden="true">
	<svg
		viewBox="0 0 16 16"
		width="24"
		height="24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.1"
		stroke-linejoin="round"
	>
		{@html SYMBOL_PATHS[name]}
	</svg>
</span>

<style>
	.sdk-bar-symbol {
		display: grid;
	}
</style>
