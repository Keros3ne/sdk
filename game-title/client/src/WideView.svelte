<!--
Game Title at 16 by 10, the shape every game has: its name and its line of words in a
column at the left, where a wide frame has room to spare, and the reels beside them. It
draws what the game hands it and keeps nothing of its own.

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

<main class="wide">
	<div class="words">
		<h1 class="title">Game Title</h1>
		<p class="message" id="message">{message}</p>
	</div>
	<Machine {still} {track} {onready} />
</main>

<style>
	.wide {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
		align-items: center;
		gap: 4vmin;
		height: calc(100% - var(--sdk-bar-bottom, 72px));
		padding: 3vmin 5vmin;
	}

	.words {
		display: grid;
		gap: 3vmin;
	}

	.title {
		margin: 0;
		font-size: clamp(20px, 7vmin, 48px);
		font-weight: 600;
		letter-spacing: 0.04em;
		color: var(--lamp);
	}

	.message {
		margin: 0;
		min-height: 2.8em;
		font-size: clamp(14px, 3vmin, 20px);
	}
</style>
