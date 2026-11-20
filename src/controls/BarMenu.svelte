<!--
A control bar's menu: a button that opens the volume, and under it whatever the game
writes inside this (its own switches and actions).

Author: dwclake
Created: 2026-11-19
-->
<script lang="ts">
	import type { Snippet } from "svelte";
	import type { SegmentLook } from "../look.ts";
	import { dressItem, itemSize } from "./bar-item.ts";
	import { getBar, popupOpens } from "./bar-state.svelte.ts";
	import Mark from "./Mark.svelte";
	import Popup from "./Popup.svelte";
	import Slider from "./Slider.svelte";

	interface Props {
		/** How it looks: its ground, edge, corners and padding (../look.ts). Nothing round it, left out. */
		look?: SegmentLook;
		/** Its size against the rest of the bar: 0.5 to 2. */
		size?: number;
		/** More for the menu, under the volume. */
		children?: Snippet;
	}

	let { look, size, children }: Props = $props();

	const bar = getBar("menu");
	const opens = popupOpens();
</script>

<div
	class="sdk-bar-segment"
	data-segment="menu"
	{@attach dressItem(() => look)}
	style:--segment-scale={itemSize(size)}
>
	<Popup label="Menu" button="round" opens={opens()} name="Menu">
		{#snippet face()}<Mark name="menu" />{/snippet}
		<Slider
			label="Volume"
			bind:value={bar.volume}
			step={0.1}
			onchange={(value) => bar.options.onvolume?.(value)}
		/>{@render children?.()}
	</Popup>
</div>
