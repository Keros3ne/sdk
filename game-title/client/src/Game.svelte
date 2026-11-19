<!--
Game Title, the game: what it knows (the balance, the round, the line of words), its two
views, wide and tall, which only draw that, and the SDK's control bar. It plays what the site hands it and decides nothing: a spin is one row
of the game's book, and the row's events are played here in order, by handlers that tell
the reels what to do and wait for them.

`host` is the site, or in a story something that plays rounds from the book in its place.

Author: dwclake
Created: 2026-11-18
-->
<script lang="ts">
	import { untrack } from "svelte";
	import type { BarHandle } from "@keros3ne/sdk/bar";
	import {
		Refusal,
		balanceBeforePayout,
		formatKero,
		type GameHost
	} from "@keros3ne/sdk/client";
	import { ControlBar } from "@keros3ne/sdk/controls";
	import { provideEmitter } from "@keros3ne/sdk/emitter";
	import { playEvents, type Handlers } from "@keros3ne/sdk/events";
	import { Views, type Shape } from "@keros3ne/sdk/shape";
	import { LINE_ROW, type Spin } from "../../maths/rules";
	import type { RoundView, RowEvent, StageEvent } from "./round.ts";
	import { NAMES } from "./symbols.ts";
	import TallView from "./TallView.svelte";
	import WideView from "./WideView.svelte";

	interface Props {
		host: GameHost<RoundView, null>;
		/** Follows the stage as it loads: a loading screen's `track`. */
		track?: <Work>(work: Promise<Work>) => Promise<Work>;
		/** Called once the game is ready to be played. */
		onready?: () => void;
		/** The view to show whatever shape the page has: for a story of one view. */
		show?: Shape;
	}

	let { host: given, track, onready, show }: Props = $props();

	// The site a game is played on does not change under it.
	const host = untrack(() => given);
	const { limits, reducedMotion } = host.init;

	const emitter = provideEmitter<StageEvent>();

	let balance = $state(host.init.balance);
	let busy = $state(false);
	let autoLeft = $state(0);
	let win = $state(0);
	let message = $state("Choose a bet and spin.");
	let bet = $state<number>();
	let bar = $state<BarHandle>();

	const wait = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

	/** Says something on the line of words, and to a screen reader. */
	function say(text: string) {
		message = text;
		host.announce(text);
	}

	/** What a row's events are played with: what the round paid, in cents, and the spin once played. */
	interface Playing {
		payout: number;
		spin: Spin | null;
	}

	/** Each of a row's events, played in order: the reels are told, and waited for. */
	const handlers: Handlers<RowEvent, Playing> = {
		async spin(event, playing) {
			await emitter.broadcast({
				type: "reelsSpin",
				reels: event.reels,
				pace: bar?.pace() ?? 1
			});
			if (event.win)
				await emitter.broadcast({
					type: "reelsWin",
					text: formatKero(playing.payout)
				});

			playing.spin = event;
		}
	};

	/** One spin at the bet the bar is set to. False when it was refused. */
	async function spin(): Promise<boolean> {
		if (busy || bet === undefined) return false;

		busy = true;
		win = 0;

		let played = false;

		try {
			const round = await host.open(bet, {});
			const playing: Playing = { payout: round.payout, spin: null };

			// The stake is seen to leave; the win is not, until it has been shown.
			balance = balanceBeforePayout(round);
			await playEvents(round.view.steps[0].events, handlers, { context: playing });

			balance = round.balance;
			win = round.payout;

			const shown = playing.spin!;
			const line = shown.reels.map((reel) => NAMES[reel[LINE_ROW]]).join(", ");

			say(
				shown.win
					? `Three of a kind, ${NAMES[shown.win.symbol]}: you won ${formatKero(round.payout)}.`
					: `${line}. No win.`
			);
			// The result has been shown: the site may now show the new balance.
			host.settled();
			played = true;
		} catch (error) {
			autoLeft = 0;
			say(
				error instanceof Refusal
					? error.message
					: "Something went wrong. Try again."
			);
		}

		busy = false;

		return played;
	}

	/** Spins by itself, until the plays run out or one is refused. */
	async function autoplay(count: number) {
		autoLeft = count;

		while (autoLeft > 0) {
			if (!(await spin())) break;

			autoLeft = Math.max(0, autoLeft - 1);
			if (autoLeft > 0) await wait(reducedMotion ? 300 : 250);
		}

		autoLeft = 0;
	}

	host.onBalance((next) => (balance = next));
</script>

<!-- The game is drawn twice over, once for each shape the site may give its frame, and the
     SDK shows the one for the shape it has. -->
<Views {show}>
	{#snippet wide()}<WideView
			{message}
			still={reducedMotion}
			{track}
			{onready}
		/>{/snippet}
	{#snippet tall()}<TallView
			{message}
			still={reducedMotion}
			{track}
			{onready}
		/>{/snippet}
</Views>

<!-- Every game has the SDK's control bar: the bet, the spin, autoplay, the speed, the balance
     and the last win. -->
<ControlBar
	bets={{ steps: [{ under: 100, by: 10 }, { under: 1_000, by: 100 }, { by: 1_000 }] }}
	startBet={100}
	{limits}
	play={{ label: "Spin", symbol: "spin" }}
	onplay={() => void spin()}
	autoplay={{
		noun: ["spin", "spins"],
		onstart: (count) => void autoplay(count),
		onstop: () => (autoLeft = 0)
	}}
	look={{ surface: "#0f2530", accent: "#ffd56b", onAccent: "#0f2530" }}
	{balance}
	{win}
	{busy}
	{autoLeft}
	bind:bet
	bind:bar
/>
