<!--
Game Title at 9 by 16, a phone's shape: its name over the reels, which take the frame's
width, and its line of words under them. A game has this view only if it says so
(`"shapes": ["wide", "tall"]` in game.json); without one it is shown wide on a phone.

Author: dwclake
Created: 2026-11-19
-->
<script lang="ts">
	import Machine from "./Machine.svelte";

	interface Props {
		/** The line of words: what just happened. */
		message: string;
		still: boolean;
		track?: <Work>(work: Promise<Work>) => Promise<Work>;
		onready?: () => void;
	}

	let { message, still, track, onready }: Props = $props();
</script>

<main class="tall">
	<h1 class="title">Game Title</h1>
	<Machine {still} {track} {onready} />
	<p class="message" id="message">{message}</p>
</main>

<style>
	.tall {
		display: grid;
		grid-template-rows: auto 1fr auto;
		justify-items: center;
		align-items: center;
		gap: 5vmin;
		height: calc(100% - var(--sdk-bar-bottom, 72px));
		padding: 8vmin 4vmin 3vmin;
	}

	.title {
		margin: 0;
		font-size: clamp(18px, 8vmin, 36px);
		font-weight: 600;
		letter-spacing: 0.04em;
		color: var(--lamp);
	}

	.message {
		margin: 0;
		min-height: 2.8em;
		text-align: center;
		font-size: clamp(14px, 4vmin, 20px);
	}
</style>
