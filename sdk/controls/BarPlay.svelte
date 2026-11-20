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

<style>
	/* Play: the bar's one solid button, standing proud of it. */
	.sdk-bar-play {
		display: inline-grid;
		place-items: center;
		flex: none;
		padding: 0;
		border: 1px solid var(--bar-accent, #f4f1f2);
		font: inherit;
		font-weight: 500;
		cursor: pointer;
	}

	.sdk-bar-play {
		width: calc(72px * var(--s));
		min-width: calc(72px * var(--s));
		height: calc(72px * var(--s));
		min-height: calc(72px * var(--s));
		border-color: var(--bar-accent, #f4f1f2);
		border-radius: 50%;
		background: var(--bar-accent, #f4f1f2);
		box-shadow:
			inset 0 calc(-3px * var(--s)) 0 rgb(0 0 0 / 0.12),
			0 calc(6px * var(--s)) calc(18px * var(--s)) rgb(0 0 0 / 0.35);
		color: var(--bar-on-accent, #25191c);
	}
	.sdk-bar-play :global(svg) {
		width: calc(36px * var(--s));
		height: calc(36px * var(--s));
	}
	/* Autoplay on play: a triangle while plays wait for it, a square while they run, the number
	   in it. The symbol is as big as the round button holds, drawn with a fine line, so the
	   number can be large and bold and still clear of it. */
	.sdk-bar-play-auto {
		display: grid;
		place-items: center;
	}
	.sdk-bar-play-auto > :global(*) {
		grid-area: 1 / 1;
	}
	.sdk-bar-play .sdk-bar-play-auto :global(svg) {
		width: calc(54px * var(--s));
		height: calc(54px * var(--s));
		stroke-width: 0.6;
	}
	/* The triangle's middle is left of the button's: it is moved over, and the number with it. */
	.sdk-bar-play[data-auto="ready"] .sdk-bar-play-auto :global(svg) {
		translate: calc(4px * var(--s)) 0;
	}
	.sdk-bar-play-count {
		font-size: calc(17px * var(--s));
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		line-height: 1;
	}
	.sdk-bar-play[data-auto="ready"] .sdk-bar-play-count {
		translate: calc(2px * var(--s)) 0;
		font-size: calc(15px * var(--s));
	}
	/* Three figures are written smaller, to stay clear of the triangle round them. */
	.sdk-bar-play[data-auto="ready"] .sdk-bar-play-count[data-long] {
		translate: calc(1px * var(--s)) 0;
		font-size: calc(11px * var(--s));
	}
	/* Free spins: the count over the spin symbol, drawn faint so the figure reads. */
	.sdk-bar-play[data-auto="free"] .sdk-bar-play-auto :global(.sdk-bar-symbol) {
		opacity: 0.22;
	}
	:global(.sdk-bar-frame) .sdk-bar-play[data-auto="free"]:disabled {
		opacity: 1;
	}
	.sdk-bar-play[data-auto="free"] .sdk-bar-play-count {
		font-size: calc(22px * var(--s));
	}
</style>
