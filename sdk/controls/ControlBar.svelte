<!--
The SDK's control bar: a dock along the foot of the game, of the SDK's own items. The menu,
the balance and the bet at one side, play in its dead centre, autoplay and the speed of
play after it, and the last win.

It is laid out one way, whatever size the game is shown at: a game is drawn at the size of
its view (../WideView.svelte, ../TallView.svelte) and scaled as a whole, so nothing here
measures the screen. What suits a view is said by the view, through props: `betAs="menu"`
makes the bet one button that opens the bets on offer, and `readouts="strip"` puts the
balance and the last win in a strip along the game's other edge. A tall view passes both;
a wide one neither.

What the bar shows is a prop (the balance, the last win, whether a round is under way),
what the player sets comes back (`bind:bet`), and `bind:bar` hands over the bar itself,
for the speed of play (`bar.pace()`) and the room it takes (`bar.inset()`):

    <ControlBar
      bets={[20, 40, 60, 80, 100]} startBet={100} limits={host.init.limits}
      play={{ label: "Spin", symbol: "spin" }} onplay={spin}
      balance={balance} win={won} busy={spinning} bind:bet bind:bar
    />

A studio dresses it through `look` (its colours and typefaces, how round its buttons are,
a tint for its glass), sizes it with `scale`, puts it along the top with `place`, and may
leave out the menu or the win with `hide`. A bar laid out another way is a studio's own,
made of the same items in a `BarFrame` (./BarFrame.svelte).

Author: dwclake
Created: 2026-11-17
-->
<script lang="ts">
	import type { Snippet } from "svelte";
	import type { BarHandle, BarItem, Hideable } from "../bar-rules.ts";
	import type { BarLook } from "../look.ts";
	import type { BarOptions } from "./bar-state.svelte.ts";
	import BarAutoplay from "./BarAutoplay.svelte";
	import BarBalance from "./BarBalance.svelte";
	import BarBet from "./BarBet.svelte";
	import BarBetButton from "./BarBetButton.svelte";
	import BarFrame from "./BarFrame.svelte";
	import BarMenu from "./BarMenu.svelte";
	import BarPart from "./BarPart.svelte";
	import BarPlay from "./BarPlay.svelte";
	import BarSpeed from "./BarSpeed.svelte";
	import BarWin from "./BarWin.svelte";

	interface Props extends BarOptions {
		/** How the bar looks: its colours, typefaces, buttons and tint (../look.ts). It may change. */
		look?: BarLook;
		/** Along the bottom of the game (left out), or along the top. */
		place?: "bottom" | "top";
		/** Its size against the usual: from 0.8 to 2.5. A tall view's is about twice a wide one's. */
		scale?: number;
		/**
		 * How the bet is chosen: stepped with a minus and a plus beside its figure (left out),
		 * or as one button that opens the bets on offer, which takes less room. A game's view
		 * says which suits it.
		 */
		betAs?: "steps" | "menu";
		/**
		 * Where the balance and the last win are read: in the bar (left out), or in a strip of
		 * their own along the game's other edge, which leaves the bar to its buttons. A game's
		 * view says which suits it.
		 */
		readouts?: "bar" | "strip";
		/** What to leave out: the menu (and the volume in it) and the last win, only. */
		hide?: Hideable[];
		/** Whether the bet can be typed, by pressing it: for the site's own table games. */
		typed?: boolean;
		/** What the bar is placed in and measured against: the page, or the element it is written in. */
		within?: "page" | "parent";
		/** The player's balance, in cents. */
		balance: number;
		/** What the last play won, in cents: 0 when a play starts, and what it won once that is shown. */
		win?: number;
		/** While a round is played or shown: the bet cannot be changed, nor play pressed. */
		busy?: boolean;
		/** How many plays of autoplay are left, as the game counts them down. */
		autoLeft?: number;
		/** What the next play will cost, when that is not the bet itself. `null` for the bet. */
		cost?: number | null;
		/** What the bet is called, one of `betLabels`. `null` for "Bet". */
		betLabel?: string | null;
		/** Free spins left, shown on the play button. `null` gives the button back. */
		freeSpins?: number | null;
		/** More about the play button for a screen reader. */
		playDescription?: string;
		/** Out: the bet chosen, in cents. */
		bet?: number;
		/** Out: the bar itself. */
		bar?: BarHandle;
		/** Called once the bar is made and in the page. */
		onready?: (bar: BarHandle) => void;
		/** More for the menu, under the volume. */
		menu?: Snippet;
	}

	let {
		look,
		place = "bottom",
		betAs = "steps",
		readouts = "bar",
		hide = [],
		typed = false,
		bet = $bindable(),
		bar = $bindable(),
		menu,
		...rest
	}: Props = $props();

	$effect.pre(() => {
		for (const item of hide)
			if (item !== "menu" && item !== "win")
				throw new Error(`The bar's ${item} cannot be hidden: only menu and win.`);
	});

	/** One item's look, where the bar's look says one for it. */
	const of = (item: BarItem) => look?.segments?.[item];
	const shows = (item: Hideable) => !hide.includes(item);
	/** The edge across from the bar, where a narrow game's balance and win are. */
	const across = $derived(place === "top" ? "bottom" : "top");
</script>

<BarFrame {...rest} {look} bind:bet bind:bar>
	{#if readouts === "strip"}
		<!-- What the player reads, along the other edge of the game. -->
		<BarPart edge={across} class="sdk-bar-strip" label="Balance and last win">
			<BarBalance look={of("balance")} />{#if shows("win")}<BarWin
					look={of("win")}
				/>{/if}
		</BarPart>
	{/if}
	<BarPart
		edge={place}
		class={readouts === "strip" ? "sdk-bar sdk-bar-alone" : "sdk-bar"}
	>
		<div class="sdk-bar-left">
			{#if shows("menu")}<BarMenu look={of("menu")}>
					{@render menu?.()}
				</BarMenu>{/if}
			{#if readouts === "bar"}<BarBalance look={of("balance")} />{/if}
			{#if betAs === "menu"}
				<BarBetButton look={of("bet")} />
			{:else}
				<BarBet look={of("bet")} {typed} />
			{/if}
		</div>
		<BarPlay look={of("play")} />
		<div class="sdk-bar-right">
			<!-- Autoplay and speed after play, together, so play alone is the bar's middle. -->
			<div class="sdk-bar-pace">
				<BarAutoplay look={of("autoplay")} /><BarSpeed look={of("speed")} />
			</div>
			{#if readouts === "bar" && shows("win")}<BarWin look={of("win")} />{/if}
		</div>
	</BarPart>
</BarFrame>
