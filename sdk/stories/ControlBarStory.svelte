<!--
The control bar in a box the size of a game, for its stories: its props are the story's
controls, and what the player does with it is written above it.

Author: dwclake
Created: 2026-11-17
-->
<script lang="ts">
	import type { BarLayout } from "../bar-rules.ts";
	import { ControlBar } from "../controls/index.ts";

	interface Props {
		/** How wide the game is, in pixels: 600 or under, and the bar is in two rows. */
		width?: number;
		balance?: number;
		busy?: boolean;
		freeSpins?: number | null;
		autoplay?: boolean;
		speeds?: "turbo" | "fast" | "none";
		layout?: BarLayout;
	}

	let {
		width = 1000,
		balance = 100_00,
		busy = false,
		freeSpins = null,
		autoplay = true,
		speeds = "turbo",
		layout
	}: Props = $props();

	let bet = $state<number>();
	let win = $state(0);
	let said = $state("Nothing pressed yet.");
</script>

<p class="said">{said} Bet: {bet === undefined ? "" : (bet / 100).toFixed(2)}</p>

<div class="game" style:width="{width}px">
	<ControlBar
		within="parent"
		bets={[10, 20, 50, 100, 200, 500]}
		startBet={100}
		limits={{ minStake: 10, maxStake: 500 }}
		play={{ label: "Spin", symbol: "spin" }}
		onplay={() => {
			win = Math.random() < 0.4 ? (bet ?? 0) * 2 : 0;
			said = win > 0 ? "Played, and won." : "Played.";
		}}
		autoplay={autoplay
			? {
					counts: [10, 25, 50],
					noun: ["spin", "spins"],
					onstart: (count) => (said = `Autoplay started: ${count} spins.`),
					onstop: () => (said = "Autoplay stopped.")
				}
			: undefined}
		{speeds}
		{layout}
		{balance}
		{win}
		{busy}
		{freeSpins}
		bind:bet
	/>
</div>

<style>
	.said {
		margin: 0;
		padding: 0.75rem 1rem;
	}

	/* A game's room: the bar is placed in it and measured against it. */
	.game {
		position: relative;
		height: 420px;
		max-width: 100%;
		outline: 1px solid rgb(255 255 255 / 0.12);
	}
</style>
