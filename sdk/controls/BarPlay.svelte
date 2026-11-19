<!--
A control bar's play button: the game's main button. It plays once; with autoplay chosen
and waiting it shows the number over a triangle and starts the plays; while they run it
shows how many are left over a square and stops them; and while free spins play it shows
how many are left, and cannot be pressed. One of the three items every bar shows.

Author: dwclake
Created: 2026-11-19
-->
<script lang="ts">
	import type { SegmentLook } from "../look.ts";
	import { dressItem, itemSize } from "./bar-item.ts";
	import { getBar } from "./bar-state.svelte.ts";
	import Mark from "./Mark.svelte";

	interface Props {
		/** How it looks: its ground, edge, corners and padding (../look.ts). Nothing round it, left out. */
		look?: SegmentLook;
		/** Its size against the rest of the bar: 0.5 to 2. */
		size?: number;
	}

	let { look, size }: Props = $props();

	const bar = getBar("play");
</script>

<div
	class="sdk-bar-segment"
	data-segment="play"
	{@attach dressItem(() => look)}
	style:--segment-scale={itemSize(size)}
>
	<button
		type="button"
		class="sdk-bar-play"
		bind:this={bar.playElement}
		aria-label={bar.playName}
		data-auto={bar.face}
		disabled={bar.freeSpins !== null || (bar.busy && bar.left === 0)}
		onclick={() => bar.pressPlay()}
	>
		{#if bar.face === "play"}<Mark name={bar.options.play.symbol} />{:else}<span
				class="sdk-bar-play-auto"
			>
				<Mark name={bar.face === "free" ? "spin" : bar.face} /><span
					class="sdk-bar-play-count"
					data-long={bar.faceCount >= 100 ? "" : undefined}
				>
					{bar.faceCount}
				</span>
			</span>{/if}
	</button>
</div>
