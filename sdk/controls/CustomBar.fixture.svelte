<!--
A studio's own bar, for the tests (./bar-rules.svelte.spec.ts): the SDK's items in a frame
of the test's, in two parts and an order the SDK's bar does not have. With `without`, one
of the items every bar must show is left out.

Author: dwclake
Created: 2026-11-19
-->
<script lang="ts">
	import type { BarHandle } from "../bar-rules.ts";
	import BarAutoplay from "./BarAutoplay.svelte";
	import BarBalance from "./BarBalance.svelte";
	import BarBet from "./BarBet.svelte";
	import BarFrame from "./BarFrame.svelte";
	import BarMenu from "./BarMenu.svelte";
	import BarPart from "./BarPart.svelte";
	import BarPlay from "./BarPlay.svelte";
	import BarSpeed from "./BarSpeed.svelte";
	import BarWin from "./BarWin.svelte";

	interface Props {
		/** An item to leave out, to see the frame refuse a bar without it. */
		without?: "balance" | "bet" | "play";
		onready?: (bar: BarHandle) => void;
	}

	let { without, onready }: Props = $props();
</script>

<BarFrame
	within="parent"
	bets={[10, 20, 50, 100]}
	startBet={20}
	limits={{ minStake: 10, maxStake: 100 }}
	play={{ label: "Spin", symbol: "spin" }}
	onplay={() => {}}
	autoplay={{ noun: ["spin", "spins"], onstart: () => {}, onstop: () => {} }}
	balance={25_00}
	{onready}
>
	{#snippet children()}
		<BarPart edge="top" class="custom-top">
			<BarWin label="Last win" unit={false} />
			{#if without !== "balance"}<BarBalance
					look={{ surface: "rgb(1, 2, 3)" }}
				/>{/if}
		</BarPart>
		<BarPart class="custom-bottom" gap={10}>
			{#if without !== "play"}<BarPlay size={1.5} />{/if}
			<BarSpeed look={{ on: "rgb(4, 5, 6)" }} /><BarAutoplay />
			{#if without !== "bet"}<BarBet arrange="column-end" />{/if}
			<BarMenu />
		</BarPart>
	{/snippet}
</BarFrame>

<style>
	:global(.custom-top),
	:global(.custom-bottom) {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 10px;
	}
</style>
