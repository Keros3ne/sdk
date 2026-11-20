<!--
A control bar's autoplay button: its popup chooses Off or a number of plays, which only
readies them and closes; the bar's play button then starts and stops them. Not drawn in a
game that cannot play by itself (no `autoplay` given to the bar).

Author: dwclake
Created: 2026-11-19
-->
<script lang="ts">
	import type { SegmentLook } from "../look.ts";
	import Autoplay from "./Autoplay.svelte";
	import { dressItem, itemSize } from "./bar-item.ts";
	import { getBar, popupOpens } from "./bar-state.svelte.ts";
	import Mark from "./Mark.svelte";

	interface Props {
		/** How it looks: its ground, edge, corners and padding (../look.ts). Nothing round it, left out. */
		look?: SegmentLook;
		/** Its size against the rest of the bar: 0.5 to 2. */
		size?: number;
	}

	let { look, size }: Props = $props();

	const bar = getBar("autoplay");
	const opens = popupOpens();
	const autoplay = $derived(bar.options.autoplay);
</script>

<div
	class="sdk-bar-segment"
	data-segment="autoplay"
	{@attach dressItem(() => look)}
	hidden={!autoplay}
	style:--segment-scale={itemSize(size)}
>
	{#if autoplay}
		<Autoplay
			counts={bar.counts}
			noun={autoplay.noun}
			startFrom="play"
			left={bar.left}
			bind:ready={bar.ready}
			disabled={bar.busy && bar.left === 0}
			opens={opens()}
			class="sdk-bar-auto"
			buttonClass="sdk-bar-button"
			onstart={autoplay.onstart}
			onstop={autoplay.onstop}
		>
			{#snippet symbol()}<Mark name="auto" />{/snippet}
			{@render autoplay.content?.()}
		</Autoplay>
	{/if}
</div>

<style>
	/* Autoplay's button in a bar: its count in the bar's figures. */
	:global(.sdk-bar-frame .sdk-autoplay) {
		font-size: calc(13px * var(--s));
		font-variant-numeric: tabular-nums;
	}

	/* Chosen, and waiting for play. */
	:global(.sdk-bar-frame .sdk-autoplay[data-ready]) {
		border-color: var(--bar-on, #8ab4f8);
		color: var(--bar-on, #8ab4f8);
	}
</style>
