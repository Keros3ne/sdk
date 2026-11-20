<!--
A control bar's speed button: the ordinary pace, fast and turbo, one press on from the
last and round again. Not drawn in a game too quick for speed to matter (`speeds: "none"`).

Author: dwclake
Created: 2026-11-19
-->
<script lang="ts">
	import { SPEEDS } from "../bar-rules.ts";
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

	const bar = getBar("speed");
	const speeds = $derived(bar.options.speeds ?? "turbo");
</script>

<div
	class="sdk-bar-segment"
	data-segment="speed"
	{@attach dressItem(() => look)}
	hidden={speeds === "none"}
	style:--segment-scale={itemSize(size)}
>
	<button
		type="button"
		class="sdk-bar-button sdk-bar-speed"
		aria-label={speeds === "none"
			? "Speed: not in this game"
			: `Speed: ${SPEEDS[bar.speed]}`}
		title={speeds === "none"
			? ""
			: bar.speed === 1 && speeds === "turbo"
				? "Fast: bonuses play at their own pace"
				: `Speed: ${SPEEDS[bar.speed]}`}
		data-speed={bar.speed}
		hidden={speeds === "none"}
		onclick={() => bar.nextSpeed()}
	>
		<Mark name={bar.speed === 2 ? "turbo" : "fast"} />
	</button>
</div>

<style>
	/* Switched on: fast, or turbo. */
	:global(.sdk-bar-frame) .sdk-bar-speed:not([data-speed="0"]) {
		border-color: var(--bar-on, #8ab4f8);
		color: var(--bar-on, #8ab4f8);
	}
</style>
