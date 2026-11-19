<!--
A control bar's bet, with minus and plus: the bet under its label, and a button either
side that moves it to the next bet on offer. With `typed`, pressing the bet makes it a
field to type one in. One of the three items every bar shows (this, or ./BarBetButton.svelte).

Author: dwclake
Created: 2026-11-19
-->
<script lang="ts">
	import { flushSync } from "svelte";
	import { BET_ARRANGEMENTS, type BetArrangement } from "../bar-rules.ts";
	import { formatKero, parseKero } from "../kero.ts";
	import type { SegmentLook } from "../look.ts";
	import { dressItem, itemSize } from "./bar-item.ts";
	import { getBar } from "./bar-state.svelte.ts";
	import Mark from "./Mark.svelte";

	interface Props {
		/** How it looks: its ground, edge, corners and padding (../look.ts). Nothing round it, left out. */
		look?: SegmentLook;
		/** Its size against the rest of the bar: 0.5 to 2. */
		size?: number;
		/** The bet between minus and plus (`split`, left out), or plus over minus at one side. */
		arrange?: BetArrangement;
		/**
		 * Whether the bet can be typed, by pressing it. Left out, it cannot: the bet is one of
		 * those on offer. For the site's own table games, which take any amount.
		 */
		typed?: boolean;
	}

	let { look, size, arrange = "split", typed = false }: Props = $props();

	const bar = getBar("bet");

	$effect(() => {
		if (!BET_ARRANGEMENTS.includes(arrange))
			throw new Error(`The bet is arranged ${BET_ARRANGEMENTS.join(", ")}.`);
	});

	let typing = $state(false);
	let betOut = $state<HTMLButtonElement>();
	let betField = $state<HTMLInputElement>();

	/** The bet becomes a field to type one in. */
	function startTyping() {
		typing = true;
		// Drawn at once, so that the field is there to take the keyboard.
		flushSync();

		if (!betField) return;

		betField.value = formatKero(bar.stake);
		betField.focus();
		betField.select();
	}

	/**
	 * The field becomes the bet again. A bet the game cannot take is brought inside its
	 * limits; one that cannot be read is dropped.
	 */
	function stopTyping(keep: boolean) {
		if (!typing) return;

		const entered = parseKero(betField?.value ?? "");

		typing = false;
		flushSync();
		betOut?.focus();
		if (keep && entered !== null) bar.typeBet(entered);
	}
</script>

{#snippet betFace()}<span class="sdk-bar-label sdk-bar-betlabel">
		{#each bar.names as name}<span
				class={{ "sdk-bar-betlabel-on": name === bar.betName }}
			>
				{name}
			</span>{/each}
	</span><output>{formatKero(bar.cost ?? bar.stake)}</output>{/snippet}

<div
	class="sdk-bar-bet sdk-bar-segment"
	role="group"
	aria-label="Bet"
	data-segment="bet"
	{@attach dressItem(() => look)}
	data-arrange={arrange}
	style:--segment-scale={itemSize(size)}
>
	<button
		type="button"
		class="sdk-bar-button sdk-bar-minus"
		aria-label="Lower the bet"
		disabled={bar.locked || bar.lower === undefined}
		onclick={() => bar.setBet(bar.lower ?? bar.stake)}
	>
		<Mark name="minus" />
	</button>{#if typed}<button
			type="button"
			class="sdk-bar-readout sdk-bar-betvalue"
			bind:this={betOut}
			aria-label="{bar.betName} {formatKero(
				bar.cost ?? bar.stake
			)}. Press to type a bet."
			disabled={bar.locked}
			hidden={typing}
			onclick={startTyping}
		>
			{@render betFace()}
		</button><input
			class="sdk-bar-betfield"
			bind:this={betField}
			inputmode="decimal"
			autocomplete="off"
			aria-label="Bet"
			hidden={!typing}
			onkeydown={(event) => {
				if (event.key !== "Enter" && event.key !== "Escape") return;

				// Handled here: left to the browser, the same Enter presses the bet's button,
				// which focus has just moved back to, and opens the field again.
				event.preventDefault();
				stopTyping(event.key === "Enter");
			}}
			onblur={() => stopTyping(true)}
		/>{:else}<div class="sdk-bar-readout sdk-bar-betvalue">
			{@render betFace()}
		</div>{/if}<button
		type="button"
		class="sdk-bar-button sdk-bar-plus"
		aria-label="Raise the bet"
		disabled={bar.locked || bar.higher === undefined}
		onclick={() => bar.setBet(bar.higher ?? bar.stake)}
	>
		<Mark name="plus" />
	</button>
</div>
