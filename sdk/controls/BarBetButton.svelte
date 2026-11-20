<!--
A control bar's bet as one button: the bet under its label, and pressed, a popup of every
bet on offer in a grid, which closes when one is chosen. It takes less room than minus and
plus (./BarBet.svelte), so the SDK's bar uses it on a narrow game.

Author: dwclake
Created: 2026-11-19
-->
<script lang="ts">
	import { formatKero } from "../kero.ts";
	import type { SegmentLook } from "../look.ts";
	import { dressItem, itemSize } from "./bar-item.ts";
	import { getBar, popupOpens } from "./bar-state.svelte.ts";
	import Choices from "./Choices.svelte";
	import Popup from "./Popup.svelte";

	interface Props {
		/** How it looks: its ground, edge, corners and padding (../look.ts). Nothing round it, left out. */
		look?: SegmentLook;
		/** Its size against the rest of the bar: 0.5 to 2. */
		size?: number;
		/** How many bets to a line in the popup. Four, left out. */
		columns?: number;
	}

	let { look, size, columns = 4 }: Props = $props();

	const bar = getBar("bet");
	const opens = popupOpens();

	let popup = $state<ReturnType<typeof Popup>>();
</script>

<div
	class="sdk-bar-bet sdk-bar-segment"
	role="group"
	aria-label="Bet"
	data-segment="bet"
	{@attach dressItem(() => look)}
	style:--segment-scale={itemSize(size)}
>
	<Popup
		bind:this={popup}
		label="Bet"
		title="Bet"
		class="sdk-bar-bets"
		buttonClass="sdk-bar-betbutton"
		opens={opens()}
		disabled={bar.locked}
		buttonProps={{
			"aria-label": `${bar.betName} ${formatKero(bar.cost ?? bar.stake)}. Press to choose a bet.`
		}}
	>
		{#snippet face()}<span class="sdk-bar-readout sdk-bar-betvalue">
				<span class="sdk-bar-label sdk-bar-betlabel">
					{#each bar.names as name}<span
							class={{ "sdk-bar-betlabel-on": name === bar.betName }}
						>
							{name}
						</span>{/each}
				</span><output>{formatKero(bar.cost ?? bar.stake)}</output>
			</span>{/snippet}
		<Choices
			label="Bet"
			grid={columns}
			options={bar.bets.map((value) => ({ value, label: formatKero(value) }))}
			value={bar.stake}
			onchange={(value) => bar.setBet(value)}
			onpick={() => popup?.close()}
		/>
	</Popup>
</div>

<style>
	/* The bet as one button, which opens the bets on offer: a pill of the buttons' glass. */
	:global(.sdk-bar-frame .sdk-bar-betbutton) {
		min-height: calc(52px * var(--s));
		padding: 0 calc(12px * var(--s));
		border: 1px solid var(--bar-line, rgb(255 255 255 / 0.22));
		border-radius: 999px;
		background: var(--bar-button, rgb(255 255 255 / 0.1));
		box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.22);
		color: inherit;
	}
	:global(.sdk-bar-frame .sdk-bar-betbutton .sdk-bar-betvalue) {
		min-width: calc(36px * var(--s));
	}
	:global(.sdk-bar-frame .sdk-bar-betbutton .sdk-bar-label) {
		color: color-mix(in srgb, var(--bar-ink, #f4f1f2) 82%, transparent);
	}
	:global(.sdk-bar-frame .sdk-bar-betbutton output) {
		font-size: calc(17px * var(--s));
	}
	:global(.sdk-bar-frame .sdk-bar-bets .sdk-choices-row) {
		max-height: 232px;
		overflow-y: auto;
	}
	:global(.sdk-bar-frame .sdk-bar-bets .sdk-choice) {
		padding: 0 6px;
		font-variant-numeric: tabular-nums;
	}

	/* Open: its edge and its figures in the colour of what is on. */
	:global(.sdk-bar-frame .sdk-bar-betbutton[aria-expanded="true"]) {
		border-color: var(--bar-on, #d49791);
		color: var(--bar-on, #d49791);
	}
</style>
