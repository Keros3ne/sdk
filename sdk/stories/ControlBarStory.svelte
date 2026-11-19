<!--
The SDK's control bar in a box the size of a game, for its stories: its props are the
story's controls, and what the player does with it is written above it.

Author: dwclake
Created: 2026-11-17
-->
<script lang="ts">
	import type { Hideable } from "../bar-rules.ts";
	import { Action, ControlBar, Switch } from "../controls/index.ts";

	interface Props {
		/** How wide the game is, in pixels: 600 or under, and the bar is one row with a strip above. */
		width?: number;
		height?: number;
		balance?: number;
		busy?: boolean;
		freeSpins?: number | null;
		autoLeft?: number;
		autoplay?: boolean;
		speeds?: "turbo" | "fast" | "none";
		place?: "bottom" | "top";
		scale?: number;
		hide?: Hideable[];
		typed?: boolean;
		/** A colour to stain the bar's glass with. */
		tint?: string;
	}

	let {
		width = 1000,
		height = 625,
		balance = 1_250_00,
		busy = false,
		freeSpins = null,
		autoLeft = 0,
		autoplay = true,
		speeds = "turbo",
		place = "bottom",
		scale = 1,
		hide = [],
		typed = false,
		tint
	}: Props = $props();

	let bet = $state<number>();
	let win = $state(0);
	let sound = $state(true);
	let said = $state("Nothing pressed yet.");
</script>

<p class="said">{said} Bet: {bet === undefined ? "" : (bet / 100).toFixed(2)}</p>

<div class="game" style:width="{width}px" style:height="{height}px">
	<!-- Something to see through the glass. -->
	<div class="scenery">
		{#each Array.from({ length: 15 }) as _, index}
			<span class={{ lit: index % 4 === 1 }}></span>
		{/each}
	</div>
	<ControlBar
		within="parent"
		look={tint ? { tint } : undefined}
		bets={{
			steps: [
				{ under: 2_00, by: 20 },
				{ under: 6_00, by: 25 },
				{ under: 10_00, by: 50 },
				{ by: 2_50 }
			]
		}}
		startBet={100}
		limits={{ minStake: 20, maxStake: 25_00 }}
		play={{ label: "Spin", symbol: "spin" }}
		onplay={() => {
			win = Math.random() < 0.4 ? (bet ?? 0) * 2 : 0;
			said = win > 0 ? "Played, and won." : "Played.";
		}}
		autoplay={autoplay
			? {
					noun: ["spin", "spins"],
					onstart: (count) => (said = `Autoplay started: ${count} spins.`),
					onstop: () => (said = "Autoplay stopped.")
				}
			: undefined}
		{speeds}
		{place}
		{scale}
		{hide}
		{typed}
		{balance}
		{win}
		{busy}
		{freeSpins}
		{autoLeft}
		bind:bet
	>
		{#snippet menu()}
			<Switch label="Sound effects" bind:checked={sound} />
			<Action label="Rules" onpress={() => (said = "Rules pressed.")} />
		{/snippet}
	</ControlBar>
</div>

<style>
	.said {
		margin: 0;
		padding: 0.75rem 1rem;
	}

	/* A game's room: the bar is placed in it and measured against it. */
	.game {
		position: relative;
		max-width: 100%;
		overflow: hidden;
		background: #1d1418;
		outline: 1px solid rgb(255 255 255 / 0.12);
	}

	.scenery {
		position: absolute;
		inset: 12% 20% 22%;
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 2%;
	}

	.scenery span {
		border: 1px solid #53474e;
		border-radius: 14%;
		background: #2f232b;
	}

	.scenery span.lit {
		background: #d49791;
	}
</style>
